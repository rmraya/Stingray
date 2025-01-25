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
    currentCell: HTMLTableCellElement = null;
    currentContent: string = null;
    currentPos: number = 0;
    currentNode: Node;

    autoSelect: any = null;

    topBar: HTMLDivElement;
    mainPanel: HTMLDivElement;
    bottomBar: HTMLDivElement;

    constructor() {

        this.electron.ipcRenderer.send('get-theme');
        this.electron.ipcRenderer.on('set-theme', (event: Electron.IpcRendererEvent, arg: any) => {
            (document.getElementById('theme') as HTMLLinkElement).href = arg;
        });

        this.createTopToolbar();
        this.createCenterPanel();
        this.createBottomToolbar();

        setTimeout(() => {
            this.resize();
        }, 200);

        window.addEventListener('resize', () => { this.resize(); });

        this.electron.ipcRenderer.on('start-waiting', () => {
            document.body.classList.add("wait");
        });
        this.electron.ipcRenderer.on('end-waiting', () => {
            document.body.classList.remove("wait");
        });
        this.electron.ipcRenderer.on('set-status', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setStatus(arg);
        });
        this.electron.ipcRenderer.on('save-edit', () => {
            this.saveEdit();
        });
        this.electron.ipcRenderer.on('cancel-edit', () => {
            this.cancelEdit();
        });
        this.electron.ipcRenderer.on('move-down', () => {
            this.moveSegmentDown();
        });
        this.electron.ipcRenderer.on('move-up', () => {
            this.moveSegmentUp();
        });
        this.electron.ipcRenderer.on('split-segment', () => {
            this.split();
        });
        this.electron.ipcRenderer.on('merge-segment', () => {
            this.mergeNext();
        });
        this.electron.ipcRenderer.on('remove-segment', () => {
            this.removeSegment();
        });
        this.electron.ipcRenderer.on('file-info', (event: Electron.IpcRendererEvent, arg: any) => {
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
        (document.getElementById('rows_page') as HTMLInputElement).addEventListener('keydown', (ev: KeyboardEvent) => {
            this.rowsPageKeyboardListener(ev);
        });
        this.electron.ipcRenderer.on('set-rows', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setRows(arg);
        });
        this.electron.ipcRenderer.on('refresh-page', () => {
            this.getRows();
        });
        this.electron.ipcRenderer.on('file-renamed', (event: Electron.IpcRendererEvent, arg: any) => {
            document.getElementById('title').innerText = 'Stingray - ' + arg;
        });

        document.addEventListener('paste', (event) => {
            let clipboardData = event.clipboardData;
            let html: string = clipboardData.getData('text/html');
            if (html.length !== 0) {
                event.preventDefault();
                if (this.hasTags(html)) {
                    this.parseClipboardHtml(html);
                } else {
                    let text = clipboardData.getData('text/plain').replace(/\r/g, '');
                    text = text.replace(/\n\n/g, '\n');
                    document.execCommand('insertHTML', false, text);
                }
            }
        });
    }

    hasTags(html: string): boolean {
        let container: HTMLDivElement = document.createElement('div');
        container.innerHTML = html;
        let tags: NodeListOf<Element> = container.querySelectorAll('IMG');
        if (tags.length > 0) {
            for (let i = 0; i < tags.length; i++) {
                let img: HTMLImageElement = tags[i] as HTMLImageElement;
                if (img.getAttribute('src').startsWith('data:image')) {
                    return true;
                }
            }
        }
        return false;
    }

    parseClipboardHtml(html: string): void {
        let container: HTMLDivElement = document.createElement('div');
        container.innerHTML = html;
        let text: string = this.recurseNodes(container);
        container.innerHTML = text;
        text = this.trimSpaces(container);
        document.execCommand('insertHTML', false, text);
    }

    trimSpaces(node: Node): string {
        let result: string = '';
        if (node.nodeType === Node.TEXT_NODE) {
            result = node.textContent.replace(/\s\s+/g, ' ');
        }
        if (node.nodeName === 'IMG') {
            return (node as HTMLImageElement).outerHTML;
        }
        node.childNodes.forEach((child) => {
            result += this.trimSpaces(child);
        });
        return result;
    }

    recurseNodes(node: Node): string {
        let result: string = '';
        if (node.nodeName === 'IMG' && this.isTag(node)) {
            return (node as HTMLImageElement).outerHTML;
        }
        if (node.nodeType === Node.COMMENT_NODE || node.nodeName === 'META' || node.nodeName === 'STYLE'
            || node.nodeName === 'SCRIPT' || node.nodeName === 'LINK') {
            return '';
        }
        if (node.nodeType === Node.TEXT_NODE) {
            let content = node.textContent.replace(/\n/g, '');
            return content;
        }
        node.childNodes.forEach((child) => {
            result += this.recurseNodes(child);
        });
        if (node.nodeName === 'DIV') {
            return result.trim();
        }
        return result;
    }

    isTag(node: Node): boolean {
        let img: HTMLImageElement = node as HTMLImageElement;
        if (img.getAttribute('src').startsWith('data:image')) {
            return true;
        }
        return false;
    }

    resize(): void {
        let height: number = document.body.clientHeight;
        this.mainPanel.style.height = (height - this.topBar.clientHeight - this.bottomBar.clientHeight) + 'px';
    }

    createTopToolbar(): void {
        this.topBar = document.getElementById('topBar') as HTMLDivElement;

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

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.cancelEdit();
        });

        document.getElementById('replaceText').addEventListener('click', () => {
            this.electron.ipcRenderer.send('replace-text');
        });

        document.getElementById('moveDown').addEventListener('click', () => {
            this.moveSegmentDown();
        });

        document.getElementById('moveUp').addEventListener('click', () => {
            this.moveSegmentUp();
        });

        document.getElementById('split').addEventListener('click', () => {
            this.split();
        });

        document.getElementById('mergeNext').addEventListener('click', () => {
            this.mergeNext();
        });

        document.getElementById('remove').addEventListener('click', () => {
            this.removeSegment();
        });

        document.getElementById('export').addEventListener('click', () => {
            this.electron.ipcRenderer.send('export-tmx');
        });

        document.getElementById('delimited').addEventListener('click', () => {
            this.electron.ipcRenderer.send('export-csv');
        });

        document.getElementById('excel').addEventListener('click', () => {
            this.electron.ipcRenderer.send('export-excel');
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
    }

    createCenterPanel(): void {
        this.mainPanel = document.getElementById('main') as HTMLDivElement;
    }

    createBottomToolbar(): void {
        this.bottomBar = document.getElementById('bottomBar') as HTMLDivElement;

        document.getElementById('first').addEventListener('click', () => {
            this.firstPage();
        });

        document.getElementById('previous').addEventListener('click', () => {
            this.previousPage();
        });

        document.getElementById('page').addEventListener('keydown', (ev: KeyboardEvent) => {
            this.pageKeyboardListener(ev);
        });

        document.getElementById('next').addEventListener('click', () => {
            this.nextPage();
        });

        document.getElementById('last').addEventListener('click', () => {
            this.lastPage();
        });

        document.getElementById('rows_page').addEventListener('keydown', (ev: KeyboardEvent) => {
            this.rowsPageKeyboardListener(ev);
        });
    }

    setStatus(text: string): void {
        let status: HTMLDivElement = document.getElementById('status') as HTMLDivElement;
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
        let cells: HTMLCollectionOf<Element> = document.getElementsByClassName('cell');
        for (let cell of cells) {
            cell.addEventListener('click', (ev: MouseEvent) => {
                this.clickListener(ev);
            });
        }
        let fixed: HTMLCollectionOf<Element> = document.getElementsByClassName('fixed');
        for (let cell of fixed) {
            cell.addEventListener('click', (ev: MouseEvent) => {
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

        if (this.autoSelect) {
            let row: HTMLTableRowElement = document.getElementById(this.autoSelect.id) as HTMLTableRowElement;
            if (row) {
                let tableCells: HTMLCollectionOf<HTMLTableCellElement> = row.getElementsByTagName('td');
                for (let cell of tableCells) {
                    if (cell.getAttribute('lang') === this.autoSelect.lang) {
                        this.currentId = this.autoSelect.id;
                        this.currentLang = this.autoSelect.lang;
                        this.currentCell = cell;
                        this.currentContent = this.currentCell.innerHTML;
                        this.currentCell.contentEditable = 'true';
                        this.currentCell.classList.add('editing');
                        this.currentCell.addEventListener('keydown', () => { this.selectionChanged(); });
                        this.currentCell.addEventListener('click', () => { this.selectionChanged(); });
                        this.currentPos = 0;
                        this.currentNode = null;
                        this.currentCell.focus();
                        break;
                    }
                }
            }
            this.autoSelect = null;
        }
    }

    clickListener(event: MouseEvent) {
        let element: Element = (event.target as Element);
        if (element.parentElement.tagName === 'TH') {
            // clicked select all
            return;
        }
        let x: string = element.tagName;
        let id: string;
        let lang: string;
        if ('TD' === x || 'INPUT' === x) {
            let composed = event.composedPath();
            if ('TR' === (composed[0] as Element).tagName) {
                id = (composed[0] as Element).id;
            } else if ('TR' === (composed[1] as Element).tagName) {
                id = (composed[1] as Element).id;
            } else if ('TR' === (composed[2] as Element).tagName) {
                id = (composed[2] as Element).id;
            }
            lang = (event.target as Element).getAttribute('lang');
        }
        if (this.currentCell !== null && this.currentCell.isContentEditable && this.currentId === id && this.currentLang === lang) {
            // same cell
            return;
        }
        if (this.currentCell !== null && this.currentCell.isContentEditable && (this.currentId !== id || this.currentLang !== lang)) {
            this.saveEdit();
        }
        if (id) {
            this.currentId = id;
            if (this.currentCell != null) {
                this.currentCell.innerHTML = this.currentContent;
                this.currentCell = null;
                this.currentContent = null;
            }
            if (lang) {
                this.currentLang = lang;
                this.currentCell = (event.target as HTMLTableCellElement);
                this.currentContent = this.currentCell.innerHTML;
                this.currentCell.contentEditable = 'true';
                this.currentCell.classList.add('editing');
                this.currentCell.addEventListener('keydown', () => { this.selectionChanged(); });
                this.currentCell.addEventListener('click', () => { this.selectionChanged(); });
                let selection: Selection = window.getSelection();
                if (selection.rangeCount !== 0) {
                    this.currentPos = selection.anchorOffset;
                    this.currentNode = selection.anchorNode;
                }
                this.currentCell.focus();
            }
        }
    }

    selectionChanged(): void {
        let selection: Selection = window.getSelection();
        if (selection.rangeCount !== 0) {
            this.currentPos = selection.anchorOffset;
            this.currentNode = selection.anchorNode;
        }
    }

    fixedListener(event: MouseEvent) {
        if (this.currentCell?.isContentEditable) {
            this.saveEdit();
        }
        let element: Element = (event.target as Element);
        if (element.parentElement.tagName === 'TH') {
            // clicked header
            return;
        }
        let x: string = element.tagName;
        let id: string;
        if ('TD' === x) {
            let composed = event.composedPath();
            if ('TR' === (composed[0] as Element).tagName) {
                id = (composed[0] as Element).id;
            } else if ('TR' === (composed[1] as Element).tagName) {
                id = (composed[1] as Element).id;
            } else if ('TR' === (composed[2] as Element).tagName) {
                id = (composed[2] as Element).id;
            }
        }
        if (id) {
            this.currentId = id;
            if (this.currentCell != null) {
                this.currentCell.innerHTML = this.currentContent;
                this.currentCell = null;
                this.currentContent = null;
            }
        }
    }

    saveEdit(): void {
        if (this.currentCell?.isContentEditable) {
            if (this.currentContent === this.currentCell.innerHTML) {
                this.cancelEdit();
                return;
            }
            this.electron.ipcRenderer.send('save-data', { id: this.currentId, lang: this.currentLang, data: this.parseCurrentCell() });
            this.currentContent = this.currentCell.innerHTML;
            this.currentCell.contentEditable = 'false';
            this.currentCell.classList.remove('editing');
            this.currentCell.removeEventListener('keydown', this.selectionChanged);
            this.currentCell.removeEventListener('click', this.selectionChanged);
            this.currentCell = null;
        }
    }

    parseCurrentCell(): string {
        let nodes: NodeListOf<ChildNode> = this.currentCell.childNodes;
        let text: string = '';
        for (let node of nodes) {
            if (node.nodeName === 'IMG') {
                let img: HTMLImageElement = node as HTMLImageElement;
                let title: string = img.getAttribute('title');
                text = text + title;
            } else {
                text = text + node.textContent;
            }
        }
        return text
    }

    cancelEdit(): void {
        if (this.currentCell) {
            this.currentCell.innerHTML = this.currentContent;
            this.currentCell.contentEditable = 'false';
            this.currentCell.classList.remove('editing');
            this.currentCell.removeEventListener('keydown', this.selectionChanged);
            this.currentCell.removeEventListener('click', this.selectionChanged);
            this.currentCell = null;
        }
    }

    moveSegmentDown(): void {
        if (this.currentCell) {
            let id = this.currentId;
            let lang = this.currentLang;
            this.cancelEdit();
            let row: number = Number.parseInt(id);
            this.autoSelect = { id: '' + (row + 1), lang: lang }
            this.electron.ipcRenderer.send('segment-down', { id: id, lang: lang });
        }
    }

    moveSegmentUp(): void {
        if (this.currentCell) {
            let id = this.currentId;
            let lang = this.currentLang;
            this.cancelEdit();
            let row: number = Number.parseInt(id);
            this.autoSelect = { id: '' + (row - 1), lang: lang }
            this.electron.ipcRenderer.send('segment-up', { id: id, lang: lang });
        }
    }

    mergeNext(): void {
        if (this.currentCell) {
            let id = this.currentId;
            let lang = this.currentLang;
            this.cancelEdit();
            this.autoSelect = { id: id, lang: lang }
            this.electron.ipcRenderer.send('merge-next', { id: id, lang: lang });
        }
    }

    split(): void {
        if (this.currentCell) {
            let id = this.currentId;
            let lang = this.currentLang;
            let selection: Selection = window.getSelection();
            if (selection.rangeCount !== 0) {
                let nodes: NodeListOf<ChildNode> = this.currentCell.childNodes;
                let hasNode: boolean = false;
                for (let node of nodes) {
                    if (node.isSameNode(selection.anchorNode)) {
                        hasNode = true;
                        break;
                    }
                }
                let splitNode: Node = hasNode ? selection.anchorNode : this.currentNode;
                let pos: number = hasNode ? selection.anchorOffset : this.currentPos;

                if (pos != 0) {
                    let left: string = '';
                    let right: string = '';

                    let found: boolean = false;
                    for (let node of nodes) {
                        if (node.isSameNode(splitNode)) {
                            let text: string = node.textContent;
                            left = left + text.substring(0, pos);
                            right = text.substring(pos);
                            found = true;
                        } else {
                            if (!found) {
                                if (node.nodeType === Node.ELEMENT_NODE) {
                                    left = left + (node as Element).outerHTML;
                                } else {
                                    left = left + node.textContent;
                                }
                            } else {
                                if (node.nodeType === Node.ELEMENT_NODE) {
                                    right = right + (node as Element).outerHTML;
                                } else {
                                    right = right + node.textContent;
                                }
                            }
                        }
                    }
                    if (left !== '' && right !== '') {
                        this.autoSelect = { id: id, lang: lang };
                        left = this.parseFragment(left);
                        right = this.parseFragment(right);
                        this.electron.ipcRenderer.send('split-data', { id: id, lang: lang, start: left, end: right });
                    }
                }
            }
        }
    }

    parseFragment(fragment: string): string {
        let div: HTMLDivElement = document.createElement('div');
        div.innerHTML = fragment;
        let nodes: NodeListOf<ChildNode> = div.childNodes;
        let text: string = '';
        for (let node of nodes) {
            if (node.nodeName === 'IMG') {
                let img: HTMLImageElement = node as HTMLImageElement;
                let title: string = img.getAttribute('title');
                text = text + title;
            } else {
                text = text + node.textContent;
            }
        }
        return text
    }

    removeSegment(): void {
        if (this.currentCell) {
            let id = this.currentId;
            let lang = this.currentLang;
            this.cancelEdit();
            this.electron.ipcRenderer.send('remove-data', { id: id, lang: lang });
        }
    }
}
