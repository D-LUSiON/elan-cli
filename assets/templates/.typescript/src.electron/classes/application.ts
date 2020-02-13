import { environment } from '../environment';

import * as Electron from 'electron';
import { MainWindow } from './mainWindow';

export class Application {
    mainWindow: MainWindow;

    app: Electron.App;

    constructor(app: Electron.App) {
        this.app = app;
        this.init();
    }

    init() {
        if (!environment.production) {
            this.app.name = `${this.app.name} (development mode)`;
            this.app.setPath('userData', `${this.app.getPath('userData')}-dev`);
        }

        // Create window on electron intialization
        this.app.on('ready', () => {
            this.mainWindow = new MainWindow();
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
