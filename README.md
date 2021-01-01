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
    "deploy": "ssh-sftp",
    "ls-deploy-files":"ssh-sftp ls"
  }
}
```

**You can run `npx ssh-sftp ls` to see which files will be upload**

## `.sftprc.json`

`.sftprc.json`

| name             | type                  | desc                                             |
| ---------------- | --------------------- | ------------------------------------------------ |
| localPath        | `string`              |                                                  |
| remotePath       | `string`              |                                                  |
| connectOptions   | `Object`              | sftp server connect config                       |
| ignore           | `string[]`            | `glob` pattern string                            |
| cleanRemoteFiles | `boolean \| string[]` | `glob` pattern remove remote files before upload |

`connectOptions`

| name     | type     | desc |
| -------- | -------- | ---- |
| host     | `string` |      |
| port     | `number` |      |
| username | `string` |      |
| password | `string` |      |

## Commands

### `ssh-sftp init`

Init config json `.sftprc.json`

### `ssh-sftp ls`

Default ls all upload/delete files.

`ssh-sftp ls -u` ls all upload files.

`ssh-sftp ls -d` ls all delete files.
