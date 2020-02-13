const {
    app,
    ipcMain
} = require('electron');
const path = require('path');
const fs = require('fs-extra');
const http = require('http');
const ini = require('ini');
const readline = require('readline');
const requireJSON = require('./require-json');
const package_json = requireJSON(path.resolve('package.json'));

const DEFAULT_SETTINGS = {};

class DataExchange {

    constructor(el_app) {
        this.USER_DATA = el_app.getPath('userData');
        this.settings_ini_path = path.join(this.USER_DATA, 'settings.ini');

        this._loadCurrentSettings();

        this.getSettingsAll();
        this.getDefaultSettings();
        this.saveSettings();
    }

    _loadCurrentSettings() {
        return new Promise((resolve, reject) => {
            if (!this.settings) this.settings = { ...DEFAULT_SETTINGS };
            if (!fs.existsSync(this.settings_ini_path))
                fs.writeFileSync(this.settings_ini_path, ini.stringify(this.settings), { encoding: 'utf-8' });

            fs.readFile(this.settings_ini_path, { encoding: 'utf-8' }, (err, sett_ini_file) => {
                const sett_ini_parsed = ini.parse(sett_ini_file, 'utf-8');
                Object.keys(sett_ini_parsed).forEach(key => {
                    if (!isNaN(sett_ini_parsed[key]) && !['true', 'false'].includes((sett_ini_parsed[key] || '').toString()))
                        this.settings[key] = +sett_ini_parsed[key];
                    else
                        this.settings[key] = sett_ini_parsed[key];
                });
                resolve(this.settings);
            });
        });
    }

    getSettingsAll() {
        ipcMain.on('settings:all', (event, args) => {
            this._loadCurrentSettings().then(() => {
                event.sender.send('settings:all:response', {
                    ...this.settings,
                    ...{
                        cwd: process.cwd(),
                        app_name: app.name,
                        userData: app.getPath('userData'),
                        version: package_json.version
                    }
                });
            });
        });
    }

    getDefaultSettings() {
        ipcMain.on('settings:all', (event, args) => {
            event.sender.send('settings:default:all:response', DEFAULT_SETTINGS);
        });
    }

    saveSettings() {
        ipcMain.on('settings:save', (event, args) => {
            fs.writeFile(this.settings_ini_path, ini.stringify(args), { encoding: 'utf-8' });
            this._loadCurrentSettings().then(() => {
                event.sender.send('settings:save:response', {
                    ...this.settings,
                    ...{
                        cwd: process.cwd(),
                        app_name: app.name,
                        userData: app.getPath('userData'),
                        version: package_json.version
                    }
                });
            });
        });
    }

}

module.exports = DataExchange;
