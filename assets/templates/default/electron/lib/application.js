const environment = require('../environment');
const MainWindow = require('./main-window');
const { app } = require('electron');

class Application {
    constructor() {
        this.app = app;
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
        if (!environment.production) {
            this.app.name = `${this.app.name} (development mode)`;
            this.app.setPath('userData', `${this.app.getPath('userData')}-dev`);
        }

        // Create window on electron intialization
        this.app.on('ready', () => {
            this.mainWindow.createWindow();
        });

        // Quit when all windows are closed.
        this.app.on('window-all-closed', () => {
            // On macOS specific close process
            if (process.platform !== 'darwin') {
                this.app.quit();
            }
        });

        this.app.on('activate', () => {
            // macOS specific close process
            if (this.mainWindow.window === null) {
                this.mainWindow.createWindow();
            }
        });
    }
}

module.exports = Application;
