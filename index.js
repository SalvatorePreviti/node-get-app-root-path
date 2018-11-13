const fs = require('fs')
const path = require('path')

let appRootPathValue

function doNothing() {}

function loadAppRootPath() {
  let result
  const dir = path.resolve(__dirname)

  // eslint-disable-next-line global-require
  if ((require('module').globalPaths || []).some(x => dir.indexOf(x) === 0)) {
    result = path.dirname(require.main.filename)
    const npmGlobalModuleDir = path.resolve(
      process.platform === 'win32' ? path.dirname(process.execPath) : path.dirname(path.dirname(process.execPath)),
      'lib',
      'node_modules'
    )
    if (result.indexOf(npmGlobalModuleDir) !== -1 && result.indexOf(`${path.sep}bin`) === result.length - 4) {
      result = result.slice(0, -4)
    }
  } else {
    const nodeModulesDir = `${path.sep}node_modules`
    if (dir.indexOf(nodeModulesDir) !== -1) {
      result = dir.split(nodeModulesDir)[0]
    }
    if (result === undefined) {
      result = path.dirname(require.main.filename)
    }
  }

  if (!result) {
    result = process.cwd() || '.'
  }

  try {
    let bestChoice = result
    let current = result
    for (;;) {
      if (fs.existsSync(path.join(current, 'package.json'))) {
        bestChoice = current
        if (current.indexOf(`${path.sep}node_modules${path.sep}`) <= 0) {
          break
        }
      }
      const parent = path.dirname(current)
      if (!parent || parent === current) {
        break
      }
      current = parent
    }
    result = bestChoice
  } catch (e) {
    // Ignore error
  }
  return result
}

/**
 * Sets the app root path value
 *
 * @param {string|undefined} value The new app root path value.
 * @returns {void}
 */
function setAppRootPath(value) {
  if (!value) {
    value = undefined
  } else if (typeof value !== 'string') {
    throw new TypeError('setAppRootPath requires a string')
  }
  appRootPathValue = value
}

/**
 * Gets the app root path (the root folder for the application)
 *
 * @returns {string} The app root path, the root folder for the application
 */
function getAppRootPath() {
  if (appRootPathValue) {
    return appRootPathValue
  }

  if (process.env.APP_ROOT_PATH) {
    return path.resolve(process.env.APP_ROOT_PATH)
  }

  appRootPathValue = loadAppRootPath()
  return appRootPathValue
}

/**
 * Gets the "module" object for the given module or file name
 *
 * @param {*} module The module
 * @returns {*} The NodeJS module object.
 */
function getModule(module) {
  let mpath
  if (typeof module === 'string') {
    mpath = require.resolve(module)
    const found = require.cache[mpath]
    if (found) {
      module = found
    } else {
      // eslint-disable-next-line global-require
      require(module)
      module = require.cache[mpath]
    }
  }

  if (typeof module !== 'object' || module === null) {
    return undefined
  }

  if (!module.filename) {
    module.filename = mpath
  }

  if (typeof module !== 'object') {
    return undefined
  }

  return module
}

/**
 * Makes a module unloadable.
 * Useful to override proxyquire behaviour or other scripts that tries to unload modules.
 *
 * @param {NodeModule|string} module The module to make unloadable
 * @param {*} [exports=undefined] If not undefined, overrides the module.exports
 * @returns {*} The module
 */
function makeModuleUnloadable(module, exports = undefined) {
  let m = module
  try {
    m = getModule(module)
    if (m === undefined) {
      return m
    }

    m.loaded = true

    if (exports === undefined) {
      exports = m.exports
    }

    const key = m.filename
    if (key) {
      Object.defineProperty(require.cache, key, {
        get() {
          return m
        },
        set: doNothing,
        configurable: false,
        enumerable: false
      })
    }
  } catch (e) {
    return module
  }
  return m
}

/**
 * Given an absolute path, returns the shortest path to the app root path.
 * This function does nothing if the given path is not absolute.
 *
 * @param {string} file The path to relativize.
 * @returns {string} The relativize or absolute path (depending which one is shorter)
 */
function shortenPath(file) {
  if (path.isAbsolute(file)) {
    let relativized = path.relative(getAppRootPath(), file)
    if (!relativized.startsWith('.') && !relativized.startsWith(file.sep)) {
      relativized = `.${path.sep}${relativized}`
    }
    if (relativized.length < file.length) {
      file = relativized
    }
  }
  return file
}

getAppRootPath.path = ''
getAppRootPath.makeModuleUnloadable = makeModuleUnloadable
getAppRootPath.shortenPath = shortenPath
getAppRootPath.getModule = getModule

Object.defineProperties(getAppRootPath, {
  path: { get: getAppRootPath, set: setAppRootPath, configurable: true, enumerable: true },
  toJSON: { value: getAppRootPath, enumerable: false, writable: true, configurable: true },
  valueOf: { value: getAppRootPath, enumerable: false, writable: true, configurable: true },
  toString: { value: getAppRootPath, enumerable: false, writable: true, configurable: true },
  makeModuleUnloadable: { value: makeModuleUnloadable, enumerable: false, writable: true, configurable: true },
  shortenPath: { value: shortenPath, enumerable: false, writable: true, configurable: true },
  getModule: { value: getModule, enumerable: false, writable: true, configurable: true }
})

module.exports = getAppRootPath

makeModuleUnloadable(module)
