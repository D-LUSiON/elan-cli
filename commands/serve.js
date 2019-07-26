const {
    spawn
} = require('child_process');
const nodemon = require('nodemon');
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
        console.log(chalk.greenBright('ACTION'), `Starting ElAn live server${this.args._[1] ? (' for project"' + this.project + '"') : ''}...`);
        return Promise.all([
            this.electronWatch(),
            this.ngWatch(),
        ]);
    }

    ngWatch() {
        return new Promise((resolve, reject) => {
            const ng_build = spawn('node', [
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

            ng_build.once('exit', (code, signal) => {
                if (code === 0) {
                    resolve();
                } else {
                    process.exit(code);
                }
            });
        });
    }

    electronWatch() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), 'Type "rs" to restart application');
            console.log(chalk.cyan('INFO'), `Press Ctrl-C to quit\n`);

            nodemon([
                '--exec electron ./electron',
                // '--inspect',
                '--verbose',
                '--watch ./www',
                '--watch ./electron',
                '--ext *',
                '--delay 0.5',
            ].join(' '));

            nodemon.on('start', () => {
                console.log(chalk.cyan('INFO'), 'App has started');
            }).on('quit', () => {
                console.log(chalk.cyan('INFO'), 'App has quit');
                resolve();
            }).on('restart', (files) => {
                console.log(chalk.cyan('INFO'), 'App restarted', files instanceof Array ? `due to: ${chalk.green(files.join())}` : '');
            });
        });
    }
}

module.exports = Serve;