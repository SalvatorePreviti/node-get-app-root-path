import cjs = require('module')
import np = require('path')
import util = require('util')
import os = require('os')
import fs = require('fs')

const VERSION = 2
const sym = Symbol.for('⭐ get-app-root-path ⭐')
const versionSym = Symbol.for('#singleton-module-version')
const defProp = Reflect.defineProperty
const nmpath = np.sep + 'node_modules' + np.sep

interface AppRootPath {
  /**
   * Gets the application or workspace root folder path.
   * @returns {string} The application or workspace root folder path.
   */
  (): string

  /**
   * The root package.json manifest.
   * @type {AppRootPath.IPackageManifest}
   */
  readonly manifest: getAppRootPath.IPackageManifest

  /**
   * True if the root application folder is a git repository (has .git and .gitignore)
   * @readonly @type {boolean}
   */
  isGitRepo: boolean

  /**
   * Gets or sets wether running tests framework (jest, mocha).
   * @type {boolean}
   */
  isTesting: boolean

  /**
   * Gets or sets the root package name
   * @type {string}
   */
  applicationName: string

  /**
   * Gets or sets the terminal supported colors.
   * 0: no color. 1: 16 colors. 2: 256 colors. 3: 16 million colors.
   * @type {0|1|2|3}
   */
  terminalColorSupport: 0 | 1 | 2 | 3

  /**
   * Gets or sets wether running in a local environment.
   * @type {boolean}
   */
  isLocal: boolean

  /**
   * Gets or sets wether running inside a CI environment.
   * @type {boolean}
   */
  isCI: boolean

  /**
   * Gets or sets the application or workspace root folder path.
   * @type {string}
   */
  path: string
}

class AppRootPath implements AppRootPath {
  public static [Symbol.hasInstance](instance: any): boolean {
    return !!instance && !!instance[sym]
  }

  /**
   * A map of shared values between modules.
   *
   * @type {{ [key: string]: any }}
   * @memberof AppRootPath
   */
  public readonly shared: { [key: string]: any } = Object.create(null)

  /**
   * A global cache shared between all modules
   */
  public readonly globalCache: { [key: string]: any } = Object.create(null)

  public readonly version: number = VERSION
  public readonly AppRootPath: typeof AppRootPath = AppRootPath

  public readonly env: NodeJS.ProcessEnv
  public readonly initialCwd: string
  public readonly lambdaTaskRoot: string
  public readonly isLambda: boolean

  private _singletonModules: { [key: string]: any } = Object.create(null)
  private _initialized: boolean = false
  private _isTesting: boolean | undefined = undefined
  private _isLocal: boolean | undefined = undefined
  private _hasFlagMap: Map<string, boolean> | undefined = undefined
  private _root: string | undefined = undefined
  private _terminalColorSupport: 0 | 1 | 2 | 3 | undefined = undefined
  private _isGitRepo: boolean | undefined = undefined
  private _appName: string | undefined = undefined
  private _manifest: getAppRootPath.IPackageManifest | undefined = undefined
  private _isCI: boolean | undefined = undefined

  public constructor(env = process.env) {
    const lambdaTaskRoot = dirpath(np.sep === '/' && env.AWS_EXECUTION_ENV && env.AWS_LAMBDA_FUNCTION_NAME && env.LAMBDA_TASK_ROOT)
    const initialCwd = np.resolve(process.cwd())
    const isLambda = !!lambdaTaskRoot

    this.env = env
    this.initialCwd = initialCwd
    this.lambdaTaskRoot = lambdaTaskRoot
    this.isLambda = isLambda

    // tslint:disable-next-line:no-shadowed-variable
    function getAppRootPath() {
      return (getAppRootPath as any).getPath()
    }
    const S = getAppRootPath as AppRootPath
    Object.assign(S, this)
    Object.setPrototypeOf(S, new.target.prototype)
    return setup(S)
  }

  /**
   * Returns true if the given flag is specified in the command line argument list
   * The value is cached once requested.
   *
   * @param {string} flag The flag to look for.
   * @returns {boolean} True if the flag was specified in the process argv, false if not
   */
  public hasArgvFlag(flag: string | number) {
    if (flag === null || flag === undefined) {
      return false
    }
    flag = `${flag}`
    const found = this._hasFlagMap && this._hasFlagMap.get(flag)
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
      if (this._hasFlagMap === undefined) {
        this._hasFlagMap = new Map()
      }
      this._hasFlagMap.set(flag, result)
    }
    return result
  }

  /**
   * Gets or sets wether running inside CI
   *
   * @returns {boolean} True if running inside CI, false if not
   * @memberof AppRootPath
   */
  public getIsCI(): boolean {
    let result = this._isCI
    if (result === undefined) {
      const ci: any = this.env.CI
      result = ci === true || ci === 'true' || !!this.env.TEAMCITY_VERSION
      this._isCI = result
    }
    return result
  }

  public setIsCI(value: boolean): void {
    this._isCI = !!bool(value)
  }

  /**
   * Gets the application or workspace root folder path.
   * @returns {string} The application or workspace root folder path.
   */
  public getPath(): string {
    if (!this._initialized) {
      this.init()
    }
    return this._root!
  }

  /**
   * Sets the application or workspace root folder path.
   * @param {string} value The new root folder path.
   */
  public setPath(value: string): void {
    this._root = np.resolve(value)
    this.env.APP_ROOT_PATH = this._root
  }

  /**
   * Returns true if running in a local environment.
   * @returns {boolean} True if running in a local environment.
   */
  public getIsLocal(): boolean {
    if (this._isLocal === undefined) {
      this.init()
    }
    return this._isLocal!
  }

  /**
   * Sets isLocal value (running inside a local environment).
   * @param {(string | boolean)} value The boolean value.
   */
  public setIsLocal(value: string | boolean): void {
    const v = bool(value)
    if (v === undefined) {
      throw new TypeError('isLocal must be a boolean value')
    }
    this._isLocal = v
    if (v) {
      this.env.isLocal = 'true'
    } else {
      delete this.env.isLocal
    }
  }

  /**
   * Gets the singleton instance of the parsed root package.json
   *
   * @type {AppRootPath.IPackageManifest}
   */
  public getManifest(): getAppRootPath.IPackageManifest {
    if (!this._initialized) {
      this.init()
    }
    return this._manifest!
  }

  /**
   * Returns true if running in a unit testing framework.
   * @returns {boolean} True if running in a unit testing framework.
   */
  public getIsTesting(): boolean {
    if (this._isTesting === undefined) {
      const g = global as any
      if (
        typeof g.it === 'function' &&
        typeof g.describe === 'function' &&
        typeof g.afterEach === 'function' &&
        typeof g.beforeEach === 'function' &&
        ((typeof g.before === 'function' && typeof g.after === 'function') ||
          (typeof g.beforeAll === 'function' && typeof g.afterAll === 'function'))
      ) {
        this._isTesting = true
        return true
      }
      return false
    }
    return this._isTesting
  }

  /**
   * Sets isTesting value (running inside a unit test framework).
   * @param {(string | boolean)} value The boolean value.
   */
  public setIsTesting(value: string | boolean): void {
    this._isTesting = bool(value) || !!value
  }

  /**
   * Shortens a path making it relative to the specified rootDir.
   * By default, rootDir is the application or workspace root path.
   *
   * @param {string} p The path to shorten.
   * @param {string} [rootDir] The root dir, by default is getAppRootPath()
   * @returns {string} The shortened path. May be relative or absolute.
   */
  public shortenPath(filepath: string, rootDir: string = this.getPath()): string {
    filepath = np.normalize(filepath)
    if (np.isAbsolute(filepath)) {
      const p = np.normalize(np.relative(rootDir, filepath))
      if (p.length < filepath.length) {
        filepath = p
      }
    }
    return filepath
  }

  /**
   * Gets a module from the cache. Returns undefined if not found.
   *
   * @param {string} id The id of the module to resolve.
   * @returns {NodeModule|undefined} The module found in the cache or undefined if not found.
   */
  public getModuleFromRequireCache(module: any, caller: Function = this.getModuleFromRequireCache): any {
    return this.requireModule(module, caller, false)
  }

  /**
   * Requires a module and returns the module itself instead of the exports.
   *
   * @param {string} id The id or the path of the module to require.
   * @param {Function} [caller]
   * @returns {NodeModule} The resolved module.
   */
  public requireModule<T = any>(
    module: string | NodeModule,
    caller?: Function | string | undefined,
    canRequire?: true | undefined
  ): getAppRootPath.IModule<T>
  public requireModule<T = any>(
    module: string | NodeModule,
    caller: Function | string | undefined,
    canRequire: boolean
  ): getAppRootPath.IModule<T> | undefined
  public requireModule<T = any>(
    module: string | NodeModule,
    caller: Function | string = this.requireModule,
    canRequire = true
  ): getAppRootPath.IModule<T> | undefined {
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
          Error.captureStackTrace(obj, caller || this.requireModule)
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
  public coreModule<TModule extends NodeModule>(module: TModule, activator?: (module: any) => any, caller?: Function): TModule
  public coreModule<TExports, TModule = getAppRootPath.IModule<TExports>>(
    module: TModule,
    activator?: (module: any) => any,
    caller?: Function
  ): TModule
  public coreModule<TModule extends getAppRootPath.IModule>(module: TModule, activator?: (module: any) => any, caller?: Function): TModule
  public coreModule<TModule>(module: TModule, activator?: (module: any) => any, caller?: Function): TModule
  public coreModule(module: string, activator?: (module: any) => any, caller?: Function): NodeModule
  public coreModule(module: any, activator?: (module: any) => any, caller: Function = this.coreModule): any {
    if (activator !== null && activator !== undefined && typeof activator !== 'function') {
      throw new TypeError('Activator must be undefined or a function but is ' + typeof activator)
    }

    if (typeof module !== 'object') {
      module = this.requireModule(module, caller)
    }

    if (module.unloadable) {
      return module
    }

    defProp(module, 'unloadable', { value: true, configurable: true, writable: true })

    const key = module.filename || module.id
    if (typeof key === 'string' && key.length) {
      defProp(require.cache, key, {
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
   * Marks a NodeJS module as a singleton module that should not be unloaded.
   *
   * If the given version is a number, the existing module will be replaced if the version is greater.
   * If the given version is a string or undefined, the module will coexist if another version exists.
   *
   * @template TModule NodeJS module
   * @param {TModule} module NodeJS module
   * @returns {TModule} NodeJS module
   */
  public singletonModule<TModule extends NodeModule>(
    module: TModule,
    activator?: (module: TModule) => void,
    version?: number,
    caller?: Function
  ): TModule
  public singletonModule<TExports, TModule = getAppRootPath.IModule<TExports>>(
    module: TModule,
    activator?: (this: TExports, module: TModule) => void,
    version?: number | string,
    caller?: Function
  ): TModule
  public singletonModule<TModule extends getAppRootPath.IModule>(
    module: TModule,
    activator?: (this: any, module: TModule) => void,
    version?: number | string,
    caller?: Function
  ): TModule
  public singletonModule<TModule>(
    module: TModule,
    activator?: (this: any, module: TModule) => void,
    version?: number | string,
    caller?: Function
  ): TModule
  public singletonModule(
    module: string,
    activator?: (this: any, module: NodeModule) => void,
    version?: number | string,
    caller?: Function
  ): NodeModule
  public singletonModule(module: any): any
  public singletonModule(
    module: any,
    activator?: (module: any) => any,
    version: number | string = 0,
    caller: Function = this.singletonModule
  ): any {
    if (activator !== null && activator !== undefined && typeof activator !== 'function') {
      if ((typeof activator === 'number' || typeof activator === 'string') && version === undefined) {
        version = activator
        activator = undefined
      } else {
        throw new TypeError('Activator must be undefined or a function but is ' + typeof activator)
      }
    }

    module = this.requireModule(module, caller)
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

    const found = this._singletonModules[singletonKey]
    if (found !== undefined && (typeof version === 'string' || found[versionSym] >= version)) {
      module.exports = found.exports
      this.coreModule(module, undefined, caller)
      return found
    }

    if (activator) {
      const exp = activator.call(module.exports, module)
      if (exp !== undefined && !(exp instanceof Promise)) {
        module.exports = exp
      }
    }

    module[versionSym] = version
    this.coreModule(module, undefined, caller)
    this._singletonModules[singletonKey] = module
    return module
  }

  /**
   * Returns the specified value. If undefined, calls initialize() function and uses the return value.
   */
  public fieldInit(value: undefined, initialize: () => never): never
  public fieldInit<T>(value: T, initialize: () => never): T
  public fieldInit<T, Q extends T = T>(value: T | undefined, initialize: () => Q): T
  public fieldInit<R extends () => any>(value: ReturnType<R> | undefined, initialize: R): ReturnType<R>
  public fieldInit<R extends () => any>(v: ReturnType<R> | undefined, f: R): ReturnType<R>
  public fieldInit<R extends () => any>(v: ReturnType<R> | undefined, f: R): ReturnType<R> {
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
  public singletonModuleExports<Exports>(
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
  public singletonModuleExports<Exports>(module: string, exports: Exports, version?: number): Exports

  public singletonModuleExports(
    module: any,
    exports: any = module.exports,
    activator?: number | ((module: any) => any),
    version: number | string = 0,
    caller: Function = this.singletonModuleExports
  ): any {
    if (activator !== null && activator !== undefined && typeof activator !== 'function') {
      if ((typeof activator === 'number' || typeof activator === 'string') && version === undefined) {
        version = activator
        activator = undefined
      } else {
        throw new TypeError('Activator must be undefined or a function but is ' + typeof activator)
      }
    }

    return this.singletonModule(
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
      caller
    ).exports
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
  public executableModule<TModule extends NodeModule>(module: TModule, functor?: () => never | void | Promise<any>): TModule
  public executableModule<TExports, TModule = getAppRootPath.IModule<TExports>>(
    module: TModule,
    functor?: () => never | void | Promise<any>
  ): TModule
  public executableModule<TModule extends getAppRootPath.IModule>(module: TModule, functor?: () => never | void | Promise<any>): TModule
  public executableModule<TModule>(module: TModule, functor?: () => never | void | Promise<any>): TModule
  public executableModule(module: string, functor?: () => never | void | Promise<any>): NodeModule
  public executableModule(module: any, functor?: () => never | void | Promise<any>): any
  public executableModule(module: any, functor?: (...args: string[]) => any): any {
    if (typeof functor !== 'function') {
      if (functor !== undefined) {
        throw new TypeError(`Argument "functor" must be a function but is ${typeof functor}`)
      }
      functor = module.exports
      if (typeof functor !== 'function') {
        throw new TypeError(`module.exports must be a function but is ${typeof functor}`)
      }
    }
    module = this.requireModule(module, this.executableModule)
    if (require.main === module) {
      module.executable = true
      executeModule(this, module, functor, this.executableModule)
    }
    return module
  }

  public getTerminalColorSupport(): 0 | 1 | 2 | 3 {
    if (this.isLambda && !this.getIsLocal()) {
      return 0
    }
    if (this._terminalColorSupport === undefined) {
      this._terminalColorSupport = loadColors(this)
    }
    return this._terminalColorSupport
  }

  public setTerminalColorSupport(value: boolean | string | number | null | undefined): void {
    if (value === null) {
      value = false
    }
    if (value !== undefined) {
      if (value === true) {
        value = 1
      } else if (value === false) {
        value = 0
      } else {
        value = Number.parseInt(value as string, 10)
      }
      if (value < 0) {
        value = 0
      }
      if (value > 3) {
        value = 3
      }
      if (!Number.isFinite(value)) {
        value = 0
      }
    }
    this._terminalColorSupport = value as 0 | 1 | 2 | 3 | undefined
  }

  public getIsGitRepo(): boolean {
    if (!this._initialized) {
      this.init()
    }
    return this._isGitRepo!
  }

  public setIsGitRepo(value: boolean): void {
    this._isGitRepo = !!bool(value)
  }

  public getApplicationName(): string {
    if (!this._initialized) {
      this.init()
    }
    return this._appName!
  }

  public setApplicationName(value: string | undefined | null) {
    this._appName = value !== null && value !== undefined ? `${value}` : ''
  }

  public toJSON(): any {
    if (!this._initialized) {
      this.init()
    }
    const result = {}
    const processed = new Set()
    for (let p = this; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
      const names = Object.getOwnPropertyNames(this)
      for (const n of names) {
        if (processed.has(n)) {
          continue
        }
        processed.add(n)
        if (!n.startsWith('_') && n !== 'constructor' && n !== 'prototype') {
          const v = this[n]
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            result[n] = v
          }
        }
      }
    }
    return result
  }

  public toString(): string {
    return this.getPath()
  }

  protected init(): void {
    this._initialized = true
    if (this._isLocal === undefined) {
      this._isLocal = bool(this.env.isLocal)
      if (this._isLocal === undefined) {
        this._isLocal = bool(this.env.npm_config_isLocal)
        if (
          this._isLocal === undefined &&
          (this.env.NODE_ENV === 'development' || this._isTesting || (this.env.VSCODE_PID && this.env.VSCODE_IPC_HOOK))
        ) {
          this._isLocal = true
        }
      }
    }

    if (!this._isLocal && (this.getIsCI() || this.getIsTesting())) {
      this._isLocal = true
    }

    if (!this._isLocal && this.isLambda && bool(process.env.IS_OFFLINE)) {
      this._isLocal = true
    }

    this._root = dirpath(this._root) || dirpath(this.env.APP_ROOT_PATH)

    let root = this._root
    if (!root) {
      if (this.env.VSCODE_PID && this.env.VSCODE_IPC_HOOK) {
        root = this.initialCwd
      } else {
        root = np.resolve(__dirname || '')
        const m = require.main
        if (m && typeof m.filename === 'string' && isGlobalDirectory(this._root)) {
          this._root = np.dirname(m.filename)
          const g = np.resolve(
            (process.platform === 'win32' ? np.dirname(process.execPath) : np.dirname(np.dirname(process.execPath))) || '',
            'lib',
            'node_modules'
          )
          if (root.indexOf(g) !== -1 && root.indexOf(`${np.sep}bin`) === root.length - 4) {
            root = root.slice(0, -4)
          }
        }
        this._root = root
      }

      const nm = `${np.sep}node_modules`
      const nmi = root.indexOf(nm + np.sep)
      if (nmi > 0) {
        this._root = root = root.slice(0, nmi) || root
      }
      if (root.endsWith(nm)) {
        this._root = root = root.slice(0, root.length - nm.length) || root
      }

      let home: string | undefined
      for (let current = root; current; ) {
        const m = readPkg(current)
        if (m) {
          this._manifest = m
          const isRoot = bool(m.root)
          if (isRoot !== false) {
            this._root = root = current
            if (isRoot === true) {
              break
            }
            this._isGitRepo = isGit(current)
            if (this._isGitRepo) {
              break
            }
          }
        }
        const parent = np.dirname(current)
        if (!parent || parent === current || this.isLambda) {
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

    if (this._manifest === undefined) {
      this._manifest = readPkg(root)
    }

    if (this._isGitRepo === undefined) {
      this._isGitRepo = isGit(root)
    }

    if (!this._manifest) {
      this._manifest = { name: np.basename(this._root), private: true }
    }

    this._appName = this._manifest.name

    if (this._isLocal === undefined) {
      this._isLocal = bool(this._manifest.isLocal)
      if (this._isLocal === undefined) {
        const config = this._manifest.config
        if (config) {
          this._isLocal = bool(config.isLocal)
        }
        if (this._isLocal === undefined) {
          this._isLocal = this._isGitRepo
        }
      }
    }

    this.env.APP_ROOT_PATH = this._root

    if (this._isLocal) {
      this.env.isLocal = 'true'
    } else {
      delete this.env.isLocal
    }
  }
}

AppRootPath.prototype[sym] = sym

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

async function executeModule(r: AppRootPath, module: any, functor: () => any, caller: Function): Promise<any> {
  module = r.requireModule(module, caller)
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
      defProp(functor, 'name', { value: name, configurable: true, writable: true })
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

function loadColors(r: AppRootPath) {
  const has = r.hasArgvFlag
  // Based on https://github.com/chalk/supports-color
  let forceColor: boolean | undefined
  if (r.hasArgvFlag('no-color') || r.hasArgvFlag('no-colors') || r.hasArgvFlag('color=false')) {
    forceColor = false
  } else if (r.hasArgvFlag('color') || r.hasArgvFlag('colors') || r.hasArgvFlag('color=true') || r.hasArgvFlag('color=always')) {
    forceColor = true
  }
  const envForceColor = r.env.FORCE_COLOR
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
  if ('CI' in r.env) {
    if ('TRAVIS' in r.env || 'CIRCLECI' in r.env || 'APPVEYOR' in r.env || 'GITLAB_CI' in r.env || r.env.CI_NAME === 'codeship') {
      return 1
    }
    return min
  }
  const teamcityVersion = r.env.TEAMCITY_VERSION
  if (typeof teamcityVersion === 'string') {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(teamcityVersion) ? 1 : 0
  }
  if (r.env.COLORTERM === 'truecolor') {
    return 3
  }
  const termProgram = r.env.TERM_PROGRAM
  if (typeof termProgram === 'string') {
    if (termProgram === 'iTerm.app') {
      return parseInt(termProgram.split('.')[0], 10) >= 3 ? 3 : 2
    }
    if (termProgram === 'Apple_Terminal.app') {
      return 2
    }
  }
  const envTerm = r.env.TERM
  if (typeof envTerm === 'string') {
    if (/-256(color)?$/i.test(envTerm)) {
      return 2
    }
    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(envTerm)) {
      return 1
    }
  }
  return 'COLORTERM' in r.env ? 1 : min
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

function readPkg(p: string): any {
  try {
    const m = JSON.parse(fs.readFileSync(np.join(p, 'package.json')).toString())
    if (typeof m === 'object' && m !== null && typeof m.name === 'string') {
      return m
    }
  } catch (error) {}
  return null
}

function setup(r: AppRootPath): AppRootPath {
  const proto = Object.getPrototypeOf(r)
  for (const n of Object.getOwnPropertyNames(proto)) {
    const def = Object.getOwnPropertyDescriptor(proto, n)
    if (def !== undefined) {
      const f = def.value
      if (typeof f === 'function') {
        defProp(r, n, { value: f.bind(r), configurable: true, writable: true })
      }
    }
  }
  Object.defineProperties(r, {
    isLocal: {
      get: r.getIsLocal,
      set: r.setIsLocal,
      enumerable: true,
      configurable: true
    },
    isCI: {
      get: r.getIsCI,
      set: r.setIsCI,
      enumerable: true,
      configurable: true
    },
    isTesting: {
      get: r.getIsTesting,
      set: r.setIsTesting,
      enumerable: true,
      configurable: true
    },
    isGitRepo: {
      get: r.getIsGitRepo,
      enumerable: true,
      configurable: true
    },
    terminalColorSupport: {
      get: r.getTerminalColorSupport,
      set: r.setTerminalColorSupport,
      enumerable: true,
      configurable: true
    },
    path: {
      get: r.getPath,
      set: r.setPath,
      enumerable: true,
      configurable: true
    },
    applicationName: {
      get: r.getApplicationName,
      set: r.setApplicationName,
      enumerable: true,
      configurable: true
    },
    manifest: {
      get: r.getManifest,
      enumerable: false,
      configurable: true
    }
  })
  return r
}

let getAppRootPath: AppRootPath = global[sym]
if (!getAppRootPath || !getAppRootPath.version) {
  getAppRootPath = new AppRootPath(process.env)
  defProp(global, sym, { value: getAppRootPath, configurable: true, writable: true })
  if (util.inspect.defaultOptions && !util.inspect.defaultOptions.colors && getAppRootPath.terminalColorSupport > 0) {
    util.inspect.defaultOptions.colors = true
  }
} else if (VERSION >= getAppRootPath.version) {
  Object.defineProperties(Object.getPrototypeOf(getAppRootPath), Object.getOwnPropertyDescriptors(AppRootPath.prototype))
  Object.setPrototypeOf(getAppRootPath, AppRootPath.prototype)
  setup(getAppRootPath)
}

defProp(module, 'unloadable', { value: true, configurable: true, writable: true })
defProp(module, 'exports', {
  get() {
    return getAppRootPath
  },
  set: empty,
  configurable: true,
  enumerable: true
})

defProp(require.cache, module.filename, {
  get() {
    return module
  },
  set: empty,
  configurable: true
})

export = getAppRootPath
