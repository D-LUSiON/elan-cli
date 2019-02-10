const fs = require('fs');

class Help {
    constructor(about) {
        this.about = about;
    }

    showHelp() {
        if (!this.about) {
            // collect all command controllers and show their help
            console.log();
            fs.readdir('../commands', (err, files) => {
                files.forEach(file => {
                    console.log(file);
                });
            })
        } else {
            // show specific command controller help
        }
    }
}

module.exports = Help;