const Client = require('ssh2-sftp-client')
const ora = require('ora')
const glob = require('glob')
const fs = require('fs')

/**
 * get upload files
 *
 * @param {string} localPath
 * @param {string} remotePath
 * @param {string[]} ignore
 */
function getFilesPath(localPath, remotePath, ignore) {
  if (!fs.existsSync(localPath)) throw new Error('path not exists')

  if (fs.statSync(localPath).isFile()) {
    return [{ localPath, remotePath }]
  }

  const files = glob.sync(`${localPath}/**/*`, { ignore })
  return files.map((localFilePath) => {
    return {
      localPath: localFilePath,
      remotePath: localFilePath.replace(localPath, remotePath),
    }
  })
}

/**
 * @typedef {Object} Options
 * @property {string} localPath
 * @property {string} remotePath
 * @property {import('ssh2').ConnectConfig} connectOptions
 * @property {string[]} [ignore]
 * @param {Options} opts
 */
async function sshSftp(opts) {
  const spinner = ora('Connecting').start()
  const sftp = new Client()
  try {
    await sftp.connect(opts.connectOptions)

    spinner
      .succeed()
      .start(`uploadingDir ${opts.localPath} to ${opts.remotePath}`)

    if (opts.ignore && opts.ignore.length > 0) {
      const ls = getFilesPath(opts.localPath, opts.remotePath, opts.ignore)
      for (const o of ls) {
        spinner.text = `uploadingDir ${o.localPath} to ${o.remotePath}`
        if (fs.statSync(o.localPath).isDirectory()) {
          if (!(await sftp.exists(o.remotePath))) {
            await sftp.mkdir(o.remotePath)
          }
          continue
        }
        await sftp.fastPut(o.localPath, o.remotePath)
      }
    } else {
      await sftp.uploadDir(opts.localPath, opts.remotePath)
    }
    spinner.succeed(`Uploaded ${opts.localPath} to ${opts.remotePath}`)
  } catch (error) {
    spinner.fail()
    console.error(error)
  } finally {
    sftp.end()
  }
}

module.exports = sshSftp
module.exports.sshSftp = sshSftp
