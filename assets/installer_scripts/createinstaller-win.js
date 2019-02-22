const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller;
const fs = require('fs');
const path = require('path');
const package = require('../package.json');

const util = require('util');
const inquirer = require('inquirer');

getInstallerConfig()
    .then(createWindowsInstaller)
    .catch((error) => {
        console.error(error.message || error)
        process.exit(1)
    });

function getInstallerConfig() {
    const rootPath = path.join('./');
    const outPath = path.join(rootPath, 'releases');

    const settings = {
        appDirectory: path.join(outPath, `${package.name}-win32-ia32`),
        authors: `${package.author}`,
        noMsi: false,
        outputDirectory: path.join(outPath, 'windows-installer'),
        exe: `${package.name}.exe`,
        setupExe: `${package.name.charAt(0).toUpperCase()}${package.name.substr(1)}Installer.exe`,
        setupIcon: path.join(rootPath, 'src', 'assets', 'app-icon.ico')
    };

    return new Promise(resolve => {
        fs.readdir(outPath, (err, dir_list) => {
            inquirer.prompt([{
                type: 'list',
                name: 'path',
                message: 'Select packaged application you wish to bundle as installer:',
                choices: [...dir_list]
            }]).then(selected_path => {
                if (selected_path.path) {
                    settings.appDirectory = path.join(outPath, selected_path.path);
                    inquirer.prompt([{
                            type: 'input',
                            name: 'authors',
                            message: 'Author(s) of the package:',
                            default: settings.authors
                        },
                        {
                            type: 'confirm',
                            name: 'noMsi',
                            message: 'Do you want to create .msi package?',
                            default: settings.noMsi
                        },
                        {
                            type: 'input',
                            name: 'outputDirectory',
                            message: 'Select output directory for your installer:',
                            default: settings.outputDirectory
                        },
                        {
                            type: 'input',
                            name: 'exe',
                            message: 'Name of the .exe file of the application:',
                            default: settings.exe
                        },
                        {
                            type: 'input',
                            name: 'setupExe',
                            message: 'File name of your installer:',
                            default: settings.setupExe
                        },
                        {
                            type: 'input',
                            name: 'setupIcon',
                            message: 'Icon for the installer setup file:',
                            default: settings.setupIcon
                        }
                    ]).then(answers => {
                        const options = util._extend(settings, answers);
                        if (!options.exe.match(/\.exe$/i))
                            options.exe = `${options.exe}.exe`;
                        if (!options.setupExe.match(/\.exe$/i))
                            options.setupExe = `${options.setupExe}.exe`;
                        console.log('');
                        console.log('Using following settings for creating an installer:');
                        console.log(options);

                        resolve(options);
                    });
                } else
                    resolve(settings);
            });
        });
    });
}
