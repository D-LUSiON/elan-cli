const { Menu } = require('electron');
class ContextMenu {
    constructor(ctx) {
        this.ctx = ctx;
        this.position = {
            x: 0,
            y: 0
        };
        this.menu_tpl = [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { type: 'separator' },
            {
                label: 'Inspect here',
                click: () => {
                    this.ctx.inspectElement(this.position.x, this.position.y);
                    this.ctx.devToolsWebContents.focus();
                }
            }
        ]

        this.menu = Menu.buildFromTemplate(this.menu_tpl);
    }

    show(position) {
        this.position = position;
        this.menu.popup();
    }
}

module.exports = ContextMenu;
