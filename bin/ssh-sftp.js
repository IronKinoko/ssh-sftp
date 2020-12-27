#!/usr/bin/env node
const path = require('path')
const { sshSftp } = require('../lib')
const fs = require('fs')

const opts = fs.readFileSync(path.join(process.cwd(), '.sftprc.json'), {
  encoding: 'utf-8',
})

sshSftp(JSON.parse(opts))
