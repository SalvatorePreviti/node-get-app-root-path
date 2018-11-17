import fs = require('fs')
import path = require('path')
import cjs = require('module')

const nodeRequire = require

let _appRootPath: string | undefined

/**
 * Gets the application root path.
 * @returns {string} The application root path
 */
function getAppRootPath(): string {
  let result = process.env.APP_ROOT_PATH
  if (result) {
    return path.resolve(result)
  }
  result = _appRootPath
  if (result === undefined) {
    result = loadAppRootPath()
    _appRootPath = result
  }
  return result
}

/**
 * @type {string} Gets or sets the app root path.
 */
getAppRootPath.path = ''

namespace getAppRootPath {
  const _Error = Error
  const _captureStackTrace = _Error.captureStackTrace

  export type ModuleLocation = string | string[] | { filename?: string | null | undefined; paths?: string[] } | Function | null | undefined
  export interface GenericNodeModule<Exports = any> extends NodeModule {
    exports: Exports
  }

  export const initialCwd: string = process.cwd()

  export function shortenPath(file: string, rootDir: string = getAppRootPath()): string {
    file = path.normalize(file)
    try {
      if (path.isAbsolute(file)) {
        let p = path.normalize(path.relative(rootDir, file))
        if (!p.startsWith('.') && !p.startsWith(path.sep)) {
          p = `.${path.sep}${p}`
        }
        if (p.length < file.length) {
          file = p
        }
      }
    } catch (_error) {
      // Ignore error
    }
    return file
  }

  /**
   * Sets the application root path.
   * @export
   * @param {string} value The application root path. Must be a valid string.
   * @returns {void}
   */
  export function setAppRootPath(value: string): void {
    if (typeof value !== 'string') {
      throw new TypeError('app root path must be a string')
    }
    value = path.resolve(value)
    _appRootPath = value
    try {
      process.env.APP_ROOT_PATH = value
    } catch (_error) {
      // Ignore error
    }
  }

  /**
   * Gets the filename of the caller function.
   * @export
   * @param {(Function | undefined | null)} [location] The optional caller function in the stack.
   * @returns {string} The file path location of the caller function.
   */
  export function getCallerFile(location?: Function | undefined | null): string {
    const oldPrepare = Error.prepareStackTrace
    const oldLimit = Error.stackTraceLimit
    try {
      _Error.stackTraceLimit = 1
      _Error.prepareStackTrace = captureCallerFileName
      const obj = {} as { stack?: string }
      _captureStackTrace(obj, typeof location === 'function' ? location : getCallerFile)
      return obj.stack || __filename
    } finally {
      _Error.prepareStackTrace = oldPrepare
      _Error.stackTraceLimit = oldLimit
    }
  }

  /**
   * Gets the directory that contains the filename of the caller function.
   * @export
   * @param {(Function | undefined | null)} [location] The optional caller function in the stack.
   * @returns {string} The directory path location of the caller function.
   */
  export function getCallerDir(location?: Function | string | undefined | null): string {
    if (typeof location === 'string') {
      if (path.isAbsolute(location)) {
        return getDirFromPath(location)
      }
      return location.startsWith('.')
        ? getDirFromPath(path.join(path.dirname(getCallerFile(getCallerDir)), location))
        : path.resolve(path.normalize(location))
    }
    return path.dirname(getCallerFile(typeof location === 'function' ? location : getCallerDir))
  }

  /**
   * Dynamic node module require.
   * Throws if module cannot be loaded.
   * @export
   * @param {string} [id] The node module or path to require.
   * @param {ModuleLocation} [location] The optional reference location for looking up the module. Can be a path, an array of paths or a function in the stack.
   * @returns {*} The required module exports
   * @throws {Error} Throws if the module was not found or it was not possible to load.
   */
  export function require(id: string, location?: ModuleLocation): any {
    if (typeof id !== 'string') {
      throw new TypeError('The "id" argument must be of type string. Received type number')
    }
    if (id.length === 0) {
      throw new TypeError("The argument 'id' must be a non-empty string. Received ''")
    }
    if (path.isAbsolute(id)) {
      return nodeRequire(id)
    }
    if (Array.isArray(location)) {
      location = { paths: location }
    }
    let paths
    if (typeof location === 'object' && location !== null) {
      paths = location.paths
      location = location.filename
    }
    const callerDir = getCallerDir(typeof location === 'function' || typeof location === 'string' ? location : resolve)
    if (id.startsWith('.')) {
      id = path.normalize(path.join(callerDir, id))
      return nodeRequire(id)
    }
    const customRequire = cjs.createRequireFromPath(callerDir) as typeof nodeRequire
    if (Array.isArray(paths) && paths.length !== 0) {
      try {
        const resolved = customRequire.resolve(id, { paths })
        if (resolved) {
          return nodeRequire(resolved)
        }
      } catch (_error) {
        // Ignore error
      }
    }
    return customRequire(id)
  }

  /**
   * Dynamic node module require.
   * Returns undefined if module cannot be loaded.
   * @export
   * @param {string} [id] The node module or path to require.
   * @param {ModuleLocation} [location] The optional reference location for looking up the module. Can be a path, an array of paths or a function in the stack.
   * @returns {*} The required module exports or undefined if not found or load failed.
   */
  export function tryRequire(id?: string | null | undefined, location?: ModuleLocation): any {
    if (typeof id === 'string' && id.length !== 0) {
      try {
        return require(id, location !== null && location !== undefined ? location : tryRequire)
      } catch (_error) {
        // Ignore error
      }
    }
    return undefined
  }

  /**
   * Resolves a node module path. Throws if the module was not found
   * @export
   * @param {string} id The node module or path to resolve.
   * @param {ModuleLocation} [location] The optional reference location for looking up the module. Can be a path, an array of paths or a function in the stack.
   * @returns {string} The module full path.
   * @throws {Error} Throws if the module coult not be found.
   */
  export function resolve(id: string, location?: ModuleLocation): string {
    if (typeof id !== 'string') {
      throw new TypeError('The "id" argument must be of type string. Received type number')
    }
    if (id.length === 0) {
      throw new TypeError("The argument 'id' must be a non-empty string. Received ''")
    }
    if (path.isAbsolute(id)) {
      return nodeRequire.resolve(id)
    }
    if (Array.isArray(location)) {
      location = { paths: location }
    }
    let paths
    if (typeof location === 'object' && location !== null) {
      paths = location.paths
      location = location.filename
    }
    const callerDir = getCallerDir(typeof location === 'function' || typeof location === 'string' ? location : resolve)
    if (id.startsWith('.')) {
      id = path.normalize(path.join(callerDir, id))
      return nodeRequire.resolve(id)
    }
    const customRequire = cjs.createRequireFromPath(callerDir) as typeof nodeRequire
    if (Array.isArray(paths) && paths.length !== 0) {
      return customRequire.resolve(id, { paths })
    }
    return customRequire.resolve(id)
  }

  /**
   * Tries to resolve a module path. Returns undefined if the module was not found.
   * @export
   * @param {(string | null | undefined)} id The node module or path to resolve.
   * @param {ModuleLocation} [location] The optional reference location for looking up the module. Can be a path, an array of paths or a function in the stack.
   * @returns {(string | undefined)} The module full path or undefined if not found.
   */
  export function tryResolve(id: string | null | undefined, location?: ModuleLocation): string | undefined {
    if (typeof id === 'string' && id.length !== 0) {
      try {
        return resolve(id, location !== null && location !== undefined ? location : tryResolve)
      } catch (_error) {
        // Ignore error
      }
    }
    return undefined
  }

  /**
   * Gets a node module from cache. Returns undefined if module was not found.
   * @export
   * @param {(string | NodeModule | null | undefined)} id The node module or path to resolve.
   * @param {ModuleLocation} [location] The optional reference location for looking up the module. Can be a path, an array of paths or a function in the stack.
   * @returns {(NodeModule | undefined)} The cached node module or undefined.
   */
  export function getLoadedModule(id: string | NodeModule | null | undefined, location?: ModuleLocation): NodeModule | undefined {
    let result
    if (typeof id === 'object' && id !== null) {
      result = id
      id = (id as any).filename
    }
    const cache = nodeRequire.cache
    if (cache) {
      if (id === undefined) {
        id =
          typeof location === 'string' ? path.resolve(location) : getCallerFile(typeof location === 'function' ? location : getLoadedModule)
      }
      if (typeof id === 'string' && id.length !== 0) {
        let resolved
        try {
          resolved = resolve(id, location !== null && location !== undefined ? location : tryResolve)
          const found = cache[resolved]
          if (typeof found === 'object' && found !== null) {
            return found
          }
        } catch (_error) {
          // Ignore error
        }
      }
    }

    return result
  }

  /**
   * Requires a NodeJS module. Instead of returing the module exports, returns the module itself.
   * Throws an error if the module could not be found or is a builtin module.
   * @export
   * @param {string} id The id of the module to load.
   * @param {ModuleLocation} [location] The optional reference location for looking up the module. Can be a path, an array of paths or a function in the stack.
   * @returns {NodeJS.Module} The NodeJS module.
   * @throws {Error} Throws if the module coult not be loaded or is a builtin module.
   */
  export function requireModule(id: string, location?: ModuleLocation): NodeJS.Module {
    if (location === null || location === undefined) {
      location = requireModule
    }
    if (typeof location === 'function') {
      location = getCallerDir(location)
    }
    let cached = getLoadedModule(id, location)
    if (cached !== undefined) {
      return cached
    }
    const cache = nodeRequire.cache
    if (!cache) {
      throw new Error('require.cache is not valid')
    }
    require(id, location)
    cached = getLoadedModule(id, location)
    if (!cached) {
      throw new TypeError(`could not get module '${id}'`)
    }
    return cached
  }

  /**
   * Tries to requires a NodeJS module. Instead of returing the module exports, returns the module itself.
   * Returns undefined if the module could not be found or is a builtin module.
   * @export
   * @param {string} id The id of the module to load.
   * @param {ModuleLocation} [location] The optional reference location for looking up the module. Can be a path, an array of paths or a function in the stack.
   * @returns {(NodeJS.Module | undefined)} The NodeJS module or undefined if not found
   */
  export function tryRequireModule(id: string | null | undefined, location?: ModuleLocation): NodeJS.Module | undefined {
    if (typeof id !== 'string' || id.length === 0) {
      return undefined
    }
    if (location === null || location === undefined) {
      location = tryRequireModule
    }
    if (typeof location === 'function') {
      location = getCallerDir(location)
    }
    const cached = getLoadedModule(id, location)
    if (cached !== undefined) {
      return cached
    }
    const cache = nodeRequire.cache
    if (!cache) {
      return undefined
    }
    try {
      require(id, location)
    } catch (_error) {
      // Ignore error
    }
    return getLoadedModule(id, location)
  }

  /**
   * Unloads a node module from node module require cache.
   * @export
   * @param {(string | NodeModule)} module The node module to unload from require cache.
   * @param {ModuleLocation} [location] The optional reference location for looking up the module. Can be a path, an array of paths or a function in the stack.
   * @returns {boolean} True if the module was unloaded during this call, false if not.
   */
  export function unloadModule(module: string | NodeModule, location?: ModuleLocation): boolean {
    try {
      const cache = nodeRequire.cache
      if (!cache) {
        return false
      }
      const found = getLoadedModule(module, location)
      if (typeof found !== 'object' || found === null || (found as any).unloadable) {
        return false
      }
      const filename = found.filename
      if (typeof filename !== 'string' || filename.length === 0 || filename.endsWith('.node')) {
        return false
      }
      const descriptor = Object.getOwnPropertyDescriptor(cache, filename)
      if ((descriptor && (!descriptor.enumerable || !descriptor.value)) || (typeof found === 'object' && cache[filename] !== found)) {
        return false
      }
      return delete cache[filename]
    } catch (error) {
      return false
    }
  }

  /**
   * Unloads all cached modules (excluding non unloadable modules).
   * @export
   * @returns {number} The number of unloaded modules.
   */
  export function unloadAllModules(): number {
    let result = 0
    const cache = nodeRequire.cache
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

  export function makeModuleUnloadable(module: string, exports?: any, location?: ModuleLocation): NodeModule | undefined
  export function makeModuleUnloadable<Exports = any>(
    module: NodeModule,
    exports: Exports,
    location?: ModuleLocation
  ): GenericNodeModule<Exports>
  export function makeModuleUnloadable<Module extends {} = NodeModule>(
    module: Module,
    exports?: undefined,
    location?: ModuleLocation
  ): Module
  export function makeModuleUnloadable(module: any, exports?: any, location?: ModuleLocation): NodeModule | undefined {
    let m = module
    try {
      if (typeof m !== 'object' || !m.filename) {
        m = tryRequireModule(m, location)
        if (!m) {
          return module
        }
      }
      if (m.unloadable) {
        return m
      }
      m.loaded = true
      m.unloadable = true
      if (exports !== undefined) {
        m.exports = exports
      }
      const key = m.filename
      if (key) {
        Object.defineProperty(nodeRequire.cache, key, {
          get() {
            return m
          },
          set: doNothing,
          configurable: false,
          enumerable: false
        })
      }
    } catch (e) {
      // Ignore error
    }
    return m
  }

  Object.defineProperties(getAppRootPath, {
    path: {
      get: getAppRootPath,
      set(value) {
        getAppRootPath.setAppRootPath(value)
      },
      enumerable: true,
      configurable: false
    },
    toJSON: { value: getAppRootPath, enumerable: false, configurable: true, writable: true }
  })

  function getDirFromPath(location: string): string {
    location = path.resolve(location)
    try {
      const stats = fs.lstatSync(location)
      if (stats.isFile()) {
        return path.dirname(location)
      }
    } catch (_error) {
      // Ignore error
    }
    return location
  }

  function captureCallerFileName(_error: any, callsites: NodeJS.CallSite[]) {
    const callsite = callsites[0]
    return (callsite && callsite.getFileName()) || ''
  }

  function doNothing() {}
}

function isGlobalDirectory(dir: any): boolean {
  if (typeof dir !== 'string') {
    return false
  }
  const globalPaths = (cjs as { globalPaths?: string[] }).globalPaths
  if (!globalPaths) {
    return false
  }
  const len = globalPaths.length
  for (let i = 0; i < len; ++i) {
    const globalPath = globalPaths[i]
    if (dir.indexOf(globalPath) === 0) {
      return true
    }
  }
  return false
}

function loadAppRootPath(): string {
  const env = process.env
  if (env.LAMBDA_TASK_ROOT && env.AWS_EXECUTION_ENV && env.AWS_LAMBDA_FUNCTION_NAME && path.sep === '/') {
    try {
      if (fs.existsSync(env.LAMBDA_TASK_ROOT)) {
        return env.LAMBDA_TASK_ROOT
      }
    } catch (e) {
      // Ignore error
    }
  }
  let result = path.resolve(__dirname)
  if (!env.VSCODE_PID || !env.VSCODE_IPC_HOOK) {
    try {
      const r = nodeRequire.main
      if (r && typeof r.filename === 'string' && isGlobalDirectory(result)) {
        result = path.dirname(r.filename)
        const npmGlobalModuleDir = path.resolve(
          process.platform === 'win32' ? path.dirname(process.execPath) : path.dirname(path.dirname(process.execPath)),
          'lib',
          'node_modules'
        )
        if (result.indexOf(npmGlobalModuleDir) !== -1 && result.indexOf(`${path.sep}bin`) === result.length - 4) {
          result = result.slice(0, -4)
        }
      }
    } catch (error) {
      // Ignore error
    }
  }
  try {
    if (!result) {
      result = getAppRootPath.initialCwd
    }
    const nm = `${path.sep}node_modules`
    const nmi = result.indexOf(nm + path.sep)
    if (nmi > 0) {
      result = result.slice(0, nmi)
    } else if (result.endsWith(nm)) {
      result = result.slice(0, result.length - nm.length)
    }
    const home = nodeRequire('os').homedir() || path.resolve('/')
    let best = result
    for (let current = result; current; ) {
      try {
        if (current === home || current === '/var/task') {
          break
        }
        if (fs.existsSync(path.join(current, 'package.json')) && fs.existsSync(path.join(current, 'node_modules'))) {
          best = current
        }
      } catch (error) {
        // Ignore error
      }
      const parent = path.dirname(current)
      if (!parent || parent === current) {
        break
      }
      current = parent
    }
    return best
  } catch (e) {
    // Ignore error
  }

  return result || getAppRootPath.initialCwd
}

export = getAppRootPath

getAppRootPath.makeModuleUnloadable(module)
