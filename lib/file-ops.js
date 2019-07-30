const fs = require('fs');
const path = require('path');

class FileOps {
    constructor() {}
    static checkDir(dir) {
        try {
            return fs.existsSync(dir);
        } catch (err) {
            return false;
        }
    }

    static recursiveFindByExt(base, ext, files, result) {
        files = files || fs.readdirSync(base);
        result = result || [];

        files.forEach(
            (file) => {
                const newbase = path.join(base, file);
                if (fs.statSync(newbase).isDirectory()) {
                    result = FileOps.recursiveFindByExt(newbase, ext, fs.readdirSync(newbase), result);
                } else {
                    if (ext instanceof Array) {
                        ext.forEach(ex => {
                            if (file.substr(-1 * (ex.length + 1)) == '.' + ex) {
                                result.push(newbase);
                            }
                        });
                    } else if (file.substr(-1 * (ext.length + 1)) == '.' + ext) {
                        result.push(newbase);
                    }
                }
            }
        )
        return result;
    }

    static recursiveFindDir(base, dirname, dir_content, result) {
        dir_content = (dir_content || fs.readdirSync(base)).filter(item => {
            const newbase = path.join(base, item);
            return fs.statSync(newbase).isDirectory();
        });

        result = result || [];

        dir_content.forEach(
            (item) => {
                const newbase = path.join(base, item);
                if (dirname instanceof Array) {
                    dirname.forEach(dirn => {
                        if (item === dirn)
                            result.unshift(newbase);
                    });
                } else if (item === dirname) {
                    result.unshift(newbase);
                }
                result = FileOps.recursiveFindDir(newbase, dirname, fs.readdirSync(newbase), result);
            }
        )
        return result;
    }
}

module.exports = FileOps;