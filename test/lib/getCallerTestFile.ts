import getAppRootPath = require('get-app-root-path')

function getCallerTestFile(callerFunction?: Function | undefined) {
  return {
    declarationFile: __filename,
    declarationDir: __dirname,
    file: getAppRootPath.getCallerFile(callerFunction),
    dir: getAppRootPath.getCallerDir(callerFunction)
  }
}

export = getCallerTestFile
