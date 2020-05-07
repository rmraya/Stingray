/*****************************************************************************
Copyright (c) 2008-2020 - Maxprograms,  http://www.maxprograms.com/

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

class Main {

    electron = require('electron');

    fileLoaded: boolean;
    maxPage: number;
    currentPage: number;
    rowsPage: number = 200;
    sourceRows: number;
    targetRows: number;
    maxRows: number;

    constructor() {
        this.electron.ipcRenderer.send('get-theme');
        this.electron.ipcRenderer.on('set-theme', (event, arg) => {
            (document.getElementById('theme') as HTMLLinkElement).href = arg;
        });
        this.electron.ipcRenderer.on('start-waiting', () => {
            document.getElementById('body').classList.add("wait");
        });
        this.electron.ipcRenderer.on('end-waiting', () => {
            document.getElementById('body').classList.remove("wait");
        });
        this.electron.ipcRenderer.on('set-status', (event, arg) => {
            this.setStatus(arg);
        });
        document.getElementById('newFile').addEventListener('click', () => {
            this.electron.ipcRenderer.send('new-file');
        });
        document.getElementById('openFile').addEventListener('click', () => {
            this.electron.ipcRenderer.send('open-file');
        });
        document.getElementById('saveFile').addEventListener('click', ()=>{
            this.electron.ipcRenderer.send('save-file');
        });
        document.getElementById('export').addEventListener('click', ()=>{
            this.electron.ipcRenderer.send('export-tmx');
        });
        document.getElementById('delimited').addEventListener('click', ()=>{
            this.electron.ipcRenderer.send('export-csv');
        });
        document.getElementById('openHelp').addEventListener('click', () => {
            this.electron.ipcRenderer.send('show-help');
        });
        this.electron.ipcRenderer.on('file-info', (event, arg) => {
            this.setFileInfo(arg);
        });
        this.electron.ipcRenderer.on('first-page', () => {
            this.firstPage();
        });
        this.electron.ipcRenderer.on('previous-page', () => {
            this.previousPage();
        });
        this.electron.ipcRenderer.on('next-page', () => {
            this.nextPage();
        });
        this.electron.ipcRenderer.on('last-page', () => {
            this.lastPage();
        });
        this.electron.ipcRenderer.on('set-first-page', () => {
            this.currentPage = 0;
            (document.getElementById('page') as HTMLInputElement).value = '1';
        });
        (document.getElementById('page') as HTMLInputElement).addEventListener('keydown', (ev: KeyboardEvent) => {
            this.pageKeyboardListener(ev);
        });
        (document.getElementById('rows_page') as HTMLInputElement).addEventListener('keydown', (ev: KeyboardEvent) => {
            this.rowsPageKeyboardListener(ev);
        });
        document.getElementById('first').addEventListener('click',() => {
            this.firstPage();
        });
        document.getElementById('previous').addEventListener('click',() => {
            this.previousPage();
        });
        document.getElementById('next').addEventListener('click',() => {
            this.nextPage();
        });
        document.getElementById('last').addEventListener('click',() => {
            this.lastPage();
        });
        this.electron.ipcRenderer.on('set-rows', (event, arg) => {
            this.setRows(arg);
        });
        this.electron.ipcRenderer.on('refresh-page', () => {
            this.getRows();
        });
    }

    setStatus(text: string): void {
        var status: HTMLDivElement = document.getElementById('status') as HTMLDivElement;
        status.innerHTML = text;
        if (text.length > 0) {
            status.style.display = 'block';
        } else {
            status.style.display = 'none';
        }
    }

    setFileInfo(data: any) {
        document.getElementById('title').innerText = 'Stingray - ' + data.file;
        this.sourceRows = data.srcRows;
        this.targetRows = data.tgtRows;

        document.getElementById('sourceHeader').innerText = data.srcLang.code + ' - ' + data.srcLang.description;
        document.getElementById('targetHeader').innerText = data.tgtLang.code + ' - ' + data.tgtLang.description;

        this.maxRows = this.sourceRows;
        if (this.targetRows > this.maxRows) {
            this.maxRows = this.targetRows;
        }
        this.maxPage = Math.ceil(this.maxRows / this.rowsPage);
        document.getElementById('pages').innerText = '' + this.maxPage;
        this.firstPage();
    }

    getRows(): void {
        this.electron.ipcRenderer.send('get-rows', {
            start: this.currentPage * this.rowsPage,
            count: this.rowsPage
        });
    }

    firstPage(): void {
        this.currentPage = 0;
        (document.getElementById('page') as HTMLInputElement).value = '1';
        this.getRows();
    }

    previousPage(): void {
        if (this.currentPage > 0) {
            this.currentPage--;
            (document.getElementById('page') as HTMLInputElement).value = '' + (this.currentPage + 1);
            this.getRows();
        }
    }

    nextPage(): void {
        if (this.currentPage < this.maxPage - 1) {
            this.currentPage++;
            (document.getElementById('page') as HTMLInputElement).value = '' + (this.currentPage + 1);
            this.getRows();
        }
    }

    lastPage(): void {
        this.currentPage = this.maxPage - 1;
        (document.getElementById('page') as HTMLInputElement).value = '' + this.maxPage;
        this.getRows();
    }

    rowsPageKeyboardListener(ev: KeyboardEvent): void {
        if (!this.fileLoaded) {
            return;
        }
        if (ev.keyCode == 13) {
            this.rowsPage = Number.parseInt((document.getElementById('rows_page') as HTMLInputElement).value);
            if (this.rowsPage < 1) {
                this.rowsPage = 1;
            }
            if (this.rowsPage > this.maxRows) {
                this.rowsPage = this.maxRows;
            }
            (document.getElementById('rows_page') as HTMLInputElement).value = '' + this.rowsPage;
            this.maxPage = Math.ceil(this.maxRows / this.rowsPage);
            document.getElementById('pages').innerText = '' + this.maxPage;
            this.firstPage();
        }
    }

    pageKeyboardListener(ev: KeyboardEvent): void {
        if (!this.fileLoaded) {
            return;
        }
        if (ev.keyCode == 13) {
            this.currentPage = Number.parseInt((document.getElementById('page') as HTMLInputElement).value) - 1;
            if (this.currentPage < 0) {
                this.currentPage = 0;
            }
            if (this.currentPage > this.maxPage - 1) {
                this.currentPage = this.maxPage - 1;
            }
            (document.getElementById('page') as HTMLInputElement).value = '' + (this.currentPage + 1);
            this.getRows();
        }
    }

    setRows(data: any): void {
        let html = '';
        let rows = data.rows;
        let length: number = rows.length;
        for (let i = 0; i < length; i++) {
            html = html + rows[i];
        }
        document.getElementById('tableBody').innerHTML = html;
    }
}

new Main();