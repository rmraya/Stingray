/*******************************************************************************
 * Copyright (c) 2008-2021 Maxprograms.
 *
 * This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License 1.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/org/documents/epl-v10.html
 *
 * Contributors:
 *     Maxprograms - initial API and implementation
 *******************************************************************************/

class Preferences {

    electron = require('electron');

    constructor() {
        this.electron.ipcRenderer.send('get-theme');
        this.electron.ipcRenderer.send('get-languages');
        this.electron.ipcRenderer.on('set-languages', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setLanguages(arg);
        });
        this.electron.ipcRenderer.on('set-theme', (event: Electron.IpcRendererEvent, arg: any) => {
            (document.getElementById('theme') as HTMLLinkElement).href = arg;
        });
        this.electron.ipcRenderer.on('set-preferences', (event: Electron.IpcRendererEvent, arg: any) => {
            (document.getElementById('themeColor') as HTMLSelectElement).value = arg.theme;
            (document.getElementById('srcLangSelect') as HTMLSelectElement).value = arg.srcLang;
            (document.getElementById('tgtLangSelect') as HTMLSelectElement).value = arg.tgtLang;
            (document.getElementById('defaultSRX') as HTMLInputElement).value = arg.srx;
            (document.getElementById('defaultCatalog') as HTMLInputElement).value = arg.catalog;
        });
        document.addEventListener('keydown', (event: KeyboardEvent) => { KeyboardHandler.keyListener(event); });
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
        document.getElementById('srcLangSelect').focus();
    }

    setLanguages(arg: any): void {
        var array = arg.languages;
        var languageOptions = '<option value="none">Select Language</option>';
        for (let i = 0; i < array.length; i++) {
            var lang = array[i];
            languageOptions = languageOptions + '<option value="' + lang.code + '">' + lang.description + '</option>';
        }
        document.getElementById('srcLangSelect').innerHTML = languageOptions;
        document.getElementById('tgtLangSelect').innerHTML = languageOptions;
        this.electron.ipcRenderer.send('get-preferences');

        let body: HTMLBodyElement = document.getElementById('body') as HTMLBodyElement;
        this.electron.ipcRenderer.send('settings-height', { width: body.clientWidth, height: body.clientHeight });
    }

    savePreferences() {
        var prefs: any = {
            srcLang: (document.getElementById('srcLangSelect') as HTMLSelectElement).value,
            tgtLang: (document.getElementById('tgtLangSelect') as HTMLSelectElement).value,
            theme: (document.getElementById('themeColor') as HTMLSelectElement).value,
            catalog: (document.getElementById('defaultCatalog') as HTMLInputElement).value,
            srx: (document.getElementById('defaultSRX') as HTMLInputElement).value
        }
        this.electron.ipcRenderer.send('save-preferences', prefs);
    }
}

new Preferences();




