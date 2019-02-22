class Serve {
    constructor() {
        this.description = 'Starts a development server';
        this.usage = '$ elan serve [options]';
        this.options = [];
    }

    entry() {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }
}

module.exports = Serve;