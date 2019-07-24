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
const ncp = require('ncp').ncp;

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
            os: 'WINDOWS',
            arch: ['x64'],
            targets: {
                WINDOWS: [{
                    target: 'nsis',
                    arch: ['x64']
                }]
            }
        };
        this.copy_resources = true;
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
                    .then(() => this.copyResources())
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
        return new Promise((resolve, reject) => {
            inquirer.prompt([{
                    type: 'checkbox',
                    name: 'os',
                    message: 'Which platform do you want to build for?',
                    choices: [
                        'Windows',
                        'Linux',
                        'MacOS'
                    ],
                    // default: ['Windows'],
                },
                {
                    type: 'list',
                    name: 'arch',
                    message: 'What architecture do you want to use?',
                    choices: [
                        'x64',
                        'ia32',
                        'All',
                    ],
                    default: 'x64',
                    filter(input) {
                        return input.toLowerCase();
                    }
                },
                {
                    type: 'confirm',
                    name: 'asar',
                    message: `Do you want to use ASAR while building ${this.packageJson.productName || this.packageJson.name}?`,
                    default: true
                },
                {
                    type: 'confirm',
                    name: 'resources',
                    message: `Do you want to use copy contents of "resources" dir to built output?`,
                    default: true
                }
            ]).then((answers) => {
                this.copy_resources = answers.resources;
                delete answers.resources;
                answers.os = answers.os.map(os => os === 'MacOS' ? 'MAC' : os.toUpperCase());
                this.answers = { ...answers };

                let target_questions = [];
                answers.os.forEach(os => {
                    let target_question = {
                        type: 'checkbox',
                        name: `${os}`,
                        message: `Which target do you want to build for ${os === 'MAC' ? 'MacOS' : (os.charAt(0).toUpperCase() + os.substr(1))}?`,
                        filter(input) {
                            return input.map(answer => {
                                return {
                                    target: answer,
                                    arch: answers.arch === 'all' ? ['x64', 'ia32'] : [answers.arch]
                                }
                            });
                        }
                    };

                    switch (os) {
                        case 'WINDOWS':
                            target_question = {
                                ...target_question,
                                choices: [
                                    'nsis',
                                    'nsis-web',
                                    'portable',
                                    'zip',
                                    'dir',
                                ]
                            };
                            break;
                        case 'LINUX':
                            target_question = {
                                ...target_question,
                                choices: [
                                    'AppImage',
                                    'snap',
                                    'deb',
                                    'rpm',
                                    'apk',
                                    'zip',
                                    'tar.gz',
                                    'dir',
                                ],
                                
                            };
                            break;
                        case 'MAC':
                            target_question = {
                                ...target_question,
                                choices: [
                                    'dmg',
                                    'mas',
                                    'mas-dev',
                                    'zip',
                                    'tar.gz',
                                    'dir',
                                ],
                            };
                            break;
                    }
                    target_questions.push(target_question);
                });
                
                inquirer.prompt([
                    ...target_questions
                ]).then((answer) => {
                    this.answers.targets = answer;
                    // console.log(this.answers.targets);
                    // reject('testing...');
                    resolve();
                });
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
            console.log(chalk.greenBright('ACTION'), `Creating build's package.json...`);
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

    copyResources() {
        return new Promise((resolve, reject) => {
            if (this.copy_resources) {
                console.log(chalk.greenBright('ACTION'), `Copying "resources" folder to build...`);
                ncp(path.join(process.cwd(), 'resources'), path.join(process.cwd(), 'build', 'resources'), (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            } else {
                resolve();
            }
        });
    }

    build() {
        console.log(chalk.greenBright('ACTION'), `Building for ${this.answers.os}...`);
        const builder = require('electron-builder');
        const Platform = builder.Platform;

        if (this.args.debug)
            process.env.DEBUG = 'electron-builder';

        const config = {
            productName: this.packageJson.productName || this.packageJson.name,
            artifactName: '${productName}-' + this.project + '-${version}-${os}-${arch}.${ext}',
            directories: {
                buildResources: 'resources',
                app: 'build',
                output: `release/${this.packageJson.productName || this.packageJson.name}-${this.project}` + '-${version}-${os}-${arch}'
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
                executableName: this.project,
                icon: fs.existsSync(path.join(process.cwd(), 'resources', 'icon-256x256.png')) ? path.join(process.cwd(), 'resources', 'icon-256x256.png') : '',
                category: 'Utility',
                target: [
                    'deb',
                    'tar.gz',
                    'AppImage',
                    'dir'
                ],
            },
            mac: {
                category: '',
                target: [
                    'zip',
                    'dmg',
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

        Object.keys(this.answers.targets).forEach(os => {
            const trg = os === 'WINDOWS' ? 'win' : os.toLowerCase();
            config[trg].target = this.answers.targets[os];
        });

        return builder.build({
            targets: builder.createTargets(this.answers.os.map(os => Platform[os]), null, this.answers.arch),
            config: config
        });
    }
}

module.exports = Build;