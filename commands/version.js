const path = require('path');
const chalk = require('chalk');
const loadingSpinner = require('loading-spinner');

const exec = require('child_process').exec;

class Version {

    constructor() {
        this.description = 'Shows version of the project, Electron and Angular';
        this.usage = '$ elan version';
        this.options = [];
    }
    
    entry() {
        return new Promise((resolve, reject) => {
            this.displayVersion().then(() => {
                resolve();
            });
        });
    }

    displayVersion() {
        return new Promise((resolve, reject) => {
            console.log(chalk `\n{rgb(255,131,0) Checking installed versions...}`);

            loadingSpinner.start(
                100, {
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
            ]).then(([local_versions, elan_latest, angular_latest, electron_latest]) => {
                loadingSpinner.stop();
                const elan = local_versions.filter(x => x.startsWith('elan-cli'))[0];
                const elan_ver = elan ? elan.split('@').pop() : '';

                const angular = local_versions.filter(x => x.startsWith('@angular/cli'))[0];
                const angular_ver = angular ? angular.split('@').pop() : '';

                const electron = local_versions.filter(x => x.startsWith('electron'))[0];
                const electron_ver = electron ? electron.split('@').pop() : '';

                console.log(chalk `
ElAn-CLI: {${(!elan_ver || elan_latest > elan_ver) ? 'rgb(255,131,0)' : 'green'} ${elan_ver || '--- none installed ---'}} {rgb(35, 198, 200) ${(elan_ver && elan_ver < elan_latest) ? (' - newer version available: ' + elan_latest) : ''}}
Electron: {${(!electron_ver || electron_latest > electron_ver) ? 'rgb(255,131,0)' : 'green'} ${electron_ver || '--- none installed ---'}} {rgb(35, 198, 200) ${(electron_ver && electron_ver < electron_latest) ? ('- newer version available: ' + electron_latest) : ''}}
Angular/CLI: {${(!angular_ver || angular_latest > angular_ver) ? 'rgb(255,131,0)' : 'green'} ${angular_ver || '--- none installed ---'}} {rgb(35, 198, 200) ${(angular_ver && angular_ver < angular_latest) ? ('- newer version available: ' + angular_latest) : ''}}
                `);
                resolve();
            });
        });
    }
}

module.exports = Version;