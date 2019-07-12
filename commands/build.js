const fs = require('fs-extra');
const path = require('path');
const {
    spawn
} = require('child_process');
const chalk = require('chalk');
const inquirer = require('inquirer');

const np = process.argv[0].split(/[\\\/]/g);
np.pop();
const npm = path.join(...np, 'node_modules', 'npm', 'bin', 'npm-cli.js');
const ng = path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng');
const webpack = require('webpack');

class Build {
    constructor(args) {
        this.description = 'Starts build process';
        this.usage = '$ elan bld [project] [,options]';
        this.options = {
            keepCompile: false
        };
        this.args = args;
        this.answers = {
            asar: false,
            target: 'Windows'
        };
    }

    entry() {
        this.options = {
            ...this.options,
            ...this.args
        };
        delete this.options._;

        this.packageJson = require(path.join(process.cwd(), 'package.json'));
        this.angularJson = require(path.join(process.cwd(), 'angular.json'));
        this.project = this.args._[1] || this.angularJson.defaultProject;
        
        if (this.args._[1])
            console.log(chalk.greenBright('ACTION'), `Building project "${this.project}"...`);

        return new Promise((resolve, reject) => {
            if (!this.angularJson.projects[this.project])
                reject(`Project with the name "${this.project}" does not exist!`);
            else
                this.startAskingQuestions()
                    .then(() => this.removeOldBuild())
                    .then(() => this.copyElectronFiles())
                    .then(() => this.installElectronDependancies())
                    .then(() => this.buildElectron())
                    .then(() => this.createBuildPackageJSON())
                    .then(() => this.buildAngular())
                    .then(() => this.build())
                    .then(() => {
                        if (!this.options.keepCompile) {
                            this.removeOldBuild().then(() => {
                                resolve();
                            });
                        } else
                            resolve();
                    })
                    .catch(error => {
                        console.log(chalk.red('ERROR'), error);
                    });
        });
    }

    removeOldBuild() {
        return new Promise((resolve, reject) => {
            fs.remove(path.join(process.cwd(), 'build'))
                .then(() => fs.remove(path.join(process.cwd(), 'tmp')))
                .then(() => {
                    resolve();
                })
                .catch(() => {
                    resolve();
                });
        });
    }

    startAskingQuestions() {
        return new Promise(resolve => {
            inquirer.prompt([{
                    type: 'list',
                    name: 'os',
                    message: 'Which platform do you want to build for?',
                    choices: [
                        'Windows',
                        'Linux',
                        'MacOs'
                    ],
                    default: 'Windows'
                },
                {
                    type: 'confirm',
                    name: 'asar',
                    message: `Do you want to use ASAR while building ${this.packageJson.productName || this.packageJson.name}?`,
                    default: true
                }
            ]).then((answers) => {
                this.answers = {
                    asar: answers.asar,
                    target: answers.os
                };
                resolve();
            });
        });
    }

    buildAngular() {
        return new Promise((resolve, reject) => {
            console.log(chalk.greenBright('ACTION'), `Start building Angular project "${this.project}"...`);
            const ng_build = spawn('node', [
                ng,
                'build',
                this.project,
                '--configuration=production',
                '--outputPath=build/app',
                '--baseHref=',
            ], {
                stdio: 'inherit'
            });

            ng_build.once('exit', (code, signal) => {
                if (code === 0) {
                    this.fixIndexHTML().then(() => {
                        resolve();
                    });
                } else {
                    process.exit(code);
                }
            });
        });
    }

    fixIndexHTML() {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(process.cwd(), 'build', 'app', 'index.html')).then(index_html => {
                index_html = index_html.toString().replace(/type=\"module\"/g, 'type="text/javascript"');
                fs.writeFile(path.join(process.cwd(), 'build', 'app', 'index.html'), index_html, 'utf8', () => {
                    resolve();
                });
            });
        });
    }

    copyElectronFiles() {
        return new Promise((resolve, reject) => {
            fs.mkdir(path.join(process.cwd(), 'tmp'))
                .then(() => fs.copy(path.join(process.cwd(), 'electron'), path.join(process.cwd(), 'tmp'), {
                    recursive: true,
                    filter: (path) => {
                        const ignored = ['env', 'node_modules', 'package-lock.json'];
                        const found = !!ignored.filter(x => path.replace(process.cwd(), '').substr(1).split(/[\\\/]/).indexOf(x) > -1).length;
                        if (!found) {
                            if (path.replace(process.cwd(), '').substr(1).match(/[A-Za-z0-9]{1,}\.[A-Za-z0-9]{1,}$/))
                                console.log(chalk.greenBright('COPY'), path.replace(process.cwd(), '').substr(1), chalk.green('->'), `tmp${path.replace(process.cwd(), '').substr(1).replace(/^electron/, '')}`);
                            return true;
                        } else
                            return false;
                    }
                }))
                .then(() => {
                    let env_path = '';
                    if (fs.existsSync(path.join(process.cwd(), 'electron', 'env', `environment.${this.project}.prod.js`)))
                        env_path = path.join(process.cwd(), 'electron', 'env', `environment.${this.project}.prod.js`);
                    else
                        env_path = path.join(process.cwd(), 'electron', 'env', `environment.prod.js`);

                    return fs.copy(env_path, path.join(process.cwd(), 'tmp', 'environment.js'))
                })
                .then(() => {
                    resolve();
                });
        });
    }

    installElectronDependancies() {
        return new Promise((resolve, reject) => {
            console.log(chalk.greenBright('ACTION'), `Installing Electron dependancies...`);

            const package_json = require(path.join(process.cwd(), 'tmp', 'package.json'));
            delete package_json.devDependencies;
            fs.writeFile(
                path.join(process.cwd(), 'tmp', 'package.json'),
                JSON.stringify(package_json, null, 2),
                'utf8'
            ).then(() => {
                const npm_install = spawn('node', [npm, 'install'], {
                    cwd: path.join(process.cwd(), 'tmp'),
                    stdio: 'inherit'
                });
                npm_install.once('exit', (code, signal) => {
                    if (code === 0)
                        resolve();
                    else
                        process.exit(code);
                });
            });
        });
    }

    buildElectron() {
        return new Promise((resolve, reject) => {
            console.log(chalk.greenBright('ACTION'), 'Webpacking Electron...');
            webpack({
                target: 'electron-main',
                entry: './tmp/main.js',
                output: {
                    path: path.join(process.cwd(), 'build'),
                    filename: 'main.js'
                },
                mode: 'production'
            }).run((err, stats) => {
                if (err) {
                    console.error(err.stack || err);
                    if (err.details) {
                        console.error(err.details);
                    }
                    reject(err);
                }

                const info = stats.toJson();

                if (stats.hasErrors()) {
                    console.error(info.errors);
                    reject(info.errors);
                } else if (stats.hasWarnings()) {
                    console.warn(info.warnings);
                } else {
                    console.log(stats.toString({
                        assets: false,
                        hash: true,
                        colors: true
                    }));
                    resolve();
                }
            });
        });
    }

    createBuildPackageJSON() {
        return new Promise((resolve, reject) => {
            fs.writeFile(
                path.join(process.cwd(), 'build', 'package.json'),
                JSON.stringify({
                    name: this.packageJson.name,
                    productName: this.packageJson.productName,
                    version: this.packageJson.version,
                    description: this.packageJson.description,
                    author: this.packageJson.author,
                    main: 'main.js'
                }, null, 2),
                'utf8'
            ).then(() => {
                resolve();
            });
        });
    }

    build() {
        console.log(chalk.greenBright('ACTION'), `Building for ${this.answers.target}...`);
        const builder = require('electron-builder');
        const Platform = builder.Platform;

        let target;
        switch (this.answers.target) {
            case 'Linux':
                target = Platform.LINUX.createTarget();
                break;
            case 'macOs':
                target = Platform.MAC.createTarget();
                break;
            case 'Windows':
            default:
                target = Platform.WINDOWS.createTarget();
                break;
        }

        if (this.args.debug)
            process.env.DEBUG = 'electron-builder';

        return builder.build({
            targets: target,
            config: {
                productName: this.packageJson.productName || this.packageJson.name,
                artifactName: '${productName}-' + this.project + '-${version}-${os}-${arch}.${ext}',
                directories: {
                    buildResources: 'resources',
                    app: 'build',
                    output: `release/${this.packageJson.productName || this.packageJson.name}` + '-${version}-${os}-${arch}'
                },
                files: [
                    '**/*',
                ],
                asar: this.answers.asar,
                win: {
                    icon: fs.existsSync(path.join(process.cwd(), 'resources', 'icon.ico')) ? path.join(process.cwd(), 'resources', 'icon.ico') : '',
                    target: ['nsis', 'zip', 'portable']
                },
                nsis: {
                    oneClick: false,
                    allowToChangeInstallationDirectory: true,
                    artifactName: '${productName}-' + this.project + '-setup-${version}-win.${ext}'
                },
                linux: {
                    icon: fs.existsSync(path.join(process.cwd(), 'resources', 'icon-256x256.png')) ? path.join(process.cwd(), 'resources', 'icon-256x256.png') : '',
                    category: '',
                    target: [
                        'deb',
                        'tar.gz',
                        // 'appimage'
                    ],
                },
                mac: {
                    category: '',
                    target: [
                        'zip',
                        'dmg'
                    ],
                    darkModeSupport: true,
                    extraResources: [{
                        filter: [
                            'LICENSE.txt',
                            'NOTICE.txt'
                        ]
                    }]
                },
                dmg: {
                    background: 'resources/osx/DMG_BG.png',
                    iconSize: 140,
                    iconTextSize: 18
                },
            }
        });
    }
}

module.exports = Build;