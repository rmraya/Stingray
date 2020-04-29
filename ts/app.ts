/*****************************************************************************
Copyright (c) 2008-2020 - Maxprograms,  http://www.maxprograms.com/

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to compile,
modify and use the Software in its executable form without restrictions.

Redistribution of this Software or parts of it in any form (source code or
executable binaries) requires prior written permission from Maxprograms.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*****************************************************************************/

import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItem, shell, webContents, nativeTheme, Rectangle, IpcMainEvent } from "electron";
import { existsSync, mkdirSync, readFile, readFileSync, writeFile, writeFileSync } from "fs";

class Stingray {

    mainWindow: BrowserWindow;
    static contents: webContents;
    currentDefaults: Rectangle;

    constructor() {
        app.allowRendererProcessReuse = true;
        if (!app.requestSingleInstanceLock()) {
            app.quit();
        } else {
            if (this.mainWindow) {
                // Someone tried to run a second instance, we should focus our window.
                if (this.mainWindow.isMinimized()) {
                    this.mainWindow.restore();
                }
                this.mainWindow.focus();
            }
        }
        this.loadDefaults();
        this.loadPreferences();
        app.on('ready', () => {
            this.createWindow();
            this.mainWindow.loadURL('file://' + app.getAppPath() + '/index.html');
            this.mainWindow.on('resize', () => {
                this.saveDefaults();
            });
            this.mainWindow.on('move', () => {
                this.saveDefaults();
            });
            this.mainWindow.once('ready-to-show', () => {
                this.setTheme();
                if (this.currentDefaults) {
                    this.mainWindow.setBounds(this.currentDefaults);
                }
                this.mainWindow.show();
            });
            Stingray.checkUpdates(true);
        });
    }

    createWindow(): void {
        this.mainWindow = new BrowserWindow({
            title: app.name,
            width: this.currentDefaults.width,
            height: this.currentDefaults.height,
            x: this.currentDefaults.x,
            y: this.currentDefaults.y,
            useContentSize: true,
            webPreferences: {
                nodeIntegration: true
            },
            show: false,
            icon: 'icons/icon.png'
        });
        Stingray.contents = this.mainWindow.webContents;
        var fileMenu: Menu = Menu.buildFromTemplate([
        ]);
        var editMenu: Menu = Menu.buildFromTemplate([
            { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: function () { Stingray.contents.undo(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: function () { Stingray.contents.cut(); } },
            { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: function () { Stingray.contents.copy(); } },
            { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: function () { Stingray.contents.paste(); } },
            { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: function () { Stingray.contents.selectAll(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Replace Text...', accelerator: 'CmdOrCtrl+F', click: function () { this.replaceText(); } }
        ]);
        var helpMenu: Menu = Menu.buildFromTemplate([
            { label: 'Stingray User Guide', accelerator: 'F1', click: function () { Stingray.showHelp(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Check for Updates...', click: function () { Stingray.checkUpdates(false); } },
            { label: 'View Licenses', click: function () { this.showLicenses(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Release History', click: function () { this.showReleaseHistory(); } },
            { label: 'Support Group', click: function () { this.showSupportGroup(); } }
        ]);
        var template: MenuItem[] = [
            new MenuItem({ label: '&File', role: 'fileMenu', submenu: fileMenu }),
            new MenuItem({ label: '&Edit', role: 'editMenu', submenu: editMenu }),
            new MenuItem({ label: '&Help', role: 'help', submenu: helpMenu })
        ];
        if (process.platform === 'darwin') {
            var appleMenu: Menu = Menu.buildFromTemplate([
                new MenuItem({ label: 'About...', click: function () { Stingray.showAbout(); } }),
                new MenuItem({
                    label: 'Preferences...', submenu: [
                        { label: 'Settings', accelerator: 'Cmd+,', click: function () { Stingray.showSettings(); } }
                    ]
                }),
                new MenuItem({ type: 'separator' }),
                new MenuItem({
                    label: 'Services', role: 'services', submenu: [
                        { label: 'No Services Apply', enabled: false }
                    ]
                }),
                new MenuItem({ type: 'separator' }),
                new MenuItem({ label: 'Quit Stingray', accelerator: 'Cmd+Q', role: 'quit', click: function () { app.quit(); } })
            ]);
            template.unshift(new MenuItem({ label: 'Stingray', role: 'appMenu', submenu: appleMenu }));
        } else {
            var help: MenuItem = template.pop();
            template.push(new MenuItem({
                label: '&Settings', submenu: [
                    { label: 'Preferences', click: function () { Stingray.showSettings(); } }
                ]
            }));
            template.push(help);
        }
        if (process.platform == 'win32') {
            template[0].submenu.append(new MenuItem({ type: 'separator' }));
            template[0].submenu.append(new MenuItem({ label: 'Exit', accelerator: 'Alt+F4', role: 'quit', click: function () { app.quit(); } }));
            template[7].submenu.append(new MenuItem({ type: 'separator' }));
            template[7].submenu.append(new MenuItem({ label: 'About...', click: function () { Stingray.showAbout(); } }));
        }
        if (process.platform === 'linux') {
            template[0].submenu.append(new MenuItem({ type: 'separator' }));
            template[0].submenu.append(new MenuItem({ label: 'Quit', accelerator: 'Ctrl+Q', role: 'quit', click: function () { app.quit(); } }));
            template[7].submenu.append(new MenuItem({ type: 'separator' }));
            template[7].submenu.append(new MenuItem({ label: 'About...', click: function () { Stingray.showAbout(); } }));
        }
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }

    loadDefaults(): void {
        this.currentDefaults = { width: 900, height: 700, x: 0, y: 0 };
        if (existsSync(app.getAppPath() + '/defaults.json')) {
            try {
                var data: Buffer = readFileSync(app.getAppPath() + '/defaults.json');
                this.currentDefaults = JSON.parse(data.toString());
            } catch (err) {
                console.log(err);
            }
        }
    }

    loadPreferences(): void {
        // TODO
    }

    saveDefaults(): void {
        // TODO
    }

    setTheme(): void {
        // TODO
    }

    static checkUpdates(silent: boolean): void {
        // TODO
    }

    replaceText(): void {
        // TODO
    }

    static showAbout(): void {
        // TODO
    }

    static showSettings(): void {
        // TODO
    }

    static showHelp(): void {
        // TODO
    }

    showLicenses(): void {
        // TODO
    }

    showReleaseHistory(): void {
        // TODO
    }

    showSupportGroup(): void {
        // TODO
    }
}

new Stingray();





