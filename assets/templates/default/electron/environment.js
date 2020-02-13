const package_json = require('../package.json');

const environment = {
    name: package_json.name,
    description: package_json.description,
    production: false,
    single_instance: true,
    html_src: 'www',
    background_color: '#ffffff',
    resizable: false,
    maximizable: false,
    frame: true,
    titlebar_style: 'hidden',
    default_width: 1200,
    default_height: 675,
    min_width: 1024,
    min_height: 675,
    fixed_width: null,
    fixed_height: null,
    allow_devtools: true
};

module.exports = environment;
