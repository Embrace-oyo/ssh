const fs = require('fs')
const path = require('path')
const ora = require('ora')
const zipper = require('zip-local')
const shell = require('shelljs')
const chalk = require('chalk')
const inquirer = require('inquirer')
const node_ssh = require('node-ssh')
const CONFIG = {
	test: {
		SERVER_PATH: "xxx.xxx.xxx", // ssh地址
		SSH_USER: "root", // ssh 用户
		SSH_KEY: "12345678", // ssh 密码 / private key文件地址
		PATH: '/var/www/test/sea/.nuxt', // 操作开始文件夹
		PORT: '60022',
	},
}
//const Backup = require('./backup')
let config

let SSH = new node_ssh()
// loggs
const errorLog = error => console.log(chalk.red(`********* ${error} *********`))
const defaultLog = log => console.log(chalk.blue(`********* ${log} *********`))
const successLog = log => console.log(chalk.green(`********* ${log} *********`))
// 文件夹位置
const distDir = path.resolve(__dirname, './.nuxt')
const distZipPath = path.resolve(__dirname, './nuxt.zip')


// ********* TODO 打包代码 暂时不用 需要和打包接通之后进行测试 *********
const compileDist = async () => {
	// 进入本地文件夹
	shell.cd(path.resolve(__dirname, './'))
	shell.exec(`npm run testBuild`)
	successLog('编译完成')
}

// ********* 压缩dist 文件夹 *********
const zipDist =  async () => {
	try {
		if(fs.existsSync(distZipPath)) {
			defaultLog('nuxt.zip已经存在, 即将删除压缩包')
			fs.unlinkSync(distZipPath)
		} else {
			defaultLog('即将开始压缩zip文件')
		}
		await zipper.sync.zip(distDir).compress().save(distZipPath);
		successLog('文件夹压缩成功')
	} catch (error) {
		errorLog(error)
		errorLog('压缩dist文件夹失败')
	}
}

// ********* 连接ssh *********
const connectSSh = async () => {
	defaultLog(`尝试连接服务： ${config.SERVER_PATH}`)
	let spinner = ora('正在连接')
	spinner.start()
	try {
		let option = {
			host: config.SERVER_PATH,
			username: config.SSH_USER,
			password: config.SSH_KEY,
			port: config.PORT
		}
		await SSH.connect(option)
		spinner.stop()
		successLog('SSH 连接成功')
	} catch (error) {
		errorLog(err)
		errorLog('SSH 连接失败');
	}
}

// ********* 执行清空线上文件夹指令 *********
const runCommond = async (commond) => {
	const result = await SSH.exec(commond,[], {cwd: config.PATH})
	defaultLog(result)
}

const commonds = [`ls`, `rm -rf *`]

// ********* 执行清空线上文件夹指令 *********
const runBeforeCommand = async () =>{
	for (let i = 0; i < commonds.length; i++) {
		await runCommond(commonds[i])
	}
}

// ********* 通过ssh 上传文件到服务器 *********
const uploadZipBySSH = async () => {
	// 连接ssh
	await connectSSh()
	// 执行前置命令行
	await runBeforeCommand()
	// 上传文件
	let spinner = ora('准备上传文件').start()
	try {
		await SSH.putFile(distZipPath, config.PATH + '/nuxt.zip')
		successLog('完成上传')
		spinner.text = "完成上传, 开始解压"
		await runCommond('unzip ./nuxt.zip')
		// 重启服务器
		await runCommond('sh /var/sw.sh restart pctest')
	} catch (error) {
		errorLog(error)
		errorLog('上传失败')
	}
	spinner.stop()
}

// ********* 发布程序 *********
/**
 * 通过配置文件检查必要部分
 * @param {*dev/prod} env
 * @param {*} config
 */
const checkByConfig = (env, config = {}) => {
	const errors = new Map([
		['SERVER_PATH',  () => {
			// 预留其他校验
			return config.SERVER_PATH == '' ? false : true
		}],
		['SSH_USER',  () => {
			// 预留其他校验
			return config.SSH_USER == '' ? false : true
		}],
		['SSH_KEY',  () => {
			// 预留其他校验
			return config.SSH_KEY == '' ? false : true
		}],
		['SSH_KEY',  () => {
			// 预留其他校验
			return config.SSH_KEY == '' ? false : true
		}]
	])
	if (Object.keys(config).length === 0) {
		errorLog('配置文件为空， 请检查配置文件')
		process.exit(1)
	} else {
		Object.keys(config).forEach((key) => {
			let result = errors.get(key) ? errors.get(key)() : true
			if (!result) {
				errorLog(`配置文件中配置项${key}设置异常，请检查配置文件`)
				process.exit(1)
			}
		})
	}
	
}

// ********* 发布程序 *********
const runDeployTask = async () => {
	await compileDist()
	await zipDist()
	await uploadZipBySSH()
	successLog('发布完成!')
	SSH.dispose()
	// exit process
	process.exit(0)
}

// ********* 执行交互 *********
inquirer.prompt([
	{
		type: 'confirm',
		message: '首先你是不是一个小可爱哒~~',
		name: 'one',
	},
	{
		type: 'confirm',
		message: '第二你说这程序是不是很可爱哒~~',
		name: 'two',
	},
	{
		type: 'confirm',
		message: '第三估计你烦了哒，告辞~~',
		name: 'three',
	},
]).then(res => {
	config = CONFIG['test']
	// 检查配置文件
	checkByConfig(res.push, config)
	// 执行备份
	/*	if (answers.backup) {
			Backup.doBackup()
		}*/
	// 发布task
	runDeployTask()
})

