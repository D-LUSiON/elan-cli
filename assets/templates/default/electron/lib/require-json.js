const fs = require('fs');
const path = require('path');

module.exports = function requireJSON(json_path) {
    return new Promise((resolve, reject) => {
        if (!json_path) reject(`Path to .json file is missing!`);

        if (!path.isAbsolute(json_path))
            json_path = path.resolve(json_path);

        fs.readFile(json_path, (err, data) => {
            try {
                resolve(JSON.parse(data));
            } catch (error) {
                reject(`Cannot parse file ${json_path}`);
            }
        });
    });
};
