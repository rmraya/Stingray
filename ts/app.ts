/*******************************************************************************
 * Copyright (c) 2008 - 2024 Maxprograms.
 *
 * This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License 1.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/org/documents/epl-v10.html
 *
 * Contributors:
 *     Maxprograms - initial API and implementation
 *******************************************************************************/

import { ChildProcessWithoutNullStreams, execFileSync, spawn } from "child_process";
import { app, BrowserWindow, dialog, ipcMain, IpcMainEvent, Menu, MenuItem, nativeTheme, net, session, Rectangle, shell } from "electron";
import { IncomingMessage } from "electron/main";
import { appendFileSync, existsSync, readFileSync, writeFile, writeFileSync, unlinkSync } from "fs";
import { ClientRequest, request } from "http";
import { Locations, Point } from "./locations";

class Stingray {

    static path = require('path');
    static https = require('https');

    static mainWindow: BrowserWindow;
    static messagesWindow: BrowserWindow;
    static aboutWindow: BrowserWindow;
    static licensesWindow: BrowserWindow;
    static settingsWindow: BrowserWindow;
    static newFileWindow: BrowserWindow;
    static changeLanguagesWindow: BrowserWindow;
    static replaceTextWindow: BrowserWindow;
    static updatesWindow: BrowserWindow;
    static systemInfoWindow: BrowserWindow;

    static alignmentStatus: any = { aligning: false, alignError: '', status: '' };
    static loadingStatus: any = { loading: false, loadError: '', status: '' };
    static savingStatus: any = { saving: false, saveError: '', status: '' };

    static currentPreferences: Preferences;
    static currentTheme: string;
    static locations: Locations;
    currentDefaults: Rectangle;

    javapath: string = Stingray.path.join(app.getAppPath(), 'bin', 'java');
    ls: ChildProcessWithoutNullStreams;

    static currentFile: string;
    static srcLang: string;
    static tgtLang: string;
    static saved: boolean = true;
    static shouldQuit: boolean;
    stopping: boolean = false;

    static argFile: string = '';
    static isReady: boolean = false;

    static messageParam: any;
    static latestVersion: string;
    static downloadLink: string;

    constructor(args: string[]) {
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
        if (process.platform === 'win32' && args.length > 1 && args[1] !== '.') {
            Stingray.argFile = ''
            for (let i = 1; i < args.length; i++) {
                if (args[i] !== '.') {
                    if (Stingray.argFile !== '') {
                        Stingray.argFile = Stingray.argFile + ' ';
                    }
                    Stingray.argFile = Stingray.argFile + args[i];
                }
            }
        }
        if (process.platform === 'win32') {
            this.javapath = Stingray.path.join(app.getAppPath(), 'bin', 'java.exe');
        }

        this.ls = spawn(this.javapath, ['--module-path', 'lib', '-m', 'stingray/com.maxprograms.stingray.StingrayServer', '-port', '8040'], { cwd: app.getAppPath(), windowsHide: true });
        if (!app.isPackaged) {
            this.ls.stdout.on('data', (data: Buffer | string) => {
                console.log(data instanceof Buffer ? data.toString() : data);
            });
            this.ls.stderr.on('data', (data: Buffer | string) => {
                console.error(data instanceof Buffer ? data.toString() : data);
            });
        }
        execFileSync(this.javapath, ['--module-path', 'lib', '-m', 'stingray/com.maxprograms.stingray.CheckURL', 'http://localhost:8040/'], { cwd: app.getAppPath(), windowsHide: true });

        Stingray.locations = new Locations(Stingray.path.join(app.getPath('appData'), app.name, 'locations.json'));
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
            Stingray.loadPreferences();
            this.createWindow();
            Stingray.mainWindow.loadURL(Stingray.path.join('file://', app.getAppPath(), 'html/index.html'));
            Stingray.mainWindow.on('resize', () => {
                this.saveDefaults();
            });
            Stingray.mainWindow.on('move', () => {
                this.saveDefaults();
            });
            Stingray.mainWindow.once('ready-to-show', () => {
                Stingray.isReady = true;
                Stingray.mainWindow.setBounds(this.currentDefaults);
                Stingray.setLocation(Stingray.mainWindow, 'index.html');
                Stingray.mainWindow.show();
                Stingray.checkUpdates(true);
                Stingray.mainLoaded();
                if (process.platform === 'darwin' && app.runningUnderARM64Translation) {
                    Stingray.showMessage({
                        type: 'warning',
                        message: 'You are running a version for Macs with Intel processors on a Mac with Apple M1 chipset.'
                    });
                }
            });
            Stingray.mainWindow.on('close', (ev) => {
                if (!Stingray.saved) {
                    Stingray.shouldQuit = true;
                    Stingray.closeFile();
                    ev.preventDefault();
                }
            });
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
        app.on('open-file', (event, filePath) => {
            event.preventDefault();
            if (Stingray.isReady) {
                Stingray.openFile(filePath);
            } else {
                Stingray.argFile = filePath;
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
        ipcMain.on('get-message-param', (event: IpcMainEvent) => {
            event.sender.send('set-message', Stingray.messageParam);
        });
        ipcMain.on('get-theme', (event: IpcMainEvent) => {
            event.sender.send('set-theme', Stingray.currentTheme);
        });
        ipcMain.on('set-height', (event: IpcMainEvent, arg: { window: string, width: number, height: number }) => {
            Stingray.setHeight(arg);
        });
        ipcMain.on('get-version', (event: IpcMainEvent) => {
            event.sender.send('set-version', app.name + ' ' + app.getVersion());
        });
        ipcMain.on('replace-text', () => {
            Stingray.replaceText();
        })
        ipcMain.on('replace-request', (event: IpcMainEvent, arg: any) => {
            Stingray.replace(arg);
        });
        ipcMain.on('browse-srx', (event: IpcMainEvent) => {
            this.browseSRX(event);
        });
        ipcMain.on('browse-catalog', (event: IpcMainEvent) => {
            this.browseCatalog(event);
        });
        ipcMain.on('browse-alignment', (event: IpcMainEvent) => {
            this.browseAlignment(event);
        });
        ipcMain.on('browse-source', (event: IpcMainEvent) => {
            this.browseSource(event);
        });
        ipcMain.on('browse-target', (event: IpcMainEvent) => {
            this.browseTarget(event);
        });
        ipcMain.on('save-preferences', (event: IpcMainEvent, arg: Preferences) => {
            Stingray.destroyWindow(Stingray.settingsWindow);
            Stingray.mainWindow.focus();
            Stingray.currentPreferences = arg;
            Stingray.savePreferences();
        });
        ipcMain.on('get-preferences', (event: IpcMainEvent) => {
            event.sender.send('set-preferences', Stingray.currentPreferences);
        });
        ipcMain.on('system-info-clicked', () => {
            Stingray.showSystemInfo();
        });
        ipcMain.on('close-systemInfo', () => {
            Stingray.destroyWindow(Stingray.systemInfoWindow);
        });
        ipcMain.on('get-system-info', (event: IpcMainEvent) => {
            Stingray.getSystemInformation(event);
        });
        ipcMain.on('licenses-clicked', () => {
            Stingray.showLicenses('about');
        });
        ipcMain.on('open-license', (event: IpcMainEvent, arg: any) => {
            Stingray.openLicense(arg.type);
        })
        ipcMain.on('show-help', () => {
            Stingray.showHelp();
        });
        ipcMain.on('get-languages', (event: IpcMainEvent) => {
            this.getLanguages(event);
        });
        ipcMain.on('get-types', (event: IpcMainEvent) => {
            this.getTypes(event);
        });
        ipcMain.on('get-charsets', (event: IpcMainEvent) => {
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
        ipcMain.on('export-excel', () => {
            Stingray.exportExcel();
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
        ipcMain.on('create-alignment', (event: IpcMainEvent, arg: any) => {
            Stingray.createAlignment(arg);
        });
        ipcMain.on('get-rows', (event: IpcMainEvent, arg: any) => {
            Stingray.getRows(arg);
        });
        ipcMain.on('file-languages', (event: IpcMainEvent) => {
            event.sender.send('language-pair', { srcLang: Stingray.srcLang, tgtLang: Stingray.tgtLang });
        });
        ipcMain.on('save-languages', (event: IpcMainEvent, arg: any) => {
            Stingray.setLanguages(arg);
        });
        ipcMain.on('save-data', (event: IpcMainEvent, arg: any) => {
            Stingray.saveData(arg);
        });
        ipcMain.on('split-data', (event: IpcMainEvent, arg: any) => {
            Stingray.split(arg);
        });
        ipcMain.on('segment-down', (event: IpcMainEvent, arg: any) => {
            Stingray.segmentDown(arg);
        });
        ipcMain.on('segment-up', (event: IpcMainEvent, arg: any) => {
            Stingray.segmentUp(arg);
        });
        ipcMain.on('merge-next', (event: IpcMainEvent, arg: any) => {
            Stingray.mergeNext(arg);
        });
        ipcMain.on('remove-data', (event: IpcMainEvent, arg: any) => {
            Stingray.removeData(arg);
        });
        ipcMain.on('close-about', () => {
            Stingray.destroyWindow(Stingray.aboutWindow);
        });
        ipcMain.on('close-change=languages', () => {
            Stingray.destroyWindow(Stingray.changeLanguagesWindow);
        });
        ipcMain.on('close-licenses', () => {
            Stingray.destroyWindow(Stingray.licensesWindow);
        });
        ipcMain.on('close-messages', () => {
            Stingray.destroyWindow(Stingray.messagesWindow);
        });
        ipcMain.on('close-new-file', () => {
            Stingray.destroyWindow(Stingray.newFileWindow);
        });
        ipcMain.on('close-preferences', () => {
            Stingray.destroyWindow(Stingray.settingsWindow);
        });
        ipcMain.on('close-search-replace', () => {
            Stingray.destroyWindow(Stingray.replaceTextWindow);
        });
        ipcMain.on('get-versions', (event: IpcMainEvent) => {
            event.sender.send('set-versions', { current: app.getVersion(), latest: Stingray.latestVersion });
        });
        ipcMain.on('close-updates', () => {
            Stingray.destroyWindow(Stingray.updatesWindow);
        });
        ipcMain.on('release-history', () => {
            Stingray.showReleaseHistory();
        });
        ipcMain.on('download-latest', () => {
            Stingray.downloadLatest();
        });
    }

    static destroyWindow(window: BrowserWindow): void {
        if (window) {
            try {
                let parent: BrowserWindow = window.getParentWindow();
                window.hide();
                window.destroy();
                window = undefined;
                if (parent) {
                    parent.focus();
                } else {
                    Stingray.mainWindow.focus();
                }
            } catch (e) {
                console.log(e);
            }
        }
    }

    stopServer(): void {
        if (!this.stopping) {
            this.stopping = true;
            this.ls.kill(15);
        }
    }

    static setHeight(arg: { window: string, width: number, height: number }): void {
        if ('about' === arg.window) {
            this.aboutWindow.setContentSize(arg.width, arg.height, true);
        }
        if ('licenses' === arg.window) {
            this.licensesWindow.setContentSize(arg.width, arg.height, true);
        }
        if ('preferences' === arg.window) {
            this.settingsWindow.setContentSize(arg.width, arg.height, true);
        }
        if ('replaceText' === arg.window) {
            this.replaceTextWindow.setContentSize(arg.width, arg.height, true);
        }
        if ('systemInfo' === arg.window) {
            this.systemInfoWindow.setContentSize(arg.width, arg.height, true);
        }
        if ('newFile' === arg.window) {
            this.newFileWindow.setContentSize(arg.width, arg.height, true);
        }
        if ('messages' === arg.window) {
            this.messagesWindow.setContentSize(arg.width, arg.height, true);
        }
        if ('languages' === arg.window) {
            this.changeLanguagesWindow.setContentSize(arg.width, arg.height, true);
        }
        if ('updates' === arg.window) {
            this.updatesWindow.setContentSize(arg.width, arg.height, true);
        }
    }

    static mainLoaded(): void {
        if (Stingray.argFile !== '') {
            setTimeout(() => {
                Stingray.openFile(Stingray.argFile);
                Stingray.argFile = '';
            }, 2000);

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
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            show: false,
            icon: Stingray.path.join(app.getAppPath(), 'icons', 'icon.png')
        });
        let fileMenu: Menu = Menu.buildFromTemplate([
            { label: 'New Alignment', accelerator: 'CmdOrCtrl+N', click: () => { Stingray.newFile(); } },
            { label: 'Open Alignment', accelerator: 'CmdOrCtrl+O', click: () => { Stingray.openFileDialog(); } },
            { label: 'Close Alignment', accelerator: 'CmdOrCtrl+W', click: () => { Stingray.closeFile(); } },
            { label: 'Save Alignment', accelerator: 'CmdOrCtrl+S', click: () => { Stingray.saveFile(); } },
            { label: 'Save Alignment As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => { Stingray.saveFileAs(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Export Aligment as TMX', click: () => { Stingray.exportTMX(); } },
            { label: 'Export Aligment as Excel', click: () => { Stingray.exportExcel(); } },
            { label: 'Export Alignment as TAB Delimited', click: () => { Stingray.exportCSV(); } }
        ]);
        let recentFiles: string[] = Stingray.loadRecents();
        if (recentFiles.length > 0) {
            fileMenu.append(new MenuItem({ type: 'separator' }));
            let length: number = recentFiles.length;
            for (let i = 0; i < length; i++) {
                let file: string = recentFiles[i];
                fileMenu.append(new MenuItem({ label: file, click: () => { Stingray.openFile(file) } }));
            }
        }
        let editMenu: Menu = Menu.buildFromTemplate([
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
            { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => { BrowserWindow.getFocusedWindow().webContents.undo(); } },
            { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: () => { BrowserWindow.getFocusedWindow().webContents.cut(); } },
            { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => { BrowserWindow.getFocusedWindow().webContents.copy(); } },
            { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: () => { BrowserWindow.getFocusedWindow().webContents.paste(); } },
            { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => { BrowserWindow.getFocusedWindow().webContents.selectAll(); } }
        ]);
        let viewMenu: Menu = Menu.buildFromTemplate([
            { label: 'First Page', accelerator: 'CmdOrCtrl+Home', click: () => { Stingray.firstPage(); } },
            { label: 'Previous Page', accelerator: 'CmdOrCtrl+PageUp', click: () => { Stingray.previousPage(); } },
            { label: 'Next Page', accelerator: 'CmdOrCtrl+PageDown', click: () => { Stingray.nextPage(); } },
            { label: 'Last Page', accelerator: 'CmdOrCtrl+End', click: () => { Stingray.lastPage(); } },
            new MenuItem({ type: 'separator' }),
            new MenuItem({ label: 'Toggle Full Screen', role: 'togglefullscreen' }),
            new MenuItem({ label: 'Toggle Development Tools', accelerator: 'F12', role: 'toggleDevTools' })
        ]);
        let tasksMenu: Menu = Menu.buildFromTemplate([
            { label: 'Remove all Tags', click: () => { Stingray.removeTags(); } },
            { label: 'Remove Duplicate Entries', click: () => { Stingray.removeDuplicates(); } },
            { label: 'Change Language Codes', click: () => { Stingray.changeLanguages(); } },
        ]);
        let helpMenu: Menu = Menu.buildFromTemplate([
            { label: 'Stingray User Guide', accelerator: 'F1', click: () => { Stingray.showHelp(); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Check for Updates...', click: () => { Stingray.checkUpdates(false); } },
            { label: 'View Licenses', click: () => { Stingray.showLicenses('main'); } },
            new MenuItem({ type: 'separator' }),
            { label: 'Release History', click: () => { Stingray.showReleaseHistory(); } },
            { label: 'Support Group', click: () => { Stingray.showSupportGroup(); } }
        ]);
        let template: MenuItem[] = [
            new MenuItem({ label: '&File', role: 'fileMenu', submenu: fileMenu }),
            new MenuItem({ label: '&Edit', role: 'editMenu', submenu: editMenu }),
            new MenuItem({ label: '&View', role: 'viewMenu', submenu: viewMenu }),
            new MenuItem({ label: '&Tasks', submenu: tasksMenu }),
            new MenuItem({ label: '&Help', role: 'help', submenu: helpMenu })
        ];
        if (process.platform === 'darwin') {
            let appleMenu: Menu = Menu.buildFromTemplate([
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
            let help: MenuItem = template.pop();
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
                let data: Buffer = readFileSync(defaultsFile);
                this.currentDefaults = JSON.parse(data.toString());
            } catch (err) {
                console.log(err);
            }
        }
    }

    static loadPreferences(): void {
        let preferencesFile = this.path.join(app.getPath('appData'), app.name, 'preferences.json');
        if (!existsSync(preferencesFile)) {
            this.currentPreferences = {
                srcLang: 'none',
                tgtLang: 'none',
                theme: 'system',
                catalog: this.path.join(app.getAppPath(), 'catalog', 'catalog.xml'),
                srx: this.path.join(app.getAppPath(), 'srx', 'default.srx')
            };
            this.savePreferences();
        }
        try {
            let data: Buffer = readFileSync(preferencesFile);
            this.currentPreferences = JSON.parse(data.toString());
        } catch (err) {
            console.log(err);
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
        writeFileSync(preferencesFile, JSON.stringify(this.currentPreferences, null, 2));
        this.loadPreferences();
    }

    saveDefaults(): void {
        let defaultsFile: string = Stingray.path.join(app.getPath('appData'), app.name, 'defaults.json');
        writeFileSync(defaultsFile, JSON.stringify(Stingray.mainWindow.getBounds()));
    }

    static setTheme(): void {
        let windows: BrowserWindow[] = BrowserWindow.getAllWindows();
        for (let window of windows) {
            window.webContents.send('set-theme', this.currentTheme);
        }
    }

    static checkUpdates(silent: boolean): void {
        session.defaultSession.clearCache().then(() => {
            let req: Electron.ClientRequest = net.request({
                url: 'https://maxprograms.com/stingray.json',
                session: session.defaultSession
            });
            req.on('response', (response: IncomingMessage) => {
                let responseData: string = '';
                if (response.statusCode !== 200) {
                    if (!silent) {
                        Stingray.showMessage({
                            type: 'info',
                            message: 'Server status: ' + response.statusCode
                        });
                    }
                }
                response.on('data', (chunk: Buffer) => {
                    responseData += chunk;
                });
                response.on('end', () => {
                    try {
                        let parsedData = JSON.parse(responseData);
                        if (app.getVersion() !== parsedData.version) {
                            Stingray.latestVersion = parsedData.version;
                            switch (process.platform) {
                                case 'darwin':
                                    Stingray.downloadLink = process.arch === 'arm64' ? parsedData.arm64 : parsedData.darwin;
                                    break;
                                case 'win32':
                                    Stingray.downloadLink = parsedData.win32;
                                    break;
                                case 'linux':
                                    Stingray.downloadLink = parsedData.linux;
                                    break;
                            }
                            Stingray.updatesWindow = new BrowserWindow({
                                parent: this.mainWindow,
                                width: 590,
                                height: 240,
                                minimizable: false,
                                maximizable: false,
                                resizable: false,
                                show: false,
                                icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
                                webPreferences: {
                                    nodeIntegration: true,
                                    contextIsolation: false
                                }
                            });
                            Stingray.updatesWindow.setMenu(null);
                            Stingray.updatesWindow.loadURL('file://' + this.path.join(app.getAppPath(), 'html', 'updates.html'));
                            Stingray.updatesWindow.once('ready-to-show', () => {
                                Stingray.updatesWindow.show();
                            });
                            this.updatesWindow.on('close', () => {
                                this.mainWindow.focus();
                            });
                        } else {
                            if (!silent) {
                                Stingray.showMessage({
                                    type: 'info',
                                    message: 'There are currently no updates available'
                                });
                            }
                        }
                    } catch (reason: any) {
                        if (!silent) {
                            Stingray.showMessage({
                                type: 'error',
                                message: reason.message
                            });
                        }
                    }
                });
            });
            req.on('error', (error: Error) => {
                if (!silent) {
                    Stingray.showMessage({
                        type: 'error',
                        message: error.message
                    });
                }
            });
            req.end();
        });
    }

    static downloadLatest(): void {
        let downloadsFolder = app.getPath('downloads');
        let url: URL = new URL(Stingray.downloadLink);
        let path: string = url.pathname;
        path = path.substring(path.lastIndexOf('/') + 1);
        let file: string = downloadsFolder + (process.platform === 'win32' ? '\\' : '/') + path;
        if (existsSync(file)) {
            unlinkSync(file);
        }
        let req: Electron.ClientRequest = net.request({
            url: Stingray.downloadLink,
            session: session.defaultSession
        });
        Stingray.mainWindow.webContents.send('set-status', 'Downloading...');
        Stingray.updatesWindow.destroy();
        req.on('response', (response: IncomingMessage) => {
            let fileSize = Number.parseInt(response.headers['content-length'] as string);
            let received: number = 0;
            response.on('data', (chunk: Buffer) => {
                received += chunk.length;
                if (process.platform === 'win32' || process.platform === 'darwin') {
                    Stingray.mainWindow.setProgressBar(received / fileSize);
                }
                Stingray.mainWindow.webContents.send('set-status', 'Downloaded: ' + Math.trunc(received * 100 / fileSize) + '%');
                appendFileSync(file, chunk);
            });
            response.on('end', () => {
                Stingray.mainWindow.webContents.send('set-status', '');
                dialog.showMessageBox({
                    type: 'info',
                    message: 'Update downloaded'
                });
                if (process.platform === 'win32' || process.platform === 'darwin') {
                    Stingray.mainWindow.setProgressBar(0);
                    shell.openPath(file).then(() => {
                        app.quit();
                    }).catch((reason: string) => {
                        dialog.showErrorBox('Error', reason);
                    });
                }
                if (process.platform === 'linux') {
                    shell.showItemInFolder(file);
                }
            });
            response.on('error', (reason: string) => {
                Stingray.mainWindow.webContents.send('set-status', '');
                dialog.showErrorBox('Error', reason);
                if (process.platform === 'win32' || process.platform === 'darwin') {
                    Stingray.mainWindow.setProgressBar(0);
                }
            });
        });
        req.end();
    }

    static showAbout(): void {
        this.aboutWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: 350,
            height: 490,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        this.aboutWindow.setMenu(null);
        this.aboutWindow.on('closed', () => {
            this.mainWindow.focus();
        });
        this.aboutWindow.loadURL(this.path.join('file://', app.getAppPath(), 'html', 'about.html'));
        this.aboutWindow.once('ready-to-show', (event: IpcMainEvent) => {
            this.aboutWindow.show();
        });
        Stingray.setLocation(this.aboutWindow, 'about.html');
    }

    static showSettings(): void {
        this.settingsWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: 590,
            height: 330,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        this.settingsWindow.setMenu(null);
        this.settingsWindow.on('closed', () => {
            this.mainWindow.focus();
        });
        this.settingsWindow.loadURL(this.path.join('file://', app.getAppPath(), 'html', 'preferences.html'));
        this.settingsWindow.once('ready-to-show', (event: IpcMainEvent) => {
            this.settingsWindow.show();
        });
        Stingray.setLocation(this.settingsWindow, 'preferences.html');
    }

    static showHelp(): void {
        shell.openExternal(this.path.join('file://', app.getAppPath(), 'stingray.pdf'));
    }

    static showSystemInfo() {
        this.systemInfoWindow = new BrowserWindow({
            parent: Stingray.aboutWindow,
            width: 420,
            height: 230,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        this.systemInfoWindow.setMenu(null);
        this.systemInfoWindow.loadURL('file://' + this.path.join(app.getAppPath(), 'html', 'systemInfo.html'));
        this.systemInfoWindow.once('ready-to-show', () => {
            this.systemInfoWindow.show();
        });
        this.systemInfoWindow.on('close', () => {
            Stingray.aboutWindow.focus();
        });
        Stingray.setLocation(this.systemInfoWindow, 'systemInfo.html');
    }

    static getSystemInformation(event: IpcMainEvent) {
        this.sendRequest('/systemInfo', {},
            (data: any) => {
                if (data.status === 'Success') {
                    data.electron = process.versions.electron;
                    event.sender.send('set-system-info', data);
                } else {
                    Stingray.showMessage({ type: 'error', message: data.reason });
                }
            },
            (reason: string) => {
                Stingray.showMessage({ type: 'error', message: reason });
            }
        );
    }

    static setLocation(window: BrowserWindow, key: string): void {
        if (Stingray.locations.hasLocation(key)) {
            let position: Point = Stingray.locations.getLocation(key);
            window.setPosition(position.x, position.y, true);
        }
        window.addListener('moved', () => {
            let bounds: Rectangle = window.getBounds();
            Stingray.locations.setLocation(key, bounds.x, bounds.y);
        });
    }

    static showLicenses(from: string): void {
        let parent: BrowserWindow = from === 'about' ? this.aboutWindow : this.mainWindow;
        this.licensesWindow = new BrowserWindow({
            parent: parent,
            width: 420,
            height: 390,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        this.licensesWindow.setMenu(null);
        this.licensesWindow.loadURL('file://' + app.getAppPath() + '/html/licenses.html');
        this.licensesWindow.once('ready-to-show', (event: IpcMainEvent) => {
            this.licensesWindow.show();
        });
        Stingray.setLocation(this.licensesWindow, 'licenses.html');
    }

    static openLicense(type: string) {
        let licenseFile = '';
        let title = '';
        switch (type) {
            case 'Stingray':
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'EclipsePublicLicense1.0.html');
                title = 'Eclipse Public License 1.0';
                break;
            case "electron":
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'electron.txt');
                title = 'MIT License';
                break;
            case "MapDB":
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'Apache2.0.html');
                title = 'Apache 2.0';
                break;
            case "Java":
                licenseFile = this.path.join('file://', app.getAppPath(), 'html', 'licenses', 'java.html');
                title = 'GPL2 with Classpath Exception';
                break;
            case "OpenXLIFF":
            case "XMLJava":
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
        let licenseWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: 680,
            height: 400,
            show: false,
            title: title,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        licenseWindow.setMenu(null);
        licenseWindow.loadURL(licenseFile);
        licenseWindow.show();
    }

    static showReleaseHistory(): void {
        shell.openExternal('https://www.maxprograms.com/products/stgraylog.html');
    }

    static showSupportGroup(): void {
        shell.openExternal('https://groups.io/g/maxprograms/');
    }

    static sendRequest(url: string, json: any, success: Function, error: Function) {
        let postData: string = JSON.stringify(json);
        let options = {
            hostname: '127.0.0.1',
            port: 8040,
            path: url,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        // Make a request
        let req: ClientRequest = request(options);
        req.on('response',
            (res: any) => {
                res.setEncoding('utf-8');
                if (res.statusCode !== 200) {
                    error('sendRequest() error: ' + res.statusMessage);
                }
                let rawData: string = '';
                res.on('data', (chunk: string) => {
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
            (data: any) => {
                if (data.status === 'Success') {
                    data.srcLang = Stingray.currentPreferences.srcLang;
                    data.tgtLang = Stingray.currentPreferences.tgtLang;
                    event.sender.send('set-languages', data);
                } else {
                    dialog.showErrorBox('Error', data.reason);
                }
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    getTypes(event: IpcMainEvent): void {
        Stingray.sendRequest('/getTypes', {},
            (data: any) => {
                if (data.status === 'Success') {
                    event.sender.send('set-types', data);
                } else {
                    dialog.showErrorBox('Error', data.reason);
                }
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    getCharsets(event: IpcMainEvent): void {
        Stingray.sendRequest('/getCharsets', {},
            (data: any) => {
                if (data.status === 'Success') {
                    event.sender.send('set-charsets', data);
                } else {
                    dialog.showErrorBox('Error', data.reason);
                }
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static newFile(): void {
        this.newFileWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: 840,
            height: 370,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        this.newFileWindow.on('closed', () => {
            this.mainWindow.focus();
        });
        this.newFileWindow.setMenu(null);
        this.newFileWindow.loadURL(this.path.join('file://', app.getAppPath(), 'html', 'newFile.html'));
        this.newFileWindow.once('ready-to-show', (event: IpcMainEvent) => {
            this.newFileWindow.show();
        });
        Stingray.setLocation(this.newFileWindow, 'newFile.html');
    }

    browseSRX(event: IpcMainEvent): void {
        dialog.showOpenDialog({
            title: 'Default SRX File',
            defaultPath: Stingray.currentPreferences.srx,
            properties: ['openFile'],
            filters: [
                { name: 'SRX File', extensions: ['srx'] },
                { name: 'Any File', extensions: ['*'] }
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
                { name: 'Any File', extensions: ['*'] }
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
                { name: 'Any File', extensions: ['*'] }
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
        let filters: any[] = [
            { name: 'Any File', extensions: [] },
            { name: 'Adobe InCopy ICML', extensions: ['icml'] },
            { name: 'Adobe InDesign Interchange', extensions: ['inx'] },
            { name: 'Adobe InDesign IDML', extensions: ['idml'] },
            { name: 'DITA Map', extensions: ['ditamap', 'dita', 'xml'] },
            { name: 'HTML Page', extensions: ['html', 'htm'] },
            { name: 'JavaScript', extensions: ['js'] },
            { name: 'Java Properties', extensions: ['properties'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'MIF (Maker Interchange Format)', extensions: ['mif'] },
            { name: 'Microsoft Office 2007 Document', extensions: ['docx', 'xlsx', 'pptx'] },
            { name: 'OpenOffice 1.x Document', extensions: ['sxw', 'sxc', 'sxi', 'sxd'] },
            { name: 'OpenOffice 2.x Document', extensions: ['odt', 'ods', 'odp', 'odg'] },
            { name: 'PHP Arrays', extensions: ['php'] },
            { name: 'Plain Text', extensions: ['txt'] },
            { name: 'RC (Windows C/C++ Resources)', extensions: ['rc'] },
            { name: 'ResX (Windows .NET Resources)', extensions: ['resx'] },
            { name: 'SRT Subtitles', extensions: ['srt'] },
            { name: 'SVG (Scalable Vector Graphics)', extensions: ['svg'] },
            { name: 'Visio XML Drawing', extensions: ['vsdx'] },
            { name: 'XML Document', extensions: ['xml'] }
        ];
        if (process.platform === 'linux') {
            filters.splice(0, 1);
            filters.push({ name: 'Any File', extensions: ['*'] });
        }
        dialog.showOpenDialog({
            title: 'Source File',
            properties: ['openFile'],
            filters: filters
        }).then((value) => {
            if (!value.canceled) {
                this.getFileType(event, value.filePaths[0], 'set-source');
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    browseTarget(event: IpcMainEvent): void {
        let filters: any[] = [
            { name: 'Any File', extensions: [] },
            { name: 'Adobe InCopy ICML', extensions: ['icml'] },
            { name: 'Adobe InDesign Interchange', extensions: ['inx'] },
            { name: 'Adobe InDesign IDML', extensions: ['idml'] },
            { name: 'DITA Map', extensions: ['ditamap', 'dita', 'xml'] },
            { name: 'HTML Page', extensions: ['html', 'htm'] },
            { name: 'JavaScript', extensions: ['js'] },
            { name: 'Java Properties', extensions: ['properties'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'MIF (Maker Interchange Format)', extensions: ['mif'] },
            { name: 'Microsoft Office 2007 Document', extensions: ['docx', 'xlsx', 'pptx'] },
            { name: 'OpenOffice 1.x Document', extensions: ['sxw', 'sxc', 'sxi', 'sxd'] },
            { name: 'OpenOffice 2.x Document', extensions: ['odt', 'ods', 'odp', 'odg'] },
            { name: 'PHP Arrays', extensions: ['php'] },
            { name: 'Plain Text', extensions: ['txt'] },
            { name: 'RC (Windows C/C++ Resources)', extensions: ['rc'] },
            { name: 'ResX (Windows .NET Resources)', extensions: ['resx'] },
            { name: 'SRT Subtitles', extensions: ['srt'] },
            { name: 'SVG (Scalable Vector Graphics)', extensions: ['svg'] },
            { name: 'Visio XML Drawing', extensions: ['vsdx'] },
            { name: 'XML Document', extensions: ['xml'] }
        ];
        if (process.platform === 'linux') {
            filters.splice(0, 1);
            filters.push({ name: 'Any File', extensions: ['*'] });
        }
        dialog.showOpenDialog({
            title: 'Target File',
            properties: ['openFile'],
            filters: filters
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
            (data: any) => {
                event.sender.send(arg, data);
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static createAlignment(params: any): void {
        this.destroyWindow(this.newFileWindow);
        this.mainWindow.focus();
        Stingray.mainWindow.webContents.send('start-waiting');
        Stingray.mainWindow.webContents.send('set-status', 'Preparing files');
        params.catalog = Stingray.currentPreferences.catalog;
        params.srx = Stingray.currentPreferences.srx;
        this.sendRequest('/alignFiles', params,
            (data: any) => {
                if (data.status === 'Success') {
                    Stingray.alignmentStatus.aligning = true;
                    Stingray.alignmentStatus.status = 'Preparing files';
                    let intervalObject = setInterval(() => {
                        if (Stingray.alignmentStatus.aligning) {
                            Stingray.mainWindow.webContents.send('set-status', Stingray.alignmentStatus.status);
                        } else {
                            clearInterval(intervalObject);
                            Stingray.mainWindow.webContents.send('end-waiting');
                            Stingray.mainWindow.webContents.send('set-status', '');
                            if (Stingray.alignmentStatus.alignError !== '') {
                                dialog.showErrorBox('Error', Stingray.alignmentStatus.alignError);
                            } else {
                                Stingray.openFile(params.alignmentFile);
                                let save: boolean = false;
                                if (Stingray.currentPreferences.srcLang === 'none') {
                                    Stingray.currentPreferences.srcLang = params.srcLang;
                                    save = true;
                                }
                                if (Stingray.currentPreferences.tgtLang === 'none') {
                                    Stingray.currentPreferences.tgtLang = params.tgtLang;
                                    save = true;
                                }
                                if (save) {
                                    Stingray.savePreferences();
                                }
                            }
                        }
                        Stingray.getAlignmentStatus();
                    }, 500);
                } else {
                    Stingray.mainWindow.webContents.send('end-waiting');
                    Stingray.mainWindow.webContents.send('set-status', '');
                    dialog.showErrorBox('Error', data.reason);
                }
            },
            (reason: string) => {
                Stingray.mainWindow.webContents.send('end-waiting');
                Stingray.mainWindow.webContents.send('set-status', '');
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static getAlignmentStatus(): void {
        this.sendRequest('/alignmentStatus', {},
            (data: any) => {
                Stingray.alignmentStatus = data;
            },
            (reason: string) => {
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
                { name: 'Any File', extensions: ['*'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                Stingray.openFile(value.filePaths[0]);
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    static openFile(file: string): void {
        if (this.currentFile !== '') {
            this.closeFile();
        }
        Stingray.mainWindow.webContents.send('start-waiting');
        Stingray.mainWindow.webContents.send('set-status', 'Loading file');
        this.sendRequest('/openFile', { file: file },
            (data: any) => {
                if (data.status === 'Success') {
                    Stingray.loadingStatus.loading = true;
                    Stingray.loadingStatus.status = 'Loading file';
                    let intervalObject = setInterval(() => {
                        if (Stingray.loadingStatus.loading) {
                            // keep waiting
                        } else {
                            clearInterval(intervalObject);
                            Stingray.mainWindow.webContents.send('end-waiting');
                            Stingray.mainWindow.webContents.send('set-status', '');
                            if (Stingray.loadingStatus.loadError !== '') {
                                dialog.showErrorBox('Error', Stingray.loadingStatus.loadError);
                            } else {
                                Stingray.currentFile = file;
                                Stingray.saved = true;
                                Stingray.getFileInfo();
                                Stingray.saveRecent(Stingray.currentFile);
                            }
                        }
                        Stingray.getLoadingStatus();
                    }, 500);
                } else {
                    Stingray.mainWindow.webContents.send('end-waiting');
                    Stingray.mainWindow.webContents.send('set-status', '');
                    dialog.showErrorBox('Error', data.reason);
                }
            },
            (reason: string) => {
                Stingray.mainWindow.webContents.send('end-waiting');
                Stingray.mainWindow.webContents.send('set-status', '');
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static getLoadingStatus(): void {
        this.sendRequest('/loadingStatus', {},
            (data: any) => {
                Stingray.loadingStatus = data;
            },
            (reason: string) => {
                Stingray.loadingStatus.loading = false;
                Stingray.loadingStatus.LoadError = reason;
                Stingray.loadingStatus.status = '';
            }
        );
    }

    static getFileInfo(): void {
        this.sendRequest('/getFileInfo', {},
            (data: any) => {
                Stingray.srcLang = data.srcLang.code;
                Stingray.tgtLang = data.tgtLang.code;
                Stingray.mainWindow.webContents.send('file-info', data);
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static getRows(params: any): void {
        this.sendRequest('/getRows', params,
            (data: any) => {
                Stingray.mainWindow.webContents.send('set-rows', data);
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static firstPage(): void {
        Stingray.mainWindow.webContents.send('first-page');
    }

    static previousPage(): void {
        Stingray.mainWindow.webContents.send('previous-page');
    }

    static nextPage(): void {
        Stingray.mainWindow.webContents.send('next-page');
    }

    static lastPage(): void {
        Stingray.mainWindow.webContents.send('last-page');
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
                (data: any) => {
                    Stingray.saved = true;
                    Stingray.mainWindow.setDocumentEdited(false);
                    Stingray.mainWindow.webContents.send('clear-file');
                },
                (reason: string) => {
                    dialog.showErrorBox('Error', reason);
                }
            );
        }
    }

    static saveFile(): void {
        if (this.currentFile === '') {
            return;
        }
        Stingray.mainWindow.webContents.send('start-waiting');
        Stingray.mainWindow.webContents.send('set-status', 'Saving file');
        this.sendRequest("/saveFile", {},
            (data: any) => {
                if (data.status === 'Success') {
                    Stingray.savingStatus.saving = true;
                    Stingray.savingStatus.status = 'Saving file';
                    let intervalObject = setInterval(() => {
                        if (Stingray.savingStatus.saving) {
                            // keep waiting
                        } else {
                            clearInterval(intervalObject);
                            Stingray.mainWindow.webContents.send('end-waiting');
                            Stingray.mainWindow.webContents.send('set-status', '');
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
                    Stingray.mainWindow.webContents.send('end-waiting');
                    Stingray.mainWindow.webContents.send('set-status', '');
                    dialog.showErrorBox('Error', data.reason);
                }

            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static getSavingStatus(): void {
        this.sendRequest('/savingStatus', {},
            (data: any) => {
                Stingray.savingStatus = data;
            },
            (reason: string) => {
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
                { name: 'Any File', extensions: ['*'] }
            ],
            defaultPath: Stingray.currentFile
        }).then((value) => {
            if (!value.canceled) {
                this.currentFile = value.filePath;
                this.sendRequest('/renameFile', { file: this.currentFile },
                    (data: any) => {
                        Stingray.mainWindow.webContents.send('file-renamed', Stingray.currentFile);
                        Stingray.saveFile();
                        Stingray.saveRecent(Stingray.currentFile);
                    },
                    (reason: string) => {
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
                { name: 'Any File', extensions: ['*'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                this.sendRequest("/exportTMX", { file: value.filePath },
                    (data: any) => {
                        Stingray.showMessage({ type: 'info', message: 'File exported' });
                    },
                    (reason: string) => {
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
                { name: 'Any File', extensions: ['*'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                this.sendRequest("/exportCSV", { file: value.filePath },
                    (data: any) => {
                        Stingray.showMessage({ type: 'info', message: 'File exported' });
                    },
                    (reason: string) => {
                        dialog.showErrorBox('Error', reason);
                    }
                );
            }
        }).catch((error) => {
            console.log(error);
        });
    }

    static exportExcel(): void {
        if (this.currentFile === '') {
            return;
        }
        dialog.showSaveDialog(this.mainWindow, {
            title: 'Export Excel File',
            properties: ['createDirectory', 'showOverwriteConfirmation'],
            filters: [
                { name: 'Excel File', extensions: ['xlsx'] },
                { name: 'Any File', extensions: ['*'] }
            ]
        }).then((value) => {
            if (!value.canceled) {
                this.sendRequest("/exportExcel", { file: value.filePath },
                    (data: any) => {
                        if (data.status === 'Success') {
                            Stingray.showMessage({ type: 'info', message: 'File exported' });
                        } else {
                            dialog.showErrorBox('Error', data.reason);
                        }
                    },
                    (reason: string) => {
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
        Stingray.mainWindow.webContents.send('start-waiting');
        this.sendRequest("/removeTags", {},
            (data: any) => {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.mainWindow.webContents.send('end-waiting');
                Stingray.mainWindow.webContents.send('refresh-page');
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static removeDuplicates(): void {
        if (this.currentFile === '') {
            return;
        }
        Stingray.mainWindow.webContents.send('start-waiting');
        this.sendRequest("/removeDuplicates", {},
            (data: any) => {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.mainWindow.webContents.send('end-waiting');
                Stingray.getFileInfo();
            },
            (reason: string) => {
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
            width: 540,
            height: 190,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        this.changeLanguagesWindow.setMenu(null);
        this.changeLanguagesWindow.on('closed', () => {
            this.mainWindow.focus();
        });
        this.changeLanguagesWindow.loadURL(this.path.join('file://', app.getAppPath(), 'html', 'changeLanguages.html'));
        this.changeLanguagesWindow.once('ready-to-show', (event: IpcMainEvent) => {
            this.changeLanguagesWindow.show();
        });
        Stingray.setLocation(this.changeLanguagesWindow, 'changeLanguages.html');
    }

    static replaceText(): void {
        if (this.currentFile === '') {
            return;
        }
        this.replaceTextWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: 440,
            height: 270,
            minimizable: false,
            maximizable: false,
            resizable: false,
            show: false,
            icon: this.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        this.replaceTextWindow.setMenu(null);
        this.replaceTextWindow.on('closed', () => {
            this.mainWindow.focus();
        });
        this.replaceTextWindow.loadURL(this.path.join('file://', app.getAppPath(), 'html', 'searchReplace.html'));
        this.replaceTextWindow.once('ready-to-show', (event: IpcMainEvent) => {
            this.replaceTextWindow.show();
        });
        Stingray.setLocation(this.replaceTextWindow, 'searchReplace.html');
    }

    static replace(data: any): void {
        this.sendRequest('/replaceText', data,
            (data: any) => {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.mainWindow.webContents.send('refresh-page');
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static saveEdit(): void {
        if (this.currentFile === '') {
            return;
        }
        Stingray.mainWindow.webContents.send('save-edit');
    }

    static cancelEdit(): void {
        if (this.currentFile === '') {
            return;
        }
        Stingray.mainWindow.webContents.send('cancel-edit');
    }

    static moveSegmentDown(): void {
        if (this.currentFile === '') {
            return;
        }
        Stingray.mainWindow.webContents.send('move-down');
    }

    static moveSegmentUp(): void {
        if (this.currentFile === '') {
            return;
        }
        Stingray.mainWindow.webContents.send('move-up');
    }

    static splitSegment(): void {
        if (this.currentFile === '') {
            return;
        }
        Stingray.mainWindow.webContents.send('split-segment');
    }

    static mergeSegment(): void {
        if (this.currentFile === '') {
            return;
        }
        Stingray.mainWindow.webContents.send('merge-segment');
    }

    static removeSegment(): void {
        if (this.currentFile === '') {
            return;
        }
        Stingray.mainWindow.webContents.send('remove-segment');
    }

    static loadRecents(): string[] {
        let recentsFile = this.path.join(app.getPath('appData'), app.name, 'recent.json');
        if (!existsSync(recentsFile)) {
            return [];
        }
        try {
            let data: Buffer = readFileSync(recentsFile);
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
        files = files.filter((f: string) => {
            return f !== file;
        });
        files.unshift(file);
        if (files.length > 5) {
            files = files.slice(0, 5);
        }
        let jsonData: any = { files: files };
        writeFile(recentsFile, JSON.stringify(jsonData), (error) => {
            if (error) {
                Stingray.showMessage({ type: 'error', message: error.message });
            }
        });
    }

    static setLanguages(langs: any): void {
        this.destroyWindow(this.changeLanguagesWindow);
        Stingray.mainWindow.focus();
        this.sendRequest('/setLanguages', langs,
            (data: any) => {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.getFileInfo();
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static saveData(data: any): void {
        this.sendRequest('/saveData', data,
            (data: any) => {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.mainWindow.webContents.send('refresh-page');
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static split(data: any): void {
        this.sendRequest('/splitSegment', data,
            (data: any) => {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.mainWindow.webContents.send('refresh-page');
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static segmentDown(data: any): void {
        this.sendRequest('/segmentDown', data,
            (data: any) => {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.mainWindow.webContents.send('refresh-page');
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static segmentUp(data: any): void {
        this.sendRequest('/segmentUp', data,
            (data: any) => {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.mainWindow.webContents.send('refresh-page');
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static mergeNext(data: any): void {
        this.sendRequest('/mergeNext', data,
            (data: any) => {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.mainWindow.webContents.send('refresh-page');
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static removeData(data: any): void {
        this.sendRequest('/removeSegment', data,
            (data: any) => {
                Stingray.saved = false;
                Stingray.mainWindow.setDocumentEdited(true);
                Stingray.mainWindow.webContents.send('refresh-page');
            },
            (reason: string) => {
                dialog.showErrorBox('Error', reason);
            }
        );
    }

    static showMessage(arg: any): void {
        Stingray.messagesWindow = new BrowserWindow({
            parent: this.mainWindow,
            width: 600,
            minimizable: false,
            maximizable: false,
            resizable: false,
            modal: true,
            show: false,
            icon: Stingray.path.join(app.getAppPath(), 'icons', 'icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        Stingray.messageParam = arg;
        Stingray.messagesWindow.setMenu(null);
        Stingray.messagesWindow.loadURL('file://' + this.path.join(app.getAppPath(), 'html', 'messages.html'));
        Stingray.messagesWindow.once('ready-to-show', (event: IpcMainEvent) => {
            Stingray.messagesWindow.show();
        });
        Stingray.setLocation(this.messagesWindow, 'messages.html');
    }
}

try {
    new Stingray(process.argv);
} catch (error) {
    console.error(error);
}
