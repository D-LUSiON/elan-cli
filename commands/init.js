const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const chalk = require('chalk');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const ncp = require('ncp').ncp; // Recursive copying

const np = process.argv[0].split(/[\\\/]/g);
np.pop();
const npm = path.join(...np, 'node_modules', 'npm', 'bin', 'npm-cli.js');

class Init {
    constructor(args) {
        this.description = 'Starts a new project';
        this.usage = '$ elan init [project-name] [options]';
        this.aliases = 'init';
        this.args = args;
        this.elan_options = {};
        this.angular_options = {};
        this.electron_options = {};
        this.package_json_options = {};
        this.install_dependancies = true;
    }

    entry() {
        return new Promise((resolve, reject) => {
            if (this.args._[1]) {
                if (!fs.existsSync(path.join(process.cwd(), this.args._[1]))) {
                    this.askGeneralQuestions()
                        .then(() => this.askAngularQuestions())
                        .then(() => this.setupAll())
                        .then(() => {
                            resolve();
                        });
                } else {
                    if (fs.existsSync(path.join(process.cwd(), this.args._[1], 'elan.json'))) {
                        console.log(chalk.cyan('INFO'), `ElAn configuration exist in this folder! Starting from it...`);
                        this.elan_options.package.name = this.args._[1];
                        // TODO: Check if the whole project exists
                        this._getElanJson()
                            .then(() => this.setupAll())
                            .then(() => {
                                resolve();
                            });
                    } else {
                        reject(`Folder with the name "${this.args._[1]}" already exists and is not ElAn project!`);
                    }
                }
            } else {
                if (fs.existsSync(path.join(process.cwd(), 'elan.json'))) {
                    // TODO: Check if the whole project exists
                    this._getElanJson()
                        .then(() => this.setupAll())
                        .then(() => {
                            resolve();
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
                    default: '0.0.1'
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
                    rslv();
                });
            }).then(() => {
                inquirer.prompt([{
                    type: 'confirm',
                    name: 'npm_install',
                    message: 'Do you want to install all dependancies after the project files are created?',
                    default: this.install_dependancies
                }, ]).then(answer => {
                    this.install_dependancies = answer.npm_install;
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
                .then(() => this._commitChanges())
                .then(() => {
                    console.log(chalk.green(`\nProject "${this.elan_options.package.name}" initialized successfuly!\n\n`));
                    console.log(chalk.magentaBright(`Thank you for using ElAn-cli!`), chalk.magenta(`( https://github.com/D-LUSiON/elan-cli )`));
                    console.log(chalk.magentaBright(`I'll appreciate any feedback and issue reports!`));
                    resolve();
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
                    console.log(chalk.green('DONE'), 'Angular project created!');

                    this._modifyAngularJSON()
                        .then(() => this._getAngularJson())
                        .then(() => this._getPackageJson())
                        .then(() => this._modifyElectronPackageJSON())
                        .then(() => {
                            resolve();
                        });
                } else {
                    process.exit(code);
                }
            });
        });
    }

    copyElectronAssets() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Copying Electron assets...`);
            let ncp_options = {};
            if (!this.angular_options.createApplication)
                ncp_options = {
                    filter: (file) => !file.startsWith(path.join(__dirname, '..', 'assets', 'src'))
                }
            ncp(path.join(__dirname, '..', 'assets'), path.join(process.cwd(), this.package_json_options.name), ncp_options, () => {

                console.log(chalk.green('DONE'), 'Electron files created!');
                resolve();
            });
        });
    }

    initElectron() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Initializing Electron...`);
            this._getLatestDepsVersions().then(([electron_version, ngx_electron_version]) => {
                console.log(chalk.cyan('INFO'), `Latest Electron version:`, chalk.green(`v${electron_version}`));
                console.log(chalk.cyan('INFO'), `Latest ngx-electron version:`, chalk.green(`v${ngx_electron_version}`));

                if (!this.package_json_options.dependencies) this.package_json_options.dependencies = {};
                if (!this.package_json_options.devDependencies) this.package_json_options.devDependencies = {};

                this.package_json_options.dependencies['ngx-electron'] = `^${ngx_electron_version}`;
                this.package_json_options.devDependencies.electron = `^${electron_version}`;

                const devDependencies = {};

                Object.keys(this.package_json_options.devDependencies).sort().forEach(key => {
                    devDependencies[key] = this.package_json_options.devDependencies[key];
                });

                this.package_json_options.devDependencies = devDependencies;
                resolve();
            });
        });
    }

    saveElanOptions() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Saving ElAn options...`);
            const path_to_elan_json = path.join(process.cwd(), this.elan_options.package.name, 'elan.json');
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
            const path_to_package_json = path.join(process.cwd(), this.elan_options.package.name, 'package.json');
            delete require.cache[require.resolve(path_to_package_json)];
            this.package_json_options = require(path_to_package_json);
            resolve();
        });
    }

    _getAngularJson() {
        return new Promise((resolve, reject) => {
            const path_to_angular_json = path.join(process.cwd(), this.elan_options.package.name, 'angular.json');
            delete require.cache[require.resolve(path_to_angular_json)];
            this.angular_options = require(path_to_angular_json);
            resolve();
        });
    }

    _getElanJson() {
        return new Promise((resolve, reject) => {
            const path_to_elan_json = path.join(process.cwd(), this.elan_options.package.name, 'elan.json');
            delete require.cache[require.resolve(path_to_elan_json)];
            this.elan_options = require(path_to_elan_json);
            resolve();
        });
    }

    _modifyAngularJSON() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Adding "dev" environment...`);
            new Promise(rslv => {
                const dev_env = `export const environment = {\n  production: false\n};\n`;

                fs.writeFile(
                    path.join(process.cwd(), this.elan_options.package.name, 'src', 'environments', 'environment.dev.ts'),
                    dev_env, 'utf8', (err) => {
                        if (err) console.log(err);
                        rslv();
                    });
            }).then(() => {
                this._getAngularJson().then(() => {
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
                        path.join(process.cwd(), this.elan_options.package.name, 'angular.json'),
                        JSON.stringify(this.angular_options, null, 2),
                        'utf8',
                        (err) => {
                            if (err) console.log(err);
                            resolve();
                        }
                    );
                });
            });
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

                const path_to_package_json = path.join(process.cwd(), this.package_json_options.name, 'electron', 'package.json');

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
            fs.readFile(path.join(process.cwd(), this.elan_options.package.name, '.gitignore'), (err, buffer) => {
                if (err) {
                    reject(err);
                    process.exit(1);
                } else {
                    const gitignore = buffer.toString().split(/\n/);
                    const idx = gitignore.findIndex(x => x === '# compiled output') + 1;
                    ['/dist-*', '/build', '/www-*', '/www'].forEach(exception => {
                        gitignore.splice(idx, 0, exception);
                    });
                    fs.writeFile(path.join(process.cwd(), this.elan_options.package.name, '.gitignore'), gitignore.join(`\n`), 'utf8', (err) => {
                        if (err) {
                            reject(err);
                            process.exit(1);
                        } else
                            resolve();
                    });
                }
            });
        });
    }

    installDependancies() {
        return new Promise((resolve, reject) => {
            if (this.install_dependancies) {
                console.log(chalk.cyan('INFO'), `Installing Angular dependancies...`);
                const npm_install = spawn('node', [npm, 'install'], {
                    cwd: path.join(process.cwd(), this.elan_options.package.name),
                    stdio: 'inherit'
                });
                npm_install.once('exit', (code, signal) => {
                    if (code === 0)
                        resolve();
                    else
                        process.exit(code);
                });
            } else {
                console.log(chalk.rgb(255, 128, 0)('SKIP'), `Skipping installation of Angular dependancies...`);
                resolve();
            }
        }).then(() => {
            return new Promise((resolve, reject) => {
                if (this.install_dependancies) {
                    console.log(chalk.cyan('INFO'), `Installing Electron dependancies...`);
                    const npm_install = spawn('node', [npm, 'install'], {
                        cwd: path.join(process.cwd(), this.elan_options.package.name, 'electron'),
                        stdio: 'inherit'
                    });
                    npm_install.once('exit', (code, signal) => {
                        if (code === 0)
                            resolve();
                        else
                            process.exit(code);
                    });
                } else {
                    console.log(chalk.rgb(255, 128, 0)('SKIP'), `Skipping installation of Electron dependancies...`);
                    resolve();
                }
            });
        });
    }

    _commitChanges() {
        return new Promise((resolve, reject) => {
            console.log(chalk.cyan('INFO'), `Creating initial commit...`);
            const Git = require('simple-git')(path.join(process.cwd(), this.elan_options.package.name));
            Git.add('.', () => {
                Git.commit('Initial commit by ElAn CLI', () => {
                    resolve();
                });
            });
        });
    }
}

module.exports = Init;