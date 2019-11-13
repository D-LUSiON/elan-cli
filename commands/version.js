const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const semver = require('semver');
const loadingSpinner = require('loading-spinner');

const exec = require('child_process').exec;

class Version {

    constructor(args) {
        this.description = 'Shows version of the project, Electron and Angular; Sets version of project parts';
        this.usage = '$ elan version [, project, version] [--version [, --preid]] [--e-version [, --e-preid]]';
        this.usage_options = [
            {
                option: '--global',
                description: 'Shows globally installed versions when in project folder',
                values: '',
                defaultValue: ''
            },
            {
                option: '--ng-only',
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
            this.elanJson = require(path.join(process.cwd(), 'elan.json'));
            this.packageJson = require(path.join(process.cwd(), 'package.json'));
            this.electronPackageJson = require(path.join(process.cwd(), 'electron', 'package.json'));
            this.angularJson = require(path.join(process.cwd(), 'angular.json'));

            if (this.args._[1] === 'set') {
                return this.setVersion();
            } else
                return this.displayVersion();
        });
    }

    setVersion() {
        return new Promise((resolve, reject) => {
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
            // resolve();
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
        version = semver.valid(version) ? version : semver.inc(this.elanJson.versions.main, version, this.args.preid);
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
        return fs.writeFile(path.join(process.cwd(), 'package.json'), JSON.stringify(this.packageJson, null, 4), 'utf8');
    }

    saveElanJson() {
        const updatedElanJson = {
            ...this.elanJson,
            _versions_old: undefined
        };
        delete updatedElanJson._versions_old;
        return fs.writeFile(path.join(process.cwd(), 'elan.json'), JSON.stringify(updatedElanJson, null, 4), 'utf8');
    }

    saveElectronPackageJson() {
        return fs.writeFile(path.join(process.cwd(), 'electron', 'package.json'), JSON.stringify(this.electronPackageJson, null, 4), 'utf8');
    }

    displayVersion() {
        return new Promise((resolve, reject) => {
            if (fs.existsSync(path.join(process.cwd(), 'elan.json')) && !this.args.global) {
                console.info(`\n${chalk.rgb(255,131,0)(`Checking for installed versions in ${this.packageJson.productName}...`)}`);
                const angularProjects = Object.entries(this.angularJson.projects).filter(([project, data]) => data.projectType === 'application').map(([project, data]) => project);
                
                console.info([
                    chalk.greenBright(`${this.packageJson.productName} project versions:`),
                    `${chalk.magentaBright('Main:')} v${this.packageJson.version}`,
                    `${chalk.magentaBright('Electron backend:')} v${this.electronPackageJson.version}`,
                    ...angularProjects.map(project => `${chalk.magentaBright(project)}${project === this.angularJson.defaultProject ? chalk.grey(' (default)') : ''}${chalk.magentaBright(':')} ${(this.elanJson.versions && this.elanJson.versions.angular && this.elanJson.versions.angular[project]) ? 'v' + this.elanJson.versions.angular[project] : '--none--'}`),
                    '\n',
                    chalk.greenBright(`Packages used:`),
                    `${chalk.magentaBright('Electron')} v${this.packageJson.devDependencies['electron']}`,
                    `${chalk.magentaBright('Angular')} v${this.packageJson.dependencies['@angular/core']}`,
                ].join(`\n`), '\n');

                loadingSpinner.stop();
                resolve();
            } else {
                loadingSpinner.start(
                    100, {
                        clearChar: true,
                        clearLine: true,
                        doNotBlock: true,
                        hideCursor: true
                    }
                );
                console.info(`\n${chalk.rgb(255,131,0)('Checking for globally installed versions...')}`);

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
                ]).then(([local_versions, elan_latest, angular_latest, electron_latest]) => {
                    loadingSpinner.stop();
                    const elan = local_versions.filter(x => x.startsWith('elan-cli'))[0];
                    const elan_ver = elan ? elan.split('@').pop() : '';
    
                    const angular = local_versions.filter(x => x.startsWith('@angular/cli'))[0];
                    const angular_ver = angular ? angular.split('@').pop() : '';
    
                    const electron = local_versions.filter(x => x.startsWith('electron'))[0];
                    const electron_ver = electron ? electron.split('@').pop() : '';
    
                    console.info([
                        chalk `ElAn-CLI: {${(!elan_ver || elan_latest > elan_ver) ? 'rgb(255,131,0)' : 'green'} ${elan_ver || '--- none installed ---'}} {rgb(35, 198, 200) ${(elan_ver && elan_ver < elan_latest) ? (' - newer version available: ' + elan_latest) : ''}}`,
                        chalk `Electron: {${(!electron_ver || electron_latest > electron_ver) ? 'rgb(255,131,0)' : 'green'} ${electron_ver || '--- none installed ---'}} {rgb(35, 198, 200) ${(electron_ver && electron_ver < electron_latest) ? ('- newer version available: ' + electron_latest) : ''}}`,
                        chalk `@angular/core: {${(!angular_ver || angular_latest > angular_ver) ? 'rgb(255,131,0)' : 'green'} ${angular_ver || '--- none installed ---'}} {rgb(35, 198, 200) ${(angular_ver && angular_ver < angular_latest) ? ('- newer version available: ' + angular_latest) : ''}}`,
                    ].join('\n'));
                    resolve();
                });
            }
        });
    }
}

module.exports = Version;