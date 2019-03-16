const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const spawn = require('child_process').spawn;
const chokidar = require('chokidar');

class Serve {
    constructor(args) {
        this.description = 'Starts a development server';
        this.usage = '$ elan serve [options]';
        this.options = [];
        this.args = args;
        this.local_package_json = {};
        this.electron_changed_timeout = null;
    }

    entry() {
        return new Promise((resolve, reject) => {
            this._isElAnProject().then(() => {
                this._checkIsAngularPrebuild().then(is_prebuild => {
                    if (is_prebuild) {
                        this._serveProject().then(result => {
                            resolve();
                        });
                    } else {
                        this._prebuildAngular().then(() => {
                            this._serveProject().then(result => {
                                console.log('Serve project resolved');
                                resolve();
                            });
                        });
                    }
                });

            }).catch((err) => {
                reject(err);
            });
        });
    }

    _isElAnProject() {
        return new Promise((resolve, reject) => {
            try {
                this.local_package_json = require(path.join(process.cwd(), 'package.json'));
            } catch (error) {
                reject('Please, run "elan serve" in an ElAn project directory!')
            }
            resolve();
        });
    }

    _checkIsAngularPrebuild() {
        return new Promise((resolve) => {
            fs.readdir(path.join(process.cwd(), 'app'), (err, files) => {
                resolve(!!(files && files.length));
            });
        });
    }

    _prebuildAngular() {
        console.log(chalk `{rgb(255,128,0) Prebuilding Angular front-end...}`);
        return new Promise((resolve, reject) => {
            const ng_build = spawn('node', [
                path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng'),
                'build',
                '--configuration=dev',
                '--delete-output-path=true',
            ], {
                stdio: [process.stdin, process.stdout, process.stderr]
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

    _startElectron() {
        return new Promise((resolve, reject) => {
            fs.copy(path.join(process.cwd(), 'electron', 'env', 'environment.dev.js'), path.join(process.cwd(), 'electron', 'environment.js')).then(() => {
                // FIXME: Make Angular to hot reload only the window, not the entire application
                const watcher = chokidar.watch([
                    path.join(process.cwd(), 'electron'),
                    path.join(process.cwd(), 'app')
                ], {
                    ignored: /node_modules|[\/\\]\./,
                    persistent: true,
                    ignoreInitial: true
                });

                watcher.on('all', path => {
                    if (this.electron_changed_timeout)
                        clearTimeout(this.electron_changed_timeout);
                    this.electron_changed_timeout = setTimeout(() => {
                        electron_proc.kill('SIGTERM');
                    }, 250);
                });

                const electron_proc = spawn(path.join(process.cwd(), 'node_modules', 'electron', 'dist', 'electron.exe'), ['electron/.'], {
                    stdio: [process.stdin, process.stdout, process.stderr]
                }, {
                    cwd: path.join(process.cwd(), 'electron')
                });

                electron_proc.once('exit', (code, signal) => {
                    watcher.close();
                    if (signal === 'SIGTERM') {
                        console.log(chalk `{rgb(255,128,0) Changes detected!} {green Restarting Electron...}`);
                        // TODO: Implement closing of window with variable
                        this._startElectron();
                    } else {
                        process.exit(code);
                        if (code === 0)
                            resolve(code);
                        else
                            reject(code);
                    }
                });
            });
        });
    }

    _startAngular() {
        return new Promise((resolve, reject) => {
            const ng_build = spawn('node', [
                path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng'),
                'build',
                '--watch',
                '--configuration=dev',
                '--delete-output-path=false',
            ], {
                stdio: [process.stdin, process.stdout, process.stderr]
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

    _serveProject() {
        console.log(chalk `{green Starting dev environment with hot reload...}`);
        return Promise.all([
            this._startElectron(),
            this._startAngular()
        ]);
    }
}

module.exports = Serve;