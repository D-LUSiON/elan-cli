const env = require('./environment.js');
//handle setupevents as quickly as possible
const root_dir = env.production ? '.' : '..';
const setupEvents = require(root_dir + '/installer_scripts/setupEvents');


if (setupEvents.handleSquirrelEvent()) {
   // squirrel event handled and app will exit in 1000ms, so don't do anything else
   return;
}

const {
    app,
    BrowserWindow,
    ipcMain,
    globalShortcut
} = require('electron');

const path = require('path');
const url = require('url');
const fs = require('fs');

const windowStateKeeper = require('electron-window-state');

let mainWindow;

function createWindow() {
    // Initialize window state keeper
    let winState = windowStateKeeper({
        defaultWidth: env.default_width,
        defaultHeight: env.default_height
    });

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: winState.width,
        height: winState.height,
        minWidth: env.min_width,
        minHeight: env.min_height,
        x: winState.x,
        y: winState.y,
        resizable: env.resizable,
        frame: env.frame,
        show: false,
        backgroundColor: '#ffffff',
        icon: `file://${path.join(__dirname, root_dir, env.html_src, 'assets', 'app-icon-l.jpg')}`
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, root_dir, env.html_src, 'index.html'),
        protocol: 'file:',
        slashes: true,
        webPreferences: {
            webSecurity: false
        }
    }));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // open the DevTools if not in production mode
    if (!env.production)
        mainWindow.webContents.openDevTools();

    // open the DevTools with Ctrl-F12
    globalShortcut.register('CommandOrControl+F12', () => {
        mainWindow.webContents.openDevTools();
    });

    // Event when the window is closed.
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Enable Electron reload if not in production mode
if (!env.production)
    require('electron-reload')(
        path.join(__dirname, '..'), {
            ignored: /node_modules|[\/\\]\./,
            electron: path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')
        }
    );

// Create window on electron intialization
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS specific close process
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // macOS specific close process
    if (win === null) {
        createWindow();
    }
});


/******************************/
/******* EXAMPLE EVENTS *******/
/******************************/

// Event handler for asynchronous incoming messages
ipcMain.on('asynchronous-message', (event, arg) => {
    console.log(arg);

    // Event emitter for sending asynchronous messages
    event.sender.send('asynchronous-reply', 'async pong')
});

// Event handler for synchronous incoming messages
ipcMain.on('synchronous-message', (event, arg) => {
    console.log(arg);

    // Synchronous event emmision
    event.returnValue = 'sync pong'
});
