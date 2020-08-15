const path = require('path');
const fs = require('fs');
const is_windows = require('is-windows')();
const spawn = require('child_process').spawn;

class Npm {
    constructor() {
        const modules = require('global-modules');
        let env_paths = process.env.PATH.split(is_windows ? ';' : ':').filter(x => x.indexOf('node') > -1);
        if (is_windows)
            env_paths = env_paths.filter((x) => x.indexOf('node') > -1);
        else env_paths = ['/usr/bin', '/usr/local/bin', ...env_paths];

        const paths = [path.join(modules, '..'), ...env_paths];
        paths.forEach((p) => {
            if (!this.npm_path) {
                const npm_path = path.join(p, `npm`);
                if (
                    fs.existsSync(npm_path) &&
                    !fs.statSync(npm_path).isDirectory()
                ) {
                    this.npm_path = npm_path;
                    if (is_windows && fs.existsSync(`${this.npm_path}.cmd`))
                        this.npm_path = `${this.npm_path}.cmd`;
                }
            }
        });
    }

    exec(command, args, options) {
        args = !args ? [] : args;
        options = !options ? {
            stdio: 'inherit',
        } : {
            stdio: 'inherit',
            ...options,
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