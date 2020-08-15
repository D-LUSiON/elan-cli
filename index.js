#!/usr/bin/env node

const path = require('path');
const chalk = require('chalk');
const figlet = require('figlet');
const argv = require('minimist')(process.argv.slice(2));
const fileOps = require('./lib/file-ops');
const packagejson = require('./package.json');
const EventLog = require('./lib/event-log');

process.on('SIGINT', () => {
    process.exit(0);
});
process.on('SIGTERM', () => {
    process.exit(0);
});


console.log(figlet.textSync('ElAn CLI', {
    font: 'JS Bracket Letters',
    horizontalLayout: 'default',
    verticalLayout: 'default'
}), chalk.rgb(107, 107, 189)(`\n${new Array(21).join(' ')}v${packagejson.version}\n`));


if (!fileOps.checkDir(path.join(__dirname, 'commands', `${argv._[0]}.js`))) {
    if (!argv._[0])
        EventLog('error', `Please, provide valid command!`);
    else
        EventLog('error', `Command ${chalk.red(argv._[0])} does not exist!`);

    console.error(`Type ${chalk.rgb(255, 128, 128).bold('elan help')} for more information!`);

    process.exit(1);
} else {
    const CommandController = require(path.join(__dirname, 'commands', `${argv._[0]}.js`));
    const comm = new CommandController(argv);

    comm.entry().then(() => {
        process.exit(0);
    }).catch((err) => {
        if (err) EventLog('error', err);
        process.exit(1);
    });
}