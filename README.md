# ssh-sftp

简单易用的 SFTP 工具，可以上传/忽略/删除远程的文件

## 安装

```bash
# 全局
npm i ssh-sftp -g

# 局部
npm i ssh-sftp -D
```

## 使用

1. 首先初始化一份配置文件

`npx ssh-sftp init`

2. 将生成的`.sftprc.json`文件里的信息填写完整

3. 添加脚本到 `package.json`

```json
{
  "scripts": {
    "deploy": "ssh-sftp",
    "ls-deploy-files": "ssh-sftp ls"
  }
}
```

**建议在部署前使用`npx ssh-sftp ls`查看哪些文件会被上传或删除**

## 字段说明

### `.sftprc.json`

| 字段名           | 类型                  | 描述                                           |
| ---------------- | --------------------- | ---------------------------------------------- |
| localPath        | `string`              |                                                |
| remotePath       | `string`              |                                                |
| connectOptions   | `ConnectOptions`      | 登录信息                                       |
| ignore           | `string[]`            | 忽略`localPath`中的部分文件，`glob`类型        |
| cleanRemoteFiles | `boolean \| string[]` | 清空远程文件夹，或按`glob`匹配清空远程部分文件 |
| securityLock     | `boolean`             | 安全锁，默认开启                               |

### `connectOptions`

| 字段名   | 类型     | 描述 |
| -------- | -------- | ---- |
| host     | `string` |      |
| port     | `number` |      |
| username | `string` |      |
| password | `string` |      |

### `securityLock`

**安全锁** 默认开启，会校验项目名称与远程地址是否匹配防止误传，关闭后忽略验证

## Commands

### `ssh-sftp init`

初始化生成配置文件 `.sftprc.json`

### `ssh-sftp ls`

列出所有需要上传/删除/忽略的文件

`ssh-sftp ls -u` 单独列出所有需要上传的文件

`ssh-sftp ls -d` 单独列出所有需要删除的文件

`ssh-sftp ls -i` 单独列出所有忽略的文件
