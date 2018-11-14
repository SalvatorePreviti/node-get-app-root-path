const fs = require('fs')
const path = require('path')

/** @type {string|undefined} */
let appRootPathValue

function doNothing() {}

/**
 * Checks if a directory is in the global node paths.
 *
 * @param {string} dir The directory to check
 * @returns {boolean} True if the given directory is in a global node path, false if not
 */
function isGlobalDirectory(dir) {
  /** @type {any} */
  // eslint-disable-next-line global-require
  const m = require('module')
  const globalPaths = m.globalPaths
  if (Array.isArray(globalPaths)) {
    const len = globalPaths.length
    for (let i = 0; i < len; ++i) {
      const globalPath = globalPaths[i]
      if (dir.indexOf(globalPath) === 0) {
        return true
      }
    }
  }
  return false
}

/** @returns {string} Computes the app root path. */
function loadAppRootPath() {
  let result
  const dir = path.resolve(__dirname)

  const requireMain = require.main

  // eslint-disable-next-line global-require
  if (requireMain && isGlobalDirectory(dir)) {
    result = path.dirname(requireMain.filename)
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
    if (result === undefined && requireMain) {
      result = path.dirname(requireMain.filename)
    }
  }

  try {
    if (!result) {
      result = process.cwd()
      if (!result) {
        return ''
      }
    }

    // eslint-disable-next-line global-require
    const homeDir = require('os').homedir() || path.resolve('/')

    let bestChoice = result
    for (let current = result; ; ) {
      if (current === homeDir || current === '/var/task') {
        break
      }
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

  return result || ''
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
  let result = appRootPathValue
  if (!result) {
    result = process.env.APP_ROOT_PATH
    if (result) {
      return path.resolve(result)
    }
    result = loadAppRootPath()
    appRootPathValue = result
  }
  return result
}

/**
 * Gets the "module" object for the given module or file name
 *
 * @param {string|NodeJS.Module|{filename:string}|*} module The module
 * @param {boolean} [canRequire=true] True if the module can be loaded if it does not exists
 * @returns {NodeJS.Module|undefined} The NodeJS module object.
 */
function getModule(module, canRequire = true) {
  const cache = require.cache
  if (!cache) {
    return undefined
  }

  if (typeof module === 'string') {
    let found = cache[module]
    if (typeof found === 'object' && found !== null) {
      return found
    }

    try {
      if (!path.isAbsolute(module)) {
        found = cache[require.resolve(module)]
      }
    } catch (error) {
      // Ignore error
    }

    if (typeof found === 'object' && found !== null) {
      return found
    }

    if (canRequire) {
      try {
        // eslint-disable-next-line global-require
        require(module)
      } catch (error) {
        return undefined
      }

      found = cache[module]
      if (typeof found === 'object' && found !== null) {
        return found
      }

      try {
        if (!path.isAbsolute(module)) {
          found = cache[require.resolve(module)]
        }
      } catch (error) {
        // Ignore error
      }

      if (typeof found === 'object' && found !== null) {
        return found
      }
    }
  }

  if (typeof module !== 'object' || module === null) {
    return undefined
  }

  const filename = module.filename
  if (typeof filename === 'string') {
    const found = cache[filename]
    if (typeof found === 'object' && found !== null) {
      return found
    }
  }

  return module
}

/**
 * Makes a module unloadable.
 * Useful to override proxyquire behaviour or other scripts that tries to unload modules.
 *
 * @param {string|NodeJS.Module|{filename:string}|*} module The module to make unloadable
 * @param {*} [exports=undefined] If not undefined, overrides the module.exports
 * @returns {NodeJS.Module|undefined} The module
 */
function makeModuleUnloadable(module, exports) {
  let m = module
  try {
    m = getModule(module)
    if (!m) {
      return m
    }

    m.loaded = true
    m.unloadable = true

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
 * Unloads a module.
 *
 * @param {string|NodeJS.Module|{filename:string}|*} module The module to unload
 * @returns {boolean} True if the module was unloaded, false if not
 */
function unloadModule(module) {
  try {
    if (!module) {
      return false
    }

    const cache = require.cache
    if (!cache) {
      return false
    }

    module = getAppRootPath.getModule(module, false)
    if (typeof module !== 'object' || module === null) {
      return false
    }

    if (module.unloadable) {
      return false
    }

    const filename = module.filename
    if (typeof filename !== 'string' || filename.length === 0) {
      return false
    }

    if (filename.endsWith('.node')) {
      return false
    }

    const descriptor = Object.getOwnPropertyDescriptor(cache, filename)
    if (descriptor && (!descriptor.enumerable || !descriptor.value)) {
      return false
    }

    if (cache[filename] !== module) {
      return false
    }

    return delete cache[filename]
  } catch (error) {
    return false
  }
}

/**
 * Unload all NodeJS modules (except the unloadable modules)
 *
 * @returns {number} The total number of unloaded modules
 */
function unloadAllModules() {
  let result = 0
  const cache = require.cache
  if (cache) {
    const keys = Object.keys(cache)
    const keysLen = keys.length
    for (let i = 0; i < keysLen; ++i) {
      if (getAppRootPath.unloadModule(keys[i])) {
        ++result
      }
    }
  }
  return result
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
    if (!relativized.startsWith('.') && !relativized.startsWith(path.sep)) {
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
getAppRootPath.unloadModule = unloadModule
getAppRootPath.unloadAllModules = unloadAllModules
getAppRootPath.getAppRootPath = getAppRootPath
getAppRootPath.setAppRootPath = setAppRootPath

Object.defineProperties(getAppRootPath, {
  path: { get: getAppRootPath, set: setAppRootPath, configurable: true, enumerable: true },
  toJSON: { value: getAppRootPath, enumerable: false, writable: true, configurable: true },
  valueOf: { value: getAppRootPath, enumerable: false, writable: true, configurable: true },
  toString: { value: getAppRootPath, enumerable: false, writable: true, configurable: true },
  getAppRootPath: { value: getAppRootPath, enumerable: false, writable: true, configurable: true },
  setAppRootPath: { value: setAppRootPath, enumerable: false, writable: true, configurable: true },
  makeModuleUnloadable: { value: makeModuleUnloadable, enumerable: false, writable: true, configurable: true },
  shortenPath: { value: shortenPath, enumerable: false, writable: true, configurable: true },
  getModule: { value: getModule, enumerable: false, writable: true, configurable: true },
  unloadModule: { value: unloadModule, enumerable: false, writable: true, configurable: true },
  unloadAllModules: { value: unloadAllModules, enumerable: false, writable: true, configurable: true }
})

module.exports = getAppRootPath

makeModuleUnloadable(module)
