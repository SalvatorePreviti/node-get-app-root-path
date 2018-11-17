module.exports = {
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  roots: ['test'],
  testRegex: './test/.*.test.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  globals: { 'ts-jest': { tsConfig: './test/tsconfig.json' } },
  moduleNameMapper: {
    'get-app-root-path': '<rootDir>/src'
  }
}
