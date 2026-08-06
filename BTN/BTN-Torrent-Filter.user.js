// ==UserScript==
// @name         BTN Torrent Filter
// @namespace    https://broadcasthe.net/
// @version      2.0
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

    const isSeriesPage = window.location.pathname.includes('series.php');
    const isTorrentsPage = window.location.pathname.includes('torrents.php');
    if (!isSeriesPage && !isTorrentsPage) return;

    function buildFilters(hasHighlighter) {
        const filters = {
            resolution: new Set(),
            source: new Set(),
            container: new Set(),
            codec: new Set(),
            group: new Set()
        };

        const torrentData = [];
        const parsedGroups = [];
        let currentGroup = null;

        const torrentRows = document.querySelectorAll('tr.group_torrent');
        if (torrentRows.length === 0) return;

        // Parse Torrents
        torrentRows.forEach(row => {
            let groupCell = null;

            // Map the layout relationships on series.php for dynamic rowspan updates
            if (isSeriesPage) {
                groupCell = row.querySelector('td.group');
                if (groupCell) {
                    currentGroup = {
                        groupCell: groupCell,
                        items: []
                    };
                    parsedGroups.push(currentGroup);
                }
            }

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

            let resolution = 'Unknown', source = 'Unknown', container = 'Unknown', codec = 'Unknown', group = 'Unknown';

            if (hasHighlighter) {
                // Parse using BTN Highlighter classes
                const extract = (key) => {
                    const el = row.querySelector(`.torrent-field[data-${key}]`);
                    return el ? el.getAttribute(`data-${key}`).trim() : 'Unknown';
                };

                resolution = extract('resolution');
                source = extract('source');
                container = extract('container');
                codec = extract('codec');

                const typeEl = row.querySelector('.torrent-field[data-type]');
                if (typeEl) {
                    group = typeEl.getAttribute('data-custom') || typeEl.textContent.trim();
                }
            } else {
                // Fallback: Parse native site HTML via text extraction
                let aNode;
                if (isTorrentsPage) {
                    aNode = Array.from(row.querySelectorAll('td > a')).find(a => a.textContent.includes('»') || (a.getAttribute('onclick') && a.getAttribute('onclick').includes('swapDisplay')));
                } else if (isSeriesPage) {
                    aNode = row.querySelector('a[href^="torrents.php"][href*="torrentid"]');
                }

                if (aNode) {
                    let htmlPart = aNode.innerHTML.split('<br>')[0];
                    let tempDiv = document.createElement('div');
                    tempDiv.innerHTML = htmlPart;
                    let text = tempDiv.textContent.replace(/[»▶]/g, '').trim();
                    let parts = text.split('/').map(p => p.trim());

                    if (parts.length >= 4) {
                        container = parts[0] || 'Unknown';
                        codec = parts[1] || 'Unknown';
                        source = parts[2] || 'Unknown';
                        resolution = parts[3] || 'Unknown';
                        group = parts[4] || 'Unknown';
                    }
                }
            }

            item.data = { resolution, source, container, codec, group };

            filters.resolution.add(resolution);
            filters.source.add(source);
            filters.container.add(container);
            filters.codec.add(codec);
            filters.group.add(group);

            if (isSeriesPage && currentGroup) {
                currentGroup.items.push(item);
            }

            torrentData.push(item);
        });

        // Helper to generate a row of checkboxes
        function createCheckboxRow(key) {
            const uniqueValues = Array.from(filters[key]).sort();
            if (uniqueValues.length === 0) return '';

            const checkboxes = uniqueValues.map(val => `
                <label style="margin-right: 15px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
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

        // Build GUI strictly matching native DOM classes minus fixed height overrides
        const filterBox = document.createElement('div');
        filterBox.className = 'box';
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
                <div style="padding-top: 8px; display: flex; flex-wrap: wrap;">
                    ${createCheckboxRow('group').replace(/<div[^>]*>|<\/div>/g, '')}
                </div>
            </div>
        `;

        // Identify insertion point
        const tableElements = document.querySelectorAll('.torrent_table');
        let targetTable = null;
        tableElements.forEach(t => {
            if (t.style.display !== 'none' && !targetTable) {
                targetTable = t;
            }
        });

        if (targetTable && targetTable.parentElement) {
            targetTable.parentElement.insertBefore(filterBox, targetTable);
        } else {
            const mainColumn = document.querySelector('.main_column');
            if (mainColumn) mainColumn.insertBefore(filterBox, mainColumn.firstChild);
        }

        // Event Listeners for UI toggles
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

        // Apply Filter Logic
        const applyFilters = () => {
            const selected = {
                resolution: new Set(),
                source: new Set(),
                container: new Set(),
                codec: new Set(),
                group: new Set()
            };

            checkboxes.forEach(cb => {
                if (cb.checked) {
                    selected[cb.dataset.key].add(cb.value);
                }
            });

            torrentData.forEach(item => {
                let isVisible = true;

                for (const key of Object.keys(selected)) {
                    if (filters[key].size > 0 && !selected[key].has(item.data[key])) {
                        isVisible = false;
                        break;
                    }
                }
                item.isVisible = isVisible;
            });

            if (isSeriesPage && targetTable) {
                parsedGroups.forEach(group => {
                    const visibleItems = group.items.filter(i => i.isVisible);

                    // Apply hidden state
                    group.items.forEach(item => {
                        item.mainRow.style.display = item.isVisible ? '' : 'none';
                    });

                    if (visibleItems.length > 0) {
                        const firstVisibleRow = visibleItems[0].mainRow;

                        // Dynamically detach the rowspan cell and move it to the highest visible row
                        if (firstVisibleRow.firstElementChild !== group.groupCell) {
                            firstVisibleRow.insertBefore(group.groupCell, firstVisibleRow.firstElementChild);
                        }

                        // Recalculate cell stretch height based on remaining visible rows
                        group.groupCell.setAttribute('rowspan', visibleItems.length);
                        group.groupCell.style.display = '';
                    } else {
                        group.groupCell.style.display = 'none';
                    }
                });
            } else {
                torrentData.forEach(item => {
                    const displayValue = item.isVisible ? '' : 'none';
                    item.mainRow.style.display = displayValue;
                    item.linkedRows.forEach(r => r.style.display = displayValue);
                });
            }
        };

        checkboxes.forEach(cb => cb.addEventListener('change', applyFilters));
    }

    // Execution polling checks for highlighter injection prior to triggering filter construction
    let checkCount = 0;
    const readyCheck = setInterval(() => {
        const tagsExist = document.querySelector('.torrent-field');
        if (tagsExist) {
            clearInterval(readyCheck);
            if (!document.getElementById('dyn-filter-header')) {
                buildFilters(true);
            }
        } else if (checkCount > 10) {
            // Fallback to native HTML execution if tags remain missing after ~1.5 seconds
            clearInterval(readyCheck);
            if (!document.getElementById('dyn-filter-header')) {
                buildFilters(false);
            }
        }
        checkCount++;
    }, 150);

})();