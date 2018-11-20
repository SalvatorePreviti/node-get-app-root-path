import util = require('util')
import path = require('path')
import fs = require('fs')
import os = require('os')
import cjs = require('module')

const getAppRootPath: getAppRootPath.AppRootPath = setup()

namespace getAppRootPath {
  export interface IModule {
    exports: any
    id: string
    filename: string
    loaded: boolean
    parent: IModule | null
    children: IModule[]
    paths: string[]
    require?: NodeRequireFunction | undefined
  }

  export interface AppRootPath {
    /**
     * Gets the application root path or thr workspace root path.
     * @returns {string} The application root path.
     */

    (): string

    /**
     * True if the application is running as a lambda function
     * @type {boolean}
     */
    readonly isLambda: boolean

    /**
     * True if the root application folder is a git repository (has .git and .gitignore)
     * @type {boolean}
     */
    readonly isGitRepo: boolean

    /**
     * The root package.json manifest.
     * @type {IPackageManifest}
     */
    readonly manifest: IPackageManifest

    /**
     * The initial process.env
     * @type {NodeJS.ProcessEnv}
     */
    readonly env: NodeJS.ProcessEnv

    /**
     * The initial directory when the application was started.
     * @type {string}
     */
    readonly initialCwd: string

    /**
     * True if running in a local environment.
     * @type {boolean}
     */
    isLocal: boolean

    /**
     * True if a unit test framework (jest, mocha) was detected.
     * @type {boolean}
     */
    isTesting: boolean

    /**
     * Gets or sets the application root path
     * @type {string}
     */
    path: string

    /**
     * Gets or sets the application name
     * @type {string}
     */
    name: string

    /**
     * A map of shared values between modules.
     *
     * @type {{ [key: string]: any }}
     * @memberof AppRootPath
     */
    readonly shared: { [key: string]: any }

    /**
     * Returns true if running in a local environment.
     * @returns {boolean} True if running in a local environment.
     */
    getIsLocal(): boolean

    /**
     * Sets isLocal value (running inside a local environment).
     * @param {(string | boolean)} value The boolean value.
     */
    setIsLocal(value: string | boolean): void

    /**
     * Returns true if running in a unit testing framework.
     * @returns {boolean} True if running in a unit testing framework.
     */
    getIsTesting(): boolean

    /**
     * Sets isTesting value (running inside a unit test framework).
     * @param {(string | boolean)} value The boolean value.
     */
    setIsTesting(value: string | boolean): void

    /**
     * Gets the application or workspace root folder path.
     * @returns {string} The application or workspace root folder path.
     */
    getPath(): string

    /**
     * Sets the application or workspace root folder path.
     * @param {string} value The new root folder path.
     */
    setPath(value: string): void

    /**
     * Shortens a path making it relative to the specified rootDir.
     * By default, rootDir is the application or workspace root path.
     *
     * @param {string} p The path to shorten.
     * @param {string} [rootDir] The root dir, by default is getAppRootPath()
     * @returns {string} The shortened path. May be relative or absolute.
     */
    shortenPath(p: string, rootDir?: string): string

    /**
     * Marks a NodeJS module as a core module that should not be unloaded.
     *
     * @template Module NodeJS module
     * @param {Module} module NodeJS module
     * @returns {Module} NodeJS module
     */
    coreModule<TModule extends IModule>(module: TModule): TModule

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
    executableModule<TModule extends IModule>(module: TModule, functor: () => never | void | Promise<any>): TModule
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
    contributors?: string[] | { name: string; email?: string; homepage?: string; [key: string]: string | undefined }[]
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

function setup() {
  const uniqueSym = Symbol.for('#get-app-root-path')
  let sr: getAppRootPath.AppRootPath = require.cache[uniqueSym]
  if (typeof sr === 'function') {
    return sr
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

  function dirpath(s: any): string {
    if (typeof s === 'string' && s.length) {
      try {
        s = path.resolve(s)
        return fs.existsSync(s) ? s : ''
      } catch (_error) {}
    }
    return ''
  }

  const env = process.env
  const initialCwd = path.resolve(process.cwd())
  const lambdaTaskRoot = dirpath(path.sep === '/' && env.AWS_EXECUTION_ENV && env.AWS_LAMBDA_FUNCTION_NAME && env.LAMBDA_TASK_ROOT)
  const isLambda = !!lambdaTaskRoot

  let isTesting: boolean | undefined
  let isLocal: boolean | undefined
  let isGitRepo: boolean | undefined
  let appName: string | undefined

  if (isLambda) {
    isLocal = bool(process.env.IS_OFFLINE)
  }

  let root: string | undefined
  let manifest: getAppRootPath.IPackageManifest

  let init: () => void

  sr = function getAppRootPath(): string {
    init()
    return root!
  } as getAppRootPath.AppRootPath

  function shortenPath(filepath: string, rootDir: string = sr()): string {
    filepath = path.normalize(filepath)
    if (path.isAbsolute(filepath)) {
      const p = path.normalize(path.relative(rootDir, filepath))
      if (p.length < filepath.length) {
        filepath = p
      }
    }
    return filepath
  }

  function setPath(value: string): void {
    root = path.resolve(value)
    env.APP_ROOT_PATH = root
  }

  function getIsLocal(): boolean {
    init()
    return isLocal!
  }

  function setIsLocal(value: string | boolean): void {
    isLocal = bool(value) || !!value
    if (isLocal) {
      env.isLocal = 'true'
    } else {
      delete env.isLocal
    }
  }

  function getIsTesting(): boolean {
    if (isTesting === undefined) {
      const g = global as any
      if (
        typeof g.it === 'function' &&
        typeof g.describe === 'function' &&
        typeof g.afterEach === 'function' &&
        typeof g.beforeEach === 'function' &&
        ((typeof g.before === 'function' && typeof g.after === 'function') ||
          (typeof g.beforeAll === 'function' && typeof g.afterAll === 'function'))
      ) {
        isTesting = true
        return true
      }
      return false
    }
    return isTesting
  }

  function setIsTesting(value: string | boolean): void {
    isTesting = bool(value) || !!value
  }

  function isGlobalDirectory(dir: any): boolean {
    if (typeof dir !== 'string') {
      return false
    }
    const globalPaths = (cjs as { globalPaths?: string[] }).globalPaths
    if (globalPaths) {
      for (let i = 0, len = globalPaths.length; i < len; ++i) {
        const globalPath = globalPaths[i]
        if (dir.indexOf(globalPath) === 0) {
          return true
        }
      }
    }
    return false
  }

  function isGit(p: string): boolean {
    try {
      return fs.statSync(path.join(p, '.git')).isDirectory() && fs.statSync(path.join(p, '.gitignore')).isFile()
    } catch (_e) {
      return false
    }
  }

  function readManifest(p: string): any {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(p, 'package.json')).toString())
      if (typeof m === 'object' && m !== null && typeof m.name === 'string') {
        return m
      }
    } catch (_e) {}
    return null
  }

  init = function(): void {
    init = doNothing

    if (isLocal === undefined) {
      isLocal = bool(env.isLocal)
      if (isLocal === undefined) {
        isLocal = bool(env.npm_config_isLocal)
        if (isLocal === undefined && (env.NODE_ENV === 'development' || isTesting || (env.VSCODE_PID && env.VSCODE_IPC_HOOK))) {
          isLocal = true
        }
      }
    }

    root = dirpath(root) || dirpath(env.APP_ROOT_PATH)

    if (!root) {
      if (env.VSCODE_PID && env.VSCODE_IPC_HOOK) {
        root = initialCwd
      } else {
        root = path.resolve(__dirname || '')
        const m = require.main
        if (m && typeof m.filename === 'string' && isGlobalDirectory(root)) {
          root = path.dirname(m.filename)
          const g = path.resolve(
            (process.platform === 'win32' ? path.dirname(process.execPath) : path.dirname(path.dirname(process.execPath))) || '',
            'lib',
            'node_modules'
          )
          if (root.indexOf(g) !== -1 && root.indexOf(`${path.sep}bin`) === root.length - 4) {
            root = root.slice(0, -4)
          }
        }
      }

      const nm = `${path.sep}node_modules`
      const nmi = root.indexOf(nm + path.sep)
      if (nmi > 0) {
        root = root.slice(0, nmi) || root
      }
      if (root.endsWith(nm)) {
        root = root.slice(0, root.length - nm.length) || root
      }

      let home: string | undefined
      for (let current = root; current; ) {
        const m = readManifest(current)
        if (m) {
          manifest = m
          root = current
          const ir = bool(m.root)
          if (ir !== false) {
            if (ir === true) {
              break
            }
            isGitRepo = isGit(root)
            if (isGitRepo) {
              break
            }
          }
        }
        const parent = path.dirname(current)
        if (!parent || parent === current || isLambda) {
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

    if (manifest === undefined) {
      manifest = readManifest(root)
    }

    if (isGitRepo === undefined) {
      isGitRepo = isGit(root)
    }

    if (!manifest) {
      manifest = { name: path.basename(root), private: true }
    }

    appName = manifest.name

    if (isLocal === undefined) {
      isLocal = bool(manifest.isLocal)
      if (isLocal === undefined) {
        const config = manifest.config
        if (config) {
          isLocal = bool(config.isLocal)
        }
        if (isLocal === undefined) {
          isLocal = isGitRepo
        }
      }
    }

    env.APP_ROOT_PATH = root
    setIsLocal(isLocal!)
  }

  function coreModule(module: any): any {
    module.unloadable = true
    if (isLambda && !isLocal) {
      return module
    }
    const key = module.filename
    if (typeof key === 'string' && key.length) {
      Object.defineProperty(require.cache, key, {
        get() {
          return module
        },
        set: doNothing,
        configurable: true,
        enumerable: false
      })
    }
    return module
  }

  async function executeExecutableModule(module: any, functor: () => any): Promise<any> {
    module.executable = true
    const f = functor || module.exports
    let name
    const fname = module.filename
    if (typeof fname === 'string' && fname.length) {
      name = path.basename(fname, '.js')
      if (name === 'index') {
        name = path.dirname(fname)
      }
    }
    if (!name) {
      name = 'module'
    }
    if (!f.name) {
      try {
        Object.defineProperty(f, 'name', { value: name, configurable: true, writable: true })
      } catch (_e) {}
    }
    const n = `- running ${name}`
    console.info(n)
    console.time(n)
    try {
      await new Promise(setImmediate)
      await functor()
    } catch (error) {
      if (!process.exitCode) {
        process.exitCode = -1
      }
      console.error('Error ', n, error)
    } finally {
      console.timeEnd(n)
    }
  }

  function executableModule(module: any, functor?: (...args: string[]) => any): any {
    if (typeof functor !== 'function') {
      if (functor !== undefined) {
        throw new TypeError(`Argument "functor" must be a function but is ${typeof functor}`)
      }
      functor = module.exports
      if (typeof functor !== 'function') {
        throw new TypeError(`module.exports must be a function but is ${typeof functor}`)
      }
    }
    if (require.main === module) {
      executeExecutableModule(module, functor)
    }
    return module
  }

  function getInfo() {
    const result = {}
    for (const k of Object.keys(sr)) {
      const v = sr[k]
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        result[k] = v
      }
    }
    return result
  }

  Object.defineProperties(sr, {
    default: { value: sr, writable: true, configurable: true },
    coreModule: { value: coreModule, writable: true, configurable: true },
    executableModule: { value: executableModule, writable: true, configurable: true },
    getPath: { value: sr },
    setPath: { value: setPath, writable: true },
    shortenPath: { value: shortenPath },
    getIsLocal: { value: getIsLocal },
    setIsLocal: { value: setIsLocal },
    getIsTesting: { value: getIsTesting },
    setIsTesting: { value: setIsTesting },
    initialCwd: { value: initialCwd },
    env: { value: env },
    isLambda: { value: isLambda, enumerable: true },
    isLocal: { get: getIsLocal, set: setIsLocal, enumerable: true },
    isTesting: { get: getIsTesting, set: setIsTesting, enumerable: true },
    shared: { value: Object.create(null), enumerable: false, configurable: false, writable: false },
    isGitRepo: {
      get() {
        init()
        return isGitRepo
      },
      enumerable: true
    },
    path: {
      get: sr,
      set(value) {
        sr.setPath(value)
      },
      enumerable: true
    },
    name: {
      get() {
        init()
        return appName
      },
      set(value) {
        appName = value !== null && value !== undefined ? `${value}` : ''
      },
      enumerable: true,
      configurable: true
    },
    manifest: {
      get() {
        init()
        return manifest
      },
      enumerable: false
    },
    toJSON: {
      value: getInfo,
      writable: true,
      configurable: true
    },
    toString: { value: sr, writable: true, configurable: true }
  })

  Object.defineProperty(sr, util.inspect.custom, {
    value: getInfo,
    writable: true,
    configurable: true
  })

  function doNothing() {}

  Object.defineProperty(require.cache, uniqueSym, { value: sr, configurable: true, writable: true })

  return sr
}

export = getAppRootPath
