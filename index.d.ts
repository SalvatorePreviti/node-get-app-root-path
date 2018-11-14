declare function getAppRootPath(): string

type getAppRootPathFunction = () => string

interface getAppRootPath {
  /**
   * Gets the app root path (the root folder for the application)
   *
   * @returns {string} The app root path, the root folder for the application
   */
  (): string

  /**
   * Gets or sets the getAppRootPath() value.
   * @type {string}
   */
  path: string

  /**
   * Sets the app root path value
   *
   * @param {string|undefined} value The new app root path value.
   * @returns {void}
   */
  setAppRootPath(value: string | undefined): void

  /**
   * Given an absolute path, returns the shortest path to the app root path.
   * This function does nothing if the given path is not absolute.
   *
   * @param {string} file The path to relativize.
   * @returns {string} The relativize or absolute path (depending which one is shorter)
   */
  shortenPath(file: string): string

  /**
   * Gets the "module" object for the given module or file name
   *
   * @param {string|NodeJS.Module} module The module
   * @returns {NodeJS.Module|undefined} The NodeJS module object.
   */
  getModule(module: string | NodeJS.Module): NodeJS.Module | undefined

  /**
   * Makes a module unloadable.
   * Useful to override proxyquire behaviour or other scripts that tries to unload modules.
   *
   * @param {NodeJS.Module|string} module The module to make unloadable
   * @param {*} [exports=undefined] If not undefined, overrides the module.exports
   * @returns {NodeJS.Module|undefined} The module
   */
  makeModuleUnloadable(module: NodeJS.Module | string, exports?: any): NodeJS.Module | undefined

  /**
   * Unloads a module.
   *
   * @param {NodeJS.module|string} module The module to unload
   * @returns {boolean} True if the module was unloaded, false if not
   */
  unloadModule(module: NodeJS.module | string): boolean

  /**
   * Unload all NodeJS modules (except the unloadable modules)
   *
   * @returns {number} The total number of unloaded modules
   */
  unloadAllModules(): number

  /** Returns getAppRootPath() */
  toJSON(): string

  /** Returns getAppRootPath() */
  valueOf(): string

  /** Returns getAppRootPath() */
  toString(): string
}

export = getAppRootPath
