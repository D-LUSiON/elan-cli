const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const chalk = require('chalk');
const loadingSpinner = require('loading-spinner');
const exec = require('child_process').exec;
const ncp = require('ncp').ncp; // Recursive copying

class New {
    constructor(args) {
        this.description = 'Starts a new project ("init" is an alias)';
        this.usage = '$ elan new [project-name] [options]';
        this.aliases = 'init';
        this.args = args;
        this.angular_options = {};
        this.electron_options = {};
        this.package_json_options = {};
    }

    entry() {
        console.log(this.args);

        return new Promise((resolve, reject) => {
            // TODO: Make Promise.all if possible
            console.log('Start asking questions...');
            this.startAskingQuestions().then(() => {
                console.log('Questions answered, installing Angular...');
                this.initAngular().then(() => {
                    console.log('Angular installed');
                    this.initElectron().then(() => {
                        console.log(chalk `\n{rgb(255,131,0) Everything's ready to go!}\n\nNow write {green cd ${this.package_json_options.name}} in your console and start the project with {green elan serve}!`);
                        resolve();
                    });
                });
            });
        });
    }

    startAskingQuestions() {
        return new Promise(resolve => {
            inquirer.prompt([{
                    type: 'input',
                    name: 'name',
                    message: 'What name would you like to use for the project?',
                    default: this.args._[1] || '',
                    validate: (answer) => {
                        return !answer.match(/\d/g) ? true : 'Name must contain only letters and dashes! Example: my-awesome-app-one (not "my-awesome-app-1")';
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
                },
            ]).then((general_answers) => {
                general_answers.keywords = general_answers.keywords.split(/[(?:\,\s)\,\s]/g).filter(x => x !== '');
                this.package_json_options = {
                    ...this.package_json_options,
                    ...general_answers
                };
                inquirer.prompt([{
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
                        type: 'input',
                        name: 'prefix',
                        message: 'What prefix do you want to use in Angular?',
                        default: 'app'
                    },
                    {
                        type: 'confirm',
                        name: 'skipTests',
                        message: 'Skip tests in Angular?',
                        default: false
                    },
                ]).then(angular_answers => {
                    this.angular_options = {
                        ...this.angular_options,
                        ...angular_answers
                    };

                    resolve();
                });
            });
        });
    }

    initAngular() {
        return new Promise(resolve => {
            const ng_command = `ng new ${this.package_json_options.name} --skipInstall=true --commit=false --interactive=false ${Object.keys(this.angular_options).map(key => `--${key}=${this.angular_options[key]}`).join(' ')}`;

            loadingSpinner.start(
                100, {
                    clearChar: true,
                    clearLine: true,
                    doNotBlock: true,
                    hideCursor: true
                }
            );

            exec(ng_command, () => {
                loadingSpinner.stop();
                console.log(chalk `{green Angular project created!}`);
                this._modifyPackageJSON().then((error, stdout, stderr) => {
                    resolve();
                });
            });
        });
    }

    _modifyPackageJSON() {
        return new Promise((resolve, reject) => {
            const path_to_package_json = path.join(process.cwd(), this.package_json_options.name, 'package.json');
            let package_json = require(path_to_package_json);
            Object.keys(this.package_json_options).forEach(key => {
                delete package_json[key];
            });

            package_json = {
                ...this.package_json_options,
                ...package_json,
            };

            this._getLatestElectronVersion().then(version => {
                package_json['devDependencies'].electron = `^${version}`;

                const devDependencies = {};

                Object.keys(package_json['devDependencies']).sort().forEach(key => {
                    devDependencies[key] = package_json['devDependencies'][key];
                });

                package_json['devDependencies'] = devDependencies;

                fs.writeFile(path_to_package_json, JSON.stringify(package_json, null, 4), 'utf8', () => {
                    resolve();
                });
            });
        });
    }

    initElectron() {
        return new Promise((resolve, reject) => {
            // process.chdir(`./${this.package_json_options.name}`);
            ncp(path.join(__dirname, '..', 'assets'), process.cwd(), () => {
                console.log(chalk `{green Electron files created! Installing Electron and Angular dependancies...}`);
                loadingSpinner.start(
                    100, {
                        clearChar: true,
                        clearLine: true,
                        doNotBlock: true,
                        hideCursor: true
                    }
                );
                Promise.all([
                    new Promise((resolve_angular, reject) => {
                        exec('npm i', {
                            cwd: path.join(process.cwd(), this.package_json_options.name)
                        }, (err) => {
                            loadingSpinner.stop();
                            console.log(chalk `{green Angular dependancies installed!}`);
                            resolve_angular();
                        });
                    }),
                    new Promise((resolve_electron, reject) => {
                        exec('npm i', {
                            cwd: path.join(process.cwd(), this.package_json_options.name, 'electron')
                        }, (err) => {
                            console.log(chalk `{green Electron dependancies installed!}`);
                            resolve_angular();
                        });
                        resolve_electron();
                    }),
                ]).then(value => {
                    resolve();
                });
                // console.log(chalk `{green Installing Angular dependancies...}`, process.cwd());
                
                // exec('npm i', {
                //     cwd: path.join(process.cwd(), this.package_json_options.name)
                // }, (err) => {
                //     loadingSpinner.stop();
                //     console.log(chalk `{green Angular dependancies installed!}`);
                //     process.chdir('./electron');
                //     console.log(chalk `{green Installing Electron dependancies...}`, process.cwd());
                //     loadingSpinner.start(
                //         100, {
                //             clearChar: true,
                //             clearLine: true,
                //             doNotBlock: true,
                //             hideCursor: true
                //         }
                //     );
                //     exec('npm i', (err) => {
                //         loadingSpinner.stop();
                //         console.log(chalk `{green Electron dependancies installed!}`);
                //         process.chdir('..');
                //         resolve();
                //     });
                // });
            });
        });
    }

    _getLatestElectronVersion() {
        return new Promise(resolve => {
            exec('npm view electron version', (err, stdout, stderr) => {
                const result = stdout.replace(/\n/s, '');
                resolve(result);
            });
        });
    }
}

module.exports = New;