const Client = require('ssh2-sftp-client')
const ora = require('ora')
const glob = require('glob')
const fs = require('fs')
const minimatch = require('minimatch')

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
 * get remote ls deep
 *
 * @typedef {Object} FilesOptions
 * @property {true|string[]} [patterns]
 * @property {boolean} [noDir]
 *
 * @param {Client} sftp
 * @param {string} remotePath
 * @param {FilesOptions} [options]
 * @return {Promise<string[]>}
 */
async function getRemoteDeepFiles(sftp, remotePath, options) {
  const { patterns, noDir = true } = options
  /**
   * @param {string} remotePath
   * @returns {Promise<string[]|string>}
   */
  async function getFiles(remotePath) {
    return await Promise.all(
      (await sftp.list(remotePath)).map(async (o) => {
        if (o.type === 'd') {
          return [
            !noDir && remotePath + '/' + o.name,
            await getFiles(remotePath + '/' + o.name),
          ]
        } else {
          return remotePath + '/' + o.name
        }
      })
    )
  }
  const ls = (await getFiles(remotePath)).flat(Infinity).filter(Boolean)

  if (Array.isArray(patterns)) {
    let tmp = ls
    const fns = patterns.map((s) => minimatch.filter(s))
    fns.forEach((fn) => {
      tmp = tmp.filter(fn)
    })
    return tmp
  }
  return ls
}

/**
 * @typedef {Object} Options
 * @property {string} localPath
 * @property {string} remotePath
 * @property {import('ssh2').ConnectConfig} connectOptions
 * @property {string[]} [ignore]
 * @property {boolean|string[]} [cleanRemoteFiles]
 * @param {Options} opts
 */
async function sshSftp(opts) {
  const spinner = ora('Connecting').start()
  const sftp = new Client()
  try {
    await sftp.connect(opts.connectOptions)

    if (opts.cleanRemoteFiles) {
      spinner.succeed().start(`delete ${opts.remotePath}`)
      const ls = await getRemoteDeepFiles(sftp, opts.remotePath, {
        patterns: opts.cleanRemoteFiles === true ? [] : opts.cleanRemoteFiles,
      })
      for (const s of ls) {
        await sftp.delete(s)
      }
    }

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
