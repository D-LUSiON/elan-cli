const {
    spawn
} = require('child_process');
const nodemon = require('nodemon');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ng = path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng');

class Serve {
    constructor(args) {
        this.description = 'Starts a development server';
        this.usage = '$ elan serve [project] [,options]';
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
            console.log(chalk.cyan('INFO'), 'Type "rs" to restart application');
            console.log(chalk.cyan('INFO'), `Press Ctrl-C to quit\n`);

            nodemon({
                exec: 'electron ./electron',
                verbose: true,
                watch: [
                    './www',
                    './electron'
                ],
                ext: '*',
                delay: 2.5,
                signal: 'SIGHUP',
            });

            nodemon.on('start', () => {
                console.log(chalk.cyan('INFO'), 'App has started');
            }).on('quit', () => {
                console.log(chalk.cyan('INFO'), 'App has quit');
                resolve();
            }).on('error', () => {
                console.log(chalk.red('ERROR'), 'Error occured!');
                reject('Error occured while running monitoring!');
            }).on('restart', (files) => {
                console.log(chalk.cyan('INFO'), 'App restarted', files instanceof Array ? `due to: ${chalk.green(files.join())}` : '');
            });
        });
    }
}

module.exports = Serve;