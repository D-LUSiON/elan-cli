import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import { environment } from '../environment';
import * as path from 'path';
import * as fs from 'fs';
import { WindowState } from './window-state';

export class MainWindow {
    window: BrowserWindow = null;

    readonly ROOT_DIR = environment.production ? '.' : '..';
    readonly WINDOW_STATE_PATH = path.join(app.getPath('userData'), 'window-state.json');

    windowState: WindowState;

    constructor() {
        this._restoreWindowState();
    }

    createWindow() {
        if (!this.window) {
            this.window = new BrowserWindow({
                width: this.windowState.width,
                height: this.windowState.height,
                minWidth: environment.min_width,
                minHeight: environment.min_height,
                x: this.windowState.x,
                y: this.windowState.y,
                resizable: environment.resizable,
                frame: environment.frame,
                show: false,
                transparent: environment.background_color === 'transparent',
                backgroundColor: environment.background_color !== 'transparent' ? environment.background_color : undefined,
                icon: `file://${path.join(__dirname, this.ROOT_DIR, 'resources', 'icon.png')}`,
                webPreferences: {
                    nodeIntegration: true
                }
            });

            if (this.windowState.maximized)
                this.window.maximize();

            this._manageWinPosition();

            this.window.loadFile(`./${environment.html_src}/index.html`);

            this.window.once('ready-to-show', () => {
                this.window.show();
            });

            // open the DevTools if not in production mode
            if (!environment.production)
                this.window.webContents.openDevTools({
                    mode: 'undocked'
                });

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

    private _manageWinPosition() {
        const save_timeout = 250;

        let move_timeout: any;
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

        let resize_timeout: any;
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

        let restore_timeout: any;
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

        let maximize_timeout: any;
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

    private _restoreWindowState() {
        if (fs.existsSync(this.WINDOW_STATE_PATH)) {
            const window_state = require(this.WINDOW_STATE_PATH);
            this.windowState = new WindowState({ ...window_state });
        } else
            this.windowState = new WindowState();
    }

    private _saveWindowState() {
        if (!this.windowState.is_set)
            this.windowState = new WindowState({
                ...this.window.getBounds(),
                maximized: this.window.isMaximized(),
            });

        fs.writeFile(this.WINDOW_STATE_PATH, JSON.stringify(this.windowState.serialize()), 'utf8', (err) => {
            if (err)
                console.error(`Error writing "${this.WINDOW_STATE_PATH}"!`);
        });
    }

    destroy() {
        if (this.window)
            this.window.removeAllListeners();
        this.window = null;
    }
}
