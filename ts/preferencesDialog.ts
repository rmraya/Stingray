/*******************************************************************************
 * Copyright (c) 2008 - 2025 Maxprograms.
 *
 * This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License 1.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/org/documents/epl-v10.html
 *
 * Contributors:
 *     Maxprograms - initial API and implementation
 *******************************************************************************/

class PreferencesDialog {

    electron = require('electron');

    constructor() {
        this.electron.ipcRenderer.send('get-theme');
        this.electron.ipcRenderer.send('get-languages');
        this.electron.ipcRenderer.on('set-languages', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setLanguages(arg);
        });
        this.electron.ipcRenderer.send('get-appLanguage');
        this.electron.ipcRenderer.on('set-appLanguage', (event: Electron.IpcRendererEvent, arg: any) => {
            (document.getElementById('appLangSelect') as HTMLSelectElement).value = arg;
        });
        this.electron.ipcRenderer.on('set-theme', (event: Electron.IpcRendererEvent, arg: any) => {
            (document.getElementById('theme') as HTMLLinkElement).href = arg;
        });
        this.electron.ipcRenderer.on('set-preferences', (event: Electron.IpcRendererEvent, arg: Preferences) => {
            (document.getElementById('themeColor') as HTMLSelectElement).value = arg.theme;
            (document.getElementById('srcLangSelect') as HTMLSelectElement).value = arg.srcLang;
            (document.getElementById('tgtLangSelect') as HTMLSelectElement).value = arg.tgtLang;
            (document.getElementById('defaultSRX') as HTMLInputElement).value = arg.srx;
            (document.getElementById('defaultCatalog') as HTMLInputElement).value = arg.catalog;
        });
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.electron.ipcRenderer.send('close-preferences');
            }
            if (event.key === 'Enter') {
                this.savePreferences();
            }
        });
        document.getElementById('browseSRX').addEventListener('click', () => {
            this.electron.ipcRenderer.send('browse-srx');
        });
        document.getElementById('browseCatalog').addEventListener('click', () => {
            this.electron.ipcRenderer.send('browse-catalog');
        });
        document.getElementById('save').addEventListener('click', () => {
            this.savePreferences();
        });
        this.electron.ipcRenderer.on('set-srx', (event: Electron.IpcRendererEvent, arg: any) => {
            (document.getElementById('defaultSRX') as HTMLInputElement).value = arg;
        });
        this.electron.ipcRenderer.on('set-catalog', (event: Electron.IpcRendererEvent, arg: any) => {
            (document.getElementById('defaultCatalog') as HTMLInputElement).value = arg;
        });
        document.getElementById('srcLangSelect').focus(); setTimeout(() => {
            this.electron.ipcRenderer.send('set-height', { window: 'preferences', width: document.body.clientWidth, height: document.body.clientHeight });
        }, 200);
    }

    setLanguages(arg: any): void {
        let array = arg.languages;
        let languageOptions: string = '<option value="none">Select Language</option>';
        for (let lang of array) {
            languageOptions = languageOptions + '<option value="' + lang.code + '">' + lang.description + '</option>';
        }
        document.getElementById('srcLangSelect').innerHTML = languageOptions;
        document.getElementById('tgtLangSelect').innerHTML = languageOptions;
        this.electron.ipcRenderer.send('get-preferences');
    }

    savePreferences() {
        let prefs: Preferences = {
            srcLang: (document.getElementById('srcLangSelect') as HTMLSelectElement).value,
            tgtLang: (document.getElementById('tgtLangSelect') as HTMLSelectElement).value,
            appLang: (document.getElementById('appLangSelect') as HTMLSelectElement).value,
            theme: ((document.getElementById('themeColor') as HTMLSelectElement).value as "system" | "light" | "dark"),
            catalog: (document.getElementById('defaultCatalog') as HTMLInputElement).value,
            srx: (document.getElementById('defaultSRX') as HTMLInputElement).value
        }
        this.electron.ipcRenderer.send('save-preferences', prefs);
    }
}





