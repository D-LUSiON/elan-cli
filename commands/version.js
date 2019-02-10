const path = require('path');
const chalk = require('chalk');
const packageJSON = require(path.resolve('./package.json'));

class Version {

    constructor() {
        this.description = 'Shows version of the project, Electron and Angular';
        this.usage = '';
        this.current_dir_base = path.basename(process.cwd());
    }

    displayVersion() {
        
        console.log(chalk `
        ElAn-CLI: {green v${packageJSON.version}}
        Electron: {green 52%}
        Angular: {rgb(255,131,0) 88%}
        `);
    }
}

module.exports = Version;