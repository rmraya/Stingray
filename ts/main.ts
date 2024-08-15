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
    }

    resize(): void {
        let height: number = document.body.clientHeight;
        this.mainPanel.style.height = (height - this.topBar.clientHeight - this.bottomBar.clientHeight) + 'px';
    }

    createTopToolbar(): void {
        this.topBar = document.getElementById('topBar') as HTMLDivElement;

        let newFile: HTMLAnchorElement = document.createElement('a');
        newFile.id = 'newFile';
        newFile.classList.add('tooltip');
        newFile.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24" height="24" width="24"><path style="stroke-width:0.1" d="m 21,16.166667 h -2.454545 v -2.5 h -1.636364 v 2.5 h -2.454546 v 1.666666 h 2.454546 v 2.5 h 1.636364 v -2.5 H 21 Z m -5.727273,4.166666 V 22 H 3 V 2 h 8.336455 c 2.587909,0 8.027181,6.0191667 8.027181,8.011667 V 12 h -1.636363 v -1.285833 c 0,-3.4225003 -4.909091,-2.0475003 -4.909091,-2.0475003 0,0 1.242,-5 -2.158364,-5 H 4.6363636 V 20.333333 Z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">New Alignment</span>';
        newFile.addEventListener('click', () => {
            this.electron.ipcRenderer.send('new-file');
        });
        this.topBar.appendChild(newFile);

        let openFile: HTMLAnchorElement = document.createElement('a');
        openFile.id = 'openFile';
        openFile.classList.add('tooltip');
        openFile.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24" height="24" width="24"><path style="stroke-width:0.1" id="path299" d="m 20.0575,11.2 -1.154167,7.2 H 5.0966667 L 3.9425,11.2 Z M 8.6433333,4 h -5.81 l 0.595,4 H 5.1125 L 4.755,5.6 H 7.8333333 C 8.76,6.7104 9.46,7.2 11.3975,7.2 h 7.735833 L 18.966667,8 h 1.7 l 0.5,-2.4 H 11.3975 C 9.7491667,5.6 9.6966667,5.2664 8.6433333,4 Z M 22,9.6 H 2 L 3.6666667,20 H 20.333333 Z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Open Alignment</span>';
        openFile.addEventListener('click', () => {
            this.electron.ipcRenderer.send('open-file');
        });
        this.topBar.appendChild(openFile);

        let saveFile: HTMLAnchorElement = document.createElement('a');
        saveFile.id = 'saveFile';
        saveFile.classList.add('tooltip');
        saveFile.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24" height="24" width="24"><path style="0.1" d="m 13.555556,3.6666667 v 9.1666663 h 1.952222 L 12,17.008333 8.4922222,12.833333 H 10.444444 V 3.6666667 Z M 15.111111,2 H 8.8888889 v 9.166667 H 5 L 12,19.5 19,11.166667 h -3.888889 z m 2.333333,15.833333 v 2.5 H 6.5555556 v -2.5 H 5 V 22 h 14 v -4.166667 z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Save Alignment</span>';
        saveFile.addEventListener('click', () => {
            this.electron.ipcRenderer.send('save-file');
        });
        this.topBar.appendChild(saveFile);

        let span1: HTMLSpanElement = document.createElement('span');
        span1.style.width = '32px';
        span1.innerHTML = '&nbsp;';
        this.topBar.appendChild(span1);

        let saveEdit: HTMLAnchorElement = document.createElement('a');
        saveEdit.id = 'saveEdit';
        saveEdit.classList.add('tooltip');
        saveEdit.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24" height="24" width="24"><path style="stroke-width:0.1" d="M 12,3.6666667 C 16.595,3.6666667 20.333333,7.405 20.333333,12 20.333333,16.595 16.595,20.333333 12,20.333333 7.405,20.333333 3.6666667,16.595 3.6666667,12 3.6666667,7.405 7.405,3.6666667 12,3.6666667 Z M 12,2 C 6.4775,2 2,6.4775 2,12 2,17.5225 6.4775,22 12,22 17.5225,22 22,17.5225 22,12 22,6.4775 17.5225,2 12,2 Z m 3.660833,6.25 -4.7025,4.82 L 8.755,10.981667 7.2083333,12.53 l 3.7499997,3.636667 6.25,-6.369167 z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Confirm Edit</span>';
        saveEdit.addEventListener('click', () => {
            this.saveEdit();
        });
        this.topBar.appendChild(saveEdit);

        let cancelEdit: HTMLAnchorElement = document.createElement('a');
        cancelEdit.id = 'cancelEdit';
        cancelEdit.classList.add('tooltip');
        cancelEdit.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24" height="24" width="24"><path style="stroke-width:0.1" d="M 12,3.6666667 C 16.595,3.6666667 20.333333,7.405 20.333333,12 20.333333,16.595 16.595,20.333333 12,20.333333 7.405,20.333333 3.6666667,16.595 3.6666667,12 3.6666667,7.405 7.405,3.6666667 12,3.6666667 Z M 12,2 C 6.4775,2 2,6.4775 2,12 2,17.5225 6.4775,22 12,22 17.5225,22 22,17.5225 22,12 22,6.4775 17.5225,2 12,2 Z m 5,13.781667 -3.826667,-3.79 L 16.961667,8.1691667 15.781667,7 11.994167,10.824167 8.1708333,7.0383333 7,8.2091667 10.8275,12.0025 7.0383333,15.829167 8.2091667,17 12.005,13.17 l 3.825833,3.791667 z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Cancel Edit</span>';
        cancelEdit.addEventListener('click', () => {
            this.cancelEdit();
        });
        this.topBar.appendChild(cancelEdit);

        let span2: HTMLSpanElement = document.createElement('span');
        span2.style.width = '32px';
        span2.innerHTML = '&nbsp;';
        this.topBar.appendChild(span2);

        let replaceText: HTMLAnchorElement = document.createElement('a');
        replaceText.id = 'replaceText';
        replaceText.classList.add('tooltip');
        replaceText.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24" height="24" width="24"><path style="stroke-width:0.1" d="M 13.515011,15.871667 C 12.454179,16.535833 11.243347,16.918333 10.013349,17 L 9.5658494,15.3475 c 1.7358316,-0.01583 3.4433286,-0.7925 4.5749936,-2.27 1.779165,-2.325 1.519998,-5.575 -0.479166,-7.615 L 12.185013,7.3908333 10.710015,2 h 5.537492 l -1.564164,2.1275 c 2.562496,2.4508333 3.067496,6.3825 1.185831,9.385 L 22,19.643333 19.643336,22 Z M 4.3283562,14.935 C 2.8025249,13.480833 2.0050259,11.496667 2.000026,9.5 1.9958593,7.91 2.4933586,6.315 3.5333573,4.9566667 4.8975221,3.175 6.9091862,2.1516667 8.9908502,2.0158333 l 0.4533327,1.6508334 c -1.7391644,0.0125 -3.4516622,0.8241666 -4.584994,2.305 C 3.0766912,8.3008333 3.3408575,11.559167 5.3500216,13.6 L 6.828353,11.669167 8.3100177,17 H 2.7775249 Z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Replace Text</span>';
        replaceText.addEventListener('click', () => {
            this.electron.ipcRenderer.send('replace-text');
        });
        this.topBar.appendChild(replaceText);

        let span3: HTMLSpanElement = document.createElement('span');
        span3.style.width = '32px';
        span3.innerHTML = '&nbsp;';
        this.topBar.appendChild(span3);

        let moveDown: HTMLAnchorElement = document.createElement('a');
        moveDown.id = 'moveDown';
        moveDown.classList.add('tooltip');
        moveDown.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Move Segment Down</span>';
        moveDown.addEventListener('click', () => {
            this.moveSegmentDown();
        });
        this.topBar.appendChild(moveDown);

        let moveUp: HTMLAnchorElement = document.createElement('a');
        moveUp.id = 'moveUp';
        moveUp.classList.add('tooltip');
        moveUp.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Move Segment Up</span>';
        moveUp.addEventListener('click', () => {
            this.moveSegmentUp();
        });
        this.topBar.appendChild(moveUp);

        let split: HTMLAnchorElement = document.createElement('a');
        split.id = 'split';
        split.classList.add('tooltip');
        split.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M8 19h3v4h2v-4h3l-4-4-4 4zm8-14h-3V1h-2v4H8l4 4 4-4zM4 11v2h16v-2H4z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Split Segment</span>';
        split.addEventListener('click', () => {
            this.split();
        });
        this.topBar.appendChild(split);

        let mergeNext: HTMLAnchorElement = document.createElement('a');
        mergeNext.id = 'mergeNext';
        mergeNext.classList.add('tooltip');
        mergeNext.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M16 13h-3V3h-2v10H8l4 4 4-4zM4 19v2h16v-2H4z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Merge with Next Segment</span>';
        mergeNext.addEventListener('click', () => {
            this.mergeNext();
        });
        this.topBar.appendChild(mergeNext);

        let remove: HTMLAnchorElement = document.createElement('a');
        remove.id = 'remove';
        remove.classList.add('tooltip');
        remove.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Remove Segment</span>';
        remove.addEventListener('click', () => {
            this.removeSegment();
        });
        this.topBar.appendChild(remove);

        let span4: HTMLSpanElement = document.createElement('span');
        span4.style.width = '32px';
        span4.innerHTML = '&nbsp;';
        this.topBar.appendChild(span4);

        let exportTmx: HTMLAnchorElement = document.createElement('a');
        exportTmx.id = 'export';
        exportTmx.classList.add('tooltip');
        exportTmx.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Export TMX</span>';
        exportTmx.addEventListener('click', () => {
            this.electron.ipcRenderer.send('export-tmx');
        });
        this.topBar.appendChild(exportTmx);

        let delimited: HTMLAnchorElement = document.createElement('a');
        delimited.id = 'delimited';
        delimited.classList.add('tooltip');
        delimited.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Export TAB Delimited</span>';
        delimited.addEventListener('click', () => {
            this.electron.ipcRenderer.send('export-csv');
        });
        this.topBar.appendChild(delimited);

        let exportExcel: HTMLAnchorElement = document.createElement('a');
        exportExcel.id = 'excel';
        exportExcel.classList.add('tooltip');
        exportExcel.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g>' +
        '<path d="M13.5 23.5C13.4745 23.5 13.4491 23.498 13.424 23.494L0.424 21.494C0.305983 21.4759 0.198357 21.4161 0.120589 21.3255C0.0428206 21.2349 4.54341e-05 21.1194 0 21L0 4C6.66312e-05 3.88691 0.0384697 3.77718 0.10894 3.68873C0.179409 3.60028 0.277783 3.53833 0.388 3.513L13.388 0.513002C13.4613 0.495567 13.5376 0.495025 13.6111 0.511416C13.6847 0.527807 13.7535 0.560702 13.8125 0.607615C13.8714 0.654528 13.9189 0.714231 13.9514 0.782209C13.9839 0.850187 14.0005 0.924662 14 1V23C14.0005 23.0658 13.988 23.1311 13.963 23.192C13.9381 23.2529 13.9013 23.3082 13.8547 23.3547C13.8082 23.4013 13.7529 23.4381 13.692 23.463C13.6311 23.488 13.5658 23.5005 13.5 23.5V23.5ZM1 20.571L13 22.417V1.628L1 4.398V20.571V20.571Z"/>' +
        '<path d="M23.5 21.5H13.5C13.3674 21.5 13.2402 21.4473 13.1464 21.3536C13.0527 21.2598 13 21.1326 13 21C13 20.8674 13.0527 20.7402 13.1464 20.6464C13.2402 20.5527 13.3674 20.5 13.5 20.5H23V3.5H13.5C13.3674 3.5 13.2402 3.44732 13.1464 3.35355C13.0527 3.25979 13 3.13261 13 3C13 2.86739 13.0527 2.74021 13.1464 2.64645C13.2402 2.55268 13.3674 2.5 13.5 2.5H23.5C23.6326 2.5 23.7598 2.55268 23.8536 2.64645C23.9473 2.74021 24 2.86739 24 3V21C24 21.1326 23.9473 21.2598 23.8536 21.3536C23.7598 21.4473 23.6326 21.5 23.5 21.5ZM9.5 16.5C9.41514 16.5003 9.33163 16.4788 9.25741 16.4377C9.18319 16.3966 9.12073 16.3371 9.076 16.265L4.076 8.265C4.0412 8.20932 4.01771 8.14733 4.00686 8.08257C3.99602 8.01781 3.99804 7.95155 4.0128 7.88757C4.04262 7.75836 4.12255 7.64628 4.235 7.576C4.34745 7.50572 4.48322 7.48299 4.61243 7.5128C4.74164 7.54262 4.85372 7.62255 4.924 7.735L9.924 15.735C9.9713 15.8107 9.99749 15.8977 9.99983 15.9869C10.0022 16.0761 9.98059 16.1643 9.93732 16.2424C9.89406 16.3204 9.83068 16.3855 9.75378 16.4308C9.67688 16.4761 9.58925 16.5 9.5 16.5V16.5Z"/>' +
        '<path d="M4.5 16.5C4.41075 16.5 4.32312 16.4761 4.24622 16.4308C4.16932 16.3855 4.10595 16.3204 4.06268 16.2424C4.01941 16.1643 3.99783 16.0761 4.00017 15.9869C4.00251 15.8977 4.0287 15.8107 4.076 15.735L9.076 7.735C9.14628 7.62255 9.25836 7.54262 9.38757 7.5128C9.51678 7.48299 9.65255 7.50572 9.765 7.576C9.87745 7.64628 9.95738 7.75836 9.9872 7.88757C10.017 8.01678 9.99428 8.15255 9.924 8.265L4.924 16.265C4.87906 16.3369 4.81656 16.3962 4.74239 16.4373C4.66821 16.4784 4.5848 16.5 4.5 16.5V16.5ZM17.5 21.5C17.3674 21.5 17.2402 21.4473 17.1464 21.3536C17.0527 21.2598 17 21.1326 17 21V3C17 2.86739 17.0527 2.74021 17.1464 2.64645C17.2402 2.55268 17.3674 2.5 17.5 2.5C17.6326 2.5 17.7598 2.55268 17.8536 2.64645C17.9473 2.74021 18 2.86739 18 3V21C18 21.1326 17.9473 21.2598 17.8536 21.3536C17.7598 21.4473 17.6326 21.5 17.5 21.5Z" />' +
        '<path d="M23.5 18.5H13.5C13.3674 18.5 13.2402 18.4473 13.1464 18.3536C13.0527 18.2598 13 18.1326 13 18C13 17.8674 13.0527 17.7402 13.1464 17.6464C13.2402 17.5527 13.3674 17.5 13.5 17.5H23.5C23.6326 17.5 23.7598 17.5527 23.8536 17.6464C23.9473 17.7402 24 17.8674 24 18C24 18.1326 23.9473 18.2598 23.8536 18.3536C23.7598 18.4473 23.6326 18.5 23.5 18.5ZM23.5 15.5H13.5C13.3674 15.5 13.2402 15.4473 13.1464 15.3536C13.0527 15.2598 13 15.1326 13 15C13 14.8674 13.0527 14.7402 13.1464 14.6464C13.2402 14.5527 13.3674 14.5 13.5 14.5H23.5C23.6326 14.5 23.7598 14.5527 23.8536 14.6464C23.9473 14.7402 24 14.8674 24 15C24 15.1326 23.9473 15.2598 23.8536 15.3536C23.7598 15.4473 23.6326 15.5 23.5 15.5ZM23.5 12.5H13.5C13.3674 12.5 13.2402 12.4473 13.1464 12.3536C13.0527 12.2598 13 12.1326 13 12C13 11.8674 13.0527 11.7402 13.1464 11.6464C13.2402 11.5527 13.3674 11.5 13.5 11.5H23.5C23.6326 11.5 23.7598 11.5527 23.8536 11.6464C23.9473 11.7402 24 11.8674 24 12C24 12.1326 23.9473 12.2598 23.8536 12.3536C23.7598 12.4473 23.6326 12.5 23.5 12.5ZM23.5 9.5H13.5C13.3674 9.5 13.2402 9.44732 13.1464 9.35355C13.0527 9.25979 13 9.13261 13 9C13 8.86739 13.0527 8.74021 13.1464 8.64645C13.2402 8.55268 13.3674 8.5 13.5 8.5H23.5C23.6326 8.5 23.7598 8.55268 23.8536 8.64645C23.9473 8.74021 24 8.86739 24 9C24 9.13261 23.9473 9.25979 23.8536 9.35355C23.7598 9.44732 23.6326 9.5 23.5 9.5ZM23.5 6.5H13.5C13.3674 6.5 13.2402 6.44732 13.1464 6.35355C13.0527 6.25979 13 6.13261 13 6C13 5.86739 13.0527 5.74021 13.1464 5.64645C13.2402 5.55268 13.3674 5.5 13.5 5.5H23.5C23.6326 5.5 23.7598 5.55268 23.8536 5.64645C23.9473 5.74021 24 5.86739 24 6C24 6.13261 23.9473 6.25979 23.8536 6.35355C23.7598 6.44732 23.6326 6.5 23.5 6.5Z"/>' +
        '</g></svg>' +
            '<span class="tooltiptext bottomTooltip">Export Excel</span>';
            exportExcel.addEventListener('click', () => {
            this.electron.ipcRenderer.send('export-excel');
        });
        this.topBar.appendChild(exportExcel);

        let span5: HTMLSpanElement = document.createElement('span');
        span5.style.width = '32px';
        span5.innerHTML = '&nbsp;';
        this.topBar.appendChild(span5);

        let tags: HTMLAnchorElement = document.createElement('a');
        tags.id = 'tags';
        tags.classList.add('tooltip');
        tags.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M21 19.1H3V5h18v14.1zM21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" /><path d="M21 19.1H3V5h18v14.1zM21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fill="none" /><path d="M14.59 8L12 10.59 9.41 8 8 9.41 10.59 12 8 14.59 9.41 16 12 13.41 14.59 16 16 14.59 13.41 12 16 9.41z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Remove Tags</span>';
        tags.addEventListener('click', () => {
            this.electron.ipcRenderer.send('remove-tags');
        });
        this.topBar.appendChild(tags);

        let duplicates: HTMLAnchorElement = document.createElement('a');
        duplicates.id = 'duplicates';
        duplicates.classList.add('tooltip');
        duplicates.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M5,9 h15 M5,15 h15 M18,4 L7,20" style="stroke-width:2;stroke-linecap:round;" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Remove Duplicates</span>';
        duplicates.addEventListener('click', () => {
            this.electron.ipcRenderer.send('remove-duplicates');
        });
        this.topBar.appendChild(duplicates);

        let langs: HTMLAnchorElement = document.createElement('a');
        langs.id = 'langs';
        langs.classList.add('tooltip');
        langs.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" /></svg>' +
            '<span class="tooltiptext bottomTooltip">Change Languages</span>';
        langs.addEventListener('click', () => {
            this.electron.ipcRenderer.send('change-languages');
        });
        this.topBar.appendChild(langs);

        let span6: HTMLSpanElement = document.createElement('span');
        span6.className = 'fill_width';
        span6.innerHTML = '&nbsp;';
        this.topBar.appendChild(span6);

        let openHelp: HTMLAnchorElement = document.createElement('a');
        openHelp.id = 'openHelp';
        openHelp.classList.add('tooltip');
        openHelp.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24" height="24" width="24"><path style="stroke-width:0.1" d="M 12,3.6666667 C 16.595,3.6666667 20.333333,7.405 20.333333,12 20.333333,16.595 16.595,20.333333 12,20.333333 7.405,20.333333 3.6666667,16.595 3.6666667,12 3.6666667,7.405 7.405,3.6666667 12,3.6666667 Z M 12,2 C 6.4775,2 2,6.4775 2,12 2,17.5225 6.4775,22 12,22 17.5225,22 22,17.5225 22,12 22,6.4775 17.5225,2 12,2 Z m 1.041667,14.166667 c 0,0.575 -0.465834,1.041666 -1.041667,1.041666 -0.574167,0 -1.041667,-0.466666 -1.041667,-1.041666 0,-0.575 0.4675,-1.041667 1.041667,-1.041667 0.575833,0 1.041667,0.466667 1.041667,1.041667 z M 14.2025,7.835 C 13.695833,7.3216667 12.94,7.0391667 12.076667,7.0391667 10.26,7.0391667 9.085,8.3308333 9.085,10.330833 h 1.675833 c 0,-1.238333 0.690834,-1.6774997 1.281667,-1.6774997 0.528333,0 1.089167,0.3508334 1.136667,1.0216667 0.05167,0.705833 -0.325,1.064167 -0.801667,1.5175 -1.176667,1.119167 -1.198333,1.660833 -1.193333,2.89 H 12.855 c -0.01083,-0.553333 0.025,-1.0025 0.779167,-1.815 0.564166,-0.608333 1.265833,-1.365 1.28,-2.5183333 0.0092,-0.77 -0.236667,-1.4325 -0.711667,-1.9141667 z" /></svg>' +
            '<span class="tooltiptext bottomRightTooltip">User Guide</span>';
        openHelp.addEventListener('click', () => {
            this.electron.ipcRenderer.send('show-help');
        });
        this.topBar.appendChild(openHelp);
    }

    createCenterPanel(): void {
        this.mainPanel = document.getElementById('main') as HTMLDivElement;

        let tableContainer: HTMLDivElement = document.createElement('div');
        tableContainer.classList.add('paddedPanel');
        this.mainPanel.appendChild(tableContainer);

        let mainTable: HTMLTableElement = document.createElement('table');
        mainTable.id = 'mainTable';
        mainTable.classList.add('fill_width');
        mainTable.classList.add('stripes');
        tableContainer.appendChild(mainTable);

        let colGroup: HTMLTableColElement = document.createElement('colgroup');
        colGroup.innerHTML = '<col span="1" style="width: 2%;"><col span="1" style="width: 49%;"><col span="1" style="width: 49%;">';
        mainTable.appendChild(colGroup);

        let tableHeader: HTMLTableSectionElement = document.createElement('thead');
        tableHeader.id = 'tableHeader';
        tableHeader.innerHTML = '<tr><th class="fixed">#</th><th id="sourceHeader">Source</th><th id="targetHeader">Target</th></tr>';
        mainTable.appendChild(tableHeader);

        let tableBody: HTMLTableSectionElement = document.createElement('tbody');
        tableBody.id = 'tableBody';
        mainTable.appendChild(tableBody);
    }

    createBottomToolbar(): void {
        this.bottomBar = document.getElementById('bottomBar') as HTMLDivElement;

        let first: HTMLAnchorElement = document.createElement('a');
        first.id = 'first';
        first.classList.add('tooltip');
        first.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z" /></svg>' +
            '<span class="tooltiptext topTooltip">First Page</span>';
        first.addEventListener('click', () => {
            this.firstPage();
        });
        this.bottomBar.appendChild(first);

        let previous: HTMLAnchorElement = document.createElement('a');
        previous.id = 'previous';
        previous.classList.add('tooltip');
        previous.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>' +
            '<span class="tooltiptext topTooltip">Previous Page</span>';
        previous.addEventListener('click', () => {
            this.previousPage();
        });
        this.bottomBar.appendChild(previous);

        let pageLabel: HTMLLabelElement = document.createElement('label');
        pageLabel.innerText = 'Page';
        pageLabel.setAttribute('for', 'page');
        pageLabel.style.marginLeft = '10px';
        pageLabel.style.marginTop = '4px';
        this.bottomBar.appendChild(pageLabel);

        let pageDiv: HTMLDivElement = document.createElement('div');
        pageDiv.classList.add('tooltip');
        this.bottomBar.appendChild(pageDiv);

        let page: HTMLInputElement = document.createElement('input');
        page.id = 'page';
        page.type = 'number';
        page.value = '0';
        page.style.marginLeft = '10px';
        page.style.marginTop = '4px';
        page.style.width = '50px';
        page.addEventListener('keydown', (ev: KeyboardEvent) => {
            this.pageKeyboardListener(ev);
        });
        pageDiv.appendChild(page);

        let pageTooltip: HTMLSpanElement = document.createElement('span');
        pageTooltip.classList.add('tooltiptext');
        pageTooltip.classList.add('topTooltip');
        pageTooltip.innerText = 'Enter page number and press ENTER';
        pageDiv.appendChild(pageTooltip);

        let ofSpan: HTMLSpanElement = document.createElement('span');
        ofSpan.innerText = 'of ';
        ofSpan.style.marginLeft = '10px';
        ofSpan.style.marginTop = '4px';
        this.bottomBar.appendChild(ofSpan);

        let pages: HTMLSpanElement = document.createElement('span');
        pages.id = 'pages';
        pages.innerText = '0';
        pages.style.marginLeft = '10px';
        pages.style.marginTop = '4px';
        pages.style.width = '60px';
        this.bottomBar.appendChild(pages);

        let next: HTMLAnchorElement = document.createElement('a');
        next.id = 'next';
        next.classList.add('tooltip');
        next.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>' +
            '<span class="tooltiptext topTooltip">Next Page</span>';
        next.addEventListener('click', () => {
            this.nextPage();
        });
        this.bottomBar.appendChild(next);

        let last: HTMLAnchorElement = document.createElement('a');
        last.id = 'last';
        last.classList.add('tooltip');
        last.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z" /></svg>' +
            '<span class="tooltiptext topTooltip">Last Page</span>';
        last.addEventListener('click', () => {
            this.lastPage();
        });
        this.bottomBar.appendChild(last);

        let unitsPage: HTMLLabelElement = document.createElement('label');
        unitsPage.innerText = 'Rows/Page';
        unitsPage.setAttribute('for', 'rows_page');
        unitsPage.style.marginLeft = '10px';
        unitsPage.style.marginTop = '4px';
        this.bottomBar.appendChild(unitsPage);

        let unitsDiv: HTMLDivElement = document.createElement('div');
        unitsDiv.classList.add('tooltip');
        this.bottomBar.appendChild(unitsDiv);

        let units: HTMLInputElement = document.createElement('input');
        units.id = 'rows_page';
        units.type = 'number';
        units.value = '500';
        units.style.marginLeft = '10px';
        units.style.marginTop = '4px';
        units.style.width = '50px';
        units.addEventListener('keydown', (ev: KeyboardEvent) => {
            this.rowsPageKeyboardListener(ev);
        });
        unitsDiv.appendChild(units);

        let unitsTooltip: HTMLSpanElement = document.createElement('span');
        unitsTooltip.innerText = 'Enter number of rows/page and press ENTER';
        unitsTooltip.classList.add('tooltiptext');
        unitsTooltip.classList.add('topTooltip');
        unitsDiv.appendChild(unitsTooltip);

        let sourceSpan: HTMLSpanElement = document.createElement('span');
        sourceSpan.classList.add('noWrap');
        sourceSpan.innerText = 'Source Rows:';
        sourceSpan.style.marginLeft = '10px';
        sourceSpan.style.marginTop = '4px';
        this.bottomBar.appendChild(sourceSpan);

        let sourceRows: HTMLSpanElement = document.createElement('span');
        sourceRows.id = 'sourceRows';
        sourceRows.style.marginLeft = '10px';
        sourceRows.style.marginTop = '4px';
        sourceRows.style.minWidth = '100px';
        this.bottomBar.appendChild(sourceRows);

        let targetSpan: HTMLSpanElement = document.createElement('span');
        targetSpan.classList.add('noWrap');
        targetSpan.innerText = 'Target Rows:';
        targetSpan.style.marginLeft = '10px';
        targetSpan.style.marginTop = '4px';
        this.bottomBar.appendChild(targetSpan);

        let targetRows: HTMLSpanElement = document.createElement('span');
        targetRows.id = 'targetRows';
        targetRows.style.marginLeft = '10px';
        targetRows.style.marginTop = '4px';
        targetRows.style.minWidth = '100px';
        this.bottomBar.appendChild(targetRows);
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
            this.electron.ipcRenderer.send('save-data', { id: this.currentId, lang: this.currentLang, data: this.currentCell.innerHTML });
            this.currentContent = this.currentCell.innerHTML;
            this.currentCell.contentEditable = 'false';
            this.currentCell.classList.remove('editing');
            this.currentCell.removeEventListener('keydown', this.selectionChanged);
            this.currentCell.removeEventListener('click', this.selectionChanged);
            this.currentCell = null;
        }
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
                        this.electron.ipcRenderer.send('split-data', { id: id, lang: lang, start: left, end: right });
                    }
                }
            }
        }
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
