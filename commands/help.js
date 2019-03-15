const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class Help {
    constructor(args) {
        this.description = 'Shows this help';
        this.usage = '$ elan help [?command]';
        this.args = args;
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
            if (!this.args || !this.args._ || !this.args._[1]) {
                // TODO: collect all command controllers and show their help
                const shown_commands = [];
                fs.readdir(__dirname, (err, files) => {
                    if (err)
                        console.error(err);

                    (files || []).forEach(file => {
                        const command_name = file.replace(/\.js$/i, '');
                        if (command_name !== 'help') {
                            shown_commands.push(command_name);
                            const commandController = require(path.join(__dirname, file));
                            const command = new commandController();
                            console.log([
                                chalk `{green Command:} {rgb(128, 255, 128) ${command_name}}`,
                                chalk `{rgb(255, 128, 0) Description:} ${command.description}`,
                                chalk `{rgb(0, 128, 255) Usage:} ${command.usage}`,
                                `Aliases: ${command.aliases || '-- none --'}`,
                                `\n`
                            ].join('\n'));
                        }
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