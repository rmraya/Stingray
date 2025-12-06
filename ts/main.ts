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

    ROWSLOAD: number = 300;
    SAFETYROWS: number = 60;
    AVERAGE: number;

    sourceRows: number;
    targetRows: number;
    maxRows: number;
    diffRows: number;

    fetchingData: boolean;
    fetchingTop: boolean;
    fetchingBottom: boolean;
    checkingScroll: boolean;

    scrollToFirst: boolean = false;
    scrollToLast: boolean = false;

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
    tbody: HTMLTableSectionElement;
    srcLang: string;
    tgtLang: string;


    constructor() {

        this.electron.ipcRenderer.send('get-theme');
        this.electron.ipcRenderer.on('set-theme', (event: Electron.IpcRendererEvent, theme: string) => {
            (document.getElementById('theme') as HTMLLinkElement).href = theme;
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
        this.electron.ipcRenderer.on('segment-above', () => {
            this.selectSegmentAbove();
        });
        this.electron.ipcRenderer.on('segment-below', () => {
            this.selectSegmentBelow();
        });
        this.electron.ipcRenderer.on('source-cell', () => {
            this.selectSourceCell();
        });
        this.electron.ipcRenderer.on('target-cell', () => {
            this.selectTargetCell();
        });

        this.electron.ipcRenderer.on('move-up', () => {
            this.moveSegmentUp();
        });
        this.electron.ipcRenderer.on('split-segment', () => {
            this.split();
        });
        this.electron.ipcRenderer.on('insert-cell', () => {
            this.insertCell();
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
        this.electron.ipcRenderer.on('clear-file', () => {
            this.clearFile();
        });

        this.electron.ipcRenderer.on('set-rows', (event: Electron.IpcRendererEvent, arg: any) => {
            this.setRows(arg);
        });

        this.electron.ipcRenderer.on('refresh-page', () => {
            let tableRows: HTMLCollectionOf<HTMLTableRowElement> = this.tbody.getElementsByTagName('tr');
            let start: number = parseInt(tableRows[1].id);
            let count: number = tableRows.length - 2;
            this.getRows(start, count, false);
        });


        this.electron.ipcRenderer.on('file-renamed', (event: Electron.IpcRendererEvent, newName: string) => {
            document.getElementById('title').innerText = 'Stingray - ' + newName;
        });

        document.getElementById('mainPanel').addEventListener('keydown', (e: KeyboardEvent) => {
            // Command/Ctrl + ArrowDown
            if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown') {
                e.preventDefault();
                this.scrollToLast = true;
                this.getRows(this.maxRows - this.ROWSLOAD, this.ROWSLOAD, true);
            }
            // Command/Ctrl + ArrowUp
            if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp') {
                e.preventDefault();
                this.scrollToFirst = true;
                this.getRows(0, this.ROWSLOAD, true);
            }
        });

        document.getElementById('mainPanel').addEventListener('scroll', (e) => {
            this.checkScroll(e);
        });

        document.getElementById('mainPanel').addEventListener('scrollend', (e) => {
            this.checkScrollend(e);
        });

        this.tbody = document.getElementById('tableBody') as HTMLTableSectionElement;


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

        document.getElementById('addCellBelow').addEventListener('click', () => {
            this.insertCell();
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
        this.srcLang = data.srcLang.code;
        this.tgtLang = data.tgtLang.code;

        document.getElementById('sourceHeader').innerText = data.srcLang.code + ' - ' + data.srcLang.description;
        document.getElementById('targetHeader').innerText = data.tgtLang.code + ' - ' + data.tgtLang.description;

        this.maxRows = this.sourceRows;
        if (this.targetRows > this.maxRows) {
            this.maxRows = this.targetRows;
        }

        this.diffRows = this.sourceRows - this.targetRows;
        if (this.targetRows > this.sourceRows) {
            this.diffRows = this.targetRows - this.sourceRows;
        }

        document.getElementById('totalRows').innerText = '' + this.maxRows;
        document.getElementById('sourceRows').innerText = '' + this.sourceRows;
        document.getElementById('targetRows').innerText = '' + this.targetRows;
        document.getElementById('diffRows').innerText = '' + this.diffRows;

        if (this.diffRows > 0) {
            document.getElementById('diffRows').classList.add('diffColor');
        } else {
            document.getElementById('diffRows').classList.remove('diffColor');
        }

        let count: number = this.ROWSLOAD > this.maxRows ? this.maxRows : this.ROWSLOAD;
        let start: number = 0;
        this.electron.ipcRenderer.send('get-rows', {
            start: start,
            count: count,
            scroll: false
        });
    }

    clearFile(): void {
        document.getElementById('title').innerText = 'Stingray';
        document.getElementById('sourceHeader').innerText = 'Source';
        document.getElementById('targetHeader').innerText = 'Target';
        this.tbody.innerHTML = '';
        document.getElementById('totalRows').innerText = '';
        document.getElementById('sourceRows').innerText = '';
        document.getElementById('targetRows').innerText = '';
    }

    getRows(start: number, count: number, scroll: boolean): void {
        this.electron.ipcRenderer.send('get-rows', {
            start: start,
            count: count,
            scroll: scroll
        });
    }

    setRows(data: any): void {
        if (this.fetchingTop) {
            this.setTopRows(data);
            return;
        }
        if (this.fetchingBottom) {
            this.setBottomRows(data);
            return;
        }

        let html: string = '';
        let rows: string[] = data.rows;
        let length: number = rows.length;
        for (let i = 0; i < length; i++) {
            html = html + rows[i];
        }
        this.tbody.innerHTML = html;

        let firstChild: HTMLTableRowElement = this.tbody.firstChild as HTMLTableRowElement;
        let firstRow: number = parseInt(firstChild.id);
        let lastChild: HTMLTableRowElement = this.tbody.lastChild as HTMLTableRowElement;
        let lastRow: number = parseInt(lastChild.id);

        let loadHeight: number = this.tbody.clientHeight;
        this.AVERAGE = loadHeight / length;
        let totalHeight: number = this.AVERAGE * this.maxRows;
        let topHeight: number = firstRow * this.AVERAGE;
        let bottomHeight: number = totalHeight - topHeight - loadHeight;

        let fillerTop: HTMLTableRowElement = document.createElement('tr');
        fillerTop.id = "fillerTop";
        fillerTop.style.height = '0px';

        let fillerBottom: HTMLTableRowElement = document.createElement('tr');
        fillerBottom.id = "fillerBottom";
        fillerBottom.style.height = '0px';

        this.tbody.prepend(fillerTop);
        this.tbody.appendChild(fillerBottom);

        fillerTop.style.height = topHeight + 'px';
        fillerBottom.style.height = bottomHeight + 'px';

        if (firstRow === 0) {
            fillerTop.style.height = '0px';
        }

        if (lastRow === this.maxRows - 1) {
            fillerBottom.style.height = '0px';
        }

        this.sourceRows = data.srcRows;
        this.targetRows = data.tgtRows;
        this.maxRows = this.sourceRows;
        if (this.targetRows > this.maxRows) {
            this.maxRows = this.targetRows;
        }

        this.diffRows = this.sourceRows - this.targetRows;
        if (this.targetRows > this.sourceRows) {
            this.diffRows = this.targetRows - this.sourceRows;
        }

        document.getElementById('totalRows').innerText = '' + this.maxRows;
        document.getElementById('sourceRows').innerText = '' + this.sourceRows;
        document.getElementById('targetRows').innerText = '' + this.targetRows;
        document.getElementById('diffRows').innerText = '' + this.diffRows;

        if (this.diffRows > 0) {
            document.getElementById('diffRows').classList.add('diffColor');
        } else {
            document.getElementById('diffRows').classList.remove('diffColor');
        }

        let cells: HTMLCollectionOf<Element> = document.getElementsByClassName('cell');
        for (let cell of cells) {
            cell.addEventListener('click', (ev: MouseEvent) => {
                this.clickListener(ev);
            });
            cell.addEventListener('focus', (ev: FocusEvent) => {
                this.focusListener(ev);
            });
            cell.addEventListener('keydown', (ev: KeyboardEvent) => {
                this.keyListener(ev);
            });
        }
        let fixed: HTMLCollectionOf<Element> = document.getElementsByClassName('fixed');
        for (let cell of fixed) {
            cell.addEventListener('click', (ev: MouseEvent) => {
                this.fixedListener(ev);
            });
        }

        document.getElementById('mainPanel').focus();

        if (this.autoSelect) {
            let row: HTMLTableRowElement = document.getElementById(this.autoSelect.id) as HTMLTableRowElement;
            if (row) {
                row.scrollIntoView({ behavior: "smooth", block: "center", inline: "start" });
                let rowCells: HTMLCollectionOf<HTMLTableCellElement> = row.getElementsByTagName('td');
                for (let cell of rowCells) {
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
                        cell.focus();
                        break;
                    }
                }
            }
            this.autoSelect = null;
        }

        let middleValue: number = Math.floor(firstRow + length / 2);

        setTimeout(() => {
            if (firstRow === 0 && this.scrollToFirst && data.scroll) {
                let rowOne: HTMLTableRowElement = document.getElementById('' + firstRow) as HTMLTableRowElement;
                rowOne.scrollIntoView({ behavior: "smooth", block: "start", inline: "start" });
                document.getElementById('mainPanel').scrollTop = 0; // reset scroll position to the top
                this.scrollToFirst = false; // reset scroll to first
            }
            if (lastRow === (this.maxRows - 1) && this.scrollToLast && data.scroll) {
                let rowMax: HTMLTableRowElement = document.getElementById('' + lastRow) as HTMLTableRowElement;
                rowMax.scrollIntoView({ behavior: "smooth", block: "end", inline: "start" });
                document.getElementById('mainPanel').scrollTop = totalHeight; // set scroll position to the bottom
                this.scrollToLast = false; // reset scroll to last
            }
            if (firstRow !== 0 && lastRow !== this.maxRows - 1 && data.scroll) {
                let middleRow: HTMLTableRowElement = document.getElementById('' + middleValue) as HTMLTableRowElement;
                middleRow.scrollIntoView({ behavior: "smooth", block: "center", inline: "start" });
            }
            this.fetchingData = false;
            document.body.style.cursor = 'default';
            this.checkingScroll = false;
        }, 500);

    }

    setTopRows(data: any): void {
        let mainRows: HTMLTableSectionElement = document.getElementById('tableBody') as HTMLTableSectionElement;
        let trs: HTMLCollectionOf<HTMLTableRowElement> = mainRows.getElementsByTagName('tr');
        let array: HTMLTableRowElement[] = Array.from(trs);

        let rows: string[] = data.rows;
        let length: number = rows.length;

        let removedHeight: number = 0;
        for (let i = array.length - 2 - length; i < array.length - 1; i++) {
            let row: HTMLTableRowElement = trs[i];
            let height: number = row.clientHeight;
            removedHeight = removedHeight + height + 4; // 4px for the border
        }

        let holder: HTMLTableSectionElement = document.createElement('tbody');
        holder.style.width = mainRows.clientWidth + 'px';
        let html: string = '';
        for (let i = 0; i < length; i++) {
            html = html + rows[i];
        }
        holder.innerHTML = html;
        let addedRows: HTMLTableRowElement[] = Array.from(holder.getElementsByTagName('tr'));

        array.splice(1, 0, ...addedRows); // add rows to the top
        array.splice(array.length - 1 - addedRows.length, addedRows.length); // remove rows from the bottom

        html = '';
        length = array.length;
        for (let i = 0; i < length; i++) {
            html = html + array[i].outerHTML;
        }
        this.tbody.innerHTML = html;

        let realHeight: number = 0;
        let tableRows: HTMLCollectionOf<HTMLTableRowElement> = this.tbody.getElementsByTagName('tr');
        for (let i = 1; i < array.length - 1; i++) {
            let row: HTMLTableRowElement = tableRows[i] as HTMLTableRowElement;
            let height: number = row.clientHeight;
            realHeight += height + 4; // 4px for the border
        }

        let addedHeight: number = 0;
        for (let i = 0; i < addedRows.length; i++) {
            let row: HTMLTableRowElement = tableRows[i + 1] as HTMLTableRowElement;
            let height: number = row.clientHeight;
            addedHeight = addedHeight + height + 4; // 4px for the border
        }

        let firstRow: number = parseInt(array[1].id);
        let lastRow: number = parseInt(array[array.length - 2].id);
        this.AVERAGE = realHeight / (array.length - 2);

        let fillerTop: HTMLTableRowElement = document.getElementById('fillerTop') as HTMLTableRowElement;
        let fillerBottom: HTMLTableRowElement = document.getElementById('fillerBottom') as HTMLTableRowElement;
        let currentTop: number = fillerTop.clientHeight;
        let currentBottom: number = fillerBottom.clientHeight;
        let topHeight: number = currentTop - addedHeight;
        let bottomHeight: number = currentBottom + removedHeight;

        fillerTop.style.height = topHeight + 'px';
        fillerBottom.style.height = bottomHeight + 'px';

        if (firstRow === 0) {
            fillerTop.style.height = '0px';
        }

        if (lastRow === this.maxRows - 1) {
            fillerBottom.style.height = '0px';
        }

        let cells: HTMLCollectionOf<Element> = document.getElementsByClassName('cell');
        for (let cell of cells) {
            cell.addEventListener('click', (ev: MouseEvent) => {
                this.clickListener(ev);
            });
            cell.addEventListener('focus', (ev: FocusEvent) => {
                this.focusListener(ev);
            });
            cell.addEventListener('keydown', (ev: KeyboardEvent) => {
                this.keyListener(ev);
            });
        }
        let fixed: HTMLCollectionOf<Element> = document.getElementsByClassName('fixed');
        for (let cell of fixed) {
            cell.addEventListener('click', (ev: MouseEvent) => {
                this.fixedListener(ev);
            });
        }

        document.getElementById('mainPanel').focus();

        if (this.autoSelect) {
            let row: HTMLTableRowElement = document.getElementById(this.autoSelect.id) as HTMLTableRowElement;
            if (row) {
                row.scrollIntoView({ behavior: "smooth", block: "center", inline: "start" });
                let rowCells: HTMLCollectionOf<HTMLTableCellElement> = row.getElementsByTagName('td');
                for (let cell of rowCells) {
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
                        cell.focus();
                        break;
                    }
                }
            }
            this.autoSelect = null;
        }

        this.fetchingTop = false;
        document.body.style.cursor = 'default';
        this.checkingScroll = false;
    }

    setBottomRows(data: any): void {
        let mainRows: HTMLTableSectionElement = document.getElementById('tableBody') as HTMLTableSectionElement;
        let trs: HTMLCollectionOf<HTMLTableRowElement> = mainRows.getElementsByTagName('tr');
        let array: HTMLTableRowElement[] = Array.from(trs);

        let rows: string[] = data.rows;
        let length: number = rows.length;

        let removedHeight: number = 0;
        for (let i = 0; i < length; i++) {
            let row: HTMLTableRowElement = trs[i + 1];
            let height: number = row.clientHeight;
            removedHeight = removedHeight + height + 4; // 4px for the border
        }

        let holder: HTMLTableSectionElement = document.createElement('tbody');
        holder.style.width = mainRows.clientWidth + 'px';
        let html: string = '';
        for (let i = 0; i < length; i++) {
            html = html + rows[i];
        }
        holder.innerHTML = html;
        let addedRows: HTMLTableRowElement[] = Array.from(holder.getElementsByTagName('tr'));

        array.splice(array.length - 1, 0, ...addedRows); // add rows to the bottom
        array.splice(1, addedRows.length); // remove rows from the top      

        html = '';
        length = array.length;
        for (let i = 0; i < length; i++) {
            html = html + array[i].outerHTML;
        }
        this.tbody.innerHTML = html;

        let realHeight: number = 0;
        let tableRows: HTMLCollectionOf<HTMLTableRowElement> = this.tbody.getElementsByTagName('tr');
        for (let i = 1; i < array.length - 1; i++) {
            let row: HTMLTableRowElement = tableRows[i] as HTMLTableRowElement;
            let height: number = row.clientHeight;
            realHeight = realHeight + height + 4; // 4px for the border
        }

        let addedHeight: number = 0;
        for (let i = array.length - 1 - addedRows.length; i < array.length - 1; i++) {
            let row: HTMLTableRowElement = tableRows[i] as HTMLTableRowElement;
            let height: number = row.clientHeight;
            addedHeight = addedHeight + height + 4; // 4px for the border
        }

        let firstRow: number = parseInt(array[1].id);
        let lastRow: number = parseInt(array[array.length - 2].id);

        this.AVERAGE = realHeight / (array.length - 2);

        let fillerTop: HTMLTableRowElement = document.getElementById('fillerTop') as HTMLTableRowElement;
        let fillerBottom: HTMLTableRowElement = document.getElementById('fillerBottom') as HTMLTableRowElement;
        let currentTop: number = fillerTop.clientHeight;
        let currentBottom: number = fillerBottom.clientHeight;
        let topHeight: number = currentTop + removedHeight;
        let bottomHeight: number = currentBottom - addedHeight;

        fillerTop.style.height = topHeight + 'px';
        fillerBottom.style.height = bottomHeight + 'px';

        if (firstRow === 0) {
            fillerTop.style.height = '0px';
        }

        if (lastRow === this.maxRows - 1) {
            fillerBottom.style.height = '0px';
        }

        let cells: HTMLCollectionOf<Element> = document.getElementsByClassName('cell');
        for (let cell of cells) {
            cell.addEventListener('click', (ev: MouseEvent) => {
                this.clickListener(ev);
            });
            cell.addEventListener('focus', (ev: FocusEvent) => {
                this.focusListener(ev);
            });
            cell.addEventListener('keydown', (ev: KeyboardEvent) => {
                this.keyListener(ev);
            });
        }
        let fixed: HTMLCollectionOf<Element> = document.getElementsByClassName('fixed');
        for (let cell of fixed) {
            cell.addEventListener('click', (ev: MouseEvent) => {
                this.fixedListener(ev);
            });
        }

        document.getElementById('mainPanel').focus();

        if (this.autoSelect) {
            let row: HTMLTableRowElement = document.getElementById(this.autoSelect.id) as HTMLTableRowElement;
            if (row) {
                row.scrollIntoView({ behavior: "smooth", block: "center", inline: "start" });
                let rowCells: HTMLCollectionOf<HTMLTableCellElement> = row.getElementsByTagName('td');
                for (let cell of rowCells) {
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
                        cell.focus();
                        break;
                    }
                }
            }
            this.autoSelect = null;
        }

        this.fetchingBottom = false;
        document.body.style.cursor = 'default';
        this.checkingScroll = false;
    }

    checkScroll(e: Event): void {
        if (this.fetchingData || this.fetchingBottom || this.fetchingTop) {
            e.preventDefault();
            return;
        }
        if (this.checkingScroll) {
            e.preventDefault();
            return;
        }
    }

    checkScrollend(e: Event): void {
        if (this.fetchingData || this.fetchingBottom || this.fetchingTop) {
            e.preventDefault();
            return;
        }

        this.checkingScroll = true;
        if (this.checkingScroll) {
            e.preventDefault();
        }

        let tableRows: HTMLCollectionOf<HTMLTableRowElement> = this.tbody.getElementsByTagName('tr');
        let firstRow: number = parseInt(tableRows[1].id);
        let lastRow: number = parseInt(tableRows[tableRows.length - 2].id);

        let fillerTop: HTMLTableRowElement = document.getElementById('fillerTop') as HTMLTableRowElement;
        let fillerBottom: HTMLTableRowElement = document.getElementById('fillerBottom') as HTMLTableRowElement;
        let topHeight: number = fillerTop.clientHeight;
        let bottomHeight: number = fillerBottom.clientHeight;
        let contentHeight: number = document.getElementById('tableBody').clientHeight - topHeight - bottomHeight;
        let tableBottom: number = topHeight + contentHeight;
        let fileHeight: number = document.getElementById('tableBody').clientHeight;

        let safetyHeight: number = this.SAFETYROWS * this.AVERAGE;

        let mainPanel: HTMLDivElement = document.getElementById('mainPanel') as HTMLDivElement;
        let mainScroll: number = mainPanel.scrollTop;
        let scrollRow: number = Math.floor(mainScroll / this.AVERAGE);

        if (mainScroll <= this.AVERAGE * 15) {
            this.scrollToFirst = true;
        }

        if (mainScroll >= fileHeight - this.AVERAGE * 15) {
            this.scrollToLast = true;
        }

        if (scrollRow >= this.maxRows - 1) {
            scrollRow = this.maxRows - 1;
        }

        if (mainScroll < topHeight || mainScroll > tableBottom) {
            this.fetchingData = true;
            document.body.style.cursor = 'wait';

            let start: number = scrollRow - (this.ROWSLOAD / 2);
            if (start < 0) {
                start = 0;
            }

            let count: number = this.ROWSLOAD;
            if (count + start >= this.maxRows) {
                start = this.maxRows - this.ROWSLOAD;
                count = this.maxRows - start;
            }

            this.getRows(start, count, true);

            return;
        }

        if (mainScroll > topHeight && mainScroll < topHeight + safetyHeight && mainScroll > safetyHeight) {

            if (firstRow === 0) {
                return;
            }

            this.fetchingTop = true;
            document.body.style.cursor = 'wait';

            let start: number = firstRow - 1 - this.SAFETYROWS;
            let count: number = this.SAFETYROWS;

            if (start < this.SAFETYROWS) {
                start = 0;
                count = firstRow - 1;
            }

            this.getRows(start, count, true);

            return;
        }

        if (mainScroll > tableBottom - safetyHeight && mainScroll < tableBottom) {
            if (lastRow === this.maxRows - 1) {
                return;
            }

            this.fetchingBottom = true;
            document.body.style.cursor = 'wait';

            let start: number = lastRow + 1;

            let count: number = this.SAFETYROWS;

            if (this.maxRows - (start + count) < this.SAFETYROWS) {
                count = this.maxRows - start;
            }

            this.getRows(start, count, true);

            return;
        }

        if (mainScroll > topHeight + safetyHeight && mainScroll < tableBottom - safetyHeight) {
            this.checkingScroll = false;
            return;
        }

    }

    focusListener(event: FocusEvent) {
        let cell: HTMLTableCellElement = event.target as HTMLTableCellElement;
        let row: HTMLTableRowElement = cell.parentElement as HTMLTableRowElement;
        this.currentId = row.id;
        this.currentLang = cell.getAttribute('lang');
        row.scrollIntoView({ behavior: "smooth", block: "center", inline: "start" });
    }

    keyListener(event: KeyboardEvent) {
        // capture pgUp and pgdown to select cells
        if (event.key === 'PageUp') {
            this.selectSegmentAbove();
            event.preventDefault();
            event.stopPropagation();
        }
        if (event.key === 'PageDown') {
            this.selectSegmentBelow();
            event.preventDefault();
            event.stopPropagation();
        }
        if (event.altKey && event.key === 'ArrowLeft') {
            this.selectSourceCell();
            event.preventDefault();
            event.stopPropagation();
        }
        if (event.altKey && event.key === 'ArrowRight') {
            this.selectTargetCell();
            event.preventDefault();
            event.stopPropagation();
        }
    }

    clickListener(event: MouseEvent) {
        console.log('clicked');
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
            let currentRow: HTMLTableRowElement = document.getElementById('' + this.currentId) as HTMLTableRowElement;
            currentRow.scrollIntoView({ behavior: "smooth", block: "center", inline: "start" });

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
        return text;
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
        return text;
    }

    removeSegment(): void {
        if (this.currentCell) {
            let id = this.currentId;
            let lang = this.currentLang;
            this.cancelEdit();
            let row: number = Number.parseInt(id);
            this.autoSelect = { id: '' + row, lang: lang }
            this.electron.ipcRenderer.send('remove-data', { id: id, lang: lang });
        }
    }

    selectSegmentAbove(): void {
        if (this.currentCell) {
            let id = this.currentId;
            let row: number = Number.parseInt(id);
            this.selectCell('' + (row - 1), this.currentLang);
        }
    }

    selectSegmentBelow(): void {
        if (this.currentCell) {
            let id = this.currentId;
            let row: number = Number.parseInt(id);
            this.selectCell('' + (row + 1), this.currentLang);
        }
    }

    selectCell(id: string, lang: string): void {
        if (this.currentCell !== null && this.currentCell.isContentEditable && this.currentContent !== this.currentCell.innerHTML) {
            this.autoSelect = { id: id, lang: lang };
            this.saveEdit();
            return;
        }
        let row: HTMLTableRowElement = document.getElementById(id) as HTMLTableRowElement;
        if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center", inline: "start" });
            let rowCells: HTMLCollectionOf<HTMLTableCellElement> = row.getElementsByTagName('td');
            for (let cell of rowCells) {
                if (cell.getAttribute('lang') === lang) {
                    cell.click();
                }
            }
        }
    }

    selectSourceCell(): void {
        if (this.currentCell) {
            let id = this.currentId;
            let row: number = Number.parseInt(id);
            this.selectCell('' + row, this.srcLang);
        }
    }

    selectTargetCell(): void {
        if (this.currentCell) {
            let id = this.currentId;
            let row: number = Number.parseInt(id);
            this.selectCell('' + row, this.tgtLang);
        }
    }

    insertCell(): void {
        if (this.currentCell) {
            let lang = this.currentLang;
            let id = this.currentId;
            let row: number = Number.parseInt(id);
            this.autoSelect = { id: '' + (row + 1), lang: lang };
            this.electron.ipcRenderer.send('insert-cell', { id: id, lang: lang });
            console.log('add cell below');
        }
    }
}
