/**********************************************
 * This class is initializing the main window
 *
 * Feel free to modify it or even modify
 * everythig related to Electron initialization
 * to your liking
 **********************************************/
const env = require('./environment.js');
const ROOT_DIR = env.production ? '.' : '..';
const {
    BrowserWindow,
    globalShortcut
} = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');

class MainWindow {
    constructor() {
        this.window = null;
        // Initialize window state keeper
        this.winState = windowStateKeeper({
            defaultWidth: env.default_width,
            defaultHeight: env.default_height
        });
    }

    createWindow() {
        if (!this.window) {
            this.window = new BrowserWindow({
                width: this.winState.width,
                height: this.winState.height,
                minWidth: env.min_width,
                minHeight: env.min_height,
                x: this.winState.x,
                y: this.winState.y,
                resizable: env.resizable,
                frame: env.frame,
                show: false,
                backgroundColor: env.background_color,
                icon: `file://${path.join(__dirname, ROOT_DIR, 'resources', 'icon.png')}`,
                webPreferences: {
                    nodeIntegration: true
                }
            });

            this.winState.manage(this.window);

            this.window.loadFile(`${ROOT_DIR}/${env.html_src}/index.html`);

            this.window.once('ready-to-show', () => {
                this.window.show();
            });

            // open the DevTools if not in production mode
            if (!env.production)
                this.window.webContents.openDevTools({
                    mode: 'undocked'
                });

            // open the DevTools with Ctrl-F12
            globalShortcut.register('CommandOrControl+F12', () => {
                this.window.webContents.openDevTools();
            });

            // Event when the window about to be closed.
            this.window.on('close', () => {
                this.winState.unmanage();
            });

            // Event when the window is closed.
            this.window.on('closed', this.destroy);
        } else {
            console.error('Main window can be initialized only once!');
        }
    }

    destroy() {
        this.window = null;
    }
}

module.exports = MainWindow;