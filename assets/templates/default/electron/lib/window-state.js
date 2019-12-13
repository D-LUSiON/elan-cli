class WindowState {
    constructor(data) {
        if (data) {
            if (data.hasOwnProperty('x')) this.x = data['x'];
            if (data.hasOwnProperty('y')) this.y = data['y'];
            if (data.hasOwnProperty('width')) this.width = data['width'];
            if (data.hasOwnProperty('height')) this.height = data['height'];
            if (data.hasOwnProperty('maximized')) this.maximized = data['maximized'];
        }
    }

    get is_set() {
        return this.x !== undefined &&
            this.y !== undefined &&
            this.width !== undefined &&
            this.height !== undefined;
    }

    serialize() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            maximized: this.maximized
        }
    }
}

module.exports = WindowState;
