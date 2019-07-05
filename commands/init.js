const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const chalk = require('chalk');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const ncp = require('ncp').ncp; // Recursive copying

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
        console.log(this.args);
    }

    entry() {
        return new Promise((resolve, reject) => {
            if (this.args._[1]) {
                if (!fs.existsSync(path.join(process.cwd(), this.args._[1]))) {
                    this.askGeneralQuestions()
                        .then(() => this.askAngularQuestions())
                        .then(() => this.initAngular())
                        .then(() => this.copyElectronAssets())
                        .then(() => this.initElectron())
                        .then(() => this.saveElanOptions())
                        .then(() => this.installDependancies())
                        .then(() => {
                            console.log(`All done!`);
                            resolve();
                        });
                } else {
                    if (fs.existsSync(path.join(process.cwd(), this.args._[1], 'elan.json'))) {
                        console.log(`ElAn configuration exist in this folder! Starting from it...`);
                        this.elan_options.name = this.args._[1];
                        // TODO: Check if the whole project exists
                        this._getElanJson()
                            .then(() => this.initAngular())
                            .then(() => this.copyElectronAssets())
                            .then(() => this.initElectron())
                            .then(() => this.saveElanOptions())
                            .then(() => this.installDependancies())
                            .then(() => {
                                console.log(`All done!`);
                                resolve();
                            });
                    } else {
                        reject(`Folder with the name "${this.args._[1]}" already exists and is not ElAn project!`);
                    }
                }
            } else {
                if (fs.existsSync(path.join(process.cwd(), 'elan.json'))) {

                } else {
                    reject(`Folder with the name "${this.args._[1]}" already exists!`);
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
                // transform keywords string into array of keywords
                general_answers.keywords = general_answers.keywords.split(/[(?:\,\s)\,\s]/g).filter(x => x !== '');

                this.elan_options.package = {
                    ...general_answers
                };
                resolve();
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

    initAngular() {
        return new Promise((resolve, reject) => {
            console.log(`Init Angular...`);

            const ng_new = spawn('node', [
                path.join(__dirname, '..', 'node_modules', '@angular', 'cli', 'bin', 'ng'),
                'new',
                this.elan_options.package.name,
                '--skipInstall=true',
                '--commit=false',
                '--interactive=false',
                ...Object.keys(this.elan_options.angular).map(key => `--${key}=${typeof this.elan_options.angular[key] === 'string' ? this.elan_options.angular[key].toLowerCase() : this.elan_options.angular[key].toString()}`)
            ], {
                stdio: ['inherit', 'inherit', 'inherit']
            });

            ng_new.once('exit', (code, signal) => {
                if (code === 0) {
                    console.log(chalk.green `{green Angular project created!}`);

                    this._modifyAngularJSON()
                        .then(() => this._getAngularJson())
                        .then(() => this._getPackageJson())
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
            console.log(`Copying Electron assets...`);
            let ncp_options = {};
            if (!this.angular_options.createApplication)
                ncp_options = {
                    filter: (file) => !file.startsWith(path.join(__dirname, '..', 'assets', 'src'))
                }
            ncp(path.join(__dirname, '..', 'assets'), path.join(process.cwd(), this.package_json_options.name), ncp_options, () => {
                console.log(chalk `{green Electron files created!}`);
                resolve();
            });
        });
    }

    initElectron() {
        return new Promise((resolve, reject) => {
            console.log(`Init Electron...`);
            this._getLatestDepsVersions().then(([electron_version, ngx_electron_version]) => {
                console.log(`Latest Electron version: ${electron_version}`);
                console.log(`Latest ngx-electron version: ${ngx_electron_version}`);

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
            console.log(`Saving ElAn options...`);
            console.log(this.elan_options);
            console.log(`Stringified: ${JSON.stringify(this.elan_options, null, 2)}`);
            const path_to_elan_json = path.join(process.cwd(), this.elan_options.package.name, 'elan.json');
            console.log(`Elan.json path: ${path_to_elan_json}`);

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
            const path_to_package_json = path.join(process.cwd(), this.elan_options.name, 'package.json');
            delete require.cache[require.resolve(path_to_package_json)];
            this.package_json_options = require(path_to_package_json);
            resolve();
        });
    }

    _getAngularJson() {
        return new Promise((resolve, reject) => {
            const path_to_angular_json = path.join(process.cwd(), this.elan_options.name, 'angular.json');
            delete require.cache[require.resolve(path_to_angular_json)];
            this.angular_options = require(path_to_angular_json);
            resolve();
        });
    }

    _getElanJson() {
        return new Promise((resolve, reject) => {
            const path_to_elan_json = path.join(process.cwd(), this.elan_options.name, 'elan.json');
            delete require.cache[require.resolve(path_to_elan_json)];
            this.elan_options = require(path_to_elan_json);
            resolve();
        });
    }

    _modifyAngularJSON() {
        return new Promise((resolve, reject) => {
            console.log(`Adding "dev" config to angular.json...`);

            // TODO: Add "dev" config to angular.json

            resolve();
        });
    }

    _modifyElectronPackageJSON() {
        return new Promise((resolve, reject) => {
            exec('npm view electron-window-state version', (err, stdout, stderr) => {
                const result = stdout.replace(/\n/g, '');

                const electron_package_options = {
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

    installDependancies() {
        return new Promise((resolve, reject) => {

            resolve();
        });
    }
}

module.exports = Init;