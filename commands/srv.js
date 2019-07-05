const {
    spawn
} = require('child_process');
const nodemon = require('nodemon');
const path = require('path');

class Srv {
    constructor(args) {
        this.description = 'Starts a development server';
        this.usage = '$ elan serve [,project] [options]';
        this.options = [];
        this.args = args;
        console.log(`process.cwd(): ${process.cwd()}`);
        this.ng = path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng');

    }

    entry() {
        return Promise.all([
            this.electronWatch(),
            this.ngWatch(),
        ]).then(() => {
            resolve();
        });
        // return new Promise((resolve, reject) => {
        // });
    }

    ngWatch() {
        return new Promise((resolve, reject) => {
            const ng_build = spawn('node', [this.ng, 'build', '--watch'], {
                stdio: ['inherit', 'inherit', 'inherit']
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
            nodemon(`--exec electron ./electron --inspect --verbose --watch ./www/**/* --watch ./electron/**/* --ext * --delay 0.5`);

            nodemon.on('start', () => {
                console.log('App has started');
            }).on('quit', () => {
                console.log('App has quit');
                resolve();
            }).on('restart', (files) => {
                console.log('App restarted due to: ', files);
            });
            console.log(nodemon.config);
            
        });
    }
}

module.exports = Srv;