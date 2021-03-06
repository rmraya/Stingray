/*****************************************************************************
Copyright (c) 2008-2021 - Maxprograms,  http://www.maxprograms.com/

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

class Licenses {

    electron = require('electron');

    constructor() {
        this.electron.ipcRenderer.send('get-theme');
        this.electron.ipcRenderer.on('set-theme', (event: Electron.IpcRendererEvent, arg: any) => {
            (document.getElementById('theme') as HTMLLinkElement).href = arg;
        });
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.electron.ipcRenderer.send('close-licenses');
            }
        });
        document.getElementById('Stingray').addEventListener('click', () => {
            this.openLicense('Stingray');
        });
        document.getElementById('electron').addEventListener('click', () => {
            this.openLicense('electron');
        });
        document.getElementById('TypeScript').addEventListener('click', () => {
            this.openLicense('TypeScript');
        });
        document.getElementById('Java').addEventListener('click', () => {
            this.openLicense('Java');
        });
        document.getElementById('OpenXLIFF').addEventListener('click', () => {
            this.openLicense('OpenXLIFF');
        });
        document.getElementById('JSON').addEventListener('click', () => {
            this.openLicense('JSON');
        });
        document.getElementById('MapDB').addEventListener('click', () => {
            this.openLicense('MapDB');
        });
        document.getElementById('jsoup').addEventListener('click', () => {
            this.openLicense('jsoup');
        });
        document.getElementById('DTDParser').addEventListener('click', () => {
            this.openLicense('DTDParser');
        });
        let body: HTMLBodyElement = document.getElementById('body') as HTMLBodyElement;
        this.electron.ipcRenderer.send('licenses-height', { width: body.clientWidth, height: body.clientHeight });
    }

    openLicense(type: string) {
        this.electron.ipcRenderer.send('open-license', { type: type });
    }
}

new Licenses();