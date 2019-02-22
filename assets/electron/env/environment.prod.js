const package_json = require('./package.json');

const environment = {
    name: package_json.name,
    description: package_json.description,
    production: true,
    port: 4201,
    html_src: '',
    resizable: true,
    frame: false,
    default_width: 1200,
    default_height: 675,
    min_width: 1024,
    min_height: 675,
};

module.exports = environment;
