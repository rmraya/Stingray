/*******************************************************************************
 * Copyright (c) 2022 Maxprograms.
 *
 * This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License 1.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/org/documents/epl-v10.html
 *
 * Contributors:
 *     Maxprograms - initial API and implementation
 *******************************************************************************/

class ChangeLanguages {

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
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.electron.ipcRenderer.send('close-change=languages');
            }
            if (event.key === 'Enter') {
                this.saveLanguages();
            }
        });
        document.getElementById('save').addEventListener('click', () => {
            this.saveLanguages();
        });
        this.electron.ipcRenderer.on('language-pair', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setFileLanguages(arg);
        });
        document.getElementById('srcLangSelect').focus();
    }

    setLanguages(arg: any): void {
        var array = arg.languages;
        var languageOptions = '';
        for (let i = 0; i < array.length; i++) {
            var lang = array[i];
            languageOptions = languageOptions + '<option value="' + lang.code + '">' + lang.description + '</option>';
        }
        document.getElementById('srcLangSelect').innerHTML = languageOptions;
        document.getElementById('tgtLangSelect').innerHTML = languageOptions;
        this.electron.ipcRenderer.send('file-languages');
    }

    setFileLanguages(arg: any) {
        (document.getElementById('srcLangSelect') as HTMLSelectElement).value = arg.srcLang;
        (document.getElementById('tgtLangSelect') as HTMLSelectElement).value = arg.tgtLang;
        let body: HTMLBodyElement = document.getElementById('body') as HTMLBodyElement;
        this.electron.ipcRenderer.send('languages-height', { width: body.clientWidth, height: body.clientHeight });
    }

    saveLanguages() {
        let srcLang = (document.getElementById('srcLangSelect') as HTMLSelectElement).value;
        let tgtLang = (document.getElementById('tgtLangSelect') as HTMLSelectElement).value;
        if (srcLang === tgtLang) {
            window.alert('Select different languages');
            return;
        }
        var prefs: any = {
            srcLang: srcLang,
            tgtLang: tgtLang
        }
        this.electron.ipcRenderer.send('save-languages', prefs);
    }
}

new ChangeLanguages();




