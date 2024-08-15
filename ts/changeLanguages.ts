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
        let array = arg.languages;
        let languageOptions = '';
        for (let lang of array) {
            languageOptions = languageOptions + '<option value="' + lang.code + '">' + lang.description + '</option>';
        }
        document.getElementById('srcLangSelect').innerHTML = languageOptions;
        document.getElementById('tgtLangSelect').innerHTML = languageOptions;
        this.electron.ipcRenderer.send('file-languages');
    }

    setFileLanguages(arg: any) {
        (document.getElementById('srcLangSelect') as HTMLSelectElement).value = arg.srcLang;
        (document.getElementById('tgtLangSelect') as HTMLSelectElement).value = arg.tgtLang;
        setTimeout(() => {
            this.electron.ipcRenderer.send('set-height', { window: 'languages', width: document.body.clientWidth, height: document.body.clientHeight });
        }, 200);
    }

    saveLanguages() {
        let srcLang = (document.getElementById('srcLangSelect') as HTMLSelectElement).value;
        let tgtLang = (document.getElementById('tgtLangSelect') as HTMLSelectElement).value;
        if (srcLang === tgtLang) {
            window.alert('Select different languages');
            return;
        }
        let prefs: any = {
            srcLang: srcLang,
            tgtLang: tgtLang
        }
        this.electron.ipcRenderer.send('save-languages', prefs);
    }
}





