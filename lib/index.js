const Client = require('ssh2-sftp-client')
const ora = require('ora')
const glob = require('glob')
const fs = require('fs')
const minimatch = require('minimatch')
const inquirer = require('inquirer')
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
      (
        await sftp.list(remotePath)
      ).map(async (o) => {
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
    const _r = opts.connectOptions
    spinner.succeed(
      `Connected sftp://${_r.username}:${_r.password}@${_r.host}:${_r.port}/${opts.remotePath}`
    )

    if (!fs.existsSync(opts.localPath)) {
      throw new Error('empty local path')
    }
    
    if (!opts.remotePath) {
      throw new Error('empty remote path')
    }

    if (!(await sftp.exists(opts.remotePath))) {
      const { confirm } = await inquirer.prompt({
        name: 'confirm',
        message: `The remote path does not exist, do you want to create it?`,
        type: 'confirm',
      })
      if (confirm) {
        await sftp.mkdir(opts.remotePath, true)
      } else {
        process.exit(1)
      }
    }

    let remoteDeletefiles = []
    let localUploadFiles = []

    spinner.start('Get local/remote files')

    localUploadFiles = getFilesPath(
      opts.localPath,
      opts.remotePath,
      opts.ignore || []
    )

    spinner.succeed(`Local upload count: ${localUploadFiles.length}`)
    if (opts.cleanRemoteFiles) {
      remoteDeletefiles = await getRemoteDeepFiles(sftp, opts.remotePath, {
        patterns: opts.cleanRemoteFiles === true ? [] : opts.cleanRemoteFiles,
      })

      spinner.succeed(`Remote delete count: ${remoteDeletefiles.length}`)

      if (remoteDeletefiles.length > localUploadFiles.length) {
        const { confirm } = await inquirer.prompt({
          name: 'confirm',
          message: `Need to delete remote files (${remoteDeletefiles.length}) more than local files (${localUploadFiles.length}). Continue?`,
          type: 'confirm',
        })
        if (!confirm) {
          process.exit(1)
        }
      }

      spinner.start('Start delete remote files')
      for (const i in remoteDeletefiles) {
        const s = remoteDeletefiles[i]
        spinner.text = `[${i}/${remoteDeletefiles.length}] Delete file ${s}`
        await sftp.delete(s)
      }
      spinner.succeed(`Deleted ${opts.remotePath}`)
    }

    spinner.start(`Uploading dir ${opts.localPath} to ${opts.remotePath}`)

    if (opts.ignore && opts.ignore.length > 0) {
      for (const i in localUploadFiles) {
        const o = localUploadFiles[i]
        spinner.text = `[${i}/${localUploadFiles.length}] Uploading file ${o.localPath} to ${o.remotePath}`
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

/**
 * @param {Options} opts
 * @param {{d:boolean,u:boolean,i:boolean}} lsOpts
 */
async function sshSftpLS(opts, lsOpts) {
  const sftp = new Client()
  try {
    await sftp.connect(opts.connectOptions)

    if (lsOpts.d) {
      if (opts.cleanRemoteFiles) {
        const ls = await getRemoteDeepFiles(sftp, opts.remotePath, {
          patterns: opts.cleanRemoteFiles === true ? [] : opts.cleanRemoteFiles,
        })
        console.log(`Delete ${opts.remotePath} files(${ls.length}):`)
        for (const s of ls) {
          console.log(`  - ${s}`)
        }
      }
    }

    if (lsOpts.i && opts.ignore && opts.ignore.length > 0) {
      let ls = glob.sync(`${opts.localPath}/**/*`, { nodir: true })
      ls = ls.filter((s) => opts.ignore.every((reg) => minimatch(s, reg)))

      console.log(`ignore files(${ls.length}):`)
      for (const s of ls) {
        console.log(`  - ${s}`)
      }
    }

    if (lsOpts.u) {
      if (opts.ignore && opts.ignore.length > 0) {
        const ls = getFilesPath(opts.localPath, opts.remotePath, opts.ignore)
        console.log(`Upload files(${ls.length}): `)
        for (const o of ls) {
          console.log(`  + ${o.localPath}`)
        }
      } else {
        console.log(`Upload ${opts.localPath} all files to ${opts.remotePath}`)
      }
    }
  } catch (error) {
    console.error(error)
  } finally {
    sftp.end()
  }
}

module.exports = sshSftp
module.exports.sshSftp = sshSftp
module.exports.sshSftpLS = sshSftpLS
module.exports.Client = Client
