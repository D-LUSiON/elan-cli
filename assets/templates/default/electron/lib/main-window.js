const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const environment = require('../environment');
const path = require('path');
const fs = require('fs');
const WindowState = require('./window-state');
const requireJSON = require('./require-json');

const WINDOW_STATE_PATH = path.join(app.getPath('userData'), 'window-state.json');

class MainWindow {
    constructor() {
        this.window = null;
        this.windowState = null;
    }

    async createWindow() {
        await this._restoreOldWindowState();
        if (!this.window) {
            this.window = new BrowserWindow({
                width: environment.fixed_width || this.windowState.width,
                height: environment.fixed_height || this.windowState.height,
                minWidth: environment.min_width,
                minHeight: environment.min_height,
                x: this.windowState.x,
                y: this.windowState.y,
                resizable: environment.resizable,
                maximizable: environment.maximizable,
                frame: environment.frame,
                title: app.name,
                titleBarStyle: environment.titlebar_style,
                show: false,
                backgroundColor: environment.background_color,
                icon: `file://${path.resolve('resources', 'icon.png')}`,
                webPreferences: {
                    nodeIntegration: true
                }
            });

            if (this.windowState.maximized)
                this.window.maximize();

            this._manageWinPosition();

            this.window.loadFile(`${process.env.ROOT_DIR}/${environment.html_src}/index.html`);

            this.window.once('ready-to-show', () => {
                this.window.show();
            });

            // disable DevTools
            if (!environment.allow_devtools) {
                this.window.webContents.on('devtools-opened', () => {
                    this.window.webContents.closeDevTools();
                });
            } else {
                this.window.webContents.openDevTools({
                    mode: 'undocked'
                });
                const ContextMenu = require('./context-menu');
                const cmenu = new ContextMenu(this.window.webContents);
                this.window.webContents.on('context-menu', (e, params) => {
                    cmenu.show({
                        x: params.x,
                        y: params.y
                    });
                });
            }

            // open the DevTools with Ctrl-F12
            globalShortcut.register('CommandOrControl+F12', () => {
                this.window.webContents.openDevTools();
            });

            // Event when the window about to be closed.
            this.window.on('close', () => {
                // this.winState.unmanage();
            });

            // Event when the window is closed.
            this.window.on('closed', this.destroy);
        } else {
            console.error('Main window can be initialized only once!');
        }
    }

    _manageWinPosition() {
        const save_timeout = 250;

        let move_timeout;
        this.window.on('move', () => {
            if (move_timeout) {
                clearTimeout(move_timeout);
                move_timeout = null;
            }
            move_timeout = setTimeout(() => {
                this.windowState = new WindowState({
                    ...this.window.getBounds(),
                    maximized: false,
                })
                this._saveWindowState();
            }, save_timeout);
        });

        let resize_timeout;
        this.window.on('resize', () => {
            if (resize_timeout) {
                clearTimeout(resize_timeout);
                resize_timeout = null;
            }
            resize_timeout = setTimeout(() => {
                this.windowState = new WindowState({
                    ...this.window.getBounds(),
                    maximized: this.windowState.maximized,
                })
                this._saveWindowState();
            }, save_timeout);
        });

        let restore_timeout;
        this.window.on('restore', () => {
            if (restore_timeout) {
                clearTimeout(restore_timeout);
                restore_timeout = null;
            }
            restore_timeout = setTimeout(() => {
                this.windowState = new WindowState({
                    ...this.window.getBounds(),
                    maximized: false,
                })
                this._saveWindowState();
            }, save_timeout);
        });

        let maximize_timeout;
        this.window.on('maximize', () => {
            if (maximize_timeout) {
                clearTimeout(maximize_timeout);
                maximize_timeout = null;
            }
            maximize_timeout = setTimeout(() => {
                this.windowState.maximized = this.window.isMaximized();
                this._saveWindowState();
            }, save_timeout);
        });
    }

    async _restoreOldWindowState() {
        if (fs.existsSync(WINDOW_STATE_PATH)) {
            try {
                const window_state = await requireJSON(WINDOW_STATE_PATH);
                this.windowState = new WindowState({ ...window_state });
            } catch (error) {
                this.windowState = new WindowState();
            }
        } else {
            this.windowState = new WindowState();
        }
    }

    _saveWindowState() {
        if (!this.windowState.is_set)
            this.windowState = new WindowState({
                ...this.window.getBounds(),
                maximized: this.window.isMaximized(),
            });

        fs.writeFile(WINDOW_STATE_PATH, JSON.stringify(this.windowState.serialize()), 'utf8', (err) => {
            if (err)
                console.error(`Error writing "${WINDOW_STATE_PATH}"!`);
        });
    }

    destroy() {
        if (this.window)
            this.window.removeAllListeners();
        this.window = null;
    }
}

module.exports = MainWindow;
