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
  console.log(`${chalk.bgHex('#f8ac30').white.bold(' WARN ')} ${chalk.hex('#f8ac30').bold(message)}`)
}

module.exports.exitWithError = exitWithError
module.exports.warn = warn
