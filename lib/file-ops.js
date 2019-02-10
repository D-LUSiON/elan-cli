const fs = require('fs');
const path = require('path');

class FileOps {
    constructor() {}

    checkDir(dir) {
        try {
            return fs.existsSync(dir);
        } catch (err) {
            return false;
        }
    }
}

module.exports = new FileOps();