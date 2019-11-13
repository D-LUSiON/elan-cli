const fs = require('fs-extra');
const path = require('path');
const {
    spawn
} = require('child_process');
const chalk = require('chalk');
const inquirer = require('inquirer');

const { getInstalledPathSync } = require('get-installed-path');
const npm = getInstalledPathSync('npm');
const ng = path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng');
const { rebuild } = require('electron-rebuild');
const webpack = require('webpack');
const { ncp } = require('ncp'); // Recursive copying

class Build {
    constructor(args) {
        this.description = 'Starts build process';
        this.usage = '$ elan build [project] [,options]';
        this.usage_options = [
            {
                option: '--keepCompile or --keep-compile',
                description: 'Keep compiled output in "tmp" folder after the build has finished',
                values: 'Boolean (true or false)',
                defaultValue: 'false'
            },
            {
                option: '--environment',
                description: 'Environment to be used when building the project.',
                values: 'String - the name of the environment',
                defaultValue: 'debug'
            },
            {
                option: '--prod or --production',
                description: 'Builds the project using "environment.prod.js" environment (if options is not provided, it uses "environment.debug.js")',
                values: '',
                defaultValue: ''
            },
            {
                option: '--version',
                description: 'Increases version of the project in root "package.json".',
                values: '[<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease [--preid=<prerelease-id>]]',
                defaultValue: ''
            },
            {
                option: '--e-version or --eVersion',
                description: 'Increases version of "electron/package.json".',
                values: '[<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease [--e-preid=<prerelease-id>]]',
                defaultValue: ''
            },
            {
                option: '--ng-version or --ngVersion',
                description: `Increases version of Angular project that's being build.`,
                values: '[<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease [--ng-preid=<prerelease-id>]]',
                defaultValue: ''
            },
        ];
        this.options = {
            keepCompile: false,
            production: false,
            environment: 'debug',
            preid: '',
            ePreid: '',
            ngPreid: ''
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
        this.timer_start;
        this.timer_end;
    }

    entry() {
        this.clearRequireCache();
        this.manageOptions();

        this.packageJson = require(path.join(process.cwd(), 'package.json'));
        this.angularJson = require(path.join(process.cwd(), 'angular.json'));
        this.elanJson = require(path.join(process.cwd(), 'elan.json'));
        this.project = this.args._[1] || this.angularJson.defaultProject;
        
        if (this.args._[1])
            console.log(chalk.greenBright('ACTION'), `Building project "${this.project}" with "${this.options.environment}" environment...`);

        return new Promise((resolve, reject) => {
            if (!this.angularJson.projects[this.project])
                reject(`Project with the name "${this.project}" does not exist!`);
            else
                this.startAskingQuestions()
                    .then(() => this.startTimer())
                    .then(() => this.removeOldBuild())
                    .then(() => this.increaseVersions())
                    .then(() => this.copyElectronFiles())
                    .then(() => this.modifyTmpPackageJson())
                    .then(() => this.npmInstall('tmp'))
                    .then(() => this.installElectronAppDeps('tmp'))
                    .then(() => this.rebuildElectronNativeModules('tmp'))
                    .then(() => this.createBuildPackageJSON())
                    .then(() => this.buildElectron())
                    .then(() => this.copyElanJsonToBuild())
                    .then(() => this.npmInstall('build'))
                    .then(() => this.installElectronAppDeps('build'))
                    .then(() => this.rebuildElectronNativeModules('build'))
                    .then(() => this.copyResources())
                    .then(() => this.buildAngular())
                    .then(() => this.build())
                    .then(() => this.endTimer())
                    .then(() => this.saveVersions())
                    .then(() => {
                        if (!this.options.keepCompile) {
                            this.removeOldBuild().then(() => {
                                this.calculateElapsedTime();
                                resolve();
                            });
                        } else {
                            this.calculateElapsedTime();
                            resolve();
                        }
                    })
                    .catch(error => {
                        reject(error);
                    });
        });
    }

    clearRequireCache() {
        delete require.cache[require.resolve(path.join(process.cwd(), 'package.json'))];
        delete require.cache[require.resolve(path.join(process.cwd(), 'angular.json'))];
        delete require.cache[require.resolve(path.join(process.cwd(), 'elan.json'))];
        delete require.cache[require.resolve(path.join(process.cwd(), 'electron', 'package.json'))];
    }

    manageOptions() {
        Object.entries(this.args).forEach(([key, value]) => {
            if (key !== '_') {
                if (key === 'prod' || key === 'production') {
                    key = 'environment';
                    value = 'prod';
                }
                
                // convert key from snake case to camel case
                key = key.split('-').map(x => `${x.charAt(0).toUpperCase()}${x.substr(1)}`).join('');
                key = `${key.charAt(0).toLowerCase()}${key.substr(1)}`;
                
                this.options[key] = value;
            }
        });
        
    }

    startTimer() {
        return new Promise((resolve, reject) => {
            this.timer_start = new Date();
            resolve();
        });
    }
    
    endTimer() {
        return new Promise((resolve, reject) => {
            this.timer_end = new Date();
            resolve();
        });
    }

    calculateElapsedTime() {
        const time = (this.timer_end.getTime() - this.timer_start.getTime());
        const minutes = Math.floor(time / 1000 / 60);
        const seconds = ((time / 1000) - (minutes * 60)).toFixed(3);
        console.log(`\n`, chalk.rgb(0, 128, 255)('INFO'), `Build process is complete! It took ${minutes} minutes and ${seconds} seconds.`);
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
                    message: `Do you want to use copy contents of "resources" dir to build output?`,
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
                    resolve();
                });
            });
        });
    }

    buildAngular() {
        return new Promise((resolve, reject) => {
            console.log(chalk.greenBright('ACTION'), `Start building Angular project "${this.project}"...`);
            const environment = require(path.join(process.cwd(), 'tmp', 'environment.js'));
            const ng_build = spawn('node', [
                ng,
                'build',
                this.project,
                `--configuration=${this.options.environment === 'prod' ? 'production' : 'dev'}`,
                `--outputPath=build/${environment.html_src}`,
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
                    reject(signal);
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
        return fs.mkdir(path.join(process.cwd(), 'tmp'))
            .then(() => fs.copy(path.join(process.cwd(), 'electron'), path.join(process.cwd(), 'tmp'), {
                recursive: true,
                filter: (path) => {
                    const ignored = ['env', 'node_modules', 'package-lock.json'];
                    const found = !!ignored.filter(x => path.replace(process.cwd(), '').substr(1).split(/[\\\/]/).indexOf(x) > -1).length;
                    if (!found) {
                        if (path.replace(process.cwd(), '').substr(1).match(/[A-Za-z0-9]{1,}\.[A-Za-z0-9]{1,}$/))
                            console.log(chalk.greenBright('COPY'), path.replace(process.cwd(), '').substr(1), chalk.green('->'), `tmp${path.replace(process.cwd(), '').substr(1).replace(/^electron/, '')} (${fs.statSync(path).size} bytes)`);
                        return true;
                    } else
                        return false;
                }
            }))
            .then(() => {
                let env_path = path.join(process.cwd(), 'electron', 'env', `environment.${this.project}.${this.options.environment}.js`);
                if (!fs.existsSync(env_path)) {
                    console.warn(chalk.rgb(255, 165, 0)('COPY'), `Environment file "${path.join('.', 'electron', 'env', `environment.${this.project}.${this.options.environment}.js`)}" is missing! Falling back to "${path.join('.', 'electron', 'env', `environment.prod.js`)}"...`)
                    env_path = path.join(process.cwd(), 'electron', 'env', `environment.prod.js`);
                }
                return fs.copy(env_path, path.join(process.cwd(), 'tmp', 'environment.js'))
            });
    }

    npmInstall(dirname) {
        dirname = dirname ? dirname : 'tmp';
        return new Promise((resolve, reject) => {
            console.log(chalk.greenBright('ACTION'), `Installing Electron dependencies in "${dirname}"...`);
            const npm_install = spawn('node', [npm, 'install', '--production'], {
                cwd: path.join(process.cwd(), 'tmp'),
                stdio: 'inherit'
            });
            npm_install.once('exit', (code, signal) => {
                if (code === 0)
                    resolve();
                else
                    reject(signal);
            });
        });
    }

    installElectronAppDeps(dirname) {
        dirname = dirname ? dirname : 'build';
        return new Promise((resolve, reject) => {
            if (fs.existsSync(path.join(process.cwd(), dirname, 'node_modules'))) {
                console.log(chalk.greenBright('ACTION'), `Installing Electron application dependencies in "${dirname}"...`);
                const install_app_deps = spawn('node', [path.join(__dirname, '..', 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js'), 'install-app-deps'], {
                    cwd: path.join(process.cwd(), dirname),
                    stdio: 'inherit'
                });
                install_app_deps.once('exit', (code, signal) => {
                    if (code === 0)
                        resolve();
                    else
                        reject(signal);
                });
            } else {
                resolve();
            }
        });
    }

    rebuildElectronNativeModules(dirname) {
        dirname = dirname ? dirname : 'build';
        return new Promise((resolve, reject) => {
            if (fs.existsSync(path.join(process.cwd(), dirname, 'node_modules'))) {
                console.log(chalk.greenBright('ACTION'), `Rebuilding Electron native modules in "${dirname}"...`);
                
                let electron_version = '';
                if (fs.existsSync(path.join(process.cwd(), 'node_modules', 'electron'))) {
                    electron_version = require(path.resolve(process.cwd(), 'node_modules', 'electron', 'package.json')).version;
                } else {
                    electron_version = require(path.resolve(__dirname, '..', 'node_modules', 'electron', 'package.json')).version;
                }
                rebuild({
                    buildPath: path.join(process.cwd(), dirname),
                    electronVersion: electron_version,
                    force: true,
                }).then(result => {
                    console.log(chalk.rgb(0, 128, 255)('INFO'), `Rebuild complete!${result ? (' Result: ' + result.toString()) : ''}`);
                    resolve();
                }).catch(err => {
                    reject(err)
                });
                // const electron_rebuild = spawn('node', [path.join(__dirname, '..', 'node_modules', 'electron-rebuild', 'lib', 'src', 'cli.js'), '-f'], {
                //     cwd: path.join(process.cwd(), dirname),
                //     stdio: 'inherit'
                // });
                // electron_rebuild.once('exit', (code, signal) => {
                //     if (code === 0)
                //         resolve();
                //     else
                //         reject(signal);
                // });
            } else {
                resolve();
            }
        });
    }

    modifyTmpPackageJson() {
        return new Promise((resolve, reject) => {
            console.log(chalk.greenBright('ACTION'), `Modifying temporary package.json...`);
            const package_json = require(path.join(process.cwd(), 'tmp', 'package.json'));
            if (this.options.eVersion)
                package_json.version = this.elanJson.versions.electron;
            delete package_json.devDependencies;
            fs.writeFile(
                path.join(process.cwd(), 'tmp', 'package.json'),
                JSON.stringify(package_json, null, 2),
                'utf8'
            ).then(() => {
                resolve();
            });
        });
    }

    createBuildPackageJSON() {
        return new Promise((resolve, reject) => {
            console.log(chalk.greenBright('ACTION'), `Creating build's package.json...`);
            const package_json = {
                name: this.packageJson.name,
                productName: `${this.packageJson.productName}${this.project !== this.angularJson.defaultProject ? ' - ' + (this.project.charAt(0).toUpperCase() + this.project.substr(1)) : ''}`,
                version: this.elanJson.versions.electron,
                description: this.packageJson.description,
                author: this.packageJson.author,
                main: 'main.js',
                dependencies: {}
            };

            const tmp_package_json = require(path.join(process.cwd(), 'tmp', 'package.json'));
            
            Object.keys(tmp_package_json.dependencies || {}).forEach(dep => {
                if ((this.elanJson.blacklist || []).includes(dep))
                    package_json.dependencies[dep] = tmp_package_json.dependencies[dep];
            });

            if (Object.keys(package_json.dependencies).length)
                console.log(chalk.rgb(0, 128, 255)('INFO'), `Following modules that were added in blacklist will be added as native dependencies:\n    ${Object.keys(package_json.dependencies).map(x => chalk.rgb(255, 165, 0)('"' + x + '"')).join(',\n    ')}`);

            if (!fs.existsSync(path.join(process.cwd(), 'build')))
                fs.mkdirSync(path.join(process.cwd(), 'build'));

            fs.writeFile(
                path.join(process.cwd(), 'build', 'package.json'),
                JSON.stringify(package_json, null, 2),
                'utf8'
            ).then(() => {
                resolve();
            });
        });
    }

    buildElectron() {
        return new Promise((resolve, reject) => {
            console.log(chalk.greenBright('ACTION'), 'Webpacking Electron...');
            const build_package_json = require(path.join(process.cwd(), 'build', 'package.json'));

            webpack({
                target: 'electron-main',
                entry: './tmp/main.js',
                output: {
                    path: path.join(process.cwd(), 'build'),
                    filename: 'main.js',
                    libraryTarget: 'commonjs',
                },
                mode: 'production',
                externals: [
                    (context, request, callback) => {
                        if (build_package_json.dependencies[request])
                            return callback(null, `commonjs ${request}`);
                        callback();
                    }
                ],
            }).run((err, stats) => {
                if (err) {
                    console.error(err.stack || (err instanceof Array ? err.join('\n') : err));
                    if (err.details) {
                        console.error(err.details);
                    }
                    reject(err instanceof Array ? err.join('\n') : err);
                }

                const info = stats.toJson();

                if (stats.hasErrors()) {
                    console.error(info.errors);
                    reject(info.errors instanceof Array ? info.errors.join('\n') : info.errors);
                } else if (stats.hasWarnings()) {
                    console.log(chalk.rgb(255, 128, 0)('WARNING'), '\n', info.warnings.join('\n'));
                    resolve();
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

    copyElanJsonToBuild() {
        const elan = { ...this.elanJson };
        delete elan._versions_old;
        console.log(chalk.greenBright('ACTION'), `Copying ElAn settings to build folder...`);
        return fs.writeFile(path.join(process.cwd(), 'build', 'elan.json'), JSON.stringify(elan, null, 4), 'utf8');
    }

    copyResources() {
        return new Promise((resolve, reject) => {
            if (this.copy_resources) {
                console.log(chalk.greenBright('ACTION'), `Copying resources to build folder...`);
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
        console.log(chalk.greenBright('ACTION'), `Building v${this.elanJson.versions.angular[this.project]} for ${this.answers.os}...`);
        const builder = require('electron-builder');
        const Platform = builder.Platform;

        if (this.args.debug)
            process.env.DEBUG = 'electron-builder';

        const buildPackageJson = require(path.join(process.cwd(), 'build', 'package.json'));
        const app_name = `${buildPackageJson.productName || buildPackageJson.name}-${this.elanJson.versions.angular[this.project]}-${this.options.environment}`;
        const config = {
            productName: (buildPackageJson.productName || buildPackageJson.name),
            artifactName: app_name + '-${os}-${arch}.${ext}',
            buildVersion: this.elanJson.versions.angular[this.project],
            directories: {
                buildResources: 'resources',
                app: 'build',
                output: `release/${app_name}` + '-${os}-${arch}'
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
                artifactName: app_name + '-setup-${os}-${arch}.${ext}'
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

    increaseVersions() {
        return new Promise((resolve, reject) => {
            if (this.options.version || this.options.eVersion || this.options.ngVersion) {
                const semver = require('semver');
                
                if (!this.elanJson.versions) {
                    this.elanJson.versions = {
                        main: require(path.join(process.cwd(), 'package.json')).version,
                        electron: require(path.join(process.cwd(), 'electron', 'package.json')).version,
                        angular: {}
                    };
                }

                Object.entries(this.angularJson.projects).forEach(([project, value]) => {
                    if (value.projectType === 'application' && !this.elanJson.versions.angular[project]) {
                        this.elanJson.versions.angular[project] = this.elanJson.versions.main;
                    }
                });

                this.elanJson._versions_old = {
                    ...this.elanJson.versions,
                    angular: {
                        ...this.elanJson.versions.angular
                    }
                };

                if (this.options.version) {
                    if (semver.valid(this.options.version))
                        this.elanJson.versions.main = this.options.version;
                    else
                        this.elanJson.versions.main = semver.inc(this.elanJson.versions.main, this.options.version, this.options.preid);
                }

                if (this.options.eVersion) {
                    if (semver.valid(this.options.eVersion))
                        this.elanJson.versions.electron = this.options.eVersion;
                    else
                        this.elanJson.versions.electron = semver.inc(this.elanJson.versions.electron, this.options.eVersion, this.options.ePreid);
                }

                if (this.options.ngVersion) {
                    if (semver.valid(this.options.ngVersion))
                        this.elanJson.versions.angular[this.project] = this.options.ngVersion;
                    else
                        this.elanJson.versions.angular[this.project] = semver.inc(this.elanJson.versions.angular[this.project], this.options.ngVersion, this.options.ngPreid);
                    
                }
            }
            resolve();
        });
    }

    saveVersions() {
        return new Promise((resolve, reject) => {
            const elan_versions = { ...this.elanJson.versions };
            const elan_versions_old = { ...this.elanJson._versions_old };

            this.packageJson = require(path.join(process.cwd(), 'package.json'));
            this.packageJson.version = elan_versions.main;

            const electronPackageJson = require(path.join(process.cwd(), 'electron', 'package.json'));
            electronPackageJson.version = elan_versions.electron;

            this.elanJson = require(path.join(process.cwd(), 'elan.json'));
            this.elanJson.versions = { ...elan_versions };

            console.log(chalk.greenBright('ACTION'), [
                'Setting new versions:',
                `Main project: v${elan_versions.main !== elan_versions_old.main ? chalk.rgb(255, 255, 255).bold(elan_versions.main) : elan_versions.main}` + (elan_versions.main !== elan_versions_old.main ? ` (was v${elan_versions_old.main})` : ''),
                `Electron: v${elan_versions.electron !== elan_versions_old.electron ? chalk.rgb(255, 255, 255).bold(elan_versions.electron) : elan_versions.electron}` + (elan_versions.electron !== elan_versions_old.electron ? ` (was v${elan_versions_old.electron})` : ''),
                `${this.project}: v${elan_versions.angular[this.project] !== elan_versions_old.angular[this.project] ? chalk.rgb(255, 255, 255).bold(elan_versions.angular[this.project]) : elan_versions.angular[this.project]}` + (elan_versions.angular[this.project] !== elan_versions_old.angular[this.project] ? ` (was v${elan_versions_old.angular[this.project]})` : '')
            ].join(`\n`));

            delete this.elanJson._versions_old;

            return Promise.all([
                fs.writeFile(path.join(process.cwd(), 'package.json'), JSON.stringify(this.packageJson, null, 4), 'utf8'),
                fs.writeFile(path.join(process.cwd(), 'electron', 'package.json'), JSON.stringify(electronPackageJson, null, 4), 'utf8'),
                fs.writeFile(path.join(process.cwd(), 'elan.json'), JSON.stringify(this.elanJson, null, 4), 'utf8'),
            ]);
        });
    }
}

module.exports = Build;