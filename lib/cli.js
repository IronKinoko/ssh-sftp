const { sshSftp, sshSftpLS } = require('./index')
const fs = require('fs')
const ora = require('ora')
const { exitWithError } = require('./utils')

require('yargs')
  .usage('使用: $0 [command] \n\n文档：https://www.npmjs.com/package/ssh-sftp')
  .command('*', '上传文件', {}, upload)
  .command('init', '生成 .sftprc.json 配置文件', {}, generateDefaultConfigJSON)
  .command(
    'ls',
    '列出所有需要上传/忽略/删除的文件',
    (yargs) =>
      yargs
        .option('u', { desc: '列出需要上传的文件' })
        .option('d', { desc: '列出需要删除的文件' })
        .option('i', { desc: '列出忽略的文件' }),
    ls
  )
  .alias({ v: 'version', h: 'help' }).argv

function isRoot() {
  if (!fs.existsSync('package.json')) {
    exitWithError('请在项目的根目录运行(package.json所在的目录)')
    process.exit()
  }
}

function checkValidate() {
  isRoot()
  if (!fs.existsSync('.sftprc.json')) {
    return exitWithError('没找到 .sftprc.json 文件，请先执行 ssh-sftp init')
  }
}

function upload() {
  checkValidate()

  const opts = fs.readFileSync('.sftprc.json', 'utf-8')

  sshSftp(JSON.parse(opts))
}

function generateDefaultConfigJSON() {
  isRoot()

  if (fs.existsSync('.sftprc.json')) {
    return exitWithError('已存在 .sftprc.json 文件，请勿重复生成')
  }
  fs.writeFileSync(
    '.sftprc.json',
    JSON.stringify(
      {
        localPath: '/path/to/localDir',
        remotePath: '/path/to/remoteDir',
        connectOptions: {
          host: '127.0.0.1',
          port: 22,
          username: '',
          password: '',
        },
        ignore: ['**/something[optional].js'],
        cleanRemoteFiles: false,
      },
      null,
      2
    ),
    { encoding: 'utf-8' }
  )
  ora().succeed('.sftprc.json 生成在项目根目录')
}

function ls(argv) {
  checkValidate()

  const opts = fs.readFileSync('.sftprc.json', 'utf-8')

  if (!argv.u && !argv.d && !argv.i) {
    argv.u = true
    argv.d = true
    argv.i = true
  }
  sshSftpLS(JSON.parse(opts), argv)
}
