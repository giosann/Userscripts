// ==UserScript==
// @name         BTN Torrent Filter
// @namespace    https://broadcasthe.net/
// @version      2.8
// @description  Adds a collapsible grid of checkbox filters for series, season, and episode pages based on page content.
// @author       You
// @match        https://broadcasthe.net/series.php*
// @match        https://broadcasthe.net/torrents.php*
// @downloadURL  https://github.com/giosann/Userscripts/raw/main/BTN/BTN-Torrent-Filter.user.js
// @updateURL    https://github.com/giosann/Userscripts/raw/main/BTN/BTN-Torrent-Filter.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const isSeriesPage = window.location.pathname.includes('series.php') || document.body.id === 'series';
    const isTorrentsPage = window.location.pathname.includes('torrents.php') || document.body.id === 'torrents';
    if (!isSeriesPage && !isTorrentsPage) return;

    function buildFilters(hasHighlighter) {
        console.log(`[BTN Filter v2.8] Initializing (Highlighter Mode: ${hasHighlighter})`);

        const filters = {
            resolution: new Set(),
            source: new Set(),
            container: new Set(),
            codec: new Set(),
            hdr: new Set(),
            group: new Set()
        };

        const torrentData = [];
        const torrentRows = document.querySelectorAll('tr.group_torrent');
        if (torrentRows.length === 0) {
            console.warn('[BTN Filter] No torrent rows (tr.group_torrent) found on this page.');
            return;
        }

        torrentRows.forEach(row => {
            const item = {
                mainRow: row,
                linkedRows: [],
                data: {},
                isVisible: true
            };

            if (isTorrentsPage) {
                let next = row.nextElementSibling;
                if (next && !next.classList.contains('group_torrent')) {
                    item.linkedRows.push(next);
                    let nextNext = next.nextElementSibling;
                    if (nextNext && nextNext.classList.contains('pad')) {
                        item.linkedRows.push(nextNext);
                    }
                }
            }

            let resolution = 'Unknown', source = 'Unknown', container = 'Unknown', codec = 'Unknown', hdr = 'SDR', group = 'Unknown';

            if (hasHighlighter) {
                const extract = (key) => {
                    const el = row.querySelector(`.torrent-field[data-${key}]`);
                    return el ? (el.getAttribute(`data-${key}`) || el.textContent).trim() : 'Unknown';
                };

                resolution = extract('resolution');
                source = extract('source');
                container = extract('container');
                codec = extract('codec');
                
                const typeEl = row.querySelector('.torrent-field[data-type]');
                if (typeEl) {
                    group = typeEl.getAttribute('data-custom') || typeEl.textContent.trim();
                }

                const sourceEl = row.querySelector('.torrent-field[data-source]');
                const customSource = sourceEl ? sourceEl.getAttribute('data-custom') : null;
                const isRemux = (customSource === 'Remux') || 
                                /\bRemux\b/i.test(row.textContent) || 
                                (sourceEl && /\bRemux\b/i.test(sourceEl.textContent));

                if ((source.toLowerCase().includes('bluray') || source.toLowerCase().includes('bd')) && isRemux) {
                    source = 'Bluray Remux';
                }

                const hdrEl = row.querySelector('.torrent-field[data-hdr]');
                let hdrVal = hdrEl ? hdrEl.getAttribute('data-hdr') : null;
                if (!hdrVal) {
                    const hasDV = /\b(DV|Dolby Vision)\b/i.test(row.textContent);
                    const hasHDR = /\bHDR(10)?\b/i.test(row.textContent);
                    const hasHLG = /\bHLG\b/i.test(row.textContent);
                    
                    if (hasDV && hasHDR) hdrVal = 'DV HDR';
                    else if (hasDV) hdrVal = 'DV';
                    else if (hasHDR) hdrVal = 'HDR';
                    else if (hasHLG) hdrVal = 'HLG';
                    else hdrVal = 'SDR';
                } else {
                    if (hdrVal.includes('DV') && hdrVal.includes('HDR')) hdrVal = 'DV HDR';
                    else if (hdrVal.startsWith('DV')) hdrVal = 'DV';
                }
                hdr = hdrVal;

            } else {
                // Universal fallback link selector
                let aNode = row.querySelector('a[href*="torrentid="]') || 
                            Array.from(row.querySelectorAll('td > a')).find(a => 
                                a.textContent.includes('»') || 
                                (a.getAttribute('onclick') && a.getAttribute('onclick').includes('swapDisplay'))
                            );

                if (aNode) {
                    let parts = aNode.innerHTML.split(/<br\s*\/?>/i);
                    let mainHtml = parts[0];
                    let subHtml = parts[1] || '';

                    let tempDiv = document.createElement('div');
                    tempDiv.innerHTML = mainHtml;
                    let text = tempDiv.textContent.replace(/[»▶]/g, '').trim();
                    let mainParts = text.split('/').map(p => p.trim());
                    
                    if (mainParts.length >= 4) {
                        container = mainParts[0] || 'Unknown';
                        codec = mainParts[1] || 'Unknown';
                        source = mainParts[2] || 'Unknown';
                        resolution = mainParts[3] || 'Unknown';
                        group = mainParts[4] || 'Unknown';
                    }

                    let tempSub = document.createElement('div');
                    tempSub.innerHTML = subHtml;
                    let subText = tempSub.textContent;

                    const isRemux = /\bRemux\b/i.test(subText);
                    if ((source.toLowerCase().includes('bluray') || source.toLowerCase().includes('bd')) && isRemux) {
                        source = 'Bluray Remux';
                    }

                    const hasDV = /\b(DV|Dolby Vision)\b/i.test(subText);
                    const hasHDR = /\bHDR(10)?\b/i.test(subText);
                    const hasHLG = /\bHLG\b/i.test(subText);

                    if (hasDV && hasHDR) hdr = 'DV HDR';
                    else if (hasDV) hdr = 'DV';
                    else if (hasHDR) hdr = 'HDR';
                    else if (hasHLG) hdr = 'HLG';
                    else hdr = 'SDR';
                }
            }

            item.data = { resolution, source, container, codec, hdr, group };
            
            filters.resolution.add(resolution);
            filters.source.add(source);
            filters.container.add(container);
            filters.codec.add(codec);
            filters.hdr.add(hdr);
            filters.group.add(group);

            torrentData.push(item);
        });

        console.log(`[BTN Filter] Parsed ${torrentData.length} torrents across the page.`);

        function createCheckboxRow(key) {
            let uniqueValues = Array.from(filters[key]);

            if (key === 'resolution') {
                const resOrder = ['4k', '2160p', '1440p', '1080p', '1080i', '720p', '720i', '576p', '480p', 'sd'];
                uniqueValues.sort((a, b) => {
                    const aIndex = resOrder.indexOf(a.toLowerCase().trim());
                    const bIndex = resOrder.indexOf(b.toLowerCase().trim());
                    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                    if (aIndex !== -1) return -1;
                    if (bIndex !== -1) return 1;
                    return a.localeCompare(b);
                });
            } else {
                uniqueValues.sort();
            }

            if (uniqueValues.length === 0) return '';

            const checkboxes = uniqueValues.map(val => `
                <label style="margin-right: 15px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; transition: opacity 0.2s ease;">
                    <input type="checkbox" class="dyn-filter-cb" data-key="${key}" value="${val}" checked>
                    ${val}
                </label>
            `).join('');

            return `
                <div style="border-bottom: 1px solid #333; padding: 8px 0; display: flex; flex-wrap: wrap;">
                    ${checkboxes}
                </div>
            `;
        }

        const filterBox = document.createElement('div');
        filterBox.className = 'box';
        filterBox.style.setProperty('order', '0', 'important'); 
        filterBox.innerHTML = `
            <div class="head diffpointer" id="dyn-filter-header" style="user-select: none;">
                <strong>▶ Filter</strong> [shrink/expand]
                <span style="float: right;">
                    <a href="#" id="btn-toggle-all" onclick="return false;">[Toggle All]</a>
                </span>
            </div>
            <div class="body" id="dyn-filter-body" style="display: none; padding: 10px;">
                ${createCheckboxRow('source')}
                ${createCheckboxRow('container')}
                ${createCheckboxRow('codec')}
                ${createCheckboxRow('resolution')}
                ${createCheckboxRow('hdr')}
                <div style="padding-top: 8px; display: flex; flex-wrap: wrap;">
                    ${createCheckboxRow('group').replace(/<div[^>]*>|<\/div>/g, '')}
                </div>
            </div>
        `;

        const visibleTables = Array.from(document.querySelectorAll('.torrent_table')).filter(t => t.style.display !== 'none');
        const firstTable = visibleTables[0];

        if (firstTable && firstTable.parentElement) {
            firstTable.parentElement.insertBefore(filterBox, firstTable);
        } else {
            const mainColumn = document.querySelector('.main_column');
            if (mainColumn) mainColumn.insertBefore(filterBox, mainColumn.firstChild);
        }

        const header = document.getElementById('dyn-filter-header');
        const body = document.getElementById('dyn-filter-body');
        const headerText = header.querySelector('strong');

        header.addEventListener('click', (e) => {
            if (e.target.id === 'btn-toggle-all') return;
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'block' : 'none';
            headerText.innerText = isHidden ? '▼ Filter' : '▶ Filter';
        });

        const checkboxes = filterBox.querySelectorAll('.dyn-filter-cb');
        let allChecked = true;

        document.getElementById('btn-toggle-all').addEventListener('click', (e) => {
            e.stopPropagation();
            allChecked = !allChecked;
            checkboxes.forEach(cb => cb.checked = allChecked);
            applyFilters();
        });

        const applyFilters = () => {
            const selected = {
                resolution: new Set(),
                source: new Set(),
                container: new Set(),
                codec: new Set(),
                hdr: new Set(),
                group: new Set()
            };

            checkboxes.forEach(cb => {
                if (cb.checked) {
                    selected[cb.dataset.key].add(cb.value);
                }
            });

            const availableOptions = {
                resolution: new Set(),
                source: new Set(),
                container: new Set(),
                codec: new Set(),
                hdr: new Set(),
                group: new Set()
            };

            const categories = Object.keys(selected);
            const totalCats = categories.length;

            // 1. Determine visibility for all rows
            let visibleCount = 0;
            torrentData.forEach(item => {
                const passesCat = {};
                let totalPasses = 0;

                for (const cat of categories) {
                    if (filters[cat].size === 0 || selected[cat].has(item.data[cat])) {
                        passesCat[cat] = true;
                        totalPasses++;
                    } else {
                        passesCat[cat] = false;
                    }
                }

                item.isVisible = (totalPasses === totalCats);
                if (item.isVisible) visibleCount++;

                for (const cat of categories) {
                    if (totalPasses === totalCats || (totalPasses === totalCats - 1 && !passesCat[cat])) {
                        availableOptions[cat].add(item.data[cat]);
                    }
                }
            });

            console.log(`[BTN Filter] Active filter applied: ${visibleCount} / ${torrentData.length} visible.`);

            // 2. Gray out redundant checkboxes
            checkboxes.forEach(cb => {
                const isRelevant = availableOptions[cb.dataset.key].has(cb.value);
                cb.parentElement.style.opacity = isRelevant ? '1' : '0.35';
            });

            // 3. UNCONDITIONAL ROW HIDING: runs for all rows on all pages
            torrentData.forEach(item => {
                if (item.isVisible) {
                    item.mainRow.style.removeProperty('display');
                    item.linkedRows.forEach(r => r.style.removeProperty('display'));
                } else {
                    item.mainRow.style.setProperty('display', 'none', 'important');
                    item.linkedRows.forEach(r => r.style.setProperty('display', 'none', 'important'));
                }
            });

            // 4. SERIES PAGE LAYOUT RECALIBRATION: isolated per table
            if (isSeriesPage) {
                try {
                    const tables = document.querySelectorAll('.torrent_table');
                    tables.forEach(table => {
                        if (table.style.display === 'none') return;

                        const tbodies = table.querySelectorAll('tbody');
                        tbodies.forEach(tbody => {
                            const rows = Array.from(tbody.querySelectorAll('tr.group_torrent'));
                            if (rows.length === 0) return;

                            // Group contiguous rows under their corresponding group cell
                            let currentGroupCell = null;
                            let currentGroupRows = [];

                            const processGroup = (cell, gRows) => {
                                if (!cell) return;
                                const visible = gRows.filter(r => r.style.display !== 'none');
                                if (visible.length === 0) {
                                    cell.style.setProperty('display', 'none', 'important');
                                } else {
                                    cell.style.removeProperty('display');
                                    cell.setAttribute('rowspan', visible.length);
                                    const firstVis = visible[0];
                                    if (firstVis.firstElementChild !== cell) {
                                        firstVis.insertBefore(cell, firstVis.firstElementChild);
                                    }
                                }
                            };

                            rows.forEach(r => {
                                const gCell = r.querySelector('td.group');
                                if (gCell) {
                                    processGroup(currentGroupCell, currentGroupRows);
                                    currentGroupCell = gCell;
                                    currentGroupRows = [r];
                                } else if (currentGroupCell) {
                                    currentGroupRows.push(r);
                                }
                            });

                            processGroup(currentGroupCell, currentGroupRows);
                        });
                    });
                } catch (err) {
                    console.error('[BTN Filter] Error during layout recalibration:', err);
                }
            }
        };

        checkboxes.forEach(cb => cb.addEventListener('change', applyFilters));
        applyFilters(); 
    }

    let checkCount = 0;
    const readyCheck = setInterval(() => {
        const tagsExist = document.querySelector('.torrent-field');
        if (tagsExist) { 
            clearInterval(readyCheck);
            if (!document.getElementById('dyn-filter-header')) {
                buildFilters(true);
            }
        } else if (checkCount > 10) { 
            clearInterval(readyCheck);
            if (!document.getElementById('dyn-filter-header')) {
                buildFilters(false);
            }
        }
        checkCount++;
    }, 150);

})();