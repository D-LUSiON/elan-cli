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
const packageJson = require(path.join(process.cwd(), 'package.json'));

class Build {
    constructor(args) {
        this.description = 'Starts build process';
        this.usage = '$ elan build [,project]  [options]';
        this.options = [];
        this.args = args;
        this.local_package_json = {};
        this.angular_json = require(path.join(process.cwd(), 'angular.json'));
        this.build_project = this.args._[1] || this.angular_json.defaultProject;
        this.prebuild_folder_name = `dist-${this.build_project}`;

        this.electroBuilderJsonDefault = {
            // publish: [{
            //     provider: 'generic',
            //     url: ''
            // }],
            // appId: '',
            artifactName: '${name}-${version}-${os}-${arch}.${ext}',
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

            // protocols: [{
            //     name: '',
            //     schemes: [
            //         ''
            //     ]
            // }],
            // deb: {
            //     synopsis: ''
            // },


            // squirrelWindows: {
            //     iconUrl: 'file://resources/icon.ico',
            //     artifactName: '${name}-setup-${version}-${arch}.${ext}'
            // },
        };

        this.win32_options = {
            win: {
                icon: fs.existsSync(path.join(process.cwd(), this.prebuild_folder_name, 'assets', 'app-icon.ico')) ? path.join(process.cwd(), this.prebuild_folder_name, 'assets', 'app-icon.ico') : '',
                target: [{
                    target: 'nsis',
                    arch: [
                        'x64',
                        // 'ia32'
                    ]
                }, ],
            },
            nsis: {
                oneClick: false,
                allowToChangeInstallationDirectory: true,
                artifactName: '${name}-setup-${version}-win.${ext}'
            },
        };

        this.linux_options = {
            linux: {
                icon: fs.existsSync(path.join(process.cwd(), this.prebuild_folder_name, 'assets', 'app-icon.ico')) ? path.join(process.cwd(), this.prebuild_folder_name, 'assets', 'app-icon.ico') : '',
                category: '',
                target: [
                    'deb',
                    'tar.gz',
                    'appimage'
                ],
                // extraFiles: [{
                //         filter: [
                //             'LICENSE.txt',
                //             'NOTICE.txt'
                //         ]
                //     },
                //     {
                //         from: 'resources/linux',
                //         filter: [
                //             'create_desktop_file.sh',
                //             'icon.svg',
                //             'README.md'
                //         ]
                //     }
                // ]
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
        return new Promise((resolve, reject) => {
            this.startAskingQuestions().then(answers => {
                const ng_src = path.join(process.cwd(), 'tmp');
                const ng_dest = path.join(process.cwd(), this.prebuild_folder_name, 'app');
                const el_src = path.join(process.cwd(), 'electron');
                const el_dest = path.join(process.cwd(), this.prebuild_folder_name);
                const env_dev_src = fs.existsSync(path.join(process.cwd(), 'electron', 'env', `environment.${this.build_project}.dev.js`)) ? path.join(process.cwd(), 'electron', 'env', `environment.${this.build_project}.dev.js`) : path.join(process.cwd(), 'electron', 'env', 'environment.dev.js');
                const env_prod_src = fs.existsSync(path.join(process.cwd(), 'electron', 'env', `environment.${this.build_project}.prod.js`)) ? path.join(process.cwd(), 'electron', 'env', `environment.${this.build_project}.prod.js`) : path.join(process.cwd(), 'electron', 'env', 'environment.dev.js');
                const env_dest = path.join(process.cwd(), 'electron', 'environment.js');
                // Remove old compiled angular
                fs.remove(ng_src).then(() => {
                    // Remove old prepacked javascript
                    fs.remove(path.join(process.cwd(), this.prebuild_folder_name)).then(() => {
                        // 1. ng build --configuration=production
                        this.buildAngular().then(() => {
                            // 2. copy everything to a folder
                            console.log(`Moving from ${ng_src} to ${ng_dest}`);
                            fs.move(ng_src, ng_dest).then(arr => {
                                console.log(`Copying from ${el_src} to ${el_dest}`);
                                fs.copy(el_src, el_dest).then(arr => {
                                    console.log(`Removing ${path.join(el_dest, 'env')}`);
                                    fs.remove(path.join(el_dest, 'env')).then(() => {
                                        console.log(`Copying ${env_prod_src} to ${env_dest}`);
                                        fs.copy(env_prod_src, env_dest).then(() => {
                                            // 3. package the folder
                                            console.log('Building with electron-build...');
                                            this.build().then(arr => {
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
                    message: `Do you want to use ASAR while building ${packageJson.productName}?`,
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

    buildAngular() {
        return new Promise((resolve, reject) => {
            console.log(chalk `{rgb(255,128,0) Building Angular for production...}`);
            const ng_build = spawn('node', [
                path.join(__dirname, '..', 'node_modules', '@angular', 'cli', 'bin', 'ng'),
                'build',
                this.build_project,
                '--configuration=production',
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