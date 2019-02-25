import fs = require('fs')
import os = require('os')
import np = require('path')
import ut = require('util')
import cjs = require('module')

const VERSION = 1
const sym = Symbol.for('⭐ get-app-root-path-state ⭐')
const versionSym = Symbol.for('#singleton-module-version')

const nmpath = np.sep + 'node_modules' + np.sep
const { defineProperty } = Reflect
const { create } = Object

class State {
  public version: number = VERSION
  public init = init
  public singletonModules: any = create(null)
  public globalCache: { [key: string]: any } = create(null)
  public shared: { [key: string]: any } = create(null)
  public moduleInitialized = false
  public initialized = false
  public env: NodeJS.ProcessEnv
  public initialCwd: string
  public lambdaTaskRoot: string
  public isLambda: boolean
  public hasFlagCache: any
  public isTesting: boolean | undefined = undefined
  public isLocal: boolean | undefined = undefined
  public isGitRepo: boolean | undefined = undefined
  public appName: string | undefined = undefined
  public root: string | undefined = undefined
  public manifest: getAppRootPath.IPackageManifest | undefined = undefined
  public terminalColorSupport: number | undefined = undefined
  public getAppRootPath: typeof getAppRootPath = getAppRootPath
  public oldVersions?: Array<typeof getAppRootPath> = undefined

  public constructor() {
    const env = process.env
    const initialCwd = np.resolve(process.cwd())
    const lambdaTaskRoot = dirpath(np.sep === '/' && env.AWS_EXECUTION_ENV && env.AWS_LAMBDA_FUNCTION_NAME && env.LAMBDA_TASK_ROOT)
    const isLambda = !!lambdaTaskRoot

    this.env = env
    this.initialCwd = initialCwd
    this.lambdaTaskRoot = lambdaTaskRoot
    this.isLambda = isLambda
    if (isLambda) {
      this.isLocal = bool(process.env.IS_OFFLINE)
    }
  }
}

/**
 * Gets the application root path or thr workspace root path.
 * @returns {string} The application root path.
 */
function getAppRootPath(): string {
  return getAppRootPath.getPath()
}

let S: State = global[sym]
if (!S) {
  S = new State()
  defineProperty(global, sym, { value: S, configurable: true })
} else if (S.version < VERSION) {
  S.version = VERSION
  S.init = init
  // @ts-ignore
  getAppRootPath = S.getAppRootPath
}

namespace getAppRootPath {
  export interface IModule<TExports = any> {
    exports?: TExports
    id?: string
    filename?: string
    loaded?: boolean
    parent?: IModule | null
    children?: IModule[]
    paths?: string[]
    require?: NodeRequireFunction
  }

  /**
   * The definition of a NodeJS package.json manifest
   * @export
   * @interface IPackageManifest
   */
  export interface IPackageManifest {
    /**
     * Package name. Required.
     * @type {string}
     */
    name: string
    version?: string
    description?: string
    keywords?: string[]
    homepage?: string
    bugs?: string | { email: string; url: string; [key: string]: string | undefined }
    license?: string
    author?: string | { name: string; email?: string; homepage?: string; [key: string]: string | undefined }
    contributors?: string[] | Array<{ name: string; email?: string; homepage?: string; [key: string]: string | undefined }>
    files?: string[]
    main?: string
    bin?: string | { [name: string]: string | undefined }
    man?: string | string[]
    directories?: { lib?: string; bin?: string; man?: string; doc?: string; example?: string; [key: string]: string | undefined }
    repository?: string | { type: string; url: string }
    scripts?: { [scriptName: string]: string | undefined }
    config?: { [key: string]: any }
    dependencies?: { [name: string]: string | undefined }
    devDependencies?: { [name: string]: string | undefined }
    peerDependencies?: { [name: string]: string | undefined }
    optionalDependencies?: { [name: string]: string | undefined }
    bundledDependencies?: string[]
    engines?: { node?: string; npm?: string; [key: string]: string | undefined }
    os?: string[]
    cpu?: string[]
    preferGlobal?: boolean
    private?: boolean
    publishConfig?: { registry?: string; [key: string]: string | undefined }
    [key: string]: any
  }

  /** A global cache shared between all modules */
  export declare const globalCache: { [key: string]: any }

  /**
   * True if the application is running as a lambda function
   * @type {boolean}
   */
  export declare const isLambda: boolean

  /**
   * True if the root application folder is a git repository (has .git and .gitignore)
   * @type {boolean}
   */
  export declare const isGitRepo: boolean

  /**
   * The root package.json manifest.
   * @type {IPackageManifest}
   */
  export declare const manifest: getAppRootPath.IPackageManifest

  /**
   * The initial process.env
   * @type {NodeJS.ProcessEnv}
   */
  export declare const env: NodeJS.ProcessEnv

  /**
   * The initial directory when the application was started.
   * @type {string}
   */
  export declare const initialCwd: string

  /**
   * Gets or sets the terminal supported colors.
   * 0: no color. 1: 16 colors. 2: 256 colors. 3: 16 million colors.
   */
  export declare let terminalColorSupport: 0 | 1 | 2 | 3

  /**
   * Gets or sets wether running in a local environment.
   * @type {boolean}
   */
  export declare let isLocal: boolean

  /**
   * Gets or sets wether running tests framework (jest, mocha).
   * @type {boolean}
   */
  export declare let isTesting: boolean

  /**
   * Gets or sets the application root path
   * @type {string}
   */
  export declare let path: string

  /**
   * Gets or sets the root package name
   * @type {string}
   */
  export let applicationName: string

  /**
   * A map of shared values between modules.
   *
   * @type {{ [key: string]: any }}
   * @memberof AppRootPath
   */
  export declare const shared: { [key: string]: any }

  /**
   * Returns true if the given flag is specified in the command line argument list
   * The value is cached once requested.
   *
   * @param {string} flag The flag to look for.
   * @returns {boolean} True if the flag was specified in the process argv, false if not
   */
  export function hasArgvFlag(flag: string) {
    const found = S.hasFlagCache && S.hasFlagCache[flag]
    if (found !== undefined) {
      return found
    }
    let result = false
    const argv = process.argv
    if (argv && typeof argv.indexOf === 'function') {
      const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--'
      const pos = argv.indexOf(prefix + flag)
      const terminatorPos = argv.indexOf('--')
      result = pos !== -1 && (terminatorPos === -1 ? true : pos < terminatorPos)
      if (S.hasFlagCache === undefined) {
        S.hasFlagCache = Object.create(null)
      }
      S.hasFlagCache[flag] = result
    }
    return result
  }

  /**
   * Gets the application or workspace root folder path.
   * @returns {string} The application or workspace root folder path.
   */
  export function getPath(): string {
    if (!S.initialized) {
      S.init()
    }
    return S.root!
  }

  /**
   * Sets the application or workspace root folder path.
   * @param {string} value The new root folder path.
   */
  export function setPath(value: string): void {
    S.root = np.resolve(value)
    S.env.APP_ROOT_PATH = S.root
  }

  /**
   * Shortens a path making it relative to the specified rootDir.
   * By default, rootDir is the application or workspace root path.
   *
   * @param {string} p The path to shorten.
   * @param {string} [rootDir] The root dir, by default is getAppRootPath()
   * @returns {string} The shortened path. May be relative or absolute.
   */
  export function shortenPath(filepath: string, rootDir: string = getAppRootPath.getPath()): string {
    filepath = path.normalize(filepath)
    if (np.isAbsolute(filepath)) {
      const p = path.normalize(np.relative(rootDir, filepath))
      if (p.length < filepath.length) {
        filepath = p
      }
    }
    return filepath
  }

  /**
   * Returns true if running in a local environment.
   * @returns {boolean} True if running in a local environment.
   */
  export function getIsLocal(): boolean {
    if (S.isLocal === undefined) {
      S.init()
    }
    return S.isLocal!
  }

  /**
   * Sets isLocal value (running inside a local environment).
   * @param {(string | boolean)} value The boolean value.
   */
  export function setIsLocal(value: string | boolean): void {
    const v = bool(value)
    if (v === undefined) {
      throw new TypeError('isLocal must be a boolean value')
    }
    S.isLocal = v
    if (v) {
      S.env.isLocal = 'true'
    } else {
      delete S.env.isLocal
    }
  }

  /**
   * Returns true if running in a unit testing framework.
   * @returns {boolean} True if running in a unit testing framework.
   */
  export function getIsTesting(): boolean {
    if (S.isTesting === undefined) {
      const g = global as any
      if (
        typeof g.it === 'function' &&
        typeof g.describe === 'function' &&
        typeof g.afterEach === 'function' &&
        typeof g.beforeEach === 'function' &&
        ((typeof g.before === 'function' && typeof g.after === 'function') ||
          (typeof g.beforeAll === 'function' && typeof g.afterAll === 'function'))
      ) {
        S.isTesting = true
        return true
      }
      return false
    }
    return S.isTesting
  }

  /**
   * Sets isTesting value (running inside a unit test framework).
   * @param {(string | boolean)} value The boolean value.
   */
  export function setIsTesting(value: string | boolean): void {
    S.isTesting = bool(value) || !!value
  }

  /**
   * Gets a module from the cache. Returns undefined if not found.
   *
   * @param {string} id The id of the module to resolve.
   * @returns {NodeModule|undefined} The module found in the cache or undefined if not found.
   */
  export function getModuleFromRequireCache(module: any, caller?: Function): any {
    return getAppRootPath.requireModule(module, caller || getModuleFromRequireCache, false)
  }

  /**
   * Requires a module and returns the module itself instead of the exports.
   *
   * @param {string} id The id or the path of the module to require.
   * @param {Function} [caller]
   * @returns {NodeModule} The resolved module.
   */
  export function requireModule<T = any>(
    module: string | NodeModule,
    caller?: Function | string | undefined,
    canRequire?: true | undefined
  ): IModule<T>
  export function requireModule<T = any>(
    module: string | NodeModule,
    caller: Function | string | undefined,
    canRequire: boolean
  ): IModule<T> | undefined
  export function requireModule<T = any>(
    module: string | NodeModule,
    caller: Function | string = requireModule,
    canRequire = true
  ): IModule<T> | undefined {
    if (typeof module === 'string') {
      let fname: string
      if (typeof caller === 'string') {
        fname = caller
      } else {
        fname = __dirname
        const oldStackLimit = Error.stackTraceLimit
        const oldPrepareStackTrace = Error.prepareStackTrace
        try {
          Error.stackTraceLimit = 1
          Error.prepareStackTrace = (_err: Error, stack: any) => {
            return (stack && stack[0] && stack[0].getFileName()) || undefined
          }
          const obj = { stack: undefined }
          Error.captureStackTrace(obj, caller || requireModule)
          fname = obj.stack || __dirname
        } finally {
          Error.prepareStackTrace = oldPrepareStackTrace
          Error.stackTraceLimit = oldStackLimit
        }
      }
      let customRequire: any
      if (fname !== __dirname) {
        customRequire = (cjs.createRequireFromPath || newRequireFromPath)(fname)
      } else {
        customRequire = require
      }
      const modulePath = customRequire.resolve(module)
      module = require.cache[modulePath]
      if (!module) {
        if (!canRequire) {
          return undefined
        }
        customRequire(modulePath)
        module = require.cache[modulePath]
      }
    }
    if (typeof module !== 'object' || module === null) {
      if (canRequire) {
        throw new Error(`Cannot resolve module "${module}"`)
      }
      return undefined
    }
    return module
  }

  /**
   * Marks a NodeJS module as a core module that should not be unloaded.
   *
   * @template TModule NodeJS module
   * @param {TModule} module NodeJS module
   * @returns {TModule} NodeJS module
   */
  export function coreModule<TModule extends NodeModule>(module: TModule): TModule
  export function coreModule<TExports, TModule = getAppRootPath.IModule<TExports>>(module: TModule): TModule
  export function coreModule<TModule extends getAppRootPath.IModule>(module: TModule): TModule
  export function coreModule<TModule>(module: TModule): TModule
  export function coreModule(module: string): NodeModule
  export function coreModule(module: any, activator?: (module: any) => any): any {
    if (activator !== null && activator !== undefined && typeof activator !== 'function') {
      throw new TypeError('Activator must be undefined or a function but is ' + typeof activator)
    }

    if (typeof module !== 'object') {
      module = getAppRootPath.requireModule(module, coreModule)
    }

    if (module.unloadable) {
      return module
    }

    defineProperty(module, 'unloadable', { value: true, configurable: true, writable: true })

    const key = module.filename || module.id
    if (typeof key === 'string' && key.length) {
      defineProperty(require.cache, key, {
        get() {
          return module
        },
        set: empty,
        configurable: true
      })
    }
    if (typeof activator === 'function') {
      const exp = activator.call(module.exports, module)
      if (exp !== undefined) {
        module.exports = exp
      }
    }
    return module
  }

  /**
   * Returns the specified value. If undefined, calls initialize() function and uses the return value.
   */
  export function fieldInit(value: undefined, initialize: () => never): never
  export function fieldInit<T>(value: T, initialize: () => never): T
  export function fieldInit<T, Q extends T = T>(value: T | undefined, initialize: () => Q): T
  export function fieldInit<F extends () => any>(value: ReturnType<F> | undefined, initialize: F): ReturnType<F>
  export function fieldInit<F extends () => any>(v: ReturnType<F> | undefined, f: F): ReturnType<F>
  export function fieldInit<F extends () => any>(v: ReturnType<F> | undefined, f: F): ReturnType<F> {
    return v !== undefined ? v : f()
  }

  /**
   * Marks a NodeJS module as a singleton module that should not be unloaded.
   * Accepts the exports to assign and returns the module exports.
   *
   * If the given version is a number, the existing module will be replaced if the version is greater.
   * If the given version is a string or undefined, the module will coexist if another version exists.
   *
   * @template Exports
   * @param {IModule<Exports>} module NodeJS module
   * @param {Exports} exports NodeJS exports
   * @param {(module: IModule<Exports>) => void} [activator] The activator
   * @param {number} [version] The version
   * @returns {Exports} The exports
   */
  export function singletonModuleExports<Exports>(
    module: getAppRootPath.IModule<Exports>,
    exports: Exports,
    activator?: (this: Exports, module: getAppRootPath.IModule<Exports>) => void,
    version?: number
  ): Exports
  /**
   * Marks a NodeJS module as a singleton module that should not be unloaded.
   * Accepts the exports to assign and returns the module exports.
   *
   * @template Exports
   * @param {string} module NodeJS module id
   * @param {Exports} exports NodeJS exports
   * @param {(module: IModule<Exports>) => void} [activator] The activator
   * @param {number} [version] The version
   * @returns {Exports} The exports
   */
  export function singletonModuleExports<Exports>(module: string, exports: Exports, version?: number): Exports

  export function singletonModuleExports(
    module: any,
    exports: any = module.exports,
    activator?: number | ((module: any) => any),
    version: number | string = 0
  ): any {
    if (activator !== null && activator !== undefined && typeof activator !== 'function') {
      if ((typeof activator === 'number' || typeof activator === 'string') && version === undefined) {
        version = activator
        activator = undefined
      } else {
        throw new TypeError('Activator must be undefined or a function but is ' + typeof activator)
      }
    }

    return getAppRootPath.singletonModule(
      module,
      m => {
        if (exports !== undefined && exports !== null) {
          m.exports = exports
        }
        if (typeof activator === 'function') {
          const t = activator.call(m.exports, m)
          if (t !== undefined) {
            return t
          }
          return m.exports
        }
      },
      version,
      singletonModuleExports
    ).exports
  }

  /**
   * Marks a NodeJS module as a singleton module that should not be unloaded.
   *
   * If the given version is a number, the existing module will be replaced if the version is greater.
   * If the given version is a string or undefined, the module will coexist if another version exists.
   *
   * @template TModule NodeJS module
   * @param {TModule} module NodeJS module
   * @returns {TModule} NodeJS module
   */
  export function singletonModule<TModule extends NodeModule>(
    module: TModule,
    activator?: (module: TModule) => void,
    version?: number,
    caller?: Function
  ): TModule
  export function singletonModule<TExports, TModule = getAppRootPath.IModule<TExports>>(
    module: TModule,
    activator?: (this: TExports, module: TModule) => void,
    version?: number | string,
    caller?: Function
  ): TModule
  export function singletonModule<TModule extends getAppRootPath.IModule>(
    module: TModule,
    activator?: (this: any, module: TModule) => void,
    version?: number | string,
    caller?: Function
  ): TModule
  export function singletonModule<TModule>(
    module: TModule,
    activator?: (this: any, module: TModule) => void,
    version?: number | string,
    caller?: Function
  ): TModule
  export function singletonModule(
    module: string,
    activator?: (this: any, module: NodeModule) => void,
    version?: number | string,
    caller?: Function
  ): NodeModule
  export function singletonModule(module: any): any
  export function singletonModule(
    module: any,
    activator?: (module: any) => any,
    version: number | string = 0,
    caller: Function = singletonModule
  ): any {
    if (activator !== null && activator !== undefined && typeof activator !== 'function') {
      if ((typeof activator === 'number' || typeof activator === 'string') && version === undefined) {
        version = activator
        activator = undefined
      } else {
        throw new TypeError('Activator must be undefined or a function but is ' + typeof activator)
      }
    }

    module = getAppRootPath.requireModule(module, caller)
    const key = module.filename || module.id
    if (typeof key !== 'string' || !key) {
      throw new TypeError('Not a valid module')
    }

    if (module[versionSym] !== undefined) {
      return module
    }

    let singletonKey = key
    const indexOfNodeModules = key.lastIndexOf(nmpath)
    if (indexOfNodeModules >= 0) {
      singletonKey = key.slice(indexOfNodeModules + nmpath.length)
    }
    if (typeof version === 'string') {
      singletonKey += '@' + version
    }

    const found = S.singletonModules[singletonKey]
    if (found !== undefined && (typeof version === 'string' || found[versionSym] >= version)) {
      module.exports = found.exports
      getAppRootPath.coreModule(module)
      return found
    }

    if (activator) {
      const exp = activator.call(module.exports, module)
      if (exp !== undefined && !(exp instanceof Promise)) {
        module.exports = exp
      }
    }

    module[versionSym] = version
    getAppRootPath.coreModule(module)
    S.singletonModules[singletonKey] = module
    return module
  }

  /**
   * Marks a NodeJS module as an executable module.
   * If the module is executed with 'node module.js', the module will be called straight away.
   * When executing it handles promises and sets process exit status code -1 on failure.
   *
   * @template Module NodeJS module
   * @param {Module} module NodeJS module
   * @param {()=>any} [functor] The function to execute. If undefined, module.exports is used.
   * @returns {Module} NodeJS module
   */
  export function executableModule<TModule extends NodeModule>(module: TModule, functor?: () => never | void | Promise<any>): TModule
  export function executableModule<TExports, TModule = getAppRootPath.IModule<TExports>>(
    module: TModule,
    functor?: () => never | void | Promise<any>
  ): TModule
  export function executableModule<TModule extends getAppRootPath.IModule>(
    module: TModule,
    functor?: () => never | void | Promise<any>
  ): TModule
  export function executableModule<TModule>(module: TModule, functor?: () => never | void | Promise<any>): TModule
  export function executableModule(module: string, functor?: () => never | void | Promise<any>): NodeModule
  export function executableModule(module: any, functor?: () => never | void | Promise<any>): any
  export function executableModule(module: any, functor?: (...args: string[]) => any): any {
    if (typeof functor !== 'function') {
      if (functor !== undefined) {
        throw new TypeError(`Argument "functor" must be a function but is ${typeof functor}`)
      }
      functor = module.exports
      if (typeof functor !== 'function') {
        throw new TypeError(`module.exports must be a function but is ${typeof functor}`)
      }
    }
    module = getAppRootPath.requireModule(module, executableModule)
    if (require.main === module) {
      module.executable = true
      executeModule(module, functor)
    }
    return module
  }

  export function toJSON() {
    if (!S.initialized) {
      S.init()
    }
    const result = {}
    for (const k of Object.keys(getAppRootPath)) {
      const v = getAppRootPath[k]
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'object' && v !== null)) {
        result[k] = v
      }
    }
    return result
  }

  export function toString() {
    return getAppRootPath.getPath()
  }

  export type AppRootPath = typeof getAppRootPath
}

getAppRootPath[ut.inspect.custom] = function inspect() {
  return getAppRootPath.toJSON()
}

function empty() {}

function dirpath(s: any): string {
  if (typeof s === 'string' && s.length) {
    try {
      s = np.resolve(s)
      return fs.existsSync(s) ? s : ''
    } catch (error) {}
  }
  return ''
}

function bool(value: any): boolean | undefined {
  switch (value) {
    case true:
    case 'true':
    case 'True':
    case 'TRUE':
    case '1':
      return true
    case false:
    case 'false':
    case 'False':
    case 'FALSE':
    case '0':
      return false
  }
  return undefined
}

function isGlobalDirectory(dir: any): boolean {
  if (typeof dir === 'string') {
    const globalPaths = (cjs as { globalPaths?: string[] }).globalPaths
    if (globalPaths) {
      for (let i = 0, len = globalPaths.length; i < len; ++i) {
        if (dir.startsWith(globalPaths[i])) {
          return true
        }
      }
    }
  }
  return false
}

function isGit(p: string): boolean {
  try {
    return fs.statSync(np.join(p, '.git')).isDirectory() && fs.statSync(np.join(p, '.gitignore')).isFile()
  } catch (error) {
    return false
  }
}

function readManifest(p: string): any {
  try {
    const m = JSON.parse(fs.readFileSync(np.join(p, 'package.json')).toString())
    if (typeof m === 'object' && m !== null && typeof m.name === 'string') {
      return m
    }
  } catch (error) {}
  return null
}

function newRequireFromPath(filename: string) {
  const m = new cjs(filename)
  m.filename = filename
  m.paths = (cjs as any)._nodeModulePaths(np.dirname(filename))
  function require(id: string) {
    return m.require(id)
  }
  require.resolve = function resolve(request: any, options: any) {
    return (cjs as any)._resolveFilename(request, m, false, options)
  }
  return require
}

async function executeModule(module: any, functor: () => any): Promise<any> {
  module = getAppRootPath.requireModule(module, executeModule)
  module.executable = true
  let name
  const fname = module.filename
  if (typeof fname === 'string' && fname.length) {
    name = np.basename(fname, '.js')
    if (name === 'index') {
      name = np.dirname(fname)
    }
  }
  if (!name) {
    name = 'module'
  }
  if (!functor.name) {
    try {
      defineProperty(functor, 'name', { value: name, configurable: true, writable: true })
    } catch (error) {}
  }
  const n = `- running ${name}`
  console.info(n)
  console.time(n)
  try {
    await new Promise(setImmediate)
    await functor.call(module.exports)
  } catch (error) {
    if (!process.exitCode) {
      process.exitCode = -1
    }
    console.error('Error ', n, error)
  } finally {
    console.timeEnd(n)
  }
}

Object.defineProperties(getAppRootPath, {
  globalCache: { value: S.globalCache, configurable: true },
  shared: { value: S.shared, configurable: true },
  initialCwd: { value: S.initialCwd, configurable: true, enumerable: true },
  env: { value: S.env, configurable: true },
  isLambda: { value: S.isLambda, enumerable: true, configurable: true },
  isLocal: {
    get: getAppRootPath.getIsLocal,
    set(value) {
      getAppRootPath.setIsLocal(value)
    },
    enumerable: true,
    configurable: true
  },
  isTesting: {
    get: getAppRootPath.getIsTesting,
    set(value) {
      getAppRootPath.setIsTesting(value)
    },
    enumerable: true,
    configurable: true
  },
  isGitRepo: {
    get() {
      if (!S.initialized) {
        S.init()
      }
      return S.isGitRepo
    },
    enumerable: true,
    configurable: true
  },
  terminalColorSupport: {
    get() {
      if (S.isLambda && !S.isLocal) {
        return 0
      }
      if (S.terminalColorSupport === undefined) {
        S.terminalColorSupport = loadColorSupport()
      }
      return S.terminalColorSupport
    },
    set(value: any) {
      if (value !== undefined) {
        if (value === true) {
          S.terminalColorSupport = 1
        } else if (value === false) {
          S.terminalColorSupport = 0
        } else {
          value = Number.parseInt(value, 10)
        }
        if (value < 0) {
          value = 0
        }
        if (value > 3) {
          value = 3
        }
      }
      S.terminalColorSupport = value
    },
    enumerable: true,
    configurable: true
  },
  path: {
    get: getAppRootPath.getPath,
    set(value) {
      getAppRootPath.setPath(value)
    },
    enumerable: true,
    configurable: true
  },
  applicationName: {
    get() {
      if (!S.initialized) {
        S.init()
      }
      return S.appName
    },
    set(value) {
      S.appName = value !== null && value !== undefined ? `${value}` : ''
    },
    enumerable: true,
    configurable: true
  },
  manifest: {
    get() {
      if (!S.initialized) {
        S.init()
      }
      return S.manifest
    },
    enumerable: false,
    configurable: true
  }
})

function loadColorSupport() {
  const has = getAppRootPath.hasArgvFlag
  // Based on https://github.com/chalk/supports-color
  let forceColor: boolean | undefined
  if (has('no-color') || has('no-colors') || has('color=false')) {
    forceColor = false
  } else if (has('color') || has('colors') || has('color=true') || has('color=always')) {
    forceColor = true
  }
  const envForceColor = S.env.FORCE_COLOR
  if (envForceColor !== undefined) {
    forceColor = envForceColor.length === 0 || parseInt(envForceColor, 10) !== 0
  }
  if (forceColor === false) {
    return 0
  }
  if (has('color=16m') || has('color=full') || has('color=truecolor')) {
    return 3
  }
  if (has('color=256')) {
    return 2
  }
  if ((!process.stdout.isTTY || !process.stderr.isTTY) && forceColor !== true) {
    return 0
  }
  const min = forceColor ? 1 : 0
  if (process.platform === 'win32') {
    // Windows 10 build 14931 is the first release that supports 16m/TrueColor.
    const osRelease = os.release().split('.')
    if (Number(process.versions.node.split('.')[0]) >= 8 && Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2
    }
    return 1
  }
  if ('CI' in S.env) {
    if ('TRAVIS' in S.env || 'CIRCLECI' in S.env || 'APPVEYOR' in S.env || 'GITLAB_CI' in S.env || S.env.CI_NAME === 'codeship') {
      return 1
    }
    return min
  }
  const teamcityVersion = S.env.TEAMCITY_VERSION
  if (typeof teamcityVersion === 'string') {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(teamcityVersion) ? 1 : 0
  }
  if (S.env.COLORTERM === 'truecolor') {
    return 3
  }
  const termProgram = S.env.TERM_PROGRAM
  if (typeof termProgram === 'string') {
    if (termProgram === 'iTerm.app') {
      return parseInt(termProgram.split('.')[0], 10) >= 3 ? 3 : 2
    }
    if (termProgram === 'Apple_Terminal.app') {
      return 2
    }
  }
  const envTerm = S.env.TERM
  if (typeof envTerm === 'string') {
    if (/-256(color)?$/i.test(envTerm)) {
      return 2
    }
    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(envTerm)) {
      return 1
    }
  }
  return 'COLORTERM' in S.env ? 1 : min
}

/**
 * Internal initialization method.
 */
function init() {
  S.initialized = true
  if (S.isLocal === undefined) {
    S.isLocal = bool(S.env.isLocal)
    if (S.isLocal === undefined) {
      S.isLocal = bool(S.env.npm_config_isLocal)
      if (S.isLocal === undefined && (S.env.NODE_ENV === 'development' || S.isTesting || (S.env.VSCODE_PID && S.env.VSCODE_IPC_HOOK))) {
        S.isLocal = true
      }
    }
  }

  S.root = dirpath(S.root) || dirpath(S.env.APP_ROOT_PATH)

  let root = S.root
  if (!root) {
    if (S.env.VSCODE_PID && S.env.VSCODE_IPC_HOOK) {
      root = S.initialCwd
    } else {
      root = np.resolve(__dirname || '')
      const m = require.main
      if (m && typeof m.filename === 'string' && isGlobalDirectory(S.root)) {
        S.root = np.dirname(m.filename)
        const g = np.resolve(
          (process.platform === 'win32' ? np.dirname(process.execPath) : np.dirname(np.dirname(process.execPath))) || '',
          'lib',
          'node_modules'
        )
        if (root.indexOf(g) !== -1 && root.indexOf(`${np.sep}bin`) === root.length - 4) {
          root = root.slice(0, -4)
        }
      }
      S.root = root
    }

    const nm = `${np.sep}node_modules`
    const nmi = root.indexOf(nm + np.sep)
    if (nmi > 0) {
      S.root = root = root.slice(0, nmi) || root
    }
    if (root.endsWith(nm)) {
      S.root = root = root.slice(0, root.length - nm.length) || root
    }

    let home: string | undefined
    for (let current = root; current; ) {
      const m = readManifest(current)
      if (m) {
        S.manifest = m
        const isRoot = bool(m.root)
        if (isRoot !== false) {
          S.root = root = current
          if (isRoot === true) {
            break
          }
          S.isGitRepo = isGit(current)
          if (S.isGitRepo) {
            break
          }
        }
      }
      const parent = np.dirname(current)
      if (!parent || parent === current || S.isLambda) {
        break
      }
      if (home === undefined) {
        home = os.homedir() || ''
      }
      if (parent === home || parent === '/') {
        break
      }
      current = parent
    }
  }

  if (S.manifest === undefined) {
    S.manifest = readManifest(root)
  }

  if (S.isGitRepo === undefined) {
    S.isGitRepo = isGit(root)
  }

  if (!S.manifest) {
    S.manifest = { name: np.basename(S.root), private: true }
  }

  S.appName = S.manifest.name

  if (S.isLocal === undefined) {
    S.isLocal = bool(S.manifest.isLocal)
    if (S.isLocal === undefined) {
      const config = S.manifest.config
      if (config) {
        S.isLocal = bool(config.isLocal)
      }
      if (S.isLocal === undefined) {
        S.isLocal = S.isGitRepo
      }
    }
  }

  S.env.APP_ROOT_PATH = S.root

  if (S.isLocal) {
    S.env.isLocal = 'true'
  } else {
    delete S.env.isLocal
  }
}

defineProperty(module, 'unloadable', { value: true, configurable: true, writable: true })
defineProperty(module, 'exports', {
  get() {
    return S.getAppRootPath
  },
  set: empty,
  configurable: true,
  enumerable: true
})

defineProperty(require.cache, module.filename, {
  get() {
    return module
  },
  set: empty,
  configurable: true,
  enumerable: true
})

if (!S.moduleInitialized) {
  S.moduleInitialized = true
  defineProperty(global, Symbol.for('⭐ get-app-root-path ⭐'), { value: S.getAppRootPath, configurable: true, writable: true })
  if (ut.inspect.defaultOptions && !ut.inspect.defaultOptions.colors && getAppRootPath.terminalColorSupport > 0) {
    ut.inspect.defaultOptions.colors = true
  }
}

export = getAppRootPath
