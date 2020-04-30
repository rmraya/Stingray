/*****************************************************************************
Copyright (c) 2008-2020 - Maxprograms,  http://www.maxprograms.com\\

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

    static path = require('path');

    static mainWindow: BrowserWindow;
    static aboutWindow: BrowserWindow;
    static contents: webContents;
    currentDefaults: Rectangle;

    verticalPadding: number = 46;

    constructor() {
        app.allowRendererProcessReuse = true;
        if (!app.requestSingleInstanceLock()) {
            app.quit();
        } else {
            if (Stingray.mainWindow) {
                // Someone tried to run a second instance, we should focus our window.
                if (Stingray.mainWindow.isMinimized()) {
                    Stingray.mainWindow.restore();
                }
                Stingray.mainWindow.focus();
            }
        }
        this.loadDefaults();
        this.loadPreferences();
        app.on('ready', () => {
            this.createWindow();
            Stingray.mainWindow.loadURL('file://' + app.getAppPath() + '/index.html');
            Stingray.mainWindow.on('resize', () => {
                this.saveDefaults();
            });
            Stingray.mainWindow.on('move', () => {
                this.saveDefaults();
            });
            Stingray.mainWindow.once('ready-to-show', () => {
                this.setTheme();
                Stingray.mainWindow.setBounds(this.currentDefaults);
                Stingray.mainWindow.show();
            });
            Stingray.checkUpdates(true);
        });
        ipcMain.on('about-height', (event, arg) => {
            let rect: Rectangle = Stingray.aboutWindow.getBounds();
            rect.height = arg.height + this.verticalPadding;
            Stingray.aboutWindow.setBounds(rect);
        });
        ipcMain.on('licenses-clicked', () => {
            Stingray.showLicenses();
        });
    }

    createWindow(): void {
        Stingray.mainWindow = new BrowserWindow({
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
            icon: Stingray.path.join(app.getAppPath(), 'icons', 'icon.png')
        });
        Stingray.contents = Stingray.mainWindow.webContents;
        var fileMenu: Menu = Menu.buildFromTemplate([
        ]);
        var editMenu: Menu = Menu.buildFromTemplate([
            { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => { Stingray.contents.undo(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: () => { Stingray.contents.cut(); } },
            { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => { Stingray.contents.copy(); } },
            { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: () => { Stingray.contents.paste(); } },
            { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => { Stingray.contents.selectAll(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Replace Text...', accelerator: 'CmdOrCtrl+F', click: () => { this.replaceText(); } }
        ]);
        var helpMenu: Menu = Menu.buildFromTemplate([
            { label: 'Stingray User Guide', accelerator: 'F1', click: () => { Stingray.showHelp(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Check for Updates...', click: () => { Stingray.checkUpdates(false); } },
            { label: 'View Licenses', click: () => { Stingray.showLicenses(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Release History', click: () => { Stingray.showReleaseHistory(); } },
            { label: 'Support Group', click: () => { Stingray.showSupportGroup(); } }
        ]);
        var template: MenuItem[] = [
            new MenuItem({ label: '&File', role: 'fileMenu', submenu: fileMenu }),
            new MenuItem({ label: '&Edit', role: 'editMenu', submenu: editMenu }),
            new MenuItem({ label: '&Help', role: 'help', submenu: helpMenu })
        ];
        if (process.platform === 'darwin') {
            var appleMenu: Menu = Menu.buildFromTemplate([
                new MenuItem({ label: 'About...', click: () => { Stingray.showAbout(); } }),
                new MenuItem({
                    label: 'Preferences...', submenu: [
                        { label: 'Settings', accelerator: 'Cmd+,', click: () => { Stingray.showSettings(); } }
                    ]
                }),
                new MenuItem({ type: 'separator' }),
                new MenuItem({
                    label: 'Services', role: 'services', submenu: [
                        { label: 'No Services Apply', enabled: false }
                    ]
                }),
                new MenuItem({ type: 'separator' }),
                new MenuItem({ label: 'Quit Stingray', accelerator: 'Cmd+Q', role: 'quit', click: () => { app.quit(); } })
            ]);
            template.unshift(new MenuItem({ label: 'Stingray', role: 'appMenu', submenu: appleMenu }));
        } else {
            var help: MenuItem = template.pop();
            template.push(new MenuItem({
                label: '&Settings', submenu: [
                    { label: 'Preferences', click: () => { Stingray.showSettings(); } }
                ]
            }));
            template.push(help);
        }
        if (process.platform === 'win32') {
            template[0].submenu.append(new MenuItem({ type: 'separator' }));
            template[0].submenu.append(new MenuItem({ label: 'Exit', accelerator: 'Alt+F4', role: 'quit', click: () => { app.quit(); } }));
            template[3].submenu.append(new MenuItem({ type: 'separator' }));
            template[3].submenu.append(new MenuItem({ label: 'About...', click: () => { Stingray.showAbout(); } }));
        }
        if (process.platform === 'linux') {
            template[0].submenu.append(new MenuItem({ type: 'separator' }));
            template[0].submenu.append(new MenuItem({ label: 'Quit', accelerator: 'Ctrl+Q', role: 'quit', click: () => { app.quit(); } }));
            template[3].submenu.append(new MenuItem({ type: 'separator' }));
            template[3].submenu.append(new MenuItem({ label: 'About...', click: () => { Stingray.showAbout(); } }));
        }
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }

    loadDefaults(): void {
        let defaultsFile: string = Stingray.path.join(app.getPath('appData'), app.name, 'defaults.json');
        this.currentDefaults = { width: 900, height: 700, x: 0, y: 0 };
        if (existsSync(defaultsFile)) {
            try {
                var data: Buffer = readFileSync(defaultsFile);
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
        let defaultsFile: string = Stingray.path.join(app.getPath('appData'), app.name, 'defaults.json');
        writeFileSync(defaultsFile, JSON.stringify(Stingray.mainWindow.getBounds()));
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
        Stingray.aboutWindow = new BrowserWindow({
            parent: Stingray.mainWindow,
            width: Stingray.getWidth('aboutWindow'),
            minimizable: false,
            maximizable: false,
            resizable: false,
            useContentSize: true,
            show: false,
            icon: './icons/icon.png',
            webPreferences: {
                nodeIntegration: true
            }
        });
        Stingray.aboutWindow.setMenu(null);
        Stingray.aboutWindow.loadURL('file://' + app.getAppPath() + '/html/about.html');
        Stingray.aboutWindow.once('ready-to-show', (event: IpcMainEvent) => {
            event.sender.send('get-height');
            Stingray.aboutWindow.show();
        });
    }

    static showSettings(): void {
        // TODO
    }

    static showHelp(): void {
        shell.openExternal(Stingray.path.join(app.getAppPath(), 'stingray.pdf'));
    }

    static showLicenses(): void {
        // TODO
    }

    static showReleaseHistory(): void {
        shell.openExternal('https://www.maxprograms.com/products/stgraylog.html');
    }

    static showSupportGroup(): void {
        shell.openExternal('https://groups.io/g/maxprograms/');
    }

    static getWidth(window: string): number{
        switch (window) {
            case 'aboutWindow': { return 436; }
            case 'licensesWindow': { return 430; }
            case 'settingsWindow': { return 600; }
        }
    }
}

new Stingray();





