const {
    spawn
} = require('child_process');
const nodemon = require('nodemon');
const path = require('path');
const chalk = require('chalk');

class Serve {
    constructor(args) {
        this.description = 'Starts a development server';
        this.usage = '$ elan serve [project] [,options]';
        this.options = [];
        this.args = args;
        this.ng = path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng');
    }

    entry() {
        // TODO: Add support for multiproject
        console.log(chalk.greenBright('ACTION'), 'Starting ElAn live server...');
        return Promise.all([
            this.electronWatch(),
            this.ngWatch(),
        ]);
    }

    ngWatch() {
        return new Promise((resolve, reject) => {
            const ng_build = spawn('node', [this.ng, 'build', '--watch', '--configuration=dev'], {
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