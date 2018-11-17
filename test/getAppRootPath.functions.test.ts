import path = require('path')
import getAppRootPath = require('get-app-root-path')
import getCallerTestFile = require('./lib/getCallerTestFile')

describe('getAppRootPath functions', () => {
  describe('getCallerDir, getCallerFile', () => {
    it('returns valid result without any caller', () => {
      const t = getCallerTestFile()
      expect(t.dir).toBe(t.declarationDir)
      expect(t.file).toBe(t.declarationFile)
    })

    it('returns valid result with getCallerTestFile caller', () => {
      const t = getCallerTestFile(getCallerTestFile)
      expect(t.dir).toBe(__dirname)
      expect(t.file).toBe(__filename)
    })
  })

  describe('resolve', () => {
    it('is able to resolve this module (full path)', () => {
      const resolved = getAppRootPath.resolve(__filename)
      expect(resolved).toBe(__filename)
    })

    it('is able to resolve this module (relative path)', () => {
      const resolved = getAppRootPath.resolve(`./${path.basename(__filename)}`)
      expect(resolved).toBe(__filename)
    })

    it('is able to resolve jest', () => {
      const resolved = getAppRootPath.resolve('jest')
      expect(resolved).toContain('node_modules')
      expect(resolved).toContain('jest')
    })
  })

  describe('tryResolve', () => {
    it('is able to resolve this module (full path)', () => {
      const resolved = getAppRootPath.tryResolve(__filename)
      expect(resolved).toBe(__filename)
    })

    it('is able to resolve this module (relative path)', () => {
      const resolved = getAppRootPath.tryResolve(`./${path.basename(__filename)}`)
      expect(resolved).toBe(__filename)
    })

    it('is able to resolve jest', () => {
      const resolved = getAppRootPath.tryResolve('jest')
      expect(resolved).toContain('node_modules')
      expect(resolved).toContain('jest')
    })
  })
})
