import { AppRootPath as AppRootPathType, IPackageManifest as IPackageManifestType } from './'

export type AppRootPath = AppRootPathType
export type IPackageManifest = IPackageManifestType

const bool = (value: any): boolean | undefined => {
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

const env = (process && process.env) || {}
let root = '/'

let isTesting: boolean | undefined
let isLocal: boolean | undefined
const manifest: IPackageManifest = { name: 'package' }

function _getPath(): string {
  return root!
}

function shortenPath(filepath: string): string {
  return filepath || root
}

function setPath(value: string): void {
  root = value ? `${value}` || '/' : '/'
}

function getIsLocal(): boolean {
  if (isLocal === undefined) {
    isLocal = bool(env.isLocal)
    if (isLocal === undefined) {
      isLocal = bool(env.npm_config_isLocal)
      if (isLocal === undefined && env.NODE_ENV === 'development') {
        isLocal = false
      }
    }
    setIsLocal(!!isLocal)
  }
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

function singletonModuleExportsFunc(_module: any, exports: any): any {
  return exports
}

function moduleFunc(module: any): any {
  if (typeof module === 'string') {
    return require(module)
  }
  return module
}

const fieldInit = <T, Q extends T>(v: Q | undefined, f: () => T): T => (v !== undefined ? v : f())

let hasFlagCache: any

function hasArgvFlag(flag: string) {
  const found = hasFlagCache && hasFlagCache[flag]
  if (found !== undefined) {
    return found
  }
  const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--'
  const argv = process.argv
  let result = false
  if (argv && typeof argv.indexOf === 'function') {
    const pos = argv.indexOf(prefix + flag)
    const terminatorPos = argv.indexOf('--')
    result = pos !== -1 && (terminatorPos === -1 ? true : pos < terminatorPos)
    if (hasFlagCache === undefined) {
      hasFlagCache = Object.create(null)
    }
    hasFlagCache[flag] = result
  }
  return result
}

Object.defineProperties(_getPath, {
  default: { value: _getPath, writable: true, configurable: true },
  globalCache: { value: Object.create(null) },
  fieldInit: { value: fieldInit, writable: true, configurable: true },
  coreModule: { value: moduleFunc, writable: true, configurable: true },
  requireModule: { value: require, writable: true, configurable: true },
  getModuleFromRequireCache: { value: moduleFunc, writable: true, configurable: true },
  singletonModuleExports: { value: singletonModuleExportsFunc, writable: true, configurable: true },
  singletonModule: { value: moduleFunc, writable: true, configurable: true },
  executableModule: { value: moduleFunc, writable: true, configurable: true },
  shared: { value: {}, enumerable: false, configurable: false, writable: false },
  getAppRootPath: { value: _getPath },
  setPath: { value: setPath, writable: true },
  shortenPath: { value: shortenPath },
  getIsLocal: { value: getIsLocal },
  setIsLocal: { value: setIsLocal },
  getIsTesting: { value: getIsTesting },
  setIsTesting: { value: setIsTesting },
  initialCwd: { value: '/', writable: true },
  env: { value: env },
  name: { value: '', writable: true, configurable: true },
  path: { get: _getPath, set: setPath, enumerable: true },
  isLambda: { value: false, enumerable: true },
  isLocal: { get: getIsLocal, set: setIsLocal, enumerable: true },
  isTesting: { get: getIsTesting, set: setIsTesting, enumerable: true },
  manifest: { value: manifest, enumerable: false },
  toString: { value: _getPath, writable: true, configurable: true },
  terminalColorSupport: { value: 0, configurable: true, writable: true },
  hasArgvFlag: { value: hasArgvFlag, writable: true, configurable: true },
  toJSON: {
    value() {
      return { ..._getPath }
    },
    writable: true,
    configurable: true
  }
})

export const getPath = _getPath as AppRootPath
export namespace getAppRootPath {
  // tslint:disable-next-line:no-shadowed-variable
  export type AppRootPath = AppRootPathType
  // tslint:disable-next-line:no-shadowed-variable
  export type IPackageManifest = IPackageManifestType
}

export default getAppRootPath
