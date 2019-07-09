const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const spawn = require('child_process').spawn;
const chokidar = require('chokidar');

class Serve {
    constructor(args) {
        this.description = 'Starts a development server';
        this.usage = '$ elan serve [,project] [options]';
        this.options = [];
        this.args = args;
        this.local_package_json = {};
        this.electron_changed_timeout = null;
        this.angular_json = require(path.join(process.cwd(), 'angular.json'));
        this.run_project = this.args._[1] || this.angular_json.defaultProject;
        console.log(chalk `{rgb(255,128,0) Start serving project "${this.run_project}}"...\n`);
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
            fs.readdir(path.join(process.cwd(), `app-${this.run_project}`), (err, files) => {
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
                this.run_project,
                '--configuration=dev',
                '--delete-output-path=true',
            ], {
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

    _startElectron() {
        return new Promise((resolve, reject) => {
            let source = (this.run_project) ? path.join(process.cwd(), 'electron', 'env', `environment.${this.run_project}.dev.js`) : path.join(process.cwd(), 'electron', 'env', 'environment.dev.js');
            if (!fs.existsSync(source))
                source = path.join(process.cwd(), 'electron', 'env', 'environment.dev.js');

            fs.copy(source, path.join(process.cwd(), 'electron', 'environment.js')).then(() => {
                // FIXME: Make Angular to hot reload only the window, not the entire application
                const watcher = chokidar.watch([
                    path.join(process.cwd(), 'electron'),
                    path.join(process.cwd(), `app-${this.run_project}`)
                ], {
                    ignored: /node_modules|[\/\\]\./,
                    persistent: true,
                    ignoreInitial: true
                });

                watcher.on('all', path => {
                    if (this.electron_changed_timeout)
                        clearTimeout(this.electron_changed_timeout);
                    this.electron_changed_timeout = setTimeout(() => {
                        // FIXME: Process does not really exit and remain in memory
                        electron_proc.kill('SIGTERM');
                    }, 250);
                });

                const electron_proc = spawn(path.join(process.cwd(), 'node_modules', 'electron', 'dist', 'electron.exe'), ['electron/.'], {
                    stdio: ['inherit', 'inherit', 'inherit']
                }, {
                    cwd: path.join(process.cwd(), 'electron')
                });

                setTimeout(() => {
                    const electron = require('electron');
                    console.log(electron.remote);
                }, 120000);


                electron_proc.once('exit', (code, signal) => {
                    watcher.close();
                    if (signal === 'SIGTERM') {
                        console.log(chalk `{rgb(255,128,0) Changes detected!} {green Restarting Electron...}`);
                        // TODO: Implement closing of window with variable
                        this._startElectron();
                    } else {
                        if (electron_proc)
                            electron_proc.kill('SIGINT')
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
                this.run_project,
                '--watch',
                '--configuration=dev',
                '--delete-output-path=false',
            ], {
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

    _serveProject() {
        console.log(chalk `{green Starting dev environment with hot reload...}`);
        return Promise.all([
            this._startElectron(),
            this._startAngular()
        ]);
    }
}

module.exports = Serve;