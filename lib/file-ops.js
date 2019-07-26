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
                    if (file.substr(-1 * (ext.length + 1)) == '.' + ext) {
                        result.push(newbase);
                    }
                }
            }
        )
        return result
    }
}

module.exports = FileOps;