const {
    spawn
} = require('child_process');
const nodemon = require('nodemon');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

// const npm = require('../lib/get-npm-path')();
const npm = new (require('../lib/npm'))();
const ng = path.resolve('node_modules', '@angular', 'cli', 'bin', 'ng');
const {
    rebuild
} = require('electron-rebuild');

const EventLog = require('../lib/event-log');

const DEFAULT_NG_BUILD_FOLDER = 'www';
const DEFAULT_E_BUILD_FOLDER = 'prebuild';
const DEFAULT_E_ROOT_FOLDER = 'electron';

class Serve {
    constructor(args) {
        this.description = 'Starts a development server';
        this.usage = '$ elan serve [project] [,options]';
        this.usage_options = [{
                option: ['--fresh'],
                description: 'Clears the contents of Angular build folder before starting development instance'
            },
            {
                option: ['--inspect [, port]'],
                description: 'Binds port to Electron inspector for debugging purposes'
            },
            {
                option: ['--delay [ number in seconds]'],
                description: 'Use this parameter to alter delaying restart of app after files are changed.',
                values: 'any positive number in seconds',
                defaultValue: 2.5
            },
        ];

        this.options = [];
        this.args = args;
        this.ng_build_folder = DEFAULT_NG_BUILD_FOLDER;
        this.e_build_folder = DEFAULT_E_BUILD_FOLDER;
        this.e_root_folder = DEFAULT_E_ROOT_FOLDER;
        this.electron_version = '';
        this.electron_local = true;
        this.electron_path = '';
    }

    entry() {
        this.angularJson = require(path.resolve('angular.json'));
        this.elanJson = require(path.resolve('elan.json'));
        if (this.elanJson.template) {
            if (this.elanJson.template.ngBuildDir)
                this.ng_build_folder = this.elanJson.template.ngBuildDir;
            if (this.elanJson.template.eBuildDir)
                this.e_build_folder = this.elanJson.template.eBuildDir;
            if (this.elanJson.template.electronRoot)
                this.e_root_folder = this.elanJson.template.electronRoot;
        }
        this.project = this.args._[1] || this.angularJson.defaultProject;
        this.getElectronVersion();


        if (this.elanJson.template && this.elanJson.template.language)
            EventLog('info', `This project is using "${this.elanJson.template.language}" language`);
        EventLog('action', `Starting ElAn live server${this.args._[1] ? (` for project "${this.project}"`) : ''}...`);

        return this.freshStart()
            .then(() => this.compileElectronTS())
            .then(() => this.installElectronDependencies())
            .then(() =>
                Promise.all([
                    this.ngWatch(),
                    this.electronWatch(),
                ])
            );
    }

    freshStart() {
        return new Promise((resolve, reject) => {
            if (this.args['fresh'] || !fs.existsSync(path.resolve(this.ng_build_folder))) {
                if (this.args['fresh'])
                    EventLog('action', `Clearing "${this.ng_build_folder}" folder...`);

                fs.remove(path.resolve(this.ng_build_folder))
                    .then(() => fs.mkdirs(path.resolve(this.ng_build_folder)))
                    .then(() => fs.copyFile(
                        path.join(__dirname, '..', 'assets', 'templates', (this.elanJson.template && this.elanJson.template.name ? this.elanJson.template.name : 'default'), this.ng_build_folder, 'index.html'),
                        path.resolve(this.ng_build_folder, 'index.html')
                    ))
                    .then(() => {
                        EventLog('info', `Folder "${this.ng_build_folder}" cleared...`);
                        if (this.e_build_folder && this.e_build_folder !== DEFAULT_E_BUILD_FOLDER && this.e_build_folder !== this.e_root_folder) {
                            fs.remove(path.resolve(this.e_build_folder))
                                .then(() => fs.mkdirs(path.resolve(this.e_build_folder))).then(() => {
                                    EventLog('info', `Folder "${this.e_build_folder}" cleared...`);
                                    resolve();
                                });
                        } else
                            resolve();
                    })
                    .catch(err => {
                        reject(err);
                    });
            } else
                resolve();
        });
    }

    installElectronDependencies() {
        return new Promise((resolve, reject) => {
            if (this.elanJson.template && this.elanJson.template.language && this.elanJson.template.language.toLowerCase() === 'ts') {
                EventLog('action', `Tidying prebuild "${path.resolve(this.e_build_folder)}" folder...`);
                fs.remove(path.resolve(this.e_build_folder, 'node_modules'))
                    .then(() =>
                        fs.copyFile(
                            path.resolve(this.e_root_folder, 'package.json'),
                            path.resolve(this.e_build_folder, 'package.json')
                        )
                    ).then(() => {

                        const npm_install = npm.exec('install', [], {
                            cwd: path.resolve(this.e_build_folder)
                        });
                        
                        npm_install.once('exit', (code, signal) => {
                            if (code === 0)
                                resolve();
                            else
                                reject(signal);
                        });
                    }).then(() => this.rebuildElectronNativeModules(this.e_build_folder)).then(() => {
                        resolve();
                    }).catch(err => reject(err));
            } else
                resolve();
        });
    }

    rebuildElectronNativeModules(dirname) {
        dirname = dirname ? dirname : 'build';
        return new Promise((resolve, reject) => {
            if (fs.existsSync(path.resolve(dirname, 'node_modules'))) {
                EventLog('action', `Rebuilding Electron native modules in "${dirname}"...`);

                let electron_version = '';
                if (fs.existsSync(path.resolve('node_modules', 'electron'))) {
                    electron_version = require(path.resolve(process.cwd(), 'node_modules', 'electron', 'package.json')).version;
                } else {
                    electron_version = require(path.join(__dirname, '..', 'node_modules', 'electron', 'package.json')).version;
                }

                rebuild({
                    buildPath: path.resolve(dirname),
                    electronVersion: electron_version,
                    force: true,
                }).then(result => {
                    EventLog('info', `Rebuild complete!${result ? (' Result: ' + result.toString()) : ''}`);
                    resolve();
                }).catch(err => {
                    reject(err)
                });
            } else {
                resolve();
            }
        });
    }

    getElectronVersion() {
        if (fs.existsSync(path.resolve('node_modules', 'electron'))) {
            this.electron_local = true;
            this.electron_path = path.resolve(process.cwd(), 'node_modules', 'electron', 'dist', 'electron');
            this.electron_version = require(path.resolve(process.cwd(), 'node_modules', 'electron', 'package.json')).version;
        } else {
            this.electron_local = false;
            this.electron_path = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron');
            this.electron_version = require(path.join(__dirname, '..', 'node_modules', 'electron', 'package.json')).version;
        }
    }

    ngWatch() {
        return new Promise((resolve, reject) => {
            this.ng_build = spawn('node', [
                ng,
                'build',
                this.project,
                '--watch',
                `${this.args['prod'] ? '--prod' : '--configuration=dev'}`,
                `--outputPath=./${this.ng_build_folder}`,
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
        if (this.elanJson.template && this.elanJson.template.language.toLowerCase() === 'ts') {
            return Promise.all([
                this.electronWatchTS(),
                this.electronWatchForChanges(),
            ])
        } else {
            return this.electronWatchForChanges();
        }
    }

    electronWatchForChanges() {
        return new Promise((resolve, reject) => {

            const electron_js_folder = (this.elanJson.template && this.elanJson.template.language.toLowerCase() === 'ts') ? this.e_build_folder : this.e_root_folder;

            const watch_folders = [
                this.e_root_folder,
                this.ng_build_folder,
                this.e_build_folder,
                'resources'
            ].filter(x => !!x);

            EventLog('info', `Looking for changes in: ${watch_folders.map(f => `"${f}"`).join(', ')}`)

            nodemon({
                exec: [
                    this.electron_path,
                    this.args['inspect'] ? `--inspect=${this.args['inspect']}` : undefined,
                    path.resolve(electron_js_folder, 'main.js')
                ].filter(arg => !!arg).join(' '),
                cwd: process.cwd(),
                verbose: true,
                watch: watch_folders,
                ext: '*',
                env: {
                    'NODE_ENV': 'development'
                },
                delay: this.args.delay && this.args.delay > 0 ? this.args.delay : 2.5,
                signal: 'SIGHUP',
            });

            let first_start = true;

            nodemon
                .on('start', () => {
                    if (first_start) {
                        EventLog('info', 'App has started');
                        first_start = false;
                    }
                })
                .on('restart', (files) => {
                    EventLog('info', 'App restarted', files instanceof Array ? `due to: ${chalk.green(files.join())}` : '');
                })
                .on('quit', (e) => {
                    EventLog('info', 'App has quit', e);
                })
                .on('exit', (code) => {
                    EventLog('info', `App exited with code "${code}"`);
                })
                .on('crash', (crash_info) => {
                    EventLog('warning', 'App crashed!', crash_info);
                })
                .on('error', (err) => {
                    EventLog('error', 'Error occured!', err);
                    reject('Error occured while running monitoring!');
                });

            EventLog('info', `Serving project using ${this.electron_local ? 'your project': 'ElAn'}'s Electron v${this.electron_version}`);
            EventLog('info', 'Type "rs" to restart application');
            EventLog('info', `Press Ctrl-C to quit`);
        });
    }

    compileElectronTS(files) {
        return new Promise((resolve, reject) => {
            if (this.elanJson.template && this.elanJson.template.language.toLowerCase() === 'ts') {
                EventLog('info', `Compiling Electron${files && files.length ? ` due to: ${files.join(', ')}` : ''}...`);

                const ts_watch = spawn('node', [
                    path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
                ], {
                    cwd: path.resolve(this.e_root_folder),
                    stdio: 'inherit'
                });

                ts_watch.once('exit', (code, signal) => {
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // spawnElectron() {
    //     const electron_proc = spawn(this.electron_path, [
    //         path.resolve(this.e_build_folder, 'main.js')
    //     ], {
    //         cwd: process.cwd(),
    //         stdio: 'inherit'
    //     });
    //     console.log(`Electron process ID: ${electron_proc.pid}`);
    //     return electron_proc;

    // }

    electronWatchTS() {
        return new Promise((resolve, reject) => {
            if (this.elanJson.template && this.elanJson.template.language.toLowerCase() === 'ts') {
                const chokidar = require('chokidar');

                const watcher = chokidar.watch(path.resolve(this.e_root_folder), {
                    persistent: true,
                    ignored: 'node_modules/*',
                    ignoreInitial: true,
                    followSymlinks: true,
                    cwd: path.resolve(this.e_root_folder),
                    disableGlobbing: false,
                    usePolling: false,
                    interval: 100,
                    binaryInterval: 300,
                    alwaysStat: false,
                    depth: 99,
                    awaitWriteFinish: {
                        stabilityThreshold: 2000,
                        pollInterval: 100
                    },
                    ignorePermissionErrors: false,
                    atomic: 100
                });

                let timeout;
                let changed_files = [];
                watcher.on('all', (event, file) => {
                    EventLog(event, file);
                    changed_files.push(file);
                    if (timeout)
                        clearTimeout(timeout);
                    timeout = setTimeout(() => {
                        this.compileElectronTS(changed_files).then(() => {
                            changed_files = [];
                        }).catch(err => {
                            reject(err);
                        });
                    }, 100);
                });
                watcher.on('error', (err) => {
                    reject(err);
                });
            } else {
                resolve();
            }
        });
    }

    // electronWatchBuildFolder() {
    //     const chokidar = require('chokidar');

    //     const watcher = chokidar.watch(path.resolve(this.e_build_folder), {
    //         persistent: true,
    //         ignored: 'node_modules/*',
    //         ignoreInitial: true,
    //         followSymlinks: true,
    //         cwd: path.resolve(this.e_build_folder),
    //         disableGlobbing: false,
    //         usePolling: false,
    //         interval: 100,
    //         binaryInterval: 300,
    //         alwaysStat: false,
    //         depth: 99,
    //         awaitWriteFinish: {
    //             stabilityThreshold: 2000,
    //             pollInterval: 100
    //         },
    //         ignorePermissionErrors: false,
    //         atomic: 100
    //     });

    //     let electron_proc = this.spawnElectron();
    //     electron_proc.once('exit', () => {
    //         console.log(`process killed`);
    //         electron_proc = null;
    //     });

    //     let timeout;
    //     watcher.on('all', (event, file) => {
    //         if (electron_proc) {
    //             console.log(`killing process...`);
    //             // FIXME: It does not kill the process... :(
    //             electron_proc.kill('SIGINT');
    //         }
    //         if (timeout)
    //             clearTimeout(timeout);
    //         timeout = setTimeout(() => {
    //             electron_proc = this.spawnElectron();
    //             electron_proc.once('exit', () => {
    //                 console.log(`process killed`);
    //                 electron_proc = null;
    //             });
    //         }, 100);
    //     });
    // }

    // electronWatchTSDev() {
    //     return new Promise((resolve, reject) => {
    //         EventLog('info', `Watching TS electron scripts...`);

    //         const ts_watch = spawn('node', [
    //             path.join(__dirname, '..', 'node_modules', 'ts-node-dev', 'bin', 'ts-node-dev'),
    //             '--respawn',
    //             '--debug',
    //             'main.ts'
    //         ], {
    //             cwd: path.resolve(this.e_root_folder),
    //             stdio: 'inherit'
    //         });

    //         ts_watch.once('exit', (code, signal) => {
    //             if (code === 0) {
    //                 resolve();
    //             } else {
    //                 reject(signal);
    //             }
    //         });
    //     });
    // }
}

module.exports = Serve;