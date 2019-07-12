const fs = require('fs-extra');
const chalk = require('chalk');
const loadingSpinner = require('loading-spinner');

const sharp = require('sharp'); // image processing library 

class Resources {
    constructor(args) {
        this.description = 'Builds app resources - mainly images and icons (not implemented yet)';
        this.usage = '$ elan resources [...options]';
        this.options = [];

        this.args = args;
    }

    entry() {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }
}

module.exports = Resources;
