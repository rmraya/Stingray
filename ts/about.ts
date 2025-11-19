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

class About {

    electron = require('electron');

    constructor() {
        this.electron.ipcRenderer.send('get-theme');
        this.electron.ipcRenderer.send('get-version');
        this.electron.ipcRenderer.on('set-theme', (event: Electron.IpcRendererEvent, theme: string) => {
            (document.getElementById('theme') as HTMLLinkElement).href = theme;
        });
        this.electron.ipcRenderer.on('set-version', (event: Electron.IpcRendererEvent, version: string) => {
            document.getElementById('version').innerHTML = version;
        });
        document.getElementById('system').addEventListener('click', () => {
            this.electron.ipcRenderer.send('system-info-clicked');
            document.getElementById('system').blur();
        });
        document.getElementById('licensesButton').addEventListener('click', () => {
            this.electron.ipcRenderer.send('licenses-clicked');
        });
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.electron.ipcRenderer.send('close-about');
            }
        });
        document.getElementById('licensesButton').focus();
        setTimeout(() => {
            this.electron.ipcRenderer.send('set-height', { window: 'about', width: document.body.clientWidth, height: document.body.clientHeight });
        }, 200);
    }
}
