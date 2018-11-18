import path = require('path')
import fs = require('fs')
import os = require('os')
import cjs = require('module')

const env = process.env
const initialCwd = path.resolve(process.cwd())
const lambdaTaskRoot = dirpath(path.sep === '/' && env.AWS_EXECUTION_ENV && env.AWS_LAMBDA_FUNCTION_NAME && env.LAMBDA_TASK_ROOT)
const isLambda = !!lambdaTaskRoot
let isLocal = isLambda ? false : undefined
let root: string | undefined
let manifest: getAppRootPath.IPackageManifest

let init: () => void

const getAppRootPath = function getAppRootPath(): string {
  init()
  return root!
} as getAppRootPath.getAppRootPath

namespace getAppRootPath {
  export interface getAppRootPath {
    (): string

    readonly isLambda: boolean
    readonly manifest: IPackageManifest
    readonly env: NodeJS.ProcessEnv
    readonly initialCwd: string
    isLocal: boolean
    path: string

    getAppRootPath(): string
    setAppRootPath(value: string): void

    parseBool(value: any): boolean | undefined
  }

  export interface IPackageManifest {
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

function setAppRootPath(value: string): void {
  root = path.resolve(value)
  env.APP_ROOT_PATH = root
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

function setIsLocal(value: string | boolean): void {
  const v = bool(value)
  if (v === undefined) {
    throw new TypeError(`isLocal must be a valid boolean value but is "${value}"`)
  }
  isLocal = v
  if (v) {
    env.isLocal = 'true'
  } else {
    delete env.isLocal
  }
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

init = function(): void {
  init = () => {}

  if (isLocal === undefined) {
    isLocal = bool(env.isLocal || env.npm_config_isLocal)
    if (isLocal === undefined && env.NODE_ENV === 'development') {
      isLocal = true
    }
  }

  root = dirpath(env.APP_ROOT_PATH)

  if (!root) {
    if (env.VSCODE_PID && env.VSCODE_IPC_HOOK) {
      root = initialCwd
      if (isLocal === undefined) {
        isLocal = true
      }
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
  }

  let home: string | undefined
  for (let current = root; current; ) {
    try {
      const p = path.join(current, 'package.json')
      if (fs.statSync(p).isFile()) {
        manifest = require(p)
        if (typeof manifest === 'object' && manifest.name) {
          root = current
          const mr = manifest.root
          if (mr || (mr !== false && fs.lstatSync(path.join(current, '.git')).isDirectory())) {
            break
          }
        }
      }
    } catch (_e) {}
    const parent = path.dirname(current)
    if (!parent || parent === current || isLambda) {
      break
    }
    if (home === undefined) {
      home = os.homedir() || ''
    }
    if (current === home) {
      break
    }
    current = parent
  }

  if (manifest === undefined) {
    manifest = { name: path.dirname(root), private: true }
  } else if (isLocal === undefined) {
    isLocal = bool(manifest.isLocal)
    if (isLocal === undefined) {
      const config = manifest.config
      if (config) {
        isLocal = bool(config.isLocal)
      }
    }
  }

  setIsLocal(isLocal!)
  setAppRootPath(root)
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

Object.defineProperties(getAppRootPath, {
  getAppRootPath: { value: getAppRootPath },
  setAppRootPath: { value: setAppRootPath, writable: true },
  setIsLocal: { value: setIsLocal },
  initialCwd: { value: initialCwd },
  env: { value: env },
  isLambda: { value: isLambda, enumerable: true },
  path: {
    get: getAppRootPath,
    set(value) {
      getAppRootPath.setAppRootPath(value)
    },
    enumerable: true
  },
  isLocal: {
    get() {
      init()
      return isLocal
    },
    set: setIsLocal,
    enumerable: true
  },
  manifest: {
    get() {
      init()
      return manifest
    },
    enumerable: false
  }
})

export = getAppRootPath

console.log(Object.keys(getAppRootPath))
