const Init = require('./init');
class New extends Init {
    constructor(args) {
        super(args);
        this.description = `Starts a new project in a specified folder`;
        this.usage = '$ elan new [project-folder-name] [options]';
        this.usage_options = [];
        this.aliases = 'init';
    }
}
module.exports = New;