# ssh-sftp

SFPT Client, config once, use anytime.

## Install

`npm i ssh-sftp -D`

## Usage

Add `.sftprc.json` to root path. The ignore option is optional.

```json
{
  "localPath": "",
  "remotePath": "",
  "connectOptions": {
    "host": "127.0.0.1",
    "port": 2222,
    "username": "foo",
    "password": "pass"
  },
  "ignore": ["**/b.txt", "**/file{2..30}.txt"]
}
```

Add script to `package.json`

```json
{
  "scripts":{
    "deploy": "ssh-sftp"
  }
}
```
