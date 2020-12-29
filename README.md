# ssh-sftp

SFPT Client, config once, use anytime.

## Install

`npm i ssh-sftp -D`

## Usage

Run the command to init ssh-sftp config file

`npx ssh-sftp init`

See the `.sftprc.json`, config the json.

Add script to `package.json`

```json
{
  "scripts":{
    "deploy": "ssh-sftp"
  }
}
```

## `.sftprc.json`

`.sftprc.json`

| name             | type                 | desc                                             |
| ---------------- | -------------------- | ------------------------------------------------ |
| localPath        | `string`             |                                                  |
| remotePath       | `string`             |                                                  |
| connectOptions   | `Object`             | sftp server connect config                       |
| ignore           | `string[]`           | `glob` pattern string                            |
| cleanRemoteFiles | `boolean | string[]` | `glob` pattern remove remote files before upload |

`connectOptions`

| name     | type     | desc |
| -------- | -------- | ---- |
| host     | `string` |      |
| port     | `number` |      |
| username | `string` |      |
| password | `string` |      |
