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

class NewFile {

    electron = require('electron');

    constructor() {
        this.electron.ipcRenderer.send('get-theme');
        this.electron.ipcRenderer.on('set-theme', (event: Electron.IpcRendererEvent, arg: any) => {
            (document.getElementById('theme') as HTMLLinkElement).href = arg;
        });
        this.electron.ipcRenderer.send('get-languages');
        this.electron.ipcRenderer.on('set-languages', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setLanguages(arg);
        });
        this.electron.ipcRenderer.on('set-types', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setTypes(arg);
        });
        this.electron.ipcRenderer.send('get-charsets');
        this.electron.ipcRenderer.on('set-charsets', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setCharsets(arg);
        });
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.electron.ipcRenderer.send('close-new-file');
            }
        });
        document.getElementById('browseAlignment').addEventListener('click', () => {
            this.electron.ipcRenderer.send('browse-alignment');
            document.getElementById('browseAlignment').blur();
        });
        this.electron.ipcRenderer.on('set-alignment', (event: Electron.IpcRendererEvent, arg: any) => {
            (document.getElementById('alignmentInput') as HTMLInputElement).value = arg;
        });
        document.getElementById('browseSource').addEventListener('click', () => {
            this.electron.ipcRenderer.send('browse-source');
            document.getElementById('browseSource').blur();
        });
        this.electron.ipcRenderer.on('set-source', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setSource(arg);
        });
        this.electron.ipcRenderer.on('set-target', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setTarget(arg);
        });
        document.getElementById('browseTarget').addEventListener('click', () => {
            this.electron.ipcRenderer.send('browse-target');
            document.getElementById('browseTarget').blur();
        });
        document.getElementById('create').addEventListener('click', () => {
            this.createAlignment();
            document.getElementById('create').blur();
        });
        document.getElementById('alignmentInput').focus();
    }

    setLanguages(arg: any): void {
        let array: any[] = arg.languages;
        let languageOptions: string = '<option value="none">Select Language</option>';
        for (let lang of array) {
            languageOptions = languageOptions + '<option value="' + lang.code + '">' + lang.description + '</option>';
        }
        document.getElementById('srcLangSelect').innerHTML = languageOptions;
        if (arg.srcLang !== 'none') {
            (document.getElementById('srcLangSelect') as HTMLSelectElement).value = arg.srcLang;
        }
        document.getElementById('tgtLangSelect').innerHTML = languageOptions;
        if (arg.tgtLang !== 'none') {
            (document.getElementById('tgtLangSelect') as HTMLSelectElement).value = arg.tgtLang;
        }
        this.electron.ipcRenderer.send('get-types');
    }

    setTypes(arg: any): void {
        let array: any[] = arg.types;
        let typeOptions: string = '<option value="none">Select Type</option>';
        for (let type of array) {
            typeOptions = typeOptions + '<option value="' + type.code + '">' + type.description + '</option>';
        }
        document.getElementById('srcTypeSelect').innerHTML = typeOptions;
        document.getElementById('tgtTypeSelect').innerHTML = typeOptions;
        setTimeout(() => {
            this.electron.ipcRenderer.send('set-height', { window: 'newFile', width: document.body.clientWidth, height: document.body.clientHeight });
        }, 200);
    }

    setCharsets(arg: any): void {
        let array: any[] = arg.charsets;
        let typeOptions: string = '<option value="none">Select Character Set</option>';
        for (let type of array) {
            typeOptions = typeOptions + '<option value="' + type.code + '">' + type.description + '</option>';
        }
        document.getElementById('srcEncodingSelect').innerHTML = typeOptions;
        document.getElementById('tgtEncodingSelect').innerHTML = typeOptions;
    }

    setSource(arg: any): void {
        (document.getElementById('sourceInput') as HTMLInputElement).value = arg.file;
        if (arg.type) {
            (document.getElementById('srcTypeSelect') as HTMLSelectElement).value = arg.type;
        }
        if (arg.charset) {
            (document.getElementById('srcEncodingSelect') as HTMLSelectElement).value = arg.charset;
        }

    }

    setTarget(arg: any): void {
        (document.getElementById('targetInput') as HTMLInputElement).value = arg.file;
        if (arg.type) {
            (document.getElementById('tgtTypeSelect') as HTMLSelectElement).value = arg.type;
        }
        if (arg.charset) {
            (document.getElementById('tgtEncodingSelect') as HTMLSelectElement).value = arg.charset;
        }

    }

    createAlignment(): void {
        let alignmentFile = (document.getElementById('alignmentInput') as HTMLInputElement).value;
        if (alignmentFile === '') {
            window.alert('Select alignment file');
            return;
        }
        let sourceFile = (document.getElementById('sourceInput') as HTMLInputElement).value;
        if (sourceFile === '') {
            window.alert('Select source file');
            return;
        }
        let srcLang = (document.getElementById('srcLangSelect') as HTMLSelectElement).value;
        if (srcLang === 'none') {
            window.alert('Select source language');
            return;
        }
        let srcType = (document.getElementById('srcTypeSelect') as HTMLSelectElement).value;
        if (srcType === 'none') {
            window.alert('Select source file type');
            return;
        }
        let srcEnc = (document.getElementById('srcEncodingSelect') as HTMLSelectElement).value;
        if (srcEnc === 'none') {
            window.alert('Select source character set');
            return;
        }
        let targetFile = (document.getElementById('targetInput') as HTMLInputElement).value;
        if (targetFile === '') {
            window.alert('Select target file');
            return;
        }
        let tgtLang = (document.getElementById('tgtLangSelect') as HTMLSelectElement).value;
        if (tgtLang === 'none') {
            window.alert('Select target language');
            return;
        }
        let tgtType = (document.getElementById('tgtTypeSelect') as HTMLSelectElement).value;
        if (tgtType === 'none') {
            window.alert('Select target file type');
            return;
        }
        let tgtEnc = (document.getElementById('tgtEncodingSelect') as HTMLSelectElement).value;
        if (tgtEnc === 'none') {
            window.alert('Select target character set');
            return;
        }
        if (srcLang === tgtLang) {
            window.alert('Select different languages');
            return;
        }
        let paragraph = (document.getElementById('paragraph') as HTMLInputElement).checked;
        let params = {
            alignmentFile: alignmentFile,
            sourceFile: sourceFile,
            srcLang: srcLang,
            srcType: srcType,
            srcEnc: srcEnc,
            targetFile: targetFile,
            tgtLang: tgtLang,
            tgtType: tgtType,
            tgtEnc: tgtEnc,
            paragraph: paragraph
        }
        this.electron.ipcRenderer.send('create-alignment', params);
    }
}
