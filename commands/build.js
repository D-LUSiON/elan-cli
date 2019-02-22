class Build {
    constructor() {
        this.description = 'Starts build process';
        this.usage = '$ elan build [options]';
        this.options = [];
    }

    entry() {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }
}

module.exports = Build;