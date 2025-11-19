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

class Licenses {

    electron = require('electron');

    constructor() {
        this.electron.ipcRenderer.send('get-theme');
        this.electron.ipcRenderer.on('set-theme', (event: Electron.IpcRendererEvent, theme: string) => {
            (document.getElementById('theme') as HTMLLinkElement).href = theme;
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
        document.getElementById('Java').addEventListener('click', () => {
            this.openLicense('Java');
        });
        document.getElementById('OpenXLIFF').addEventListener('click', () => {
            this.openLicense('OpenXLIFF');
        });
        document.getElementById('BCP47J').addEventListener('click', () => {
            this.openLicense('BCP47J');
        });
        document.getElementById('XMLJava').addEventListener('click', () => {
            this.openLicense('XMLJava');
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
        setTimeout(() => {
            this.electron.ipcRenderer.send('set-height', { window: 'licenses', width: document.body.clientWidth, height: document.body.clientHeight });
        }, 200);
    }

    openLicense(type: string) {
        this.electron.ipcRenderer.send('open-license', { type: type });
    }
}
