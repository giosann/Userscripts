// ==UserScript==
// @name         BTN Torrent Filter
// @namespace    https://broadcasthe.net/
// @version      3.0
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
        console.log(`[BTN Filter v3.0] Initializing (Highlighter Mode: ${hasHighlighter})`);

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
        if (torrentRows.length === 0) return;

        // Parse Torrents
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
            const linkedText = item.linkedRows.map(r => r.textContent).join(' ');

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

                // Check all highlighter tags, row contents, and linked release rows
                const hdrEls = Array.from(row.querySelectorAll('.torrent-field[data-hdr]'));
                const hdrTags = hdrEls.map(el => el.getAttribute('data-hdr') || el.textContent).join(' ');
                const fullText = `${row.textContent} ${linkedText} ${hdrTags}`;

                const hasDV = /\b(DV|Dolby Vision)\b/i.test(fullText);
                const hasHDR = /\bHDR(10)?\b/i.test(fullText);
                const hasHLG = /\bHLG\b/i.test(fullText);

                if (hasDV && hasHDR) hdr = 'DV HDR';
                else if (hasDV) hdr = 'DV';
                else if (hasHDR) hdr = 'HDR';
                else if (hasHLG) hdr = 'HLG';
                else hdr = 'SDR';

            } else {
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

                    // Check both the descriptor link and the linked release name row
                    const fullText = `${subText} ${linkedText}`;

                    const hasDV = /\b(DV|Dolby Vision)\b/i.test(fullText);
                    const hasHDR = /\bHDR(10)?\b/i.test(fullText);
                    const hasHLG = /\bHLG\b/i.test(fullText);

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

        // Pre-parse table group structure on series.php (run once before DOM manipulation)
        const seriesGroups = [];
        if (isSeriesPage) {
            const tables = Array.from(document.querySelectorAll('.torrent_table')).filter(t => t.style.display !== 'none');
            tables.forEach(table => {
                const allRows = Array.from(table.querySelectorAll('tr')).filter(r => 
                    !r.classList.contains('colhead_dark') && !r.classList.contains('colhead')
                );

                let currentGroup = null;
                allRows.forEach(row => {
                    const gCell = row.querySelector('td.group');
                    if (gCell) {
                        currentGroup = {
                            table: table,
                            groupCell: gCell,
                            rows: []
                        };
                        seriesGroups.push(currentGroup);
                    }
                    if (currentGroup) {
                        currentGroup.rows.push(row);
                    }
                });
            });
            console.log(`[BTN Filter] Pre-parsed ${seriesGroups.length} series groups.`);
        }

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

            // 1. Evaluate torrent visibility
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

                for (const cat of categories) {
                    if (totalPasses === totalCats || (totalPasses === totalCats - 1 && !passesCat[cat])) {
                        availableOptions[cat].add(item.data[cat]);
                    }
                }
            });

            // 2. Gray out redundant checkboxes
            checkboxes.forEach(cb => {
                const isRelevant = availableOptions[cb.dataset.key].has(cb.value);
                cb.parentElement.style.opacity = isRelevant ? '1' : '0.35';
            });

            // 3. Apply visibility state to torrent rows
            torrentData.forEach(item => {
                if (item.isVisible) {
                    item.mainRow.style.removeProperty('display');
                    item.linkedRows.forEach(r => r.style.removeProperty('display'));
                } else {
                    item.mainRow.style.setProperty('display', 'none', 'important');
                    item.linkedRows.forEach(r => r.style.setProperty('display', 'none', 'important'));
                }
            });

            // 4. Series page recalibration
            if (isSeriesPage) {
                seriesGroups.forEach(group => {
                    let hasVisibleTorrentsBelow = false;
                    for (let i = group.rows.length - 1; i >= 0; i--) {
                        const row = group.rows[i];
                        if (row.classList.contains('group_torrent')) {
                            if (row.style.display !== 'none') {
                                hasVisibleTorrentsBelow = true;
                            }
                        } else if (row.querySelector('td[colspan]')) {
                            if (!hasVisibleTorrentsBelow) {
                                row.style.setProperty('display', 'none', 'important');
                            } else {
                                row.style.removeProperty('display');
                                hasVisibleTorrentsBelow = false;
                            }
                        }
                    }

                    const visibleRows = group.rows.filter(r => r.style.display !== 'none');

                    if (visibleRows.length === 0) {
                        group.groupCell.style.setProperty('display', 'none', 'important');
                    } else {
                        const firstRow = visibleRows[0];
                        
                        if (group.groupCell.parentElement !== firstRow || firstRow.firstElementChild !== group.groupCell) {
                            firstRow.insertBefore(group.groupCell, firstRow.firstElementChild);
                        }

                        group.groupCell.style.width = '22%';
                        group.groupCell.style.removeProperty('display');
                        group.groupCell.setAttribute('rowspan', visibleRows.length);
                    }
                });
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