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

import { execFileSync, spawn, ChildProcessWithoutNullStreams } from "child_process";
import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItem, shell, webContents, nativeTheme, Rectangle, IpcMainEvent } from "electron";
import { existsSync, readFileSync, writeFile, writeFileSync } from "fs";
import { ClientRequest, request, IncomingMessage } from "http";

class Stingray {

    static path = require('path');
    static https = require('https');

    static mainWindow: BrowserWindow;
    static aboutWindow: BrowserWindow;
    static licensesWindow: BrowserWindow;
    static settingsWindow: BrowserWindow;
    static newFileWindow: BrowserWindow;
    static changeLanguagesWindow: BrowserWindow;
    static replaceTextWindow: BrowserWindow;
    static contents: webContents;
    static alignmentStatus: any = { aligning: false, alignError: '', status: '' };
    static loadingStatus: any = { loading: false, loadError: '', status: '' };
    static savingStatus: any = { saving: false, saveError: '', status: '' };

    static currentPreferences: any;
    static currentTheme: string = 'system';

    currentDefaults: Rectangle;
    verticalPadding: number = 50;

    javapath: string = Stingray.path.join(app.getAppPath(), 'bin', 'java');
    ls: ChildProcessWithoutNullStreams;

    static currentFile: string;
    static srcLang: string;
    static tgtLang: string;
    static saved: boolean = true;
    static shouldQuit: boolean;
    stopping: boolean = false;

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

        if (process.platform === 'win32') {
            this.javapath = Stingray.path.join(app.getAppPath(), 'bin', 'java.exe');
        }

        this.ls = spawn(this.javapath, ['--module-path', 'lib', '-m', 'stingray/com.maxprograms.stingray.StingrayServer', '-port', '8040'], { cwd: app.getAppPath(), detached: true });

        this.ls.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        this.ls.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        this.ls.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

        var ck: Buffer = execFileSync(this.javapath, ['--module-path', 'lib', '-m', 'openxliff/com.maxprograms.server.CheckURL', 'http://localhost:8040/StingrayServer'], { cwd: app.getAppPath() });
        console.log(ck.toString());

        this.loadDefaults();
        Stingray.currentPreferences = {
            theme: 'system',
            srcLang: 'none',
            tgtLang: 'none',
            catalog: Stingray.path.join(app.getAppPath(), 'catalog', 'catalog.xml'),
            srx: Stingray.path.join(app.getAppPath(), 'srx', 'default.srx')
        }
        app.on('ready', () => {
            Stingray.currentFile = '';
            this.createWindow();
            Stingray.loadPreferences();
            Stingray.mainWindow.loadURL(Stingray.path.join('file://', app.getAppPath(), 'index.html'));
            Stingray.mainWindow.on('resize', () => {
                this.saveDefaults();
            });
            Stingray.mainWindow.on('move', () => {
                this.saveDefaults();
            });
            Stingray.mainWindow.once('ready-to-show', () => {
                Stingray.setTheme();
                Stingray.mainWindow.setBounds(this.currentDefaults);
                Stingray.mainWindow.show();
            });
            Stingray.mainWindow.on('close', (ev) => {
                if (!Stingray.saved) {
                    Stingray.shouldQuit = true;
                    Stingray.closeFile();
                    ev.preventDefault();
                }
            });
            Stingray.checkUpdates(true);
        });

        app.on('before-quit', (ev) => {
            if (!Stingray.saved) {
                ev.preventDefault();
                Stingray.shouldQuit = true;
                Stingray.closeFile();
            }
        });

        app.on('will-quit', (ev) => {
            if (!Stingray.saved) {
                ev.preventDefault();
                Stingray.shouldQuit = true;
                Stingray.closeFile();
            }
        });

        app.on('quit', (ev) => {
            if (!Stingray.saved) {
                ev.preventDefault();
                Stingray.shouldQuit = true;
                Stingray.closeFile();
                return;
            }
            this.stopServer();
        });

        app.on('window-all-closed', (ev: Event) => {
            if (!Stingray.saved) {
                ev.preventDefault();
                Stingray.shouldQuit = true;
                Stingray.closeFile();
                return;
            }
            this.stopServer();
            app.quit();
        });

        nativeTheme.on('updated', () => {
            Stingray.loadPreferences();
            Stingray.setTheme();
        });

        ipcMain.on('get-theme', (event, arg) => {
            event.sender.send('set-theme', Stingray.currentTheme);
        });
        ipcMain.on('about-height', (event, arg) => {
            let rect: Rectangle = Stingray.aboutWindow.getBounds();
            rect.height = arg.height + this.verticalPadding;
            Stingray.aboutWindow.setBounds(rect);
        });
        ipcMain.on('get-version', (event, arg) => {
            this.getVersion(event);
        });
        ipcMain.on('settings-height', (event, arg) => {
            let rect: Rectangle = Stingray.settingsWindow.getBounds();
            rect.height = arg.height + this.verticalPadding;
            Stingray.settingsWindow.setBounds(rect);
        });
        ipcMain.on('replace-text', () => {
            Stingray.replaceText();
        })
        ipcMain.on('replacetext-height', (event, arg) => {
            let rect: Rectangle = Stingray.replaceTextWindow.getBounds();
            rect.height = arg.height + this.verticalPadding;
            Stingray.replaceTextWindow.setBounds(rect);
        });
        ipcMain.on('replace-request', (event, arg) => {
            Stingray.replace(arg);
        });
        ipcMain.on('browse-srx', (event, arg) => {
            this.browseSRX(event);
        });
        ipcMain.on('browse-catalog', (event, arg) => {
            this.browseCatalog(event);
        });
        ipcMain.on('browse-alignment', (event, arg) => {
            this.browseAlignment(event);
        });
        ipcMain.on('browse-source', (event, arg) => {
            this.browseSource(event);
        });
        ipcMain.on('browse-target', (event, arg) => {
            this.browseTarget(event);
        });
        ipcMain.on('save-preferences', (event, arg) => {
            Stingray.settingsWindow.close();
            Stingray.mainWindow.focus();
            Stingray.currentPreferences = arg;
            Stingray.savePreferences();
        });
        ipcMain.on('get-preferences', (event, arg) => {
            event.sender.send('set-preferences', Stingray.currentPreferences);
        });
        ipcMain.on('licenses-clicked', () => {
            Stingray.showLicenses();
        });
        ipcMain.on('open-license', (event, arg) => {
            Stingray.openLicense(arg.type);
        })
        ipcMain.on('show-help', () => {
            Stingray.showHelp();
        });
        ipcMain.on('get-languages', (event, arg) => {
            this.getLanguages(event);
        });
        ipcMain.on('get-types', (event, arg) => {
            this.getTypes(event);
        });
        ipcMain.on('get-charsets', (event, arg) => {
            this.getCharsets(event);
        });
        ipcMain.on('new-file', () => {
            Stingray.newFile();
        });
        ipcMain.on('open-file', () => {
            Stingray.openFileDialog();
        });
        ipcMain.on('save-file', () => {
            Stingray.saveFile();
        });
        ipcMain.on('export-tmx', () => {
            Stingray.exportTMX();
        });
        ipcMain.on('export-csv', () => {
            Stingray.exportCSV();
        });
        ipcMain.on('newFile-height', (event, arg) => {
            let rect: Rectangle = Stingray.newFileWindow.getBounds();
            rect.height = arg.height + this.verticalPadding;
            Stingray.newFileWindow.setBounds(rect);
        });
        ipcMain.on('remove-tags', () => {
            Stingray.removeTags();
        });
        ipcMain.on('remove-duplicates', () => {
            Stingray.removeDuplicates();
        });
        ipcMain.on('change-languages', () => {
            Stingray.changeLanguages();
        });
        ipcMain.on('languages-height', (event, arg) => {
            let rect: Rectangle = Stingray.changeLanguagesWindow.getBounds();
            rect.height = arg.height + this.verticalPadding;
            Stingray.changeLanguagesWindow.setBounds(rect);
        });
        ipcMain.on('create-alignment', (event, arg) => {
            Stingray.createAlignment(arg);
        });
        ipcMain.on('get-rows', (event, arg) => {
            Stingray.getRows(arg);
        });
        ipcMain.on('file-languages', (event, arg) => {
            event.sender.send('language-pair', { srcLang: Stingray.srcLang, tgtLang: Stingray.tgtLang });
        });
        ipcMain.on('save-languages', (event, arg) => {
            Stingray.setLanguages(arg);
        });
        ipcMain.on('save-data', (event, arg) => {
            Stingray.saveData(arg);
        });
        ipcMain.on('split-data', (event, arg) => {
            Stingray.split(arg);
        });
        ipcMain.on('segment-down', (event, arg) => {
            Stingray.segmentDown(arg);
        });
        ipcMain.on('segment-up', (event, arg) => {
            Stingray.segmentUp(arg);
        });
        ipcMain.on('merge-next', (event, arg) => {
            Stingray.mergeNext(arg);
        });
        ipcMain.on('remove-data', (event, arg) => {
            Stingray.removeData(arg);
        });
    }

    stopServer(): void {
        if (!this.stopping) {
            this.stopping = true;
            this.ls.kill(15);
        }
    }

    createWindow(): void {
        Stingray.mainWindow = new BrowserWindow({
            title: app.name,
            width: this.currentDefaults.width,
            height: this.currentDefaults.height,
            minWidth: 900,
            minHeight: 400,
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
            { label: 'New Alignment', accelerator: 'CmdOrCtrl+N', click: () => { Stingray.newFile(); } },
            { label: 'Open Alignment', accelerator: 'CmdOrCtrl+O', click: () => { Stingray.openFileDialog(); } },
            { label: 'Close Alignment', accelerator: 'CmdOrCtrl+W', click: () => { Stingray.closeFile(); } },
            { label: 'Save Alignment', accelerator: 'CmdOrCtrl+S', click: () => { Stingray.saveFile(); } },
            { label: 'Save Alignment As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => { Stingray.saveFileAs(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Export Aligment as TMX', click: () => { Stingray.exportTMX(); } },
            { label: 'Export Alignment as TAB Delimited', click: () => { Stingray.exportCSV(); } }
        ]);
        let recentFiles: string[] = Stingray.loadRecents();
        if (recentFiles.length > 0) {
            fileMenu.append(new MenuItem({ type: 'separator' }));
            let length: number = recentFiles.length;
            for (let i = 0; i < length; i++) {
                let file: string = recentFiles[i];
                fileMenu.append(new MenuItem({ label: file, click: () => { Stingray.currentFile = file; Stingray.openFile() } }));
            }
        }
        var editMenu: Menu = Menu.buildFromTemplate([
            { label: 'Replace Text...', accelerator: 'CmdOrCtrl+F', click: () => { Stingray.replaceText(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Confirm Edit', accelerator: 'Alt+Enter', click: () => { Stingray.saveEdit(); } },
            { label: 'Cancel Edit', accelerator: 'Esc', click: () => { Stingray.cancelEdit(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Move Segment Down', accelerator: 'Alt+CmdOrCtrl+Down', click: () => { Stingray.moveSegmentDown(); } },
            { label: 'Move Segment Up', accelerator: 'Alt+CmdOrCtrl+Up', click: () => { Stingray.moveSegmentUp(); } },
            { label: 'Split Segment', accelerator: 'CmdOrCtrl+L', click: () => { Stingray.splitSegment(); } },
            { label: 'Merge With Next Segment', accelerator: 'CmdOrCtrl+M', click: () => { Stingray.mergeSegment(); } },
            { label: 'Remove Segment', accelerator: 'CmdOrCtrl+D', click: () => { Stingray.removeSegment(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: () => { Stingray.contents.cut(); } },
            { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => { Stingray.contents.copy(); } },
            { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: () => { Stingray.contents.paste(); } },
            { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => { Stingray.contents.selectAll(); } }
        ]);
        var viewMenu: Menu = Menu.buildFromTemplate([
            { label: 'First Page', accelerator: 'CmdOrCtrl+Home', click: () => { Stingray.firstPage(); } },
            { label: 'Previous Page', accelerator: 'CmdOrCtrl+PageUp', click: () => { Stingray.previousPage(); } },
            { label: 'Next Page', accelerator: 'CmdOrCtrl+PageDown', click: () => { Stingray.nextPage(); } },
            { label: 'Last Page', accelerator: 'CmdOrCtrl+End', click: () => { Stingray.lastPage(); } },
            new MenuItem({ type: 'separator' }),
            new MenuItem({ label: 'Toggle Full Screen', role: 'togglefullscreen' }),
            new MenuItem({ label: 'Toggle Development Tools', accelerator: 'F12', role: 'toggleDevTools' })
        ]);
        var tasksMenu: Menu = Menu.buildFromTemplate([
            { label: 'Remove all Tags', click: () => { Stingray.removeTags(); } },
            { label: 'Remove Duplicate Entries', click: () => { Stingray.removeDuplicates(); } },
            { label: 'Change Language Codes', click: () => { Stingray.changeLanguages(); } },
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
            new MenuItem({ label: '&View', role: 'viewMenu', submenu: viewMenu }),
            new MenuItem({ label: '&Tasks', submenu: tasksMenu }),
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
            template[5].submenu.append(new MenuItem({ type: 'separator' }));
            template[5].submenu.append(new MenuItem({ label: 'About...', click: () => { Stingray.showAbout(); } }));
        }
        if (process.platform === 'linux') {
            template[0].submenu.append(new MenuItem({ type: 'separator' }));
            template[0].submenu.append(new MenuItem({ label: 'Quit', accelerator: 'Ctrl+Q', role: 'quit', click: () => { app.quit(); } }));
            template[5].submenu.append(new MenuItem({ type: 'separator' }));
            template[5].submenu.append(new MenuItem({ label: 'About...', click: () => { Stingray.showAbout(); } }));
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

    static loadPreferences(): void {
        let preferencesFile = this.path.join(app.getPath('appData'), app.name, 'preferences.json');
        if (existsSync(preferencesFile)) {
            try {
                var data: Buffer = readFileSync(preferencesFile);
                this.currentPreferences = JSON.parse(data.toString());
            } catch (err) {
                console.log(err);
            }
        }
        let light = 'file://' + this.path.join(app.getAppPath(), 'css', 'light.css');
        let dark = 'file://' + this.path.join(app.getAppPath(), 'css', 'dark.css');
        if (this.currentPreferences.theme === 'system') {
            if (nativeTheme.shouldUseDarkColors) {
                this.currentTheme = dark;
            } else {
                this.currentTheme = light;
            }
        }
        if (this.currentPreferences.theme === 'dark') {
            this.currentTheme = dark;
        }
        if (this.currentPreferences.theme === 'light') {
            this.currentTheme = light;
        }
        if (process.platform === 'win32') {
            nativeTheme.themeSource = this.currentPreferences.theme;
        }
        this.setTheme();
    }

    static savePreferences(): void {
        let preferencesFile = this.path.join(app.getPath('appData'), app.name, 'preferences.json');
        writeFileSync(preferencesFile, JSON.stringify(this.currentPreferences));
        this.loadPreferences();
    }

    saveDefaults(): void {
        let defaultsFile: string = Stingray.path.join(app.getPath('appData'), app.name, 'defaults.json');
        writeFileSync(defaultsFile, JSON.stringify(Stingray.mainWindow.getBounds()));
    }

    static setTheme(): void {
        this.contents.send('set-theme', this.currentTheme);
    }

    static checkUpdates(silent: boolean): void {
        this.https.get('https://raw.githubusercontent.com/rmraya/Stingray/master/package.json', { timeout: 1500 }, (res: IncomingMessage) => {
            if (res.statusCode === 200) {
                let rawData = '';
                res.on('data', (chunk: string) => {
                    rawData += chunk;
                });
                res.on('end', () => {
                    try {
                        const parsedData: any = JSON.parse(rawData);
                        if (app.getVersion() !== parsedData.version) {
                            dialog.showMessageBox(this.mainWindow, {
                                type: 'info',
                                title: 'Updates Available',
                                message: 'Version ' + parsedData.version + ' is available'
                            });
                        } else {
                            if (!silent) {
                                dialog.showMessageBox(this.mainWindow, {
                                    type: 'info',
                                    message: 'There are currently no updates available'
                                });
                            }
                        }
                    } catch (e) {
                        dialog.showErrorBox('Error', e.message);
                    }
                });
            } else {
                if (!silent) {
                    dialog.showErrorBox('Error', 'Updates Request Failed.\nStatus code: ' + res.statusCode);
                }
            }
        }).on('error', (e: any) => {
            if (!silent) {
                dialog.showErrorBox('Error', e.message);
            }
        });
    }

    static showAbout(): void {
        this.aboutWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: this.getWidth('aboutWindow'),
            minimizable: false,
            maximizable: false,
            resizable: false,
            useContentSize: true,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true
            }
        });
        this.aboutWindow.setMenu(null);
        this.aboutWindow.on('closed', () => {
            this.mainWindow.focus();
        });
        this.aboutWindow.loadURL(this.path.join('file://', app.getAppPath(), 'html', 'about.html'));
        this.aboutWindow.once('ready-to-show', (event: IpcMainEvent) => {
            event.sender.send('get-height');
            this.aboutWindow.show();
        });
    }

    static showSettings(): void {
        this.settingsWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: this.getWidth('settingsWindow'),
            useContentSize: true,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true
            }
        });
        this.settingsWindow.setMenu(null);
        this.settingsWindow.on('closed', () => {
            this.mainWindow.focus();
        });
        this.settingsWindow.loadURL(this.path.join('file://', app.getAppPath(), 'html', 'preferences.html'));
        this.settingsWindow.once('ready-to-show', (event: IpcMainEvent) => {
            event.sender.send('get-height');
            this.settingsWindow.show();
        });
    }

    static showHelp(): void {
        shell.openExternal(this.path.join('file://', app.getAppPath(), 'stingray.pdf'));
    }

    static showLicenses(): void {
        let height = 345;
        this.licensesWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: this.getWidth('licensesWindow'),
            height: height,
            useContentSize: true,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true
            }
        });
        this.licensesWindow.setMenu(null);
        this.licensesWindow.on('closed', () => {
            if (this.aboutWindow) {
                this.aboutWindow.focus();
            } else {
                this.mainWindow.focus();
            }
        });
        this.licensesWindow.loadURL('file://' + app.getAppPath() + '/html/licenses.html');
        this.licensesWindow.once('ready-to-show', (event: IpcMainEvent) => {
            event.sender.send('get-height');
            this.licensesWindow.show();
        });
    }

    static openLicense(type: string) {
        var licenseFile = '';
        var title = '';
        switch (type) {
            case 'Stingray':
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'license.txt');
                title = 'Stingray License';
                break;
            case "electron":
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'electron.txt');
                title = 'MIT License';
                break;
            case "TypeScript":
            case "MapDB":
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'Apache2.0.html');
                title = 'Apache 2.0';
                break;
            case "Java":
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'java.html');
                title = 'GPL2 with Classpath Exception';
                break;
            case "OpenXLIFF":
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'EclipsePublicLicense1.0.html');
                title = 'Eclipse Public License 1.0';
                break;
            case "JSON":
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'json.txt');
                title = 'JSON.org License';
                break;
            case "jsoup":
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'jsoup.txt');
                title = 'MIT License';
                break;
            case "DTDParser":
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'LGPL2.1.txt');
                title = 'LGPL 2.1';
                break;
            default:
                dialog.showErrorBox('Error', 'Unknow license');
                return;
        }
        var licenseWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: 680,
            height: 400,
            show: false,
            title: title,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true
            }
        });
        licenseWindow.setMenu(null);
        licenseWindow.on('closed', () => {
            if (Stingray.licensesWindow) {
                this.licensesWindow.focus();
            } else {
                this.mainWindow.focus();
            }
        });
        licenseWindow.loadURL(licenseFile);
        licenseWindow.show();
    }
    static showReleaseHistory(): void {
        shell.openExternal('https://www.maxprograms.com/products/stgraylog.html');
    }

    static showSupportGroup(): void {
        shell.openExternal('https://groups.io/g/maxprograms/');
    }

    static getWidth(window: string): number {
        switch (window) {
            case 'aboutWindow': { return 436; }
            case 'licensesWindow': { return 430; }
            case 'settingsWindow': { return 600; }
            case 'newFileWindow': { return 850; }
            case 'changeLanguagesWindow': { return 550; }
            case 'replaceTextWindow': { return 450; }
        }
    }

    static sendRequest(url: string, json: any, success: any, error: any) {
        var postData: string = JSON.stringify(json);
        var options = {
            hostname: '127.0.0.1',
            port: 8040,
            path: url,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        // Make a request
        var req: ClientRequest = request(options);
        req.on('response',
            function (res: any) {
                res.setEncoding('utf-8');
                if (res.statusCode !== 200) {
                    error('sendRequest() error: ' + res.statusMessage);
                }
                var rawData: string = '';
                res.on('data', function (chunk: string) {
                    rawData += chunk;
                });
                res.on('end', () => {
                    try {
                        success(JSON.parse(rawData));
                    } catch (e) {
                        error(e.message);
                    }
                });
            }
        );
        req.write(postData);
        req.end();
    }

    getLanguages(event: IpcMainEvent): void {
        Stingray.sendRequest('/getLanguages', {},
            function success(data: any) {
                data.srcLang = Stingray.currentPreferences.srcLang;
                data.tgtLang = Stingray.currentPreferences.tgtLang;
                event.sender.send('set-languages', data);
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    getTypes(event: IpcMainEvent): void {
        Stingray.sendRequest('/getTypes', {},
            function success(data: any) {
                event.sender.send('set-types', data);
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    getCharsets(event: IpcMainEvent): void {
        Stingray.sendRequest('/getCharsets', {},
            function success(data: any) {
                event.sender.send('set-charsets', data);
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    getVersion(event: IpcMainEvent): void {
        Stingray.sendRequest('/version', {},
            function success(data: any) {
                data.srcLang = Stingray.currentPreferences.srcLang;
                data.tgtLang = Stingray.currentPreferences.tgtLang;
                event.sender.send('set-version', app.name + ' ' + data.version);
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static newFile(): void {
        this.newFileWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: this.getWidth('newFileWindow'),
            useContentSize: true,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true
            }
        });
        this.newFileWindow.on('closed', () => {
            this.mainWindow.focus();
        });
        this.newFileWindow.setMenu(null);
        this.newFileWindow.loadURL(this.path.join('file://', app.getAppPath(), 'html', 'newFile.html'));
        this.newFileWindow.once('ready-to-show', (event: IpcMainEvent) => {
            event.sender.send('get-height');
            this.newFileWindow.show();
        });
    }

    browseSRX(event: IpcMainEvent): void {
        dialog.showOpenDialog({
            title: 'Default SRX File',
            defaultPath: Stingray.currentPreferences.srx,
            properties: ['openFile'],
            filters: [
                { name: 'SRX File', extensions: ['srx'] },
                { name: 'Any File', extensions:['*'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                event.sender.send('set-srx', value.filePaths[0]);
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    browseCatalog(event: IpcMainEvent): void {
        dialog.showOpenDialog({
            title: 'Default Catalog',
            defaultPath: Stingray.currentPreferences.catalog,
            properties: ['openFile'],
            filters: [
                { name: 'XML File', extensions: ['xml'] },
                { name: 'Any File', extensions:['*'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                event.sender.send('set-catalog', value.filePaths[0]);
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    browseAlignment(event: IpcMainEvent): void {
        dialog.showSaveDialog({
            title: 'New Alignment File',
            properties: ['createDirectory', 'showOverwriteConfirmation'],
            filters: [
                { name: 'Alignment File', extensions: ['algn'] },
                { name: 'Any File', extensions:['*'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                event.sender.send('set-alignment', value.filePath);
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    browseSource(event: IpcMainEvent): void {
        dialog.showOpenDialog({
            title: 'Source File',
            properties: ['openFile'],
            filters: [
                { name: 'Any File', extensions: (process.platform !== 'linux' ? [] : ['*']) },
                { name: 'Adobe InDesign Interchange', extensions: ['inx'] },
                { name: 'Adobe InDesign IDML', extensions: ['idml'] },
                { name: 'DITA Map', extensions: ['ditamap', 'dita', 'xml'] },
                { name: 'HTML Page', extensions: ['html', 'htm'] },
                { name: 'JavaScript', extensions: ['js'] },
                { name: 'Java Properties', extensions: ['properties'] },
                { name: 'MIF (Maker Interchange Format)', extensions: ['mif'] },
                { name: 'Microsoft Office 2007 Document', extensions: ['docx', 'xlsx', 'pptx'] },
                { name: 'OpenOffice 1.x Document', extensions: ['sxw', 'sxc', 'sxi', 'sxd'] },
                { name: 'OpenOffice 2.x Document', extensions: ['odt', 'ods', 'odp', 'odg'] },
                { name: 'Plain Text', extensions: ['txt'] },
                { name: 'RC (Windows C/C++ Resources)', extensions: ['rc'] },
                { name: 'ResX (Windows .NET Resources)', extensions: ['resx'] },
                { name: 'SVG (Scalable Vector Graphics)', extensions: ['svg'] },
                { name: 'Visio XML Drawing', extensions: ['vsdx'] },
                { name: 'XML Document', extensions: ['xml'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                this.getFileType(event, value.filePaths[0], 'set-source');
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    browseTarget(event: IpcMainEvent): void {
        dialog.showOpenDialog({
            title: 'Target File',
            properties: ['openFile'],
            filters: [
                { name: 'Any File', extensions: (process.platform !== 'linux' ? [] : ['*']) },
                { name: 'Adobe InDesign Interchange', extensions: ['inx'] },
                { name: 'Adobe InDesign IDML', extensions: ['idml'] },
                { name: 'DITA Map', extensions: ['ditamap', 'dita', 'xml'] },
                { name: 'HTML Page', extensions: ['html', 'htm'] },
                { name: 'JavaScript', extensions: ['js'] },
                { name: 'Java Properties', extensions: ['properties'] },
                { name: 'MIF (Maker Interchange Format)', extensions: ['mif'] },
                { name: 'Microsoft Office 2007 Document', extensions: ['docx', 'xlsx', 'pptx'] },
                { name: 'OpenOffice 1.x Document', extensions: ['sxw', 'sxc', 'sxi', 'sxd'] },
                { name: 'OpenOffice 2.x Document', extensions: ['odt', 'ods', 'odp', 'odg'] },
                { name: 'Plain Text', extensions: ['txt'] },
                { name: 'RC (Windows C/C++ Resources)', extensions: ['rc'] },
                { name: 'ResX (Windows .NET Resources)', extensions: ['resx'] },
                { name: 'SVG (Scalable Vector Graphics)', extensions: ['svg'] },
                { name: 'Visio XML Drawing', extensions: ['vsdx'] },
                { name: 'XML Document', extensions: ['xml'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                this.getFileType(event, value.filePaths[0], 'set-target');
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    getFileType(event: IpcMainEvent, file: string, arg: string): void {
        Stingray.sendRequest('/getFileType', { file: file },
            function success(data: any) {
                event.sender.send(arg, data);
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static createAlignment(params: any): void {
        this.newFileWindow.close();
        this.mainWindow.focus();
        this.contents.send('start-waiting');
        this.contents.send('set-status', 'Preparing files');
        params.catalog = Stingray.currentPreferences.catalog;
        params.srx = Stingray.currentPreferences.srx;
        this.sendRequest('/alignFiles', params,
            function success(data: any) {
                if (data.status === 'Success') {
                    Stingray.alignmentStatus.aligning = true;
                    Stingray.alignmentStatus.status = 'Preparing files';
                    var intervalObject = setInterval(() => {
                        if (Stingray.alignmentStatus.aligning) {
                            Stingray.contents.send('set-status', Stingray.alignmentStatus.status);
                        } else {
                            clearInterval(intervalObject);
                            Stingray.contents.send('end-waiting');
                            Stingray.contents.send('set-status', '');
                            if (Stingray.alignmentStatus.alignError !== '') {
                                dialog.showErrorBox('Error', Stingray.alignmentStatus.alignError);
                            } else {
                                Stingray.currentFile = params.alignmentFile;
                                Stingray.openFile();
                            }
                        }
                        Stingray.getAlignmentStatus();
                    }, 500);
                } else {
                    Stingray.contents.send('end-waiting');
                    Stingray.contents.send('set-status', '');
                    dialog.showErrorBox('Error', data.reason);
                }
            },
            function error(reason: string) {
                Stingray.contents.send('end-waiting');
                Stingray.contents.send('set-status', '');
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static getAlignmentStatus(): void {
        this.sendRequest('/alignmentStatus', {},
            function success(data: any) {
                Stingray.alignmentStatus = data;
            },
            function error(reason: string) {
                Stingray.alignmentStatus.aligning = false;
                Stingray.alignmentStatus.alignError = reason;
                Stingray.alignmentStatus.status = '';
            }
        );
    }

    static openFileDialog(): void {
        dialog.showOpenDialog({
            title: 'Alignment File',
            properties: ['openFile'],
            filters: [
                { name: 'Alignment File', extensions: ['algn'] },
                { name: 'Any File', extensions:['*'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                Stingray.currentFile = value.filePaths[0];
                Stingray.openFile();
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    static openFile(): void {
        if (this.currentFile !== '') {
            this.closeFile();
        }
        this.contents.send('start-waiting');
        this.contents.send('set-status', 'Loading file');
        this.sendRequest('/openFile', { file: this.currentFile },
            function success(data: any) {
                if (data.status === 'Success') {
                    Stingray.loadingStatus.loading = true;
                    Stingray.loadingStatus.status = 'Loading file';
                    var intervalObject = setInterval(() => {
                        if (Stingray.loadingStatus.loading) {
                            // keep waiting
                        } else {
                            clearInterval(intervalObject);
                            Stingray.contents.send('end-waiting');
                            Stingray.contents.send('set-status', '');
                            if (Stingray.loadingStatus.loadError !== '') {
                                dialog.showErrorBox('Error', Stingray.loadingStatus.loadError);
                            } else {
                                Stingray.saved = true;
                                Stingray.getFileInfo();
                                Stingray.saveRecent(Stingray.currentFile);
                            }
                        }
                        Stingray.getLoadingStatus();
                    }, 500);
                } else {
                    Stingray.contents.send('end-waiting');
                    Stingray.contents.send('set-status', '');
                    dialog.showErrorBox('Error', data.reason);
                }
            },
            function error(reason: string) {
                Stingray.contents.send('end-waiting');
                Stingray.contents.send('set-status', '');
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static getLoadingStatus(): void {
        this.sendRequest('/loadingStatus', {},
            function success(data: any) {
                Stingray.loadingStatus = data;
            },
            function error(reason: string) {
                Stingray.loadingStatus.loading = false;
                Stingray.loadingStatus.LoadError = reason;
                Stingray.loadingStatus.status = '';
            }
        );
    }

    static getFileInfo(): void {
        this.sendRequest('/getFileInfo', {},
            function success(data: any) {
                Stingray.srcLang = data.srcLang.code;
                Stingray.tgtLang = data.tgtLang.code;
                Stingray.contents.send('file-info', data);
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static getRows(params: any): void {
        this.sendRequest('/getRows', params,
            function success(data: any) {
                Stingray.contents.send('set-rows', data);
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static firstPage(): void {
        this.contents.send('first-page');
    }

    static previousPage(): void {
        this.contents.send('previous-page');
    }

    static nextPage(): void {
        this.contents.send('next-page');
    }

    static lastPage(): void {
        this.contents.send('last-page');
    }

    static closeFile(): void {
        if (this.currentFile === '') {
            return;
        }
        if (!this.saved) {
            let clicked: number = dialog.showMessageBoxSync(Stingray.mainWindow, {
                type: 'question',
                title: 'Save changes?',
                message: 'Your changes  will be lost if you don\'t save them',
                buttons: ['Don\'t Save', 'Cancel', 'Save'],
                defaultId: 2
            });
            if (clicked === 0) {
                Stingray.saved = true;
                Stingray.mainWindow.setDocumentEdited(false);
                if (this.shouldQuit) {
                    app.quit();
                }
            }
            if (clicked === 1) {
                this.shouldQuit = false;
                return;
            }
            if (clicked === 2) {
                this.saveFile();
                return;
            }
        }
        if (!this.shouldQuit) {
            this.sendRequest('/closeFile', {},
                function success(data: any) {
                    Stingray.saved = true;
                    Stingray.mainWindow.setDocumentEdited(false);
                    Stingray.contents.send('clear-file');
                },
                function error(reason: string) {
                    dialog.showErrorBox('Error', reason);
                }
            );
        }
    }

    static saveFile(): void {
        if (this.currentFile === '') {
            return;
        }
        this.contents.send('start-waiting');
        this.contents.send('set-status', 'Saving file');
        this.sendRequest("/saveFile", {},
            function success(data: any) {
                if (data.status === 'Success') {
                    Stingray.savingStatus.saving = true;
                    Stingray.savingStatus.status = 'Saving file';
                    var intervalObject = setInterval(() => {
                        if (Stingray.savingStatus.saving) {
                            // keep waiting
                        } else {
                            clearInterval(intervalObject);
                            Stingray.contents.send('end-waiting');
                            Stingray.contents.send('set-status', '');
                            if (Stingray.savingStatus.saveError !== '') {
                                dialog.showErrorBox('Error', Stingray.savingStatus.saveError);
                            } else {
                                Stingray.saved = true;
                                Stingray.mainWindow.setDocumentEdited(false);
                                if (Stingray.shouldQuit) {
                                    app.quit();
                                }
                            }
                        }
                        Stingray.getSavingStatus();
                    }, 200);
                } else {
                    Stingray.contents.send('end-waiting');
                    Stingray.contents.send('set-status', '');
                    dialog.showErrorBox('Error', data.reason);
                }

            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static getSavingStatus(): void {
        this.sendRequest('/savingStatus', {},
            function success(data: any) {
                Stingray.savingStatus = data;
            },
            function error(reason: string) {
                Stingray.savingStatus.saving = false;
                Stingray.savingStatus.saveError = reason;
                Stingray.savingStatus.status = '';
            }
        );
    }

    static saveFileAs(): void {
        if (this.currentFile === '') {
            return;
        }
        dialog.showSaveDialog(this.mainWindow, {
            title: 'Save Alignment As...',
            properties: ['createDirectory', 'showOverwriteConfirmation'],
            filters: [
                { name: 'Alignment File', extensions: ['algn'] },
                { name: 'Any File', extensions:['*'] }
            ],
            defaultPath: Stingray.currentFile
        }).then((value) => {
            if (!value.canceled) {
                this.currentFile = value.filePath;
                this.sendRequest('/renameFile', { file: this.currentFile },
                    function success(data: any) {
                        Stingray.contents.send('file-renamed', Stingray.currentFile);
                        Stingray.saveFile();
                        Stingray.saveRecent(Stingray.currentFile);
                    },
                    function error(reason: string) {
                        dialog.showErrorBox('Error', reason);
                    }
                );
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    static exportTMX(): void {
        if (this.currentFile === '') {
            return;
        }
        dialog.showSaveDialog(this.mainWindow, {
            title: 'Export TMX',
            properties: ['createDirectory', 'showOverwriteConfirmation'],
            filters: [
                { name: 'TMX File', extensions: ['tmx'] },
                { name: 'Any File', extensions:['*'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                this.sendRequest("/exportTMX", { file: value.filePath },
                    function success(data: any) {
                        dialog.showMessageBox(Stingray.mainWindow, { type: 'info', message: 'File exported' });
                    },
                    function error(reason: string) {
                        dialog.showErrorBox('Error', reason);
                    }
                );
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    static exportCSV(): void {
        if (this.currentFile === '') {
            return;
        }
        dialog.showSaveDialog(this.mainWindow, {
            title: 'Export TAB Delimited',
            properties: ['createDirectory', 'showOverwriteConfirmation'],
            filters: [
                { name: 'CSV File', extensions: ['csv'] },
                { name: 'Text File', extensions: ['txt'] },
                { name: 'Any File', extensions:['*'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                this.sendRequest("/exportCSV", { file: value.filePath },
                    function success(data: any) {
                        dialog.showMessageBox(Stingray.mainWindow, { type: 'info', message: 'File exported' });
                    },
                    function error(reason: string) {
                        dialog.showErrorBox('Error', reason);
                    }
                );
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    static removeTags(): void {
        if (this.currentFile === '') {
            return;
        }
        this.contents.send('start-waiting');
        this.sendRequest("/removeTags", {},
            function success(data: any) {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.contents.send('end-waiting');
                Stingray.contents.send('refresh-page');
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static removeDuplicates(): void {
        if (this.currentFile === '') {
            return;
        }
        this.contents.send('start-waiting');
        this.sendRequest("/removeDuplicates", {},
            function success(data: any) {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.contents.send('end-waiting');
                Stingray.getFileInfo();
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static changeLanguages(): void {
        if (this.currentFile === '') {
            return;
        }
        this.changeLanguagesWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: this.getWidth('changeLanguagesWindow'),
            useContentSize: true,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true
            }
        });
        this.changeLanguagesWindow.setMenu(null);
        this.changeLanguagesWindow.on('closed', () => {
            this.mainWindow.focus();
        });
        this.changeLanguagesWindow.loadURL(this.path.join('file://', app.getAppPath(), 'html', 'changeLanguages.html'));
        this.changeLanguagesWindow.once('ready-to-show', (event: IpcMainEvent) => {
            event.sender.send('get-height');
            this.changeLanguagesWindow.show();
        });
    }

    static replaceText(): void {
        if (this.currentFile === '') {
            return;
        }
        this.replaceTextWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: this.getWidth('replaceTextWindow'),
            useContentSize: true,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true
            }
        });
        this.replaceTextWindow.setMenu(null);
        this.replaceTextWindow.on('closed', () => {
            this.mainWindow.focus();
        });
        this.replaceTextWindow.loadURL(this.path.join('file://', app.getAppPath(), 'html', 'searchReplace.html'));
        this.replaceTextWindow.once('ready-to-show', (event: IpcMainEvent) => {
            event.sender.send('get-height');
            this.replaceTextWindow.show();
        });
    }

    static replace(data: any): void {
        this.sendRequest('/replaceText', data,
            function success(data: any) {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.contents.send('refresh-page');
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static saveEdit(): void {
        if (this.currentFile === '') {
            return;
        }
        this.contents.send('save-edit');
    }

    static cancelEdit(): void {
        if (this.currentFile === '') {
            return;
        }
        this.contents.send('cancel-edit');
    }

    static moveSegmentDown(): void {
        if (this.currentFile === '') {
            return;
        }
        this.contents.send('move-down');
    }

    static moveSegmentUp(): void {
        if (this.currentFile === '') {
            return;
        }
        this.contents.send('move-up');
    }

    static splitSegment(): void {
        if (this.currentFile === '') {
            return;
        }
        this.contents.send('split-segment');
    }

    static mergeSegment(): void {
        if (this.currentFile === '') {
            return;
        }
        this.contents.send('merge-segment');
    }

    static removeSegment(): void {
        if (this.currentFile === '') {
            return;
        }
        this.contents.send('remove-segment');
    }

    static loadRecents(): string[] {
        let recentsFile = this.path.join(app.getPath('appData'), app.name, 'recent.json');
        if (!existsSync(recentsFile)) {
            return [];
        }
        try {
            var data: Buffer = readFileSync(recentsFile);
            let recents = JSON.parse(data.toString());
            let list: string[] = [];
            let length = recents.files.length;
            for (let i = 0; i < length; i++) {
                let file: string = recents.files[i];
                if (existsSync(file)) {
                    list.push(file);
                }
            }
            return list;
        } catch (err) {
            console.log(err);
            return [];
        }
    }

    static saveRecent(file: string) {
        let recentsFile = this.path.join(app.getPath('appData'), app.name, 'recent.json');
        let files: string[] = this.loadRecents();
        files = files.filter(function (f: string) {
            return f !== file;
        });
        files.unshift(file);
        if (files.length > 5) {
            files = files.slice(0, 5);
        }
        let jsonData: any = { files: files };
        writeFile(recentsFile, JSON.stringify(jsonData), function (error) {
            if (error) {
                dialog.showMessageBox({ type: 'error', message: error.message });
                return;
            }
        });
    }

    static setLanguages(langs: any): void {
        this.changeLanguagesWindow.close();
        Stingray.mainWindow.focus();
        this.sendRequest('/setLanguages', langs,
            function success(data: any) {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.getFileInfo();
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static saveData(data: any): void {
        this.sendRequest('/saveData', data,
            function success(data: any) {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.contents.send('refresh-page');
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static split(data: any): void {
        this.sendRequest('/splitSegment', data,
            function success(data: any) {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.contents.send('refresh-page');
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static segmentDown(data: any): void {
        this.sendRequest('/segmentDown', data,
            function success(data: any) {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.contents.send('refresh-page');
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static segmentUp(data: any): void {
        this.sendRequest('/segmentUp', data,
            function success(data: any) {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.contents.send('refresh-page');
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static mergeNext(data: any): void {
        this.sendRequest('/mergeNext', data,
            function success(data: any) {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.contents.send('refresh-page');
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static removeData(data: any): void {
        this.sendRequest('/removeSegment', data,
            function success(data: any) {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.contents.send('refresh-page');
            },
            function error(reason: string) {
                dialog.showErrorBox('Error', reason);
            }
        );
    }
}

new Stingray();
