#!/usr/bin/env node

const path = require('path');
const chalk = require('chalk');
const figlet = require('figlet');
const argv = require('minimist')(process.argv.slice(2));
const fileOps = require('./lib/file-ops');
const packagejson = require('./package.json');

const commands = {
    'init': {
        'description': 'Initialize Electron/Angular project',
        'usage': '$ elan init [project-name]'
    },
    'serve': {
        'description': 'Serves the project',
        'usage': '$ elan serve'
    },
    'build': {
        'description': 'Builds the project',
        'usage': '$ elan build'
    },
    'version': {
        'description': 'Shows version of the project, Electron and Angular',
        'usage': '$ elan version'
    },
    'help': {
        'description': 'This help...',
        'usage': '$ elan help'
    },
    'resources': {
        'description': 'Generates resources of the project',
        'usage': '$ elan resources [options]'
    }
};

const fonts = [
    'Sub-Zero',
    'Stforek',
    'Spliff',
    'Slant',
    'Red Phoenix',
    'Modular',
    'DOS Rebel',
    'Doom',
    'Delta Corps Priest 1',
    'Contrast',
    'ANSI Shadow',
    'JS Bracket Letters',
    'Jacky',
    'Graffiti',
    'Graceful',
    'Standard',
    'Merlin1',
    'Kban'
]; // choose one from these

process.on('SIGINT', () => {
    process.exit(0);
});

console.log(figlet.textSync('ElAn CLI', {
    font: 'JS Bracket Letters',
    horizontalLayout: 'default',
    verticalLayout: 'default'
}), chalk `{rgb(107, 107, 189) v${packagejson.version}\n}`);


if (!fileOps.checkDir(path.join(__dirname, 'commands', `${argv._[0]}.js`))) {
    if (!argv._[0])
        console.error(chalk.red(chalk `{rgb(255,131,0) Please, provide valid command!}\n`));
    else
        console.error(`Command ${chalk.red(argv._[0])} does not exist!`);

    console.error(`Type ${chalk.rgb(255, 128, 128).bold('elan help')} for more information!`);

    process.exit(1);
} else {
    const CommandController = require(path.join(__dirname, 'commands', `${argv._[0]}.js`));
    const comm = new CommandController(argv);

    comm.entry().then(() => {
        process.exit(0);
    }).catch((err) => {
        console.error(chalk `\n{rgb(255,0,0) ${err}}`);
        process.exit(1);
    });
}