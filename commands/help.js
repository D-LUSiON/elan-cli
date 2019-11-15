const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class Help {
    constructor(args) {
        this.description = 'Shows this help';
        this.usage = '$ elan help [?command]';
        this.usage_options = [];
        this.args = args;
    }

    entry() {
        return new Promise((resolve, reject) => {
            this.showHelp().then(() => {
                resolve();
            }).catch(error => {
                reject(error);
            });
        });
    }

    showHelp() {
        return new Promise((resolve, reject) => {
            if (!this.args || !this.args._ || !this.args._[1]) {
                const shown_commands = [];
                fs.readdir(__dirname, (err, files) => {
                    if (err)
                        console.error(err);

                    const help_lines = [];
                    (files || []).forEach(file => {
                        const command_name = file.replace(/\.js$/i, '');
                        if (command_name !== 'help') {
                            shown_commands.push(command_name);
                            const commandController = require(path.join(__dirname, file));
                            const command = new commandController();
                            help_lines.push([
                                `${chalk.rgb(128, 255, 128)('Command:')} ${command_name}${ command.aliases ? ' (alias: ' + command.aliases + ')' : ''}`,
                                `${chalk.rgb(255, 128, 0)('Description:')} ${command.description}`,
                                `${chalk.rgb(0, 128, 255)('Usage:')} ${command.usage}`,
                                `${chalk.rgb(0, 128, 255)('Usage options:')} ${command.usage_options.length ? '\n' + command.usage_options.map(option => `    ${chalk.bold(option.option[0]) + (option.option.length > 1 ? ' (or ' + option.option.slice(1).join(', ') + ')' : '')} - ${option.description}\n    Accepted values: ${option.values}\n    Default value: ${option.defaultValue || '-- none --'}\n`).join('\n') : '-- none --'}`,
                                `\n`
                            ].join('\n'));
                        }
                    });
                    help_lines.forEach(line => console.log(line));
                    resolve();
                });
            } else if (this.args._[1]) {
                const command_name = this.args._[1];

                if (fs.existsSync(path.join(__dirname, command_name))) {
                    const commandController = require(`./${command_name}.js`);
    
                    const command = new commandController();
                    const help_lines = [
                        `${chalk.green('Command:')} ${chalk.rgb(128, 255, 128)(command_name)}`,
                        `Aliases: ${command.aliases || '-- none --'}`,
                        `${chalk.rgb(0, 128, 255)('Usage:')} ${command.usage}`,
                        `${chalk.rgb(0, 128, 255)('Usage options:')} ${command.usage_options.length ? command.usage_options.map(option => `${option.option} - ${option.description}`).join('\n') : '-- none --'}`,
                        `${chalk.rgb(255, 128, 0)('Description:')} ${command.description}`,
                        `\n`
                    ].join('\n');
                    console.log(help_lines);
                } else {
                    reject(`Command "${command_name}" not found!`);
                }
            }
        });
    }
}

module.exports = Help;