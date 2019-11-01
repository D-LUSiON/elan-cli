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
        this.usage_options = [];
        this.options = [];
        this.args = args;
    }

    entry() {
        this.angularJson = require(path.join(process.cwd(), 'angular.json'));
        this.project = this.args._[1] || this.angularJson.defaultProject;
        console.log(chalk.greenBright('ACTION'), `Starting ElAn live server${this.args._[1] ? (' for project "' + this.project + '"') : ''}...`);

        return Promise.all([
            this.ngWatch(),
            this.electronWatch(),
        ]);
    }

    ngWatch() {
        return new Promise((resolve, reject) => {
            this.ng_build = spawn('node', [
                ng,
                'build',
                this.project,
                '--watch',
                '--configuration=dev',
                '--outputPath=./www',
                '--baseHref='
            ], {
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
                exec: `${electron_path} ./electron`,
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