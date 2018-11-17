import path = require('path')
import getAppRootPath = require('get-app-root-path')

describe('getAppRootPath basic', () => {
  it('gets this project root path', () => {
    const expectedPath = path.resolve(path.join(__dirname, '..'))
    expect(getAppRootPath()).toEqual(expectedPath)
  })

  it('gets this project root path accessing property getAppRootPath.path', () => {
    const expectedPath = path.resolve(path.join(__dirname, '..'))
    expect(getAppRootPath.path).toEqual(expectedPath)
  })
})
