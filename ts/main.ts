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

    maxPage: number;
    currentPage: number;
    rowsPage: number = 500;
    sourceRows: number;
    targetRows: number;
    maxRows: number;

    currentId: string = null;
    currentLang: string = null;
    currentCell: Element = null;
    currentContent: string = null;
    textArea: HTMLTextAreaElement = null;
    currentTags: string[] = [];

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
        document.getElementById('saveFile').addEventListener('click', () => {
            this.electron.ipcRenderer.send('save-file');
        });
        document.getElementById('saveEdit').addEventListener('click', () => {
            this.saveEdit();
        });
        this.electron.ipcRenderer.on('save-edit', () => {
            this.saveEdit();
        });
        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.cancelEdit();
        });
        this.electron.ipcRenderer.on('cancel-edit', () => {
            this.cancelEdit();
        });
        document.getElementById('moveDown').addEventListener('click', () => {
            this.moveSegmentDown();
        });
        this.electron.ipcRenderer.on('move-down', () => {
            this.moveSegmentDown();
        });
        document.getElementById('moveUp').addEventListener('click', () => {
            this.moveSegmentUp();
        });
        this.electron.ipcRenderer.on('move-up', () => {
            this.moveSegmentUp();
        });
        document.getElementById('remove').addEventListener('click', () => {
            this.removeSegment();
        });
        this.electron.ipcRenderer.on('remove-segment', () => {
            this.removeSegment();
        });
        document.getElementById('export').addEventListener('click', () => {
            this.electron.ipcRenderer.send('export-tmx');
        });
        document.getElementById('delimited').addEventListener('click', () => {
            this.electron.ipcRenderer.send('export-csv');
        });
        document.getElementById('tags').addEventListener('click', () => {
            this.electron.ipcRenderer.send('remove-tags');
        });
        document.getElementById('duplicates').addEventListener('click', () => {
            this.electron.ipcRenderer.send('remove-duplicates');
        });
        document.getElementById('langs').addEventListener('click', () => {
            this.electron.ipcRenderer.send('change-languages');
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
        this.electron.ipcRenderer.on('clear-file', () => {
            this.clearFile();
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
        document.getElementById('first').addEventListener('click', () => {
            this.firstPage();
        });
        document.getElementById('previous').addEventListener('click', () => {
            this.previousPage();
        });
        document.getElementById('next').addEventListener('click', () => {
            this.nextPage();
        });
        document.getElementById('last').addEventListener('click', () => {
            this.lastPage();
        });
        this.electron.ipcRenderer.on('set-rows', (event, arg) => {
            this.setRows(arg);
        });
        this.electron.ipcRenderer.on('refresh-page', () => {
            this.getRows();
        });
        this.electron.ipcRenderer.on('file-renamed', (event, arg) => {
            document.getElementById('title').innerText = 'Stingray - ' + arg;
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
        document.getElementById('sourceRows').innerText = '' + this.sourceRows;
        document.getElementById('targetRows').innerText = '' + this.targetRows;
        this.firstPage();
    }

    clearFile(): void {
        document.getElementById('title').innerText = 'Stingray';
        document.getElementById('sourceHeader').innerText = 'Source';
        document.getElementById('targetHeader').innerText = 'Target';
        document.getElementById('tableBody').innerHTML = '';
        (document.getElementById('page') as HTMLInputElement).value = '0';
        document.getElementById('pages').innerText = '0';
        document.getElementById('sourceRows').innerText = '';
        document.getElementById('targetRows').innerText = '';
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
        if (ev.key === 'Enter') {
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
        if (ev.key === 'Enter') {
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
        var cells = document.getElementsByClassName('cell');
        for (let i = 0; i < cells.length; i++) {
            cells[i].addEventListener('click', (ev: MouseEvent) => {
                this.clickListener(ev);
            });
        }
        var fixed = document.getElementsByClassName('fixed');
        for (let i = 0; i < fixed.length; i++) {
            fixed[i].addEventListener('click', (ev: MouseEvent) => {
                this.fixedListener(ev);
            });
        }
        this.sourceRows = data.srcRows;
        this.targetRows = data.tgtRows;
        this.maxRows = this.sourceRows;
        if (this.targetRows > this.maxRows) {
            this.maxRows = this.targetRows;
        }
        this.maxPage = Math.ceil(this.maxRows / this.rowsPage);
        document.getElementById('pages').innerText = '' + this.maxPage;
        document.getElementById('sourceRows').innerText = '' + this.sourceRows;
        document.getElementById('targetRows').innerText = '' + this.targetRows;
    }

    clickListener(event: MouseEvent) {
        var element: Element = (event.target as Element);
        if (element.parentElement.tagName === 'TH') {
            // clicked select all
            return;
        }
        var x: string = element.tagName;
        if ('TEXTAREA' === x) {
            // already editing
            return;
        }
        var id: string;
        var lang: string;
        if ('TD' === x || 'INPUT' === x) {
            var composed = event.composedPath();
            if ('TR' === (composed[0] as Element).tagName) {
                id = (composed[0] as Element).id;
            } else if ('TR' === (composed[1] as Element).tagName) {
                id = (composed[1] as Element).id;
            } else if ('TR' === (composed[2] as Element).tagName) {
                id = (composed[2] as Element).id;
            }
            lang = (event.target as Element).getAttribute('lang');
        }
        if (this.textArea !== null && (this.currentId !== id || this.currentLang !== lang)) {
            this.saveEdit();
        }

        if (id !== null) {
            this.currentId = id;
            if (this.currentCell != null) {
                this.currentCell.innerHTML = this.currentContent;
                this.currentCell = null;
                this.currentContent = null;
            }
            if (lang !== null) {
                this.currentLang = lang;
                this.currentCell = (event.target as Element);
                this.currentContent = this.currentCell.innerHTML;
                this.textArea = document.createElement('textarea');
                this.textArea.setAttribute('style', 'height: ' + (this.currentCell.clientHeight - 8) + 'px; width: ' + (this.currentCell.clientWidth - 8) + 'px;')
                this.textArea.innerHTML = this.cleanTags(this.currentContent);
                this.currentCell.innerHTML = '';
                this.currentCell.parentElement.style.padding = '0px';
                this.currentCell.appendChild(this.textArea);
                this.textArea.focus();
                this.electron.ipcRenderer.send('get-cell-properties', { id: this.currentId, lang: this.currentLang });
            }
        }
    }

    fixedListener(event: MouseEvent) {
        var element: Element = (event.target as Element);
        var x: string = element.tagName;
        var id: string;
        var lang: string;
        if ('TD' === x) {
            var composed = event.composedPath();
            if ('TR' === (composed[0] as Element).tagName) {
                id = (composed[0] as Element).id;
            } else if ('TR' === (composed[1] as Element).tagName) {
                id = (composed[1] as Element).id;
            } else if ('TR' === (composed[2] as Element).tagName) {
                id = (composed[2] as Element).id;
            }
            lang = (event.target as Element).getAttribute('lang');
        }
        if (this.textArea !== null && (this.currentId !== id || this.currentLang !== lang)) {
            this.saveEdit();
        }

        if (id !== null) {
            this.currentId = id;
            if (this.currentCell != null) {
                this.currentCell.innerHTML = this.currentContent;
                this.currentCell = null;
                this.currentContent = null;
            }
        }
    }

    saveEdit(): void {
        if (this.textArea !== null) {
            if (this.currentContent === this.textArea.value) {
                this.cancelEdit();
                return;
            }
            let edited: string = this.restoretags(this.textArea.value, this.currentTags);
            this.currentCell.innerHTML = edited;
            this.electron.ipcRenderer.send('save-data', { id: this.currentId, lang: this.currentLang, data: edited });
        }
    }

    restoretags(text: string, originalTags: string[]): string {
        for (let i: number = 0; i < originalTags.length; i++) {
            text = text.replace('[[' + (i + 1) + ']]', originalTags[i]);
        }
        return text;
    }

    cancelEdit(): void {
        this.currentCell.innerHTML = this.currentContent;
        this.textArea = null;
    }

    cleanTags(unit: string): string {
        var index: number = unit.indexOf('<svg ');
        var tagNumber: number = 1;
        this.currentTags = [];
        while (index >= 0) {
            let start: string = unit.slice(0, index);
            let rest: string = unit.slice(index + 1);
            let end: number = rest.indexOf('</svg>') + 5;
            let tag: string = '<' + rest.slice(0, end) + '/>';
            this.currentTags.push(tag);
            unit = start + '[[' + tagNumber++ + ']]' + rest.slice(end + 1);
            index = unit.indexOf('<svg ');
        }
        return unit;
    }

    moveSegmentDown(): void {
        if (this.textArea !== null) {
            let id = this.currentId;
            let lang = this.currentLang;
            this.cancelEdit();
            this.electron.ipcRenderer.send('segment-down', { id: id, lang: lang });
        }
    }

    moveSegmentUp(): void {
        if (this.textArea !== null) {
            let id = this.currentId;
            let lang = this.currentLang;
            this.cancelEdit();
            this.electron.ipcRenderer.send('segment-up', { id: id, lang: lang });
        }
    }

    removeSegment(): void {
        if (this.textArea !== null) {
            let id = this.currentId;
            let lang = this.currentLang;
            this.cancelEdit();
            this.electron.ipcRenderer.send('remove-data', { id: id, lang: lang });
        }
    }
}

new Main();