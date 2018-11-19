import path = require('path')
import getAppRootPath = require('get-app-root-path')

describe('getAppRootPath', () => {
  beforeAll(() => {
    delete process.env.APP_ROOT_PATH
  })

  it('has an env property', () => {
    expect(getAppRootPath.env).toBe(process.env)
  })

  it('has manifest', () => {
    expect(getAppRootPath.manifest.name).toBe('@dev/get-app-root-path')
  })

  it('has isLambda false', () => {
    expect(getAppRootPath.isLambda).toBe(false)
  })

  it('has isLocal true', () => {
    expect(getAppRootPath.isLocal).toBe(true)
  })

  it('has isTesting true', () => {
    expect(getAppRootPath.isTesting).toBe(true)
  })

  it('has isGitRepo true', () => {
    expect(getAppRootPath.isGitRepo).toBe(true)
  })

  it('returns the root path', () => {
    expect(getAppRootPath()).toEqual(path.resolve(path.join(__dirname, '..')))
  })

  it('returns the root path with the property path', () => {
    expect(getAppRootPath.path).toEqual(path.resolve(path.join(__dirname, '..')))
  })

  it('returns the root path with toString', () => {
    expect(getAppRootPath.toString()).toEqual(path.resolve(path.join(__dirname, '..')))
  })

  it('has a shared object', () => {
    expect(typeof getAppRootPath.shared === 'object' && getAppRootPath.shared !== null)
  })
})
