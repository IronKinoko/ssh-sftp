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
