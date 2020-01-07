const path = require('path');
const fs = require('fs');
const is_windows = require('is-windows');
const spawn = require('child_process').spawn;

class Npm {
    constructor() {
        const modules = require('global-modules');
        const paths = [path.join(modules, '..'), ...process.env.PATH.split(';').filter(x => x.indexOf('node') > -1)];
        paths.forEach(p => {
            if (!this.npm_path)
                try {
                    if (fs.existsSync(path.join(p, `npm`)) && !fs.statSync(path.join(p, `npm`)).isDirectory()) {
                        this.npm_path = path.join(p, `npm`);
                        if (is_windows && fs.existsSync(`${this.npm_path}.cmd`))
                            this.npm_path = `${this.npm_path}.cmd`;
                    }
                } catch (error) {}
        });
    }

    exec(command, args, options) {
        args = !args ? [] : args;
        options = !options ? {
            stdio: 'inherit'
        } : {
            stdio: 'inherit',
            ...options
        };

        if (!command) {
            throw new TypeError('npm.exec: Please, provide command!');
        }

        if (!(args instanceof Array)) {
            throw new TypeError('npm.exec: Options must be an array');
        }

        const spawn_args = is_windows ? [this.npm_path, [command, ...args], options] : ['bash', [this.npm_path, command, ...args], options];
        return spawn(...spawn_args);
    }
}

module.exports = Npm;