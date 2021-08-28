const chalk = require('chalk')

/**
 * @param {string} message
 */
function exitWithError(message) {
  console.log(
    `${chalk.bgRed.white.bold(' ERROR ')} ${chalk.redBright(message)}`
  )
  process.exit()
}

function warn(message) {
  console.log(
    `${chalk.bgHex('#f8ac30').white.bold(' WARN ')} ${chalk
      .hex('#f8ac30')
      .bold(message)}`
  )
}

function splitOnFirst(string, separator) {
  if (!(typeof string === 'string' && typeof separator === 'string')) {
    throw new TypeError('Expected the arguments to be of type `string`')
  }

  if (string === '' || separator === '') {
    return []
  }

  const separatorIndex = string.indexOf(separator)

  if (separatorIndex === -1) {
    return []
  }

  return [
    string.slice(0, separatorIndex),
    string.slice(separatorIndex + separator.length),
  ]
}

module.exports.splitOnFirst = splitOnFirst
module.exports.exitWithError = exitWithError
module.exports.warn = warn
