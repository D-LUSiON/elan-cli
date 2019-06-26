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
                    console.log(chalk `\n{green Alright, everithing's set! Let's do some work at last...}\n`);
                    this.initElectron().then(() => {
                        this.initAngular().then(() => {
                            this.installElectron().then(() => {
                                this.installAngular().then(() => {
                                    if (!this.angular_options.createApplication) {
                                        console.log(chalk `\n{rgb(255,128,0) You choose not to create initial Angular application}\n\n{green In order your project to work correctly, you MUST create one}\n`);
                                        this.createNewApplication().then(arr => {
                                            // TODO: Commit "initial commit"
                                            console.log(chalk `\n{rgb(255,128,0) Everything's ready to go!}\n\nWrite {green cd ${this.package_json_options.name}} in your console and start the project with {green elan serve}!`);
                                            resolve();
                                        });
                                    } else {
                                        // TODO: Commit "initial commit"
                                        console.log(chalk `\n{rgb(255,128,0) Everything's ready to go!}\n\nWrite {green cd ${this.package_json_options.name}} in your console and start the project with {green elan serve}!`);
                                        resolve();
                                    }
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
                },
            ]).then((general_answers) => {
                general_answers.keywords = general_answers.keywords.split(/[(?:\,\s)\,\s]/g).filter(x => x !== '');
                this.package_json_options = {
                    ...this.package_json_options,
                    ...general_answers
                };
                inquirer.prompt([{
                        type: 'input',
                        name: 'directory',
                        message: 'What folder do you want to create application in?',
                        default: this.args._[1] || this.package_json_options.name
                    },
                    // {
                    //     type: 'input',
                    //     name: 'newProjectRoot',
                    //     message: 'The path where new projects will be created, relative to the new workspace root.',
                    //     default: 'projects'
                    // },
                    {
                        type: 'confirm',
                        name: 'skipGit',
                        message: 'Do you want to skip initialization of Git repository?',
                        default: false
                    },
                    {
                        type: 'confirm',
                        name: 'createApplication',
                        message: 'Do you want to create initial application in Angular?',
                        default: true
                    },
                ]).then(angular_answers => {
                    if (angular_answers.createApplication) {
                        inquirer.prompt([
                            {
                                type: 'confirm',
                                name: 'routing',
                                message: 'Would you like to add Angular routing?',
                                default: true
                            },
                            {
                                type: 'input',
                                name: 'prefix',
                                message: 'What prefix do you want to use in Angular?',
                                default: 'app'
                            },
                            {
                                type: 'list',
                                name: 'style',
                                message: 'Which stylesheet format would you like to use?',
                                choices: ['CSS', 'SCSS', 'SASS', 'LESS', 'Stylus']
                            },
                            {
                                type: 'confirm',
                                name: 'skipTests',
                                message: 'Do you want to skip generation of "spec.ts" test files for the new project?',
                                default: false
                            },
                            {
                                type: 'confirm',
                                name: 'minimal',
                                message: 'Do you want to skip adding testing frameworks?',
                                default: false
                            },
                        ]).then(more_angular_answers => {
                            this.angular_options = {
                                ...this.angular_options,
                                ...angular_answers,
                                ...more_angular_answers,
                            };
                            resolve();
                        });
                    } else {
                        this.angular_options = {
                            ...this.angular_options,
                            ...angular_answers
                        };
                        resolve();
                    }
                });
            });
        });
    }

    createNewApplication() {
        return new Promise((resolve, reject) => {
            inquirer.prompt([{
                    type: 'input',
                    name: 'name',
                    message: 'What name would you like to use for the application?',
                    default: this.args._[1] || '',
                    validate: (answer) => {
                        return (answer && !answer.match(/\d/g)) ? true : 'Name must contain only letters and dashes! Example: my-awesome-app-one (not "my-awesome-app-1")';
                    }
                },
                {
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
                    name: 'inlineStyle',
                    message: 'Do you want to use inline styles?',
                    default: false
                },
                {
                    type: 'confirm',
                    name: 'inlineTemplate',
                    message: 'Do you want to use inline templates?',
                    default: false
                },
                {
                    type: 'confirm',
                    name: 'skipPackageJson',
                    message: 'Do you want to skip adding dependancies to the "package.json"?',
                    default: false
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
                    message: 'Do you want to skip generation of "spec.ts" test files for the new project?',
                    default: false
                },
                {
                    type: 'confirm',
                    name: 'lintFix',
                    message: 'Do you want to apply lint fixes after generating the application?',
                    default: false
                },
            ]).then(angular_answers => {
                const app_name = angular_answers.name;
                delete angular_answers.name;
                
                const ng_new = spawn('node', [
                    path.join(__dirname, '..', 'node_modules', '@angular', 'cli', 'bin', 'ng'),
                    'generate',
                    'application',
                    app_name,
                    ...Object.keys(angular_answers).map(key => `--${key}=${typeof angular_answers[key] === 'string' ? angular_answers[key].toLowerCase() : angular_answers[key].toString()}`)
                ], {
                    cwd: path.join(process.cwd(), this.angular_options.directory),
                    stdio: ['inherit', 'inherit', 'inherit']
                });

                ng_new.once('exit', (code, signal) => {
                    if (code === 0) {
                        this._modifyPackages().then(() => {
                            ncp(
                                path.join(__dirname, '..', 'assets', 'src'),
                                path.join(process.cwd(), this.package_json_options.name, this.angular_options.newProjectRoot, angular_answers.name, 'src'),
                                () => {
                                    this.addElectronEnvironment(angular_answers.name).then(() => {
                                        console.log(chalk `{green Angular project created!}`);
                                        resolve();
                                    });
                                });
                        });
                    } else {
                        process.exit(code);
                    }
                });
            });
        });
    }

    addElectronEnvironment(app_name) {
        return new Promise((resolve, reject) => {
            const source_dev = path.join(process.cwd(), this.angular_options.directory, 'electron', 'env', 'environment.dev.js');
            const target_dev = path.join(process.cwd(), this.angular_options.directory, 'electron', 'env', `environment.${app_name}.dev.js`);

            let env_dev = fs.readFileSync(source_dev, 'utf8');
            env_dev = env_dev.replace(/html_src\:\s\'(?:.+?)\'\,/i, `html_src: 'app-${app_name}',`);

            const source_prod = path.join(process.cwd(), this.angular_options.directory, 'electron', 'env', 'environment.prod.js');
            const target_prod = path.join(process.cwd(), this.angular_options.directory, 'electron', 'env', `environment.${app_name}.prod.js`);

            let env_prod = fs.readFileSync(source_prod, 'utf8');
            env_prod = env_prod.replace(/html_src\:\s\'(?:.+?)\'\,/i, `html_src: 'app-${app_name}',`);
            
            fs.writeFile(target_dev, env_dev, 'utf8', () => {
                fs.writeFile(target_prod, env_prod, 'utf8', () => {
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
                this.angular_options.name,
                '--skipInstall=true',
                '--commit=false',
                '--interactive=false',
                ...Object.keys(this.angular_options).map(key => `--${key}=${typeof this.angular_options[key] === 'string' ? this.angular_options[key].toLowerCase() : this.angular_options[key].toString()}`)
            ], {
                stdio: ['inherit', 'inherit', 'inherit']
            });

            console.log({ ...Object.keys(this.angular_options).map(key => `--${key}=${typeof this.angular_options[key] === 'string' ? this.angular_options[key].toLowerCase() : this.angular_options[key].toString()}`) });

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
            const path_to_angular_json = path.join(process.cwd(), this.angular_options.directory, 'angular.json');

            delete require.cache[require.resolve(path_to_angular_json)];
            let angular_json = require(path_to_angular_json);

            const dev_options = {
                dev: {
                    baseHref: '',
                    outputPath: './app',
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
                },
            };

            Object.keys(angular_json.projects).forEach(project_name => {
                const dev_options_copy = {
                    ...dev_options
                };
                dev_options_copy.dev.outputPath = `./app-${project_name}`;
                dev_options_copy.dev.fileReplacements = [{
                    replace: `${angular_json.newProjectRoot}/${project_name}/src/environments/environment.ts`,
                    with: `${angular_json.newProjectRoot}/${project_name}/src/environments/environment.dev.ts`
                }];
                if (
                    angular_json.projects[project_name].architect &&
                    angular_json.projects[project_name].architect.build &&
                    angular_json.projects[project_name].architect.build.configurations
                )
                    angular_json.projects[project_name].architect.build.configurations = {
                        ...dev_options_copy,
                        ...angular_json.projects[project_name].architect.build.configurations
                    }
            });

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
                package_json['dependencies']['ngx-electron'] = `^${ngx_electron_version}`;
                package_json['devDependencies'].electron = `^${electron_version}`;

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
            this._modifyGitIgnore(),
        ]);
    }

    initElectron() {
        return new Promise((resolve, reject) => {
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