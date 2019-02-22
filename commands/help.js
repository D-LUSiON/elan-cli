const fs = require('fs');

class Help {
    constructor(about) {
        this.about = about;
    }

    entry() {
        return new Promise((resolve, reject) => {
            this.showHelp().then(() => {
                resolve();
            });
        });
    }

    showHelp() {
        return new Promise(resolve => {
            if (!this.about) {
                // TODO: collect all command controllers and show their help
                const shown_commands = [];
                fs.readdir('./commands', (err, files) => {
                    (files || []).forEach(file => {
                        const command_name = file.replace(/\.js$/i, '');
                        shown_commands.push(command_name);
                        const command = new(require(`./${file}`));
                        console.log(`
Command: ${command_name}
Description: ${command.description}
Usage: ${command.usage}
Aliases: ${command.aliases || '-- none --'}`);
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