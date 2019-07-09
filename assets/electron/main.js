/******************************************
 * This is the main entry point of Electron
 * 
 * You can modify it to fit your needs
 ******************************************/

const env = require('./environment.js');
const electron = require('electron');
const {
    app,
} = electron;

if (!env.production) {
    app.setName(`${app.getName()} (development mode)`);
    app.setPath('userData', `${app.getPath('userData')}-dev`);
}

const MainWindow = require('./mainWindow');
let mainWindow;

// Create window on electron intialization
app.on('ready', () => {
    mainWindow = new MainWindow();
    mainWindow.createWindow();
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
    if (mainWindow.window === null) {
        mainWindow.createWindow();
    }
});