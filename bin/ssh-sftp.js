#!/usr/bin/env node
const { sshSftp } = require('../lib')
const fs = require('fs')
const ora = require('ora')

require('yargs')
  .usage('Usage: $0 [command]')
  .command('*', 'upload files', {}, upload)
  .command(
    'init',
    'generate ssh-sftp config file .sftprc.json',
    {},
    generateDefaultConfigJSON
  )
  .alias({ v: 'version', h: 'help' }).argv

function isRoot() {
  if (!fs.existsSync('package.json')) {
    throw new Error('please run in root path')
  }
}

function upload() {
  isRoot()
  if (!fs.existsSync('.sftprc.json')) {
    return ora().fail('no .sftprc.joson file in the root path')
  }
  const opts = fs.readFileSync('.sftprc.json', { encoding: 'utf-8' })

  sshSftp(JSON.parse(opts))
}

function generateDefaultConfigJSON() {
  isRoot()

  if (fs.existsSync('.sftprc.json')) {
    return ora().fail('already exists .sftprc.json')
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
      },
      null,
      2
    ),
    { encoding: 'utf-8' }
  )
  ora().succeed('genenrated .sftprc.json file in the root path')
}
