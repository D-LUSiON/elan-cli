const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const semver = require('semver');
const loadingSpinner = require('loading-spinner');

const exec = require('child_process').exec;

const EventLog = require('../lib/event-log');
const readline = require('readline');

class Version {

    constructor(args) {
        this.description = 'Shows version of the project, Electron and Angular; Sets version of project parts';
        this.usage = '$ elan version [ set [, project, version, preid] ] [--version [, --preid] ] [--e-version [, --e-preid]]';
        this.usage_options = [
            {
                option: ['--global'],
                description: 'Shows globally installed versions when in project folder',
                values: '',
                defaultValue: ''
            },
            {
                option: ['--ng-only'],
                description: 'Sets version only to Angular applications',
                values: '',
                defaultValue: ''
            },
        ];
        this.options = [];
        this.args = args;
    }

    entry() {
        return new Promise((resolve, reject) => {
            if (this.args._[1] === 'set') {
                this.elanJson = fs.existsSync(path.resolve('elan.json')) ? require(path.resolve('elan.json')) : null;
                this.packageJson = fs.existsSync(path.resolve('package.json')) ? require(path.resolve('package.json')) : null;
                const electron_src_folder = this.elanJson.template && this.elanJson.template.electronRoot ? this.elanJson.template.electronRoot : 'electron';
                this.electronPackageJson = fs.existsSync(path.resolve(electron_src_folder, 'package.json')) ? require(path.resolve(electron_src_folder, 'package.json')) : null;
                this.angularJson = fs.existsSync(path.resolve('angular.json')) ? require(path.resolve('angular.json')) : null;
                return this.setVersion();
            } else
                return this.displayVersion();
        });
    }

    setVersion() {
        return new Promise((resolve, reject) => {
            if (this.elanJson && this.packageJson && this.electronPackageJson && this.angularJson) {
                let [project, version] = [...this.args._].slice(2);
                if (!version && project) {
                    version = project;
                    project = '';
                }

                if (!this.elanJson.versions) {
                    this.elanJson.versions = {
                        main: this.packageJson.version,
                        electron: this.electronPackageJson.version,
                        angular: {}
                    };
                }

                Object.entries(this.angularJson.projects).forEach(([project, data]) => {
                    if (data.projectType === 'application' && !this.elanJson.versions.angular[project]) {
                        this.elanJson.versions.angular[project] = this.elanJson.versions.main;
                    }
                });

                this.elanJson._versions_old = {
                    ...this.elanJson.versions,
                    angular: {
                        ...this.elanJson.versions.angular
                    }
                };

                if (version && !project && !this.args.version && !this.args['e-version']) {
                    // increase all versions
                    this.setMainVersion(version);
                    this.setElectronVersion(version);
                    this.setAngularVersion(version);
                } else {
                    // increase parts
                    if (this.args.version) {
                        // set main version
                        this.setMainVersion(this.args.version);
                    }

                    if (this.args['e-version']) {
                        // set Electron version
                        this.setElectronVersion(this.args['e-version']);
                    }

                    if (
                        ((version && project) && !this.args.version && !this.args['e-version']) ||
                        (version || project) && (this.args.version || this.args['e-version']) ||
                        this.args['ng-only']
                    ) {
                        this.setAngularVersion(version, project);
                    }
                }

                // TODO: Save only files that need to be changed
                Promise.all([
                    this.savePackageJson(),
                    this.saveElectronPackageJson(),
                    this.saveElanJson(),
                ]).then(() => {
                    resolve();
                }).catch(err => {
                    reject(err);
                });
            } else
                reject(`You're not in an ElAn project folder!`);
        });
    }

    setMainVersion(version) {
        this.elanJson.versions.main = semver.valid(version) ? version : semver.inc(this.elanJson.versions.main, version, this.args.preid);
        this.packageJson.version = this.elanJson.versions.main;
        console.info(chalk.magentaBright(`Main:`), `${this.elanJson._versions_old.main} -> ${chalk.greenBright(this.elanJson.versions.main)}`)
    }

    setElectronVersion(version) {
        this.elanJson.versions.electron = semver.valid(version) ? version : semver.inc(this.elanJson.versions.electron, version, this.args.preid);
        this.electronPackageJson.version = this.elanJson.versions.electron;
        console.info(chalk.magentaBright(`Electron:`), `${this.elanJson._versions_old.electron} -> ${chalk.greenBright(this.elanJson.versions.electron)}`)
    }

    setAngularVersion(version, project) {
        version = semver.valid(version) ? version : semver.inc(this.elanJson.versions.angular[project], version, this.args._[4]);
        if (project) {
            this.elanJson.versions.angular[project] = version;
            console.info(chalk.magentaBright(`${project}:`), `${this.elanJson._versions_old.angular[project]} -> ${chalk.greenBright(this.elanJson.versions.angular[project])}`)
        } else {
            Object.keys(this.elanJson.versions.angular).forEach(key => {
                this.elanJson.versions.angular[key] = version;
                console.info(chalk.magentaBright(`${key}:`), `${this.elanJson._versions_old.angular[key]} -> ${chalk.greenBright(this.elanJson.versions.angular[key])}`)
            });
        }
    }

    savePackageJson() {
        return fs.writeFile(path.resolve('package.json'), JSON.stringify(this.packageJson, null, 4), 'utf8');
    }

    saveElanJson() {
        const updatedElanJson = {
            ...this.elanJson,
            _versions_old: undefined
        };
        delete updatedElanJson._versions_old;
        return fs.writeFile(path.resolve('elan.json'), JSON.stringify(updatedElanJson, null, 4), 'utf8');
    }

    saveElectronPackageJson() {
        return fs.writeFile(path.resolve('electron', 'package.json'), JSON.stringify(this.electronPackageJson, null, 4), 'utf8');
    }

    displayVersion() {
        return new Promise((resolve, reject) => {
            if (this.elanJson && !this.args.global) {
                loadingSpinner.stop();
                console.info(chalk.greenBright(`Package name:`), this.packageJson.name);
                console.info(chalk.greenBright(`Product name:`), this.packageJson.productName ? this.packageJson.productName : '--none--');
                console.info(chalk.greenBright(`Description:`), this.packageJson.description ? this.packageJson.description : '--none--', '\n');

                const angularProjects = Object.entries(this.angularJson.projects).filter(([project, data]) => data.projectType === 'application').map(([project, data]) => project);

                console.info([
                    chalk.greenBright(`"${this.packageJson.productName}" package versions:`),
                    `${chalk.magentaBright('Main:')} v${this.packageJson.version}`,
                    `${chalk.magentaBright('Electron backend:')} v${this.electronPackageJson.version}`,
                    `\n`,
                    chalk.greenBright(`Angular projects:`),
                    ...angularProjects.map(project => `${chalk.magentaBright(project)}${project === this.angularJson.defaultProject ? chalk.grey(' (default)') : ''}${chalk.magentaBright(':')} ${(this.elanJson.versions && this.elanJson.versions.angular && this.elanJson.versions.angular[project]) ? 'v' + this.elanJson.versions.angular[project] : '--none--'}`),
                    '\n',
                    chalk.greenBright(`Packages used:`),
                    `${chalk.magentaBright('Electron')} v${this.packageJson.devDependencies['electron'] ? require(path.resolve('node_modules', 'electron', 'package.json')).version : '--none--'}`,
                    `${chalk.magentaBright('Angular')} v${this.packageJson.dependencies['@angular/core'] ? require(path.resolve('node_modules', '@angular', 'core', 'package.json')).version : '--none--'}`,
                ].join(`\n`), '\n');

                resolve();
            } else {
                EventLog('info', `Checking for globally installed versions...`);
                loadingSpinner.start(
                    100,
                    {
                        clearChar: true,
                        clearLine: true,
                        doNotBlock: true,
                        hideCursor: true
                    }
                );

                Promise.all([
                    new Promise(resolve => {
                        exec('npm list -g --depth=0', (err, stdout, stderr) => {
                            let result = stdout.split(/[\+\`]\-\-\s/g);
                            result.splice(0, 1);
                            result = result.join('').split('\n').map(x => x.split(' ')[0]).filter(x => !!x);
                            resolve(result);
                        });
                    }),
                    new Promise(resolve => {
                        exec('npm view elan-cli version', (err, stdout, stderr) => {
                            const result = stdout.replace(/\n/s, '');
                            resolve(result);
                        });
                    }),
                    new Promise(resolve => {
                        exec('npm view @angular/cli version', (err, stdout, stderr) => {
                            const result = stdout.replace(/\n/s, '');
                            resolve(result);
                        });
                    }),
                    new Promise(resolve => {
                        exec('npm view electron version', (err, stdout, stderr) => {
                            const result = stdout.replace(/\n/s, '');
                            resolve(result);
                        });
                    }),
                    new Promise(resolve => {
                        const path_to_electron_pkg = path.join(__dirname, '..', 'node_modules', 'electron', 'package.json');
                        if (fs.existsSync(path_to_electron_pkg)) {
                            const elan_electron = require(path_to_electron_pkg).version;
                            resolve(elan_electron);
                        } else
                            resolve('');
                    }),
                    new Promise(resolve => {
                        const path_to_ng_pkg = path.join(__dirname, '..', 'node_modules', '@angular', 'cli', 'package.json');
                        if (fs.existsSync(path_to_ng_pkg)) {
                            const elan_electron = require(path_to_ng_pkg).version;
                            resolve(elan_electron);
                        } else
                            resolve('');
                    }),
                    new Promise(resolve => {
                        const path_to_ebuilder_pkg = path.join(__dirname, '..', 'node_modules', 'electron-builder', 'package.json');
                        if (fs.existsSync(path_to_ebuilder_pkg)) {
                            const elan_electron = require(path_to_ebuilder_pkg).version;
                            resolve(elan_electron);
                        } else
                            resolve('');
                    }),
                    new Promise(resolve => {
                        const path_to_erebuild_pkg = path.join(__dirname, '..', 'node_modules', 'electron-rebuild', 'package.json');
                        if (fs.existsSync(path_to_erebuild_pkg)) {
                            const elan_electron = require(path_to_erebuild_pkg).version;
                            resolve(elan_electron);
                        } else
                            resolve('');
                    }),
                ]).then(([
                    local_versions,
                    elan_latest,
                    angular_latest,
                    electron_latest,
                    elan_electron,
                    elan_ng_cli,
                    elan_ebulder,
                    elan_erebuild
                ]) => {
                    loadingSpinner.stop();
                    readline.moveCursor(process.stdout, 0, -1);
                    process.stdout.clearLine();

                    const elan = local_versions.filter(x => x.startsWith('elan-cli'))[0];
                    const elan_ver = elan ? elan.split('@').pop() : '';

                    const angular = local_versions.filter(x => x.startsWith('@angular/cli'))[0];
                    const angular_ver = angular ? angular.split('@').pop() : '';

                    const electron = local_versions.filter(x => x.startsWith('electron'))[0];
                    const electron_ver = electron ? electron.split('@').pop() : '';

                    console.info([
                        chalk.greenBright(`Globally installed packages:`),
                        chalk`ElAn-CLI: {${(!elan_ver || elan_latest > elan_ver) ? 'rgb(255,131,0)' : 'green'} ${elan_ver || '--- none installed ---'}} {rgb(35, 198, 200) ${(elan_ver && elan_ver < elan_latest) ? (' - newer version available: ' + elan_latest) : ''}}`,
                        chalk`Electron: {${(!electron_ver || electron_latest > electron_ver) ? 'rgb(255,131,0)' : 'green'} ${electron_ver || '--- none installed ---'}} {rgb(35, 198, 200) ${(electron_ver && electron_ver < electron_latest) ? ('- newer version available: ' + electron_latest) : ''}}`,
                        chalk`@angular/cli: {${(!angular_ver || angular_latest > angular_ver) ? 'rgb(255,131,0)' : 'green'} ${angular_ver || '--- none installed ---'}} {rgb(35, 198, 200) ${(angular_ver && angular_ver < angular_latest) ? ('- newer version available: ' + angular_latest) : ''}}`,
                    ].join('\n'), '\n');

                    console.info([
                        chalk.greenBright(`Current version of ElAn uses the following versions:`),
                        `Electron: ${chalk.greenBright(elan_electron)}`,
                        `@angular/cli: ${chalk.greenBright(elan_ng_cli)}`,
                        `Electron Builder: ${chalk.greenBright(elan_ebulder)}`,
                        `Electron Rebuild: ${chalk.greenBright(elan_erebuild)}`,
                    ].join(`\n`));
                    resolve();
                });
            }
        });
    }
}

module.exports = Version;