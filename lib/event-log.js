const chalk = require('chalk');
const readline = require('readline');

module.exports = function EventLog(severity, message) {
    const severity_colors = {
        action: 'greenBright',
        done: 'greenBright',
        info: 'cyan',
        skip: 'cyan',
        warn: 'magentaBright',
        warning: 'magentaBright',
        error: 'redBright',
    }
    const chalk_color = severity_colors[severity.toLowerCase()] || severity_colors.action;
    readline.cursorTo(process.stdout, 0);
    return console.log(`[${chalk[chalk_color](severity.toUpperCase())}]`, ...[...arguments].slice(1));
}