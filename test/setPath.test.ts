import getAppRootPath = require('get-app-root-path')

describe('getAppRootPath.setPath', () => {
  beforeAll(() => {
    delete process.env.APP_ROOT_PATH
  })

  it('sets a custom path', () => {
    getAppRootPath.setPath(__dirname)
    expect(getAppRootPath()).toBe(__dirname)
  })

  it('sets process.env.APP_ROOT_PATH', () => {
    getAppRootPath.setPath(__dirname)
    expect(process.env.APP_ROOT_PATH).toBe(__dirname)
  })
})
