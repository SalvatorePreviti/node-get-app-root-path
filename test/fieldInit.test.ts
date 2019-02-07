import getAppRootPath = require('get-app-root-path')

describe('getAppRootPath.fieldInit', () => {
  it('returns the value if not undefined', () => {
    const v = getAppRootPath.fieldInit(123, () => 456)
    expect(v).toBe(123)
  })

  it('does not call init if not undefined', () => {
    const v = getAppRootPath.fieldInit(
      123,
      (): any => {
        throw new Error()
      }
    )
    expect(v).toBe(123)
  })

  it('can throw exceptions', () => {
    expect(() => {
      const v = getAppRootPath.fieldInit(undefined, () => {
        throw new TypeError()
      })
      expect(v).toBe(undefined)
    }).toThrow(TypeError)
  })

  it('initializes if the value is undefined', () => {
    const v = getAppRootPath.fieldInit(undefined, () => 4)
    expect(v).toBe(4)
  })
})
