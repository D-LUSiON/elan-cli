const fs = require('fs');

class Help {
    constructor(about) {
        this.about = about;
    }

    showHelp() {
        return new Promise(resolve => {
            if (!this.about) {
                // TODO: collect all command controllers and show their help
                console.log();
                fs.readdir('../commands', (err, files) => {
                    files.forEach(file => {
                        console.log(file);
                    });
                    resolve();
                });
            } else {
                // show specific command controller help
            }
        });
    }
}

module.exports = Help;