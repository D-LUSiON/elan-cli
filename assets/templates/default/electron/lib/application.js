const environment = require('../environment');
const MainWindow = require('./main-window');
const DataExchange = require('./data-exchange');
const { app } = require('electron');
const path = require('path');
const requireJSON = require('./require-json');

class Application {
    constructor() {
        if (!environment.production) {
            requireJSON(path.resolve('package.json')).then(package_json => {
                app.name = `${package_json.productName || package_json.name} (development mode)`;
                const user_data_path = app.getPath('userData').split(/\/|\\/);
                user_data_path.pop();

                app.setPath('userData', `${path.join(...user_data_path, (package_json.productName || package_json.name).split(/\s/).join(''))}-dev`);
            });
        }

        this.mainWindow = new MainWindow();

        this.single_instance = app.requestSingleInstanceLock();

        if (!this.single_instance && environment.single_instance) {
            app.quit();
            return;
        } else {
            if (environment.single_instance) {
                app.on('second-instance', (event, commandLine, workingDirectory) => {
                    // Someone tried to run a second instance, we should focus our window.
                    if (this.mainWindow.window) {
                        if (this.mainWindow.window.isMinimized())
                            this.mainWindow.window.restore();
                        this.mainWindow.window.focus();
                    }
                });
            }
            this.init();
        }
    }

    init() {
        // Create window on electron intialization
        app.on('ready', () => {
            this.mainWindow.createWindow();
            this.dataExchange = new DataExchange(app);
        });

        // Quit when all windows are closed.
        app.on('window-all-closed', () => {
            // On macOS specific close process
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('activate', () => {
            // macOS specific close process
            if (this.mainWindow.window === null) {
                this.mainWindow.createWindow();
            }
        });
    }
}

module.exports = Application;
