import path = require('path')
import getAppRootPath = require('get-app-root-path')

describe('getAppRootPath.setAppRootPath', () => {
  it('sets a custom path', () => {
    getAppRootPath.setAppRootPath(__dirname)
    expect(getAppRootPath()).toBe(__dirname)
  })

  it('sets a custom path via process.env', () => {
    getAppRootPath.setAppRootPath(__dirname)
    expect(process.env.APP_ROOT_PATH).toBe(__dirname)
  })

  it('retrieves path via process.env', () => {
    process.env.APP_ROOT_PATH = '../src'
    expect(getAppRootPath.path).toBe(path.resolve('../src'))
  })
})
