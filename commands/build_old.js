const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const chalk = require('chalk');
const extend = require('extend');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const webpack = require('webpack');

const builder = require('electron-builder');
const Platform = builder.Platform;

class Build {
    constructor(args) {
        this.description = 'Starts build process for multiproject app (deprecated, will be moved to "bld" command)';
        this.usage = '$ elan build [,project]  [options]';
        this.options = [];
        this.args = args;
    }

    _init() {
        this.packageJson = require(path.join(process.cwd(), 'package.json'));

        this.local_package_json = {};
        this.angular_json = require(path.join(process.cwd(), 'angular.json'));
        this.build_project = this.args._[1] || this.angular_json.defaultProject;
        this.prebuild_folder_name = `dist-${this.build_project}`;

        this.electron_env = this.args['electron-prod'] ? 'prod' : 'dev';
        this.angular_env = this.args['angular-prod'] ? 'production' : 'dev';

        console.log(this.args);

        this.electroBuilderJsonDefault = {
            // publish: [{
            //     provider: 'generic',
            //     url: ''
            // }],
            // appId: 'com.qms-bg.${productName}',
            productName: this.build_project,
            artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
            directories: {
                buildResources: 'resources',
                app: this.prebuild_folder_name,
                output: `release/${this.build_project}` + '-${version}-${os}-${arch}'
            },
            files: [
                '**/*',
                // 'app/**/*',
                // 'electron/**/*',
                '!**/env/**/*',
                // '!**/node_modules/**/*',
                '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
                '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
                '!**/node_modules/*.d.ts',
                '!**/node_modules/.bin',
                '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
                '!.editorconfig',
                '!**/._*',
                '!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}',
                '!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}',
                '!**/{appveyor.yml,.travis.yml,circle.yml}',
                '!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}'
            ],
            asar: false,
        };

        this.win32_options = {
            win: {
                icon: fs.existsSync(path.join(process.cwd(), this.prebuild_folder_name, 'app', 'assets', 'icon.png')) ?
                    path.join(process.cwd(), this.prebuild_folder_name, 'app', 'assets', 'icon.png') : '',
                target: [{
                        target: 'nsis',
                        arch: [
                            'x64',
                            // 'ia32'
                        ]
                    },
                    {
                        target: 'zip',
                        arch: [
                            'x64',
                            // 'ia32'
                        ]
                    },
                    {
                        target: 'portable',
                        arch: [
                            'x64',
                            // 'ia32'
                        ]
                    },
                ],
            },
            nsis: {
                oneClick: false,
                allowToChangeInstallationDirectory: true,
                artifactName: '${productName}-setup-${version}-win.${ext}'
            },
        };

        this.linux_options = {
            linux: {
                icon: fs.existsSync(path.join(process.cwd(), this.prebuild_folder_name, 'assets', 'icon-256x256.png')) ? path.join(process.cwd(), this.prebuild_folder_name, 'assets', 'icon-256x256.png') : '',
                category: '',
                target: [
                    'deb',
                    'tar.gz',
                    // 'appimage'
                ],
            },
        };

        this.macOs_options = {
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

        this.electroBuilderJson = {
            targets: Platform.WINDOWS.createTarget(),
            config: {
                ...this.electroBuilderJsonDefault,
            }
        };
    }

    entry() {
        this._init();
        return new Promise((resolve, reject) => {
            this.startAskingQuestions().then(answers => {
                const ng_src = path.join(process.cwd(), 'tmp');
                const ng_dest = path.join(process.cwd(), this.prebuild_folder_name, 'app');
                const el_src = path.join(process.cwd(), 'electron');
                const el_dest = path.join(process.cwd(), this.prebuild_folder_name);
                const electron_env = fs.existsSync(path.join(process.cwd(), 'electron', 'env', `environment.${this.build_project}.${this.electron_env}.js`)) ? path.join(process.cwd(), 'electron', 'env', `environment.${this.build_project}.${this.electron_env}.js`) : path.join(process.cwd(), 'electron', 'env', 'environment.prod.js');
                const electron_env_dest = path.join(process.cwd(), this.prebuild_folder_name, 'environment.js');

                console.log(chalk `{rgb(255,128,0) Bundling Electron for ${this.electron_env === 'prod' ? 'production' : 'development'}...}`);

                // Remove old compiled angular
                fs.remove(ng_src).then(() => {
                    // Remove old prepacked javascript
                    fs.remove(path.join(process.cwd(), this.prebuild_folder_name)).then(() => {
                        // 1. ng build --configuration=production
                        this.buildAngular().then(() => {
                            // 2. copy everything to a folder
                            console.log(chalk.green('MOVE'), `${ng_src} to ${ng_dest}`);
                            fs.move(ng_src, ng_dest).then(() => {
                                console.log(chalk.green('COPY'), `${el_src} to ${el_dest}`);
                                fs.copy(el_src, el_dest, {
                                    recursive: true
                                }).then(() => {
                                    console.log(chalk.green('DELETE'), `${path.join(el_dest, 'env')}`);
                                    fs.remove(path.join(el_dest, 'env')).then(() => {
                                        console.log(chalk.green('COPY'), `${electron_env} to ${electron_env_dest}`);
                                        fs.copy(electron_env, electron_env_dest).then(() => {
                                            // 3. package the folder
                                            console.log('Building with electron-build...');
                                            this.build().then(() => {
                                                console.log(chalk `{rgb(128,255,128) Your app was build successuly!}`);
                                                // 4. ask to remove temp files
                                                resolve();
                                            });
                                            // webpack({
                                            //     target: 'node',
                                            //     entry: path.join(el_src, 'main.js'),
                                            //     output: {
                                            //         path: el_dest,
                                            //         filename: 'main.js'
                                            //     },
                                            // }).run(arr => {
                                            //     console.log(`Copying back ${env_prod_src} to ${env_dest}`);
                                            //     fs.copy(env_dev_src, env_dest).then(() => {
                                            //         fs.remove(path.join(el_dest, 'env')).then(() => {
                                            //         });
                                            //     });
                                            // });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    startAskingQuestions() {
        return new Promise(resolve => {
            inquirer.prompt([{
                    type: 'confirm',
                    name: 'asar',
                    message: `Do you want to use ASAR while building ${this.packageJson.productName}?`,
                    default: true
                },
                {
                    type: 'list',
                    name: 'os',
                    message: 'Which platform do you want to build for?',
                    choices: [
                        'Windows',
                        'Linux',
                        'MacOs'
                    ],
                    default: 'Windows'
                }
            ]).then((answers) => {
                this.electroBuilderJson.config.asar = answers.asar;
                switch (answers.os) {
                    case 'Windows':
                        this.electroBuilderJson.targets = Platform.WINDOWS.createTarget();
                        this.electroBuilderJson.config = {
                            ...this.electroBuilderJson.config,
                            ...this.win32_options
                        };
                        break;
                    case 'Linux':
                        this.electroBuilderJson.targets = Platform.LINUX.createTarget();
                        this.electroBuilderJson.config = {
                            ...this.electroBuilderJson.config,
                            ...this.linux_options
                        };
                        break;
                    case 'macOs':
                        this.electroBuilderJson.targets = Platform.MAC.createTarget();
                        this.electroBuilderJson.config = {
                            ...this.electroBuilderJson.config,
                            ...this.macOs_options
                        };
                        break;

                    default:
                        break;
                }
                resolve(answers);
            });
        });
    }

    copyResources() {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    buildAngular() {
        return new Promise((resolve, reject) => {
            console.log(chalk `{rgb(255,128,0) Building Angular for ${this.angular_env === 'production' ? 'production' : 'development'}...}`);

            const ng_build = spawn('node', [
                path.join(__dirname, '..', 'node_modules', '@angular', 'cli', 'bin', 'ng'),
                'build',
                this.build_project,
                `--configuration=${this.angular_env}`,
                `--output-path=./tmp`,
                `--base-href=`,
            ], {
                stdio: [process.stdin, process.stdout, process.stderr]
            });

            ng_build.once('exit', (code, signal) => {
                if (code === 0) {
                    console.log(chalk `{green Angular production project built!}`);
                    resolve();
                } else {
                    process.exit(code);
                }
            });
        });
    }

    build() {
        return builder.build(this.electroBuilderJson);
    }
}

module.exports = Build;