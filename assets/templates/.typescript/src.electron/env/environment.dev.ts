const package_json = require('../package.json');

export const environment = {
    name: package_json.name,
    description: package_json.description,
    production: false,
    html_src: 'www',
    background_color: '#ffffff',
    resizable: true,
    frame: true,
    default_width: 1200,
    default_height: 675,
    min_width: 1024,
    min_height: 675,
};
