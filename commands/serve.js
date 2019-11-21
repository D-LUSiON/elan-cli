const {
    spawn
} = require('child_process');
const nodemon = require('nodemon');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ng = path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng');

const readline = require('readline');

class Serve {
    constructor(args) {
        this.description = 'Starts a development server';
        this.usage = '$ elan serve [project] [,options]';
        this.usage_options = [{
                option: ['--fresh'],
                description: 'Clears the contents of "www" folder before starting development instance'
            },
            {
                option: ['--inspect [, port]'],
                description: 'Binds port to Electron inspector for debugging purposes'
            },
        ];
        this.options = [];
        this.args = args;
    }

    entry() {
        this.angularJson = require(path.join(process.cwd(), 'angular.json'));
        this.project = this.args._[1] || this.angularJson.defaultProject;
        console.log(chalk.greenBright('ACTION'), `Starting ElAn live server${this.args._[1] ? (' for project "' + this.project + '"') : ''}...`);

        return this.freshStart()
            .then(() =>
                Promise.all([
                    this.ngWatch(),
                    this.electronWatch(),
                ])
            );
    }

    freshStart() {
        return new Promise((resolve, reject) => {
            if (this.args['fresh'] || !fs.existsSync(path.join(process.cwd(), 'www'))) {
                if (this.args['fresh'])
                    console.log(chalk.greenBright('ACTION'), `Clearing "www" folder...`);
                fs.remove(path.join(process.cwd(), 'www'))
                    .then(() => fs.mkdir(path.join(process.cwd(), 'www')))
                    .then(() => fs.copyFile(path.join(__dirname, '..', 'assets', 'www', 'index.html'), path.join(process.cwd(), 'www', 'index.html')))
                    .then(() => {
                        console.log(chalk.cyan('INFO'), `Folder "www" cleared...`);
                        resolve();
                    })
                    .catch(err => {
                        reject(err);
                    });
            } else
                resolve();
        });
    }

    ngWatch() {
        return new Promise((resolve, reject) => {
            this.ng_build = spawn('node', [
                ng,
                'build',
                this.project,
                '--watch',
                `${this.args['prod'] ? '--prod' : '--configuration=dev'}`,
                '--outputPath=./www',
                '--baseHref='
            ], {
                cwd: process.cwd(),
                stdio: 'inherit'
            });

            this.ng_build.once('exit', (code, signal) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(signal);
                }
            });
        });
    }

    electronWatch() {
        return new Promise((resolve, reject) => {
            let electron_version = '';
            let electron_local = true;
            let electron_path;
            if (fs.existsSync(path.join(process.cwd(), 'node_modules', 'electron'))) {
                electron_local = true;
                electron_path = path.resolve(process.cwd(), 'node_modules', 'electron', 'dist', 'electron');
                electron_version = require(path.resolve(process.cwd(), 'node_modules', 'electron', 'package.json')).version;
            } else {
                electron_local = false;
                electron_path = path.resolve(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron');
                electron_version = require(path.resolve(__dirname, '..', 'node_modules', 'electron', 'package.json')).version;
            }

            nodemon({
                exec: `${electron_path} ${ this.args['inspect'] ? ` --inspect=${this.args['inspect']}` : ''} ./electron`,
                // exec: `${electron_path} ./electron`,
                // args: [
                //     `--inspect=${this.args['inspect']}`
                // ],
                cwd: process.cwd(),
                verbose: true,
                watch: [
                    './www',
                    './electron',
                    './resources'
                ],
                ext: '*',
                env: {
                    'NODE_ENV': 'development'
                },
                delay: 2.5,
                signal: 'SIGHUP',
            });

            let first_start = true;

            nodemon
                .on('start', () => {
                    if (first_start) {
                        console.log(chalk.cyan('INFO'), 'App has started');
                        first_start = false;
                    }
                })
                .on('restart', (files) => {
                    console.log(chalk.cyan('INFO'), 'App restarted', files instanceof Array ? `due to: ${chalk.green(files.join())}` : '');
                })
                .on('quit', () => {
                    console.log(chalk.cyan('INFO'), 'App has quit');
                    resolve();
                })
                .on('error', () => {
                    console.log(chalk.red('ERROR'), 'Error occured!');
                    reject('Error occured while running monitoring!');
                });

            console.log(`\n`);
            console.log(chalk.cyan('INFO'), `Serving project using ${electron_local ? 'your project': 'ElAn'}'s Electron v${electron_version}`);
            console.log(chalk.cyan('INFO'), 'Type "rs" to restart application');
            console.log(chalk.cyan('INFO'), `Press Ctrl-C to quit`);
            console.log(`\n`);

        });
    }
}

module.exports = Serve;