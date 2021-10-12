const Client = require('ssh2-sftp-client')
const ora = require('ora')
const glob = require('glob')
const fs = require('fs')
const minimatch = require('minimatch')
const inquirer = require('inquirer')
const { exitWithError, warn, splitOnFirst } = require('./utils')
const chalk = require('chalk')

/**
 * get upload files
 *
 * @param {string} localPath
 * @param {string} remotePath
 * @param {string[]} ignore
 */
function getFilesPath(localPath, remotePath, ignore) {
  const files = glob.sync(`${localPath}/**/*`, {
    ignore: getSafePattern(ignore, localPath),
  })
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
 *
 * @param {Client} sftp
 * @param {string} remotePath
 * @param {FilesOptions} [options]
 * @return {Promise<{isDir:boolean;path:string}[]>}
 */
async function getRemoteDeepFiles(sftp, remotePath, options) {
  const { patterns } = options
  /**
   * @param {string} remotePath
   * @returns {Promise<string[]|string>}
   */
  async function getFiles(remotePath, data = []) {
    const list = await sftp.list(remotePath)
    for (const item of list) {
      const path = remotePath + '/' + item.name
      if (item.type === 'd') {
        data.push({ isDir: true, path })
        await getFiles(path, data)
      } else {
        data.push({ isDir: false, path })
      }
    }
    return data
  }
  const ls = (await getFiles(remotePath)).filter((o) => o.path)

  if (patterns.length > 0) {
    let tmp = ls
    const safePatterns = getSafePattern(patterns, remotePath)
    tmp = tmp.filter((o) => safePatterns.some((reg) => minimatch(o.path, reg)))
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
 * @property {boolean} [securityLock]
 * @property {boolean} [keepAlive]
 * @param {Options} opts
 */
async function sshSftp(opts) {
  opts = parseOpts(opts)
  const spinner = ora('连接服务器').start()
  const sftp = new Client()
  try {
    await sftp.connect(opts.connectOptions)
    const _r = opts.connectOptions
    spinner.succeed(
      `已连接 sftp://${_r.username}:${_r.password}@${_r.host}:${_r.port}/${opts.remotePath}`
    )

    if (!(await sftp.exists(opts.remotePath))) {
      const { confirm } = await inquirer.prompt({
        name: 'confirm',
        message: `远程文件夹不存在，是否要创建一个`,
        type: 'confirm',
      })
      if (confirm) {
        await sftp.mkdir(opts.remotePath, true)
      } else {
        process.exit()
      }
    }

    let remoteDeletefiles = []
    let localUploadFiles = []

    spinner.start('对比本地/远程的文件数量')

    localUploadFiles = getFilesPath(
      opts.localPath,
      opts.remotePath,
      opts.ignore || []
    )

    spinner.succeed(`本地文件数量：${localUploadFiles.length}`)
    if (opts.cleanRemoteFiles) {
      remoteDeletefiles = await getRemoteDeepFiles(sftp, opts.remotePath, {
        patterns: opts.cleanRemoteFiles === true ? [] : opts.cleanRemoteFiles,
      })

      spinner.succeed(`远程文件数量：${remoteDeletefiles.length}`)

      if (remoteDeletefiles.length > localUploadFiles.length) {
        const { confirm } = await inquirer.prompt({
          name: 'confirm',
          message: `远程需要删除的文件数 (${remoteDeletefiles.length}) 比本地多 (${localUploadFiles.length})，确定要删除吗?`,
          type: 'confirm',
        })
        if (!confirm) {
          process.exit()
        }
      }

      spinner.start('开始删除远程文件')
      remoteDeletefiles = mergeDelete(remoteDeletefiles)
      for (const i in remoteDeletefiles) {
        const o = remoteDeletefiles[i]
        spinner.text = `[${i}/${remoteDeletefiles.length}] 正在删除 ${o.path}`
        if (o.isDir) await sftp.rmdir(o.path, true)
        else await sftp.delete(o.path)
      }
      spinner.succeed(`已删除 ${opts.remotePath}`)
    }

    spinner.start(`开始上传 ${opts.localPath} 到 ${opts.remotePath}`)

    if (Array.isArray(opts.ignore) && opts.ignore.length > 0) {
      for (const i in localUploadFiles) {
        const o = localUploadFiles[i]
        spinner.text = `[${i}/${localUploadFiles.length}] 正在上传 ${o.localPath} 到 ${o.remotePath}`
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
    spinner.succeed(`已上传 ${opts.localPath} 到 ${opts.remotePath}`)

    sshSftpShowUrl(opts)

    return sftp
  } catch (error) {
    spinner.fail('异常中断')
    if (error.message.includes('sftpConnect')) {
      exitWithError(
        `登录失败，请检查 connectOptions 配置项\n原始信息：${error.message}`
      )
    } else {
      console.error(error)
    }
  } finally {
    if (!opts.keepAlive) {
      sftp.end()
    }
  }
}

/**
 * @param {Options} opts
 * @param {{d:boolean,u:boolean,i:boolean}} lsOpts
 */
async function sshSftpLS(opts, lsOpts) {
  opts = parseOpts(opts)
  const sftp = new Client()
  try {
    await sftp.connect(opts.connectOptions)

    if (lsOpts.d) {
      if (opts.cleanRemoteFiles) {
        const ls = await getRemoteDeepFiles(sftp, opts.remotePath, {
          patterns: opts.cleanRemoteFiles === true ? [] : opts.cleanRemoteFiles,
        })
        console.log(`删除文件 ${opts.remotePath}(${ls.length}):`)
        for (const o of ls) {
          console.log(`  - ${o.path}`)
        }
      }
    }

    if (lsOpts.i && Array.isArray(opts.ignore) && opts.ignore.length > 0) {
      let ls = glob.sync(`${opts.localPath}/**/*`)
      ls = ls.filter((s) =>
        getSafePattern(opts.ignore, opts.localPath).some((reg) =>
          minimatch(s, reg)
        )
      )

      console.log(`忽略文件 (${ls.length}):`)
      for (const s of ls) {
        console.log(`  - ${s}`)
      }
    }

    if (lsOpts.u) {
      if (opts.ignore && opts.ignore.length > 0) {
        const ls = getFilesPath(opts.localPath, opts.remotePath, opts.ignore)
        console.log(`上传文件 (${ls.length}): `)
        for (const o of ls) {
          console.log(`  + ${o.localPath}`)
        }
      } else {
        console.log(`上传 ${opts.localPath} 全部文件到 ${opts.remotePath}`)
      }
    }
  } catch (error) {
    console.error(error)
  } finally {
    sftp.end()
  }
}

/**
 * @param {{isDir:boolean;path:string}[]} files
 */
function mergeDelete(files) {
  let dirs = files.filter((o) => o.isDir)
  dirs.forEach(({ path }) => {
    files = files.filter((o) => !(o.path.startsWith(path) && path !== o.path))
  })
  return files
}

/**
 * @param {string[]} patterns
 * @param {string} prefixPath
 */
function getSafePattern(patterns, prefixPath) {
  const safePatterns = patterns
    .map((s) => s.replace(/^[\.\/]*/, prefixPath + '/'))
    .reduce((acc, s) => [...acc, s, s + '/**/*'], [])
  return safePatterns
}

/**
 * @param {Options} opts
 */
function parseOpts(opts) {
  if (!fs.existsSync(opts.localPath)) {
    exitWithError('localPath 配置错误，未找到需要上传的文件夹')
  }

  if (!fs.statSync(opts.localPath).isDirectory()) {
    exitWithError('localPath 配置错误，必须是一个文件夹')
  }

  if (!opts.remotePath) {
    exitWithError('remotePath 未配置')
  }

  if (typeof opts.securityLock !== 'boolean') {
    opts.securityLock = true
  }

  if (opts.securityLock === false) {
    warn('请确保自己清楚关闭安全锁(securityLock)后的风险')
  } else {
    const rawPkg = fs.readFileSync('package.json', 'utf-8')
    const pkg = JSON.parse(rawPkg)
    if (!pkg.name) {
      exitWithError('package.json 中的 name 字段不能为空')
    }
    if (pkg.name.startsWith('@')) {
      // 如果包含scope需要无视掉
      pkg.name = pkg.name.replace(/@.*\//, '')
    }
    if (!opts.remotePath.includes(pkg.name)) {
      exitWithError(
        [
          `remotePath 中不包含项目名称`,
          `为防止错误上传/删除和保证服务器目录可读性，你必须让remotePath中包含你的项目名称`,
          `remotePath：${opts.remotePath}`,
          `项目名称：${pkg.name} // 源自 package.json 中的 name 字段，忽略scope字段`,
          `\n你可以设置 "securityLock": false 来关闭这个验证`,
        ].join('\n')
      )
    }
  }

  if (opts.ignore) {
    opts.ignore = [opts.ignore].flat(1).filter(Boolean)
  }

  if (opts.cleanRemoteFiles === true) {
    opts.cleanRemoteFiles = []
  }

  if (opts.cleanRemoteFiles) {
    opts.cleanRemoteFiles = [opts.cleanRemoteFiles].flat(1).filter(Boolean)
  }

  return opts
}

/**
 * @param {Options} opts
 */
function sshSftpShowUrl(opts) {
  opts = parseOpts(opts)
  let deployedURL = '未知'
  const urlMap = {
    'edu-page-v1': 'qsxxwapdev',
    'edu-web-page-v1': 'eduwebngv1',
  }
  if (opts.remotePath.startsWith('/erp/edumaven')) {
    const fullPath = opts.remotePath.replace('/erp/edumaven/', '')
    const [basePath, restPath] = splitOnFirst(fullPath, '/')

    const realBasePath = urlMap[basePath]
    if (realBasePath) {
      deployedURL = [
        'http://www.zhidianbao.cn',
        realBasePath,
        restPath,
        '',
      ].join('/')
    }
  }

  console.log('部署网址:', chalk[deployedURL ? 'green' : 'red'](deployedURL))
}

module.exports = sshSftp
module.exports.sshSftp = sshSftp
module.exports.sshSftpLS = sshSftpLS
module.exports.sshSftpShowUrl = sshSftpShowUrl
module.exports.Client = Client
