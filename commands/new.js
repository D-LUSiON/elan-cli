const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const chalk = require('chalk');
const loadingSpinner = require('loading-spinner');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const ncp = require('ncp').ncp; // Recursive copying

const np = process.argv[0].split(/[\\\/]/g);
np.pop();
const npm = path.join(...np, 'node_modules', 'npm', 'bin', 'npm-cli.js');

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
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path.join(process.cwd(), this.args._[1]))) {
                this.startAskingQuestions().then(() => {
                    console.log(chalk `\n{green Alright, everithing's set! Creating Angular project....}\n`);
                    this.initElectron().then(() => {
                        this.initAngular().then(() => {
                            this.installElectron().then(() => {
                                this.installAngular().then(() => {
                                    // TODO: Commit "initial commit"
                                    console.log(chalk `\n{rgb(255,128,0) Everything's ready to go!}\n\nWrite {green cd ${this.package_json_options.name}} in your console and start the project with {green elan serve}!`);
                                    resolve();
                                }).catch((err) => {
                                    reject(err);
                                });
                            }).catch((err) => {
                                reject(err);
                            });
                        }).catch((err) => {
                            reject(err);
                        });
                    }).catch((err) => {
                        reject(err);
                    });
                }).catch((err) => {
                    reject(err);
                });
            } else {
                reject(`Folder with the name "${this.args._[1]}" already exists!`);
            }
        });
    }

    startAskingQuestions() {
        return new Promise(resolve => {
            // TODO: Create "--silent" argument for the command that skips questions
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
        return new Promise((resolve, reject) => {
            const ng_new = spawn('node', [
                path.join(__dirname, '..', 'node_modules', '@angular', 'cli', 'bin', 'ng'),
                'new',
                this.package_json_options.name,
                '--skipInstall=true',
                '--commit=false',
                '--interactive=false',
                ...Object.keys(this.angular_options).map(key => `--${key}=${typeof this.angular_options[key] === 'string' ? this.angular_options[key].toLowerCase() : this.angular_options[key]}`)
            ], {
                stdio: [process.stdin, process.stdout, process.stderr]
            });

            ng_new.once('exit', (code, signal) => {
                if (code === 0) {
                    console.log(chalk `{green Angular project created!}`);
                    this._modifyPackages().then((error, stdout, stderr) => {
                        resolve();
                    });
                } else {
                    process.exit(code);
                }
            });
        });
    }

    _modifyAngularJSON() {
        return new Promise((resolve, reject) => {
            // Add "dev" config to angular.json
            const path_to_angular_json = path.join(process.cwd(), this.package_json_options.name, 'angular.json');
            let angular_json = require(path_to_angular_json);
            const dev_options = {
                "dev": {
                    "baseHref": "",
                    "outputPath": "./app",
                    "deleteOutputPath": false,
                    "optimization": false,
                    "outputHashing": "media",
                    "sourceMap": true,
                    "extractCss": false,
                    "namedChunks": true,
                    "aot": false,
                    "extractLicenses": false,
                    "vendorChunk": true,
                    "buildOptimizer": false,
                    "fileReplacements": [{
                        "replace": "src/environments/environment.ts",
                        "with": "src/environments/environment.dev.ts"
                    }]
                },
            };

            angular_json.projects[this.package_json_options.name].architect.build.configurations = {
                ...dev_options,
                ...angular_json.projects[this.package_json_options.name].architect.build.configurations
            }

            fs.writeFile(path_to_angular_json, JSON.stringify(angular_json, null, 2), 'utf8', () => {
                resolve();
            });
        });
    }

    _modifyGitIgnore() {
        return new Promise((resolve, reject) => {
            // TODO: Add /app and modify /node_modules to **/node_modules/**/*
            resolve();
        });
    }

    _modifyPackageJSON() {
        return new Promise((resolve, reject) => {
            this._modifyAngularJSON();

            // Modify ./package.json
            const path_to_package_json = path.join(process.cwd(), this.package_json_options.name, 'package.json');
            let package_json = require(path_to_package_json);
            Object.keys(this.package_json_options).forEach(key => {
                delete package_json[key];
            });

            package_json = {
                ...this.package_json_options,
                ...package_json,
            };

            this._getLatestDepsVersions().then(([electron_version, ngx_electron_version]) => {
                package_json['devDependencies'].electron = `^${electron_version}`;
                package_json['devDependencies']['ngx-electron'] = `^${ngx_electron_version}`;

                const devDependencies = {};

                Object.keys(package_json['devDependencies']).sort().forEach(key => {
                    devDependencies[key] = package_json['devDependencies'][key];
                });

                package_json['devDependencies'] = devDependencies;

                fs.writeFile(path_to_package_json, JSON.stringify(package_json, null, 2), 'utf8', () => {
                    resolve();
                });
            });
        });
    }

    _modifyElectronPackageJSON() {
        return new Promise((resolve, reject) => {
            exec('npm view electron-window-state version', (err, stdout, stderr) => {
                const result = stdout.replace(/\n/s, '');

                const electron_package_options = {
                    "main": "main.js",
                    "dependencies": {
                        "electron-window-state": ""
                    },
                    "devDependencies": {}
                };

                electron_package_options.dependencies['electron-window-state'] = `^${result}`;

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

    _modifyPackages() {
        return Promise.all([
            this._modifyAngularJSON(),
            this._modifyPackageJSON(),
            this._modifyElectronPackageJSON(),
        ]);
    }

    initElectron() {
        return new Promise((resolve, reject) => {
            ncp(path.join(__dirname, '..', 'assets'), path.join(process.cwd(), this.package_json_options.name), () => {
                console.log(chalk `{green Electron files created!}`);
                resolve();
            });
        });
    }

    installAngular() {
        console.log(chalk `{rgb(255,128,0) Installing Angular dependancies...}`);
        return new Promise((resolve) => {
            const npm_install = spawn('node', [npm, 'install'], {
                cwd: path.join(process.cwd(), this.package_json_options.name),
                stdio: [process.stdin, process.stdout, process.stderr]
            });

            npm_install.once('exit', (code, signal) => {
                if (code === 0) {
                    console.log(chalk `{green Angular dependancies installed!}`);
                    resolve();
                } else {
                    process.exit(code);
                }
            });
        });
    }

    installElectron() {
        console.log(chalk `{rgb(255,128,0) Installing Electron dependancies...}`);
        return new Promise((resolve, reject) => {
            const npm_install = spawn('node', [npm, 'install'], {
                cwd: path.join(process.cwd(), this.package_json_options.name, 'electron'),
                stdio: [process.stdin, process.stdout, process.stderr]
            });

            npm_install.once('exit', (code, signal) => {
                if (code === 0) {
                    console.log(chalk `{green Electron dependancies installed!}`);
                    resolve();
                } else {
                    reject(code);
                    process.exit(code);
                }
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
}

module.exports = New;