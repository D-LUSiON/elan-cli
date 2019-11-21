const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { exec, spawn } = require('child_process');
const { ncp } = require('ncp'); // Recursive copying
const { getInstalledPathSync } = require('get-installed-path');
const elan_package_json = require('../package.json');

const npm = getInstalledPathSync('npm');

class Init {
    constructor(args) {
        this.description = `Starts a new project in a specified folder`;
        this.usage = '$ elan init [project-folder-name] [options]';
        this.usage_options = [];
        this.aliases = 'new';
        this.args = args;
        this.create_in_folder = (this.args && this.args._) ? this.args._[1] : '';
        this.elan_options = {
            blacklist: [],
            package: {},
            angular: {},
            versions: {
                main: '',
                electron: '',
                angular: {},
            }
        };
        this.angular_options = {};
        this.electron_options = {};
        this.package_json_options = {};
        this.install_dependencies = true;
    }

    entry() {
        return new Promise((resolve, reject) => {
            if (this.args._[1]) {
                if (!fs.existsSync(path.join(process.cwd(), this.create_in_folder))) {
                    this.askGeneralQuestions()
                        .then(() => this.askAngularQuestions())
                        .then(() => this.setupAll())
                        .then(() => {
                            resolve();
                        })
                        .catch(error => {
                            reject(error);
                        });
                } else {
                    if (fs.existsSync(path.join(process.cwd(), this.create_in_folder, 'elan.json'))) {
                        console.log(chalk.cyan('INFO'), `ElAn configuration exist in this folder! Starting from it...`);
                        this.elan_options.package.name = this.args._[1];
                        // TODO: Check if the whole project exists
                        this._getElanJson()
                            .then(() => this.setupAll())
                            .then(() => {
                                resolve();
                            });
                    } else {
                        fs.readdir(path.join(process.cwd(), this.create_in_folder), (err, files) => {
                            if (files.filter(file => file !== '.git').length === 0) {
                                inquirer.prompt([{
                                    type: 'confirm',
                                    name: 'overwrite',
                                    message: `Folder "${this.args._[1]}" exists but appears to be empty. Do you want to use it for your project?`,
                                    default: false
                                }, ]).then(answer => {
                                    if (answer.overwrite) {
                                        this.askGeneralQuestions()
                                            .then(() => this.askAngularQuestions())
                                            .then(() => this.setupAll())
                                            .then(() => {
                                                resolve();
                                            })
                                            .catch(error => {
                                                reject(error);
                                            });
                                    } else {
                                        resolve();
                                    }
                                });
                            } else {
                                reject(`Folder with the name "${this.args._[1]}" already exists but it's not an empty folder or it's not ElAn project!`);
                            }
                        });
                    }
                }
            } else {
                if (fs.existsSync(path.join(process.cwd(), 'elan.json'))) {
                    // TODO: Check if the whole project exists
                    this._getElanJson()
                        .then(() => this.setupAll())
                        .then(() => {
                            resolve();
                        })
                        .catch(error => {
                            reject(error);
                        });
                } else {
                    // TODO: initialize elan.json (like `npm init`)
                    reject(`Please, specify name of the project!`);
                }
            }
        });
    }

    askGeneralQuestions() {
        return new Promise((resolve, reject) => {
            inquirer.prompt([{
                    type: 'input',
                    name: 'name',
                    message: 'What name would you like to use for the project?',
                    default: this.args._[1] || '',
                    validate: (answer) => {
                        return (answer && !answer.match(/\d/g && answer !== 'app') ? true : 'Name must contain only letters and dashes! Example: my-awesome-app-one (not "my-awesome-app-1")');
                    }
                },
                {
                    type: 'input',
                    name: 'productName',
                    message: 'Product name',
                    default: this.args._[1] || ''
                },
                {
                    type: 'input',
                    name: 'description',
                    message: 'Enter a short description of your project',
                },
                {
                    type: 'input',
                    name: 'author',
                    message: 'Author of the project',
                },
                {
                    type: 'input',
                    name: 'version',
                    message: 'Initial version',
                    default: '1.0.0'
                },
                {
                    type: 'input',
                    name: 'license',
                    message: 'License of your project',
                    default: 'MIT'
                },
                {
                    type: 'input',
                    name: 'keywords',
                    message: 'Your projects keywords (separate with "," or spaces)',
                    default: ''
                }
            ]).then((general_answers) => {
                return new Promise((rslv, reject) => {
                    // transform keywords string into array of keywords
                    general_answers.keywords = general_answers.keywords.split(/[(?:\,\s)\,\s]/g).filter(x => x !== '');

                    this.elan_options.package = {
                        ...general_answers
                    };

                    this.elan_options.versions.main = this.elan_options.package.version;
                    this.elan_options.versions.electron = this.elan_options.package.version;
                    this.elan_options.versions.angular[this.elan_options.package.name] = this.elan_options.package.version;

                    if (!this.create_in_folder) this.create_in_folder = this.elan_options.package.name;

                    rslv();
                });
            }).then(() => {
                inquirer.prompt([{
                    type: 'confirm',
                    name: 'npm_install',
                    message: 'Do you want to install all dependencies after the project files are created?',
                    default: this.install_dependencies
                }, ]).then(answer => {
                    this.install_dependencies = answer.npm_install;
                    resolve();
                });
            });
        });
    }

    askAngularQuestions() {
        return new Promise((resolve, reject) => {
            inquirer.prompt([{
                    type: 'input',
                    name: 'prefix',
                    message: 'What prefix do you want to use in your app?',
                    default: 'app'
                },
                {
                    type: 'confirm',
                    name: 'routing',
                    message: 'Would you like to add Angular routing?',
                    default: true
                },
                {
                    type: 'list',
                    name: 'style',
                    message: 'Which stylesheet format would you like to use?',
                    choices: ['CSS', 'SCSS', 'SASS', 'LESS', 'Stylus']
                },
                {
                    type: 'confirm',
                    name: 'minimal',
                    message: 'Do you want to skip adding testing frameworks?',
                    default: false
                },
                {
                    type: 'confirm',
                    name: 'skipTests',
                    message: 'Do you want to skip generation of "spec.ts" test files?',
                    default: false
                },
                {
                    type: 'confirm',
                    name: 'createApplication',
                    message: 'Do you want to create default Angular application?',
                    default: true
                },
            ]).then(angular_answers => {
                this.elan_options.angular = {
                    ...angular_answers
                };
                resolve();
            });
        });
    }

    setupAll() {
        return new Promise((resolve, reject) => {
            this.initAngular()
                .then(() => this.copyElectronAssets())
                .then(() => this.initElectron())
                .then(() => this.saveElanOptions())
                .then(() => this.installDependancies())
                .then(() => this._manageIgnores())
                .then(() => this._modifyBrowserslist())
                .then(() => this._createEditorConfig())
                .then(() => this._modifyReadme())
                .then(() => this._commitChanges())
                .then(() => {
                    console.log(chalk.greenBright(`\nProject "${this.elan_options.package.name}" initialized successfuly in "${path.join(process.cwd(), this.create_in_folder)}"!\n\n`));
                    console.log(chalk.blueBright(`Note:`, chalk.blue(`If you've chosen to use routes with Angular, don't forget to use hashes!\n(replace "RouterModule.forRoot(routes)" with "RouterModule.forRoot(routes, { useHash: true })")\n\n`)));
                    console.log(chalk.greenBright(`Now type in your console:\n`));
                    console.log(chalk.rgb(128, 128, 128)(`$ cd ${this.elan_options.package.name}\n$ elan serve\n`));
                    console.log(chalk.greenBright(`and start building your awesome app!\n\n`));
                    
                    console.log(chalk.magentaBright(`Thank you for using ElAn CLI!`), chalk.magenta(`( https://github.com/D-LUSiON/elan-cli )`));
                    console.log(chalk.magentaBright(`I'll appreciate any feedback and issue reports!`));
                    resolve();
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    initAngular() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Init Angular...`);
            const ng_new = spawn('node', [
                path.join(__dirname, '..', 'node_modules', '@angular', 'cli', 'bin', 'ng'),
                'new',
                this.elan_options.package.name,
                `--directory=${this.args._[1] || this.elan_options.package.name}`,
                '--skipInstall=true',
                '--commit=false',
                '--interactive=false',
                '--inlineStyle=false',
                '--inlineTemplate=false',
                ...Object.keys(this.elan_options.angular).map(key => `--${key}=${typeof this.elan_options.angular[key] === 'string' ? this.elan_options.angular[key].toLowerCase() : this.elan_options.angular[key].toString()}`)
            ], {
                stdio: 'inherit'
            });

            ng_new.once('exit', (code, signal) => {
                if (code === 0) {
                    console.log(chalk.greenBright('DONE'), 'Angular project created!');

                    this._modifyAngularJSON()
                        .then(() => this._getAngularJson())
                        .then(() => this._getPackageJson())
                        .then(() => {
                            resolve();
                        })
                        .catch(error => {
                            reject(error);
                        });
                } else {
                    reject(signal);
                }
            });
        });
    }

    updateAngularRouting() {
        // TODO: Update Angular routing if chosen to be used
        return new Promise((resolve, reject) => {
            if (fs.existsSync(path.join(progress.cwd(), this.args._[1])))
                resolve();
            else
                reject(`updateAngularRouting method, that's not implemented, reports that ${path.join(progress.cwd(), this.args._[1])} does not exist!`);
        });
    }

    copyElectronAssets() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Creating Electron scripts...`);
            let ncp_options = {};
            if (!this.angular_options.createApplication)
                ncp_options = {
                    filter: (file) => !file.startsWith(path.join(__dirname, '..', 'assets', 'src'))
                }
            ncp(path.join(__dirname, '..', 'assets'), path.join(process.cwd(), this.create_in_folder), ncp_options, () => {
                this._modifyElectronPackageJSON().then(() => {
                    resolve();
                }).catch(error => {
                    reject(error);
                });
            });
        });
    }

    initElectron() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Adding Electron dependencies to package.json...`);
            this._getLatestDepsVersions().then(([electron_version, ngx_electron_version]) => {
                console.log(chalk.cyan('INFO'), `Latest Electron version:`, chalk.greenBright(`v${electron_version}`));
                console.log(chalk.cyan('INFO'), `Latest ngx-electron version:`, chalk.greenBright(`v${ngx_electron_version}`));

                if (!this.package_json_options.dependencies) this.package_json_options.dependencies = {};
                if (!this.package_json_options.devDependencies) this.package_json_options.devDependencies = {};

                this.package_json_options.dependencies['ngx-electron'] = `^${ngx_electron_version}`;
                this.package_json_options.devDependencies.electron = `^${electron_version}`;

                // TODO: This block can be optimized from here...
                const dependencies = {};

                Object.keys(this.package_json_options.dependencies).sort().forEach(key => {
                    dependencies[key] = this.package_json_options.dependencies[key];
                });

                const devDependencies = {};

                Object.keys(this.package_json_options.devDependencies).sort().forEach(key => {
                    devDependencies[key] = this.package_json_options.devDependencies[key];
                });

                this.package_json_options.dependencies = dependencies;
                this.package_json_options.devDependencies = devDependencies;
                // ... until here...

                this.package_json_options = {
                    ...this.package_json_options,
                    ...this.elan_options.package
                };

                fs.writeFile(path.join(process.cwd(), this.create_in_folder, 'package.json'), JSON.stringify(this.package_json_options, null, 2), 'utf8', (err) => {
                    if (err) console.log(err);
                    resolve();
                });
            });
        });
    }

    saveElanOptions() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Saving ElAn options...`);
            const path_to_elan_json = path.join(process.cwd(), this.create_in_folder, 'elan.json');
            fs.writeFile(path_to_elan_json, JSON.stringify(this.elan_options, null, 2), 'utf8', (err) => {
                if (err) console.log(err);
                resolve();
            });
        });
    }

    _getLatestDepsVersions() {
        return Promise.all([
            new Promise(resolve => {
                exec('npm view electron version', (err, stdout, stderr) => {
                    const result = stdout.replace(/\n/s, '');
                    resolve(result);
                });
            }),
            new Promise(resolve => {
                exec('npm view ngx-electron version', (err, stdout, stderr) => {
                    const result = stdout.replace(/\n/s, '');
                    resolve(result);
                });
            }),
        ]);
    }

    _getPackageJson() {
        return new Promise((resolve, reject) => {
            const path_to_package_json = path.join(process.cwd(), this.create_in_folder, 'package.json');
            delete require.cache[require.resolve(path_to_package_json)];
            this.package_json_options = require(path_to_package_json);
            resolve();
        });
    }

    _getAngularJson() {
        return new Promise((resolve, reject) => {
            const path_to_angular_json = path.join(process.cwd(), this.create_in_folder, 'angular.json');
            delete require.cache[require.resolve(path_to_angular_json)];
            this.angular_options = require(path_to_angular_json);
            resolve();
        });
    }

    _getElanJson() {
        return new Promise((resolve, reject) => {
            const path_to_elan_json = path.join(process.cwd(), this.create_in_folder, 'elan.json');
            delete require.cache[require.resolve(path_to_elan_json)];
            this.elan_options = require(path_to_elan_json);
            resolve();
        });
    }

    _modifyAngularJSON() {
        return new Promise((resolve, reject) => {
            new Promise(rslv => {
                if (fs.existsSync(path.resolve(this.create_in_folder, 'src', 'environments'))) {
                    console.log(chalk.cyan('INFO'), `Adding "dev" environment...`);
                    const dev_env = `export const environment = {\n  production: false\n};\n`;

                    fs.writeFile(
                        path.join(process.cwd(), this.create_in_folder, 'src', 'environments', 'environment.dev.ts'),
                        dev_env, 'utf8', (err) => {
                            if (err) console.log(err);
                            rslv();
                        });
                } else
                    rslv();

            }).then(() => {
                this._getAngularJson().then(() => {
                    if (this.angular_options.projects[this.elan_options.package.name]) {
                        console.log(chalk.cyan('INFO'), `Adding "dev" config to angular.json and modifying some paths...`);
                        let configurations = {
                            ...this.angular_options.projects[this.elan_options.package.name].architect.build.configurations
                        };
    
                        configurations = {
                            production: {
                                ...configurations.production,
                                baseHref: '',
                                outputPath: 'build/app',
                            },
                            dev: {
                                baseHref: '',
                                outputPath: 'www',
                                deleteOutputPath: false,
                                optimization: false,
                                outputHashing: 'media',
                                sourceMap: true,
                                extractCss: false,
                                namedChunks: true,
                                aot: false,
                                extractLicenses: false,
                                vendorChunk: true,
                                buildOptimizer: false,
                                fileReplacements: [{
                                    replace: 'src/environments/environment.ts',
                                    with: 'src/environments/environment.dev.ts'
                                }]
                            }
                        };
    
                        this.angular_options.projects[this.elan_options.package.name].architect.build.configurations = {
                            ...configurations
                        };
    
                        fs.writeFile(
                            path.join(process.cwd(), this.create_in_folder, 'angular.json'),
                            JSON.stringify(this.angular_options, null, 2),
                            'utf8',
                            (err) => {
                                if (err) console.log(err);
                                resolve();
                            }
                        );
                    } else
                        resolve();
                });
            });
        });
    }

    _modifyBrowserslist() {
        return new Promise((resolve, reject) => {
            if (fs.existsSync(path.resolve(this.create_in_folder, 'browserslist'))) {
                fs.readFile(path.join(process.cwd(), this.create_in_folder, 'browserslist')).then(browserslist => {
                    const brl = browserslist.toString().split(/\n/);
                    let last_idx = -1;
                    brl.forEach((line, idx) => {
                        if (line.startsWith('#'))
                            last_idx = idx;
                    });
    
                    const brl_updated = brl.slice(0, last_idx);
                    brl_updated.push('');
                    brl_updated.push('last 2 Chrome versions');
    
                    fs.writeFile(
                        path.join(process.cwd(), this.create_in_folder, 'browserslist'),
                        brl_updated.join(`\n`),
                        'utf8',
                        (err) => {
                            if (err) console.log(err);
                            resolve();
                        }
                    )
                });
            } else
                resolve();
        });
    }

    _modifyElectronPackageJSON() {
        return new Promise((resolve, reject) => {
            exec('npm view electron-window-state version', (err, stdout, stderr) => {
                console.log(chalk.cyan('INFO'), `Setting up Electron's package.json`);

                const result = stdout.replace(/\n/g, '');

                const electron_package_options = {
                    name: this.package_json_options.name,
                    productName: this.package_json_options.productName || '',
                    description: this.package_json_options.description || '',
                    author: this.package_json_options.author || '',
                    version: this.package_json_options.version || '',
                    license: this.package_json_options.license || '',
                    main: 'main.js',
                    dependencies: {
                        'electron-window-state': `^${result}`
                    },
                    devDependencies: {}
                };

                const path_to_package_json = path.join(process.cwd(), this.create_in_folder, 'electron', 'package.json');

                fs.writeFile(path_to_package_json, JSON.stringify({
                    ...this.package_json_options,
                    ...electron_package_options,
                }, null, 2), 'utf8', () => {
                    resolve();
                });
            });
        });
    }

    _manageIgnores() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Modifying ".gitignore"...`);
            fs.readFile(path.join(process.cwd(), this.create_in_folder, '.gitignore'), (err, buffer) => {
                if (err) {
                    reject(err);
                } else {
                    const gitignore = buffer.toString().split(/\n/);
                    const idx = gitignore.findIndex(x => x === '# compiled output') + 1;
                    ['/dist-*', '/build', '/www-*', '/www', '/release'].forEach(exception => {
                        gitignore.splice(idx, 0, exception);
                    });

                    const node_modules_idx = gitignore.findIndex(x => x.match(/node_modules/));
                    gitignore[node_modules_idx] = '/**/node_modules/**/*';
                    fs.writeFile(path.join(process.cwd(), this.create_in_folder, '.gitignore'), gitignore.join(`\n`), 'utf8', (err) => {
                        if (err) {
                            reject(err);
                        } else
                            resolve();
                    });
                }
            });
        });
    }

    installDependancies() {
        return new Promise((resolve, reject) => {
            if (this.install_dependencies) {
                console.log(chalk.cyan('INFO'), `Installing Angular dependencies...`);
                const npm_install = spawn('node', [npm, 'install'], {
                    cwd: path.join(process.cwd(), this.create_in_folder),
                    stdio: 'inherit'
                });
                npm_install.once('exit', (code, signal) => {
                    if (code === 0)
                        resolve();
                    else
                        reject(signal);
                });
            } else {
                console.log(chalk.rgb(255, 128, 0)('SKIP'), `Skipping installation of Angular dependencies...`);
                resolve();
            }
        }).then(() => {
            return new Promise((resolve, reject) => {
                if (this.install_dependencies) {
                    console.log(chalk.cyan('INFO'), `Installing Electron dependencies...`);
                    const npm_install = spawn('node', [npm, 'install'], {
                        cwd: path.join(process.cwd(), this.create_in_folder, 'electron'),
                        stdio: 'inherit'
                    });
                    npm_install.once('exit', (code, signal) => {
                        if (code === 0)
                            resolve();
                        else
                            reject(signal);
                    });
                } else {
                    console.log(chalk.rgb(255, 128, 0)('SKIP'), `Skipping installation of Electron dependencies...`);
                    resolve();
                }
            });
        });
    }

    _createEditorConfig() {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path.join(process.cwd(), this.create_in_folder, '.editorconfig'))) {
                const editorconfig = [
                    'root = true',
                    '',
                    '[*]',
                    'indent_style = space',
                    'indent_size = 4',
                    'charset = utf-8',
                    'trim_trailing_whitespace = true',
                    'insert_final_newline = true',
                ].join(`\n`);

                fs.writeFile(path.join(process.cwd(), this.create_in_folder, '.editorconfig'), editorconfig, 'utf8', (err) => {
                    if (err) console.log(err);
                    resolve();
                });
            } else
                resolve();
        });
    }

    _modifyReadme() {
        return new Promise((resolve, reject) => {
            if (fs.existsSync(path.join(process.cwd(), this.create_in_folder, 'README.md'))) {
                fs.readFile(path.join(__dirname, '..', 'resources', 'README.md'))
                    .then(readme => {
                        const replace_texts = {
                            project_title: (this.elan_options.package.productName || (this.elan_options.package.name || this.create_in_folder).split(/[-_\. \s]/).map(word => `${word.charAt(0).toUpperCase()}${word.substr(1)}`).join('')),
                            project_description: (this.elan_options.package.description || '*No description available*'),
                            elan_version: elan_package_json.version,
                            angular_version: this.package_json_options.dependencies['@angular/core'].replace(/[\^\<\>=\*\~]/, ''),
                            angular_cli_version: this.package_json_options.devDependencies['@angular/cli'].replace(/[\^\<\>=\*\~]/, ''),
                            electron_version: this.package_json_options.devDependencies['electron'].replace(/[\^\<\>=\*\~]/, '')
                        }
                        let rdme = readme.toString();
                        rdme = rdme.replace(/\{(.+?)\}/g, ($1, $2) => replace_texts[$2.trim()]);
                        fs.writeFile(path.join(process.cwd(), this.create_in_folder, 'README.md'), rdme, 'utf8', (err) => {
                            if (err) console.log(err);
                            resolve();
                        });
                    });
            } else
                resolve();
        });
    }

    _commitChanges() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Creating initial commit...`);
            const Git = require('simple-git')(path.join(process.cwd(), this.create_in_folder));
            Git.add('.', () => {
                Git.commit('Initial commit by ElAn CLI', () => {
                    resolve();
                });
            });
        });
    }
}

module.exports = Init;