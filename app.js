// Logic

// State
window.NPC = {
    state: {
        name: '',
        walkInterval: null,
        health: null,
        walkRadius: null,
        outfit: { lookType: 128, lookHead: 0, lookBody: 0, lookLegs: 0, lookFeet: 0, lookAddons: 0, mount: 0 },
        tradeItems: [],
        dialogue: { greet: 'Hello |PLAYERNAME|.', farewell: 'Farewell.', walkaway: 'How rude!' },
        keywords: []
    },
    selectedItem: null,
    activeColorPart: 'head'
};

function gid(id) { return document.getElementById(id); }

// Sanitization
window.sanitize = function(str) {
    if (!str) return '';
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;'
    };
    return String(str).replace(/[&<>"'/]/g, function(s) { return map[s]; });
};

// Shop
window.addTradeItem = function () {
    var rawVal = (gid('shop-item-search').value || '').trim().toLowerCase();

    if (!window.NPC.selectedItem && rawVal) {
        var ids = Object.keys(APP_DATA.items);
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var n = (APP_DATA.items[id].name || '').toLowerCase();
            if (id === rawVal || n === rawVal || n.includes(rawVal)) {
                window.NPC.selectedItem = { id: id, name: APP_DATA.items[id].name };
                break;
            }
        }
    }

    if (!window.NPC.selectedItem) {
        alert('Please select an item from the catalog first.');
        return;
    }

    var bPrice = parseFloat(gid('shop-buy-price').value) || 0;
    var sPrice = parseFloat(gid('shop-sell-price').value) || 0;

    if (bPrice <= 0 && sPrice <= 0) {
        alert('Please enter a buy or sell price greater than 0.');
        return;
    }

    window.NPC.state.tradeItems.push({
        id: window.NPC.selectedItem.id,
        name: window.NPC.selectedItem.name,
        buy: bPrice,
        sell: sPrice
    });

    window.renderTradeItems();
    gid('shop-item-search').value = '';
    gid('shop-buy-price').value  = '';
    gid('shop-sell-price').value = '';
    window.NPC.selectedItem = null;
};

window.removeItem = function (index) {
    window.NPC.state.tradeItems.splice(index, 1);
    window.renderTradeItems();
};

window.renderTradeItems = function () {
    var tbody = gid('shop-items-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var visibleItems = window.NPC.state.tradeItems.slice(0, 300);
    visibleItems.forEach(function (item, index) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td><img src="items/' + window.sanitize(item.id) + '.gif" style="width:24px;image-rendering:pixelated;" onerror="this.style.display=\'none\'"></td>' +
            '<td>' + window.sanitize(item.name) + '<div style="font-size:10px;color:#777">ID: ' + window.sanitize(item.id) + (item.count ? ' · Count: ' + window.sanitize(item.count) : '') + '</div></td>' +
            '<td style="color:#2ecc71">' + window.sanitize(item.buy) + ' gp</td>' +
            '<td style="color:#e74c3c">' + window.sanitize(item.sell) + ' gp</td>' +
            '<td style="text-align:center"><button class="rpg-btn danger" style="padding:4px 10px;font-size:11px;" onclick="window.removeItem(' + index + ')">X</button></td>';
        tbody.appendChild(tr);
    });
    if (window.NPC.state.tradeItems.length > visibleItems.length) {
        var summaryRow = document.createElement('tr');
        summaryRow.innerHTML = '<td colspan="5" style="padding:14px;text-align:center;color:var(--muted)">' +
            (window.NPC.state.tradeItems.length - visibleItems.length) + ' additional items are included in the Lua export.</td>';
        tbody.appendChild(summaryRow);
    }
};

// Keywords
window.addKeyword = function () {
    var trigger = (gid('kw-trigger').value || '').trim();
    var resp    = (gid('kw-response').value || '').trim();
    if (!trigger || !resp) { alert('Please enter a keyword and a response.'); return; }
    window.NPC.state.keywords.push({ trigger: trigger, response: resp });
    window.renderKeywords();
    gid('kw-trigger').value  = '';
    gid('kw-response').value = '';
};

window.removeKeyword = function (index) {
    window.NPC.state.keywords.splice(index, 1);
    window.renderKeywords();
};

window.renderKeywords = function () {
    var tbody = gid('keywords-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    window.NPC.state.keywords.forEach(function (kw, index) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td style="color:var(--accent);font-weight:bold">' + window.sanitize(kw.trigger) + '</td>' +
            '<td>' + window.sanitize(kw.response) + '</td>' +
            '<td style="text-align:center"><button class="rpg-btn danger" style="padding:4px 10px;font-size:11px;" onclick="window.removeKeyword(' + index + ')">X</button></td>';
        tbody.appendChild(tr);
    });
};

// Modal
var modalReturnFocus = null;

function openModal(modal) {
    if (!modal) return;
    modalReturnFocus = document.activeElement;
    modal.removeAttribute('style');
    modal.classList.add('active');
    var focusTarget = modal.querySelector('textarea, button, input, select');
    if (focusTarget) focusTarget.focus();
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.removeAttribute('style');
    if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') modalReturnFocus.focus();
    modalReturnFocus = null;
}

// NPC Shop Templates and Tibia RL Economy Analyzer
var shopDataPromise = null;
var selectedShopTemplate = null;
var shopTemplateRenderTimer = null;
var shopTemplatePage = 0;
var shopTemplatesPerPage = 50;
var templateItemPage = 0;
var templateItemQuery = '';
var templateItemsPerPage = 100;

function loadShopTemplateData() {
    if (window.SHOP_TEMPLATE_DATA) return Promise.resolve(window.SHOP_TEMPLATE_DATA);
    if (shopDataPromise) return shopDataPromise;
    shopDataPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'shop_templates.js?v=20260718-shop-npc-toolkit';
        script.async = true;
        script.onload = function () {
            if (window.SHOP_TEMPLATE_DATA) resolve(window.SHOP_TEMPLATE_DATA);
            else reject(new Error('The shop template dataset is invalid.'));
        };
        script.onerror = function () { reject(new Error('The shop template dataset could not be loaded.')); };
        document.head.appendChild(script);
    });
    return shopDataPromise;
}

function templateItems(template) {
    return SHOP_TOOLS.expandTemplateItems(template, APP_DATA.items);
}

function templateSearchText(template) {
    if (template._search) return template._search;
    var names = (template.items || []).map(function (entry) {
        var item = APP_DATA.items[String(entry[0])];
        return item ? item.name : '';
    });
    template._search = (template.name + ' ' + template.type + ' ' + names.join(' ')).toLowerCase();
    return template._search;
}

function renderTemplateList(data) {
    var list = gid('shop-template-list');
    var meta = gid('shop-template-meta');
    if (!list || !meta) return;
    var query = (gid('shop-template-search').value || '').trim().toLowerCase();
    var type = gid('shop-template-type').value;
    var matches = data.templates.filter(function (template) {
        return (!type || template.type === type) && (!query || templateSearchText(template).includes(query));
    });
    var pageCount = Math.max(1, Math.ceil(matches.length / shopTemplatesPerPage));
    shopTemplatePage = Math.min(Math.max(0, shopTemplatePage), pageCount - 1);
    var start = shopTemplatePage * shopTemplatesPerPage;
    var visible = matches.slice(start, start + shopTemplatesPerPage);
    meta.textContent = matches.length + ' shops · ' + data.meta.referenceItems.toLocaleString() + ' reference items';
    var pageLabel = gid('shop-template-page');
    var previousButton = gid('shop-template-prev');
    var nextButton = gid('shop-template-next');
    if (pageLabel) pageLabel.textContent = 'Page ' + (shopTemplatePage + 1) + ' of ' + pageCount;
    if (previousButton) previousButton.disabled = shopTemplatePage === 0;
    if (nextButton) nextButton.disabled = shopTemplatePage >= pageCount - 1;
    list.innerHTML = '';
    if (!visible.length) {
        list.innerHTML = '<div class="shop-tool-empty">No audited shop matches this search.</div>';
        return;
    }
    var fragment = document.createDocumentFragment();
    visible.forEach(function (template) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'shop-template-card' + (selectedShopTemplate === template ? ' active' : '');
        button.innerHTML = '<strong>' + window.sanitize(template.name) + '</strong><span><em>' + window.sanitize(template.type) + '</em>' + template.items.length + ' items</span>';
        button.addEventListener('click', function () {
            selectedShopTemplate = template;
            templateItemPage = 0;
            templateItemQuery = '';
            list.querySelectorAll('.shop-template-card').forEach(function (card) { card.classList.remove('active'); });
            button.classList.add('active');
            renderTemplateDetail(template);
        });
        fragment.appendChild(button);
    });
    list.appendChild(fragment);
}

function outfitPreviewUrl(outfit) {
    return 'https://outfit-images-oracle.ots.me/latest_walk/animoutfit.php?id=' + outfit[0] +
        '&addons=' + outfit[5] + '&head=' + outfit[1] + '&body=' + outfit[2] +
        '&legs=' + outfit[3] + '&feet=' + outfit[4] + '&mount=' + outfit[6] + '&direction=3';
}

function renderTemplateDetail(template) {
    var detail = gid('shop-template-detail');
    if (!detail) return;
    var items = templateItems(template);
    detail.innerHTML =
        '<div class="template-detail-heading"><div class="template-outfit-preview"><img src="' + outfitPreviewUrl(template.outfit) + '" alt="' + window.sanitize(template.name) + ' outfit"></div>' +
        '<div><h3>' + window.sanitize(template.name) + '</h3><p>' + window.sanitize(template.type) + ' shop · ' + items.length + ' gold-priced items · No quest logic</p></div>' +
        '<div class="template-detail-actions"><button id="template-replace" class="rpg-btn highlight" type="button">Use Template</button><button id="template-merge" class="rpg-btn" type="button">Merge Items</button></div></div>' +
        '<div class="template-message-grid"><div class="template-message"><span>Greeting</span><p>' + window.sanitize(template.greet || 'Welcome, |PLAYERNAME|. Ask me for a {trade}.') + '</p></div>' +
        '<div class="template-message"><span>Farewell</span><p>' + window.sanitize(template.farewell || 'Goodbye.') + '</p></div></div>' +
        '<div class="template-items"><div class="template-items-toolbar"><input id="template-item-search" class="rpg-input" type="search" placeholder="Search item name or ID" aria-label="Search items in this shop"><span id="template-items-range"></span>' +
        '<div class="template-pagination"><button id="template-items-prev" class="rpg-btn" type="button">Previous</button><span id="template-items-page"></span><button id="template-items-next" class="rpg-btn" type="button">Next</button></div></div>' +
        '<div class="template-items-header"><span>Item</span><span>NPC sells</span><span>NPC buys</span></div><div id="template-items-body"></div></div>';
    gid('template-replace').addEventListener('click', function () { applyShopTemplate(template, false); });
    gid('template-merge').addEventListener('click', function () { applyShopTemplate(template, true); });
    gid('template-item-search').addEventListener('input', function (event) {
        templateItemQuery = event.target.value;
        templateItemPage = 0;
        renderTemplateItemsPage(template);
    });
    gid('template-items-prev').addEventListener('click', function () {
        templateItemPage = Math.max(0, templateItemPage - 1);
        renderTemplateItemsPage(template);
    });
    gid('template-items-next').addEventListener('click', function () {
        templateItemPage += 1;
        renderTemplateItemsPage(template);
    });
    renderTemplateItemsPage(template);
}

function renderTemplateItemsPage(template) {
    var body = gid('template-items-body');
    var range = gid('template-items-range');
    var pageLabel = gid('template-items-page');
    var previousButton = gid('template-items-prev');
    var nextButton = gid('template-items-next');
    if (!body || !range || !pageLabel || !previousButton || !nextButton) return;
    var query = templateItemQuery.trim().toLowerCase();
    var items = templateItems(template).filter(function (item) {
        return !query || item.name.toLowerCase().includes(query) || String(item.id).includes(query);
    });
    var pageCount = Math.max(1, Math.ceil(items.length / templateItemsPerPage));
    templateItemPage = Math.min(Math.max(0, templateItemPage), pageCount - 1);
    var start = templateItemPage * templateItemsPerPage;
    var visibleItems = items.slice(start, start + templateItemsPerPage);
    body.innerHTML = visibleItems.map(function (item) {
        return '<div class="template-item-row"><span class="template-item-identity"><span class="template-item-sprite"><img src="items/' + window.sanitize(item.id) + '.gif" loading="lazy" alt="" onerror="this.style.display=\'none\'"></span><span>' + window.sanitize(item.name) + ' <small>#' + window.sanitize(item.id) + (item.count ? ' · ' + window.sanitize(item.count) : '') + '</small></span></span>' +
            '<span>' + (item.buy ? item.buy.toLocaleString() + ' gp' : '—') + '</span><span>' + (item.sell ? item.sell.toLocaleString() + ' gp' : '—') + '</span></div>';
    }).join('');
    if (!visibleItems.length) body.innerHTML = '<div class="shop-tool-empty">No items match this search.</div>';
    range.textContent = items.length ? 'Showing ' + (start + 1) + '–' + (start + visibleItems.length) + ' of ' + items.length : '0 items';
    pageLabel.textContent = 'Page ' + (templateItemPage + 1) + ' of ' + pageCount;
    previousButton.disabled = templateItemPage === 0;
    nextButton.disabled = templateItemPage >= pageCount - 1;
}

function syncTemplateOutfit(outfit) {
    var lookType = String(outfit[0] || 128);
    var info = typeof OUTFIT_DATA !== 'undefined' ? OUTFIT_DATA[lookType] : null;
    var type = info && info.type ? info.type : 'monster';
    var button = document.querySelector('.outfit-filter-btn[data-filter="' + type + '"]');
    if (typeof window.filterOutfits === 'function') window.filterOutfits(type, button);
    var select = gid('outfit-select');
    if (select && !select.querySelector('option[value="' + lookType + '"]')) {
        var option = document.createElement('option');
        option.value = lookType;
        option.textContent = (info ? info.name : 'NPC outfit') + ' (' + lookType + ')';
        select.appendChild(option);
    }
    if (select) select.value = lookType;
    gid('addon1').checked = (outfit[5] & 1) === 1;
    gid('addon2').checked = (outfit[5] & 2) === 2;
    gid('mount-check').checked = Number(outfit[6]) > 0;
    gid('mount-selector-group').style.display = Number(outfit[6]) > 0 ? 'block' : 'none';
    if (gid('mount-select')) gid('mount-select').value = String(outfit[6] || 0);
    window.NPC.state.outfit = {
        lookType: Number(outfit[0]) || 128,
        lookHead: Number(outfit[1]) || 0,
        lookBody: Number(outfit[2]) || 0,
        lookLegs: Number(outfit[3]) || 0,
        lookFeet: Number(outfit[4]) || 0,
        lookAddons: Number(outfit[5]) || 0,
        mount: Number(outfit[6]) || 0
    };
    updatePreview();
}

function applyShopTemplate(template, mergeOnly) {
    var incoming = templateItems(template);
    if (mergeOnly) {
        window.NPC.state.tradeItems = SHOP_TOOLS.mergeTradeItems(window.NPC.state.tradeItems, incoming);
        window.renderTradeItems();
        closeModal(gid('shop-template-modal'));
        return;
    }
    if ((window.NPC.state.name || window.NPC.state.tradeItems.length || window.NPC.state.keywords.length) &&
        !window.confirm('Replace the current NPC identity, outfit, messages, and shop items with this shop template?')) return;
    window.NPC.state.name = template.name;
    window.NPC.state.tradeItems = incoming;
    window.NPC.state.keywords = [];
    window.NPC.state.dialogue = {
        greet: template.greet || 'Welcome, |PLAYERNAME|. Ask me for a {trade}.',
        farewell: template.farewell || 'Goodbye.',
        walkaway: template.walkaway || template.farewell || 'Goodbye.'
    };
    gid('npc-name').value = window.NPC.state.name;
    gid('msg-greet').value = window.NPC.state.dialogue.greet;
    gid('msg-farewell').value = window.NPC.state.dialogue.farewell;
    gid('msg-walkaway').value = window.NPC.state.dialogue.walkaway;
    updatePreviewName(window.NPC.state.name);
    syncTemplateOutfit(template.outfit);
    window.renderTradeItems();
    window.renderKeywords();
    closeModal(gid('shop-template-modal'));
}

function initializeShopTemplateFilters(data) {
    var select = gid('shop-template-type');
    if (!select || select.options.length > 1) return;
    Array.from(new Set(data.templates.map(function (template) { return template.type; }))).sort().forEach(function (type) {
        var option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
    });
}

window.showShopTemplates = function () {
    openModal(gid('shop-template-modal'));
    loadShopTemplateData().then(function (data) {
        initializeShopTemplateFilters(data);
        renderTemplateList(data);
    }).catch(function (error) {
        gid('shop-template-list').innerHTML = '<div class="shop-tool-empty">' + window.sanitize(error.message) + '</div>';
        gid('shop-template-meta').textContent = 'Unavailable';
    });
};

window.closeShopTemplates = function () { closeModal(gid('shop-template-modal')); };

function economyDifferenceText(actual, reference, difference) {
    if (!actual) return 'Not configured';
    if (!reference || difference === null) return actual.toLocaleString() + ' gp · No reference';
    var sign = difference > 0 ? '+' : '';
    return actual.toLocaleString() + ' gp · RL ' + reference.toLocaleString() + ' (' + sign + difference + '%)';
}

function renderEconomyReport(report) {
    var summary = gid('economy-summary');
    var results = gid('economy-results');
    var stats = [
        ['Items', report.summary.items], ['Referenced', report.summary.referenced],
        ['Warnings', report.summary.warnings], ['Duplicates', report.summary.duplicates], ['Trade loops', report.summary.loops]
    ];
    summary.innerHTML = stats.map(function (stat) { return '<div class="economy-stat"><strong>' + stat[1] + '</strong><span>' + stat[0] + '</span></div>'; }).join('');
    if (!report.results.length) {
        results.innerHTML = '<div class="shop-tool-empty">Add items to the current trade list before running the analysis.</div>';
        return;
    }
    results.innerHTML = report.results.map(function (item) {
        var notes = [];
        if (item.loop) notes.push('Infinite self-trade risk: the NPC buys this item for more than it sells it.');
        if (item.duplicate) notes.push('Duplicate item and subtype entry.');
        if (!item.loop && !item.duplicate && item.severity === 'warning') notes.push('Price differs by at least 25% from the estimated RL reference.');
        if (!notes.length) notes.push(item.hasReference ? 'Price is within the expected reference range.' : 'No RL reference is available for this item.');
        return '<div class="economy-result"><div><strong>' + window.sanitize(item.name) + '</strong><small>#' + window.sanitize(item.id) + (item.count ? ' · Count ' + item.count : '') + '</small></div>' +
            '<div><small>NPC sells to player</small>' + economyDifferenceText(item.buy, item.referenceBuy, item.buyDifference) + '</div>' +
            '<div><small>NPC buys from player</small>' + economyDifferenceText(item.sell, item.referenceSell, item.sellDifference) + '</div>' +
            '<div><span class="economy-status ' + item.severity + '">' + item.severity + '</span><small>' + window.sanitize(notes.join(' ')) + '</small></div></div>';
    }).join('');
}

window.showEconomyAnalyzer = function () {
    openModal(gid('economy-modal'));
    loadShopTemplateData().then(function (data) {
        renderEconomyReport(SHOP_TOOLS.analyzeEconomy(window.NPC.state.tradeItems, data.references));
    }).catch(function (error) {
        gid('economy-results').innerHTML = '<div class="shop-tool-empty">' + window.sanitize(error.message) + '</div>';
    });
};

window.closeEconomyAnalyzer = function () { closeModal(gid('economy-modal')); };

window.showLuaModal = function () {
    var modal = gid('output-modal');
    if (!modal) { alert('Modal not found'); return; }
    if (typeof window.generateLUA !== 'function') { alert('Generator not loaded'); return; }
    gid('lua-output').value = window.generateLUA(window.NPC.state);
    openModal(modal);
};

window.closeLuaModal = function () {
    closeModal(gid('output-modal'));
};

window.downloadLua = function () {
    var text = gid('lua-output').value;
    if (!text) return;
    var blob = new Blob([text], { type: 'text/plain' });
    var a = document.createElement('a');
    var safeName = (window.NPC.state.name || 'npc').toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'npc';
    var objectUrl = URL.createObjectURL(blob);
    a.download = safeName + '.lua';
    a.href = objectUrl;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 0);
};

window.showHelpModal = function () {
    openModal(gid('help-modal'));
};

window.closeHelpModal = function () {
    closeModal(gid('help-modal'));
};

// Reset
window.resetNPC = function () {
    if (confirm('Reset all data?')) window.location.reload();
};

// Catalog
window.renderCatalog = function (category, activeBtnEl) {
    document.querySelectorAll('#category-filters .cat-btn').forEach(function (b) { b.classList.remove('highlight'); });
    if (activeBtnEl && activeBtnEl.classList) activeBtnEl.classList.add('highlight');

    var grid = gid('catalog-grid');
    if (!grid) return;
    grid.innerHTML = '';

    Object.keys(APP_DATA.items).forEach(function (id) {
        var info = APP_DATA.items[id];
        if (info.category !== category) return;

        var div = document.createElement('div');
        div.style.cssText = 'text-align:center;cursor:pointer;padding:5px;border:1px solid transparent;border-radius:3px;';
        div.innerHTML =
            '<img src="items/' + window.sanitize(id) + '.gif" style="width:32px;height:32px;object-fit:contain;image-rendering:pixelated;" onerror="this.src=\'\'" title="' + window.sanitize(info.name) + '">' +
            '<div style="font-size:10px;color:#ad9372;margin-top:3px;word-break:break-all;">' + window.sanitize(info.name) + '</div>';

        div.onmouseover = function () { div.style.background = 'rgba(255,255,255,0.08)'; div.style.borderColor = 'var(--accent)'; };
        div.onmouseout  = function () { div.style.background = 'transparent'; div.style.borderColor = 'transparent'; };
        div.onclick = (function (itemId, itemName) {
            return function () {
                gid('shop-item-search').value = itemName;
                window.NPC.selectedItem = { id: itemId, name: itemName };
                gid('shop-buy-price').focus();
            };
        }(id, info.name));
        grid.appendChild(div);
    });
};

// Autocomplete
function initAutocomplete() {
    var searchInput = gid('shop-item-search');
    var dropdown    = gid('shop-item-dropdown');
    
    if (!searchInput || !dropdown) {
        console.error("Critical: Search elements not found in DOM");
        return;
    }

    // Initialization may be requested again by future UI changes. Avoid
    // stacking duplicate input and document listeners when that happens.
    if (searchInput.dataset.autocompleteReady === 'true') return;
    searchInput.dataset.autocompleteReady = 'true';

    function handleInput(e) {
        var raw = searchInput.value || "";
        var val = raw.toLowerCase().trim();
        
        dropdown.innerHTML = '';
        window.NPC.selectedItem = null;
        
        if (val.length === 0) { 
            dropdown.style.display = 'none'; 
            return; 
        }

        // Try different global paths for APP_DATA
        var dataRoot = window.APP_DATA || (typeof APP_DATA !== 'undefined' ? APP_DATA : null);
        var items = (dataRoot && dataRoot.items) ? dataRoot.items : null;
        
        if (!items) {
            console.error("APP_DATA.items is missing or inaccessible");
            return;
        }

        var results = [];
        var ids = Object.keys(items);
        
        // Use a simple high-speed loop
        for (var i = 0; i < ids.length; i++) {
            var id   = ids[i];
            var info = items[id];
            var name = (info.name || "").toLowerCase();
            
            // Priority matching
            var rank = -1;
            if (id === val) rank = 0;
            else if (name.indexOf(val) === 0) rank = 1;
            else if (name.indexOf(val) !== -1) rank = 2;
            
            if (rank !== -1) {
                results.push({ id: id, name: info.name, rank: rank });
                if (results.length > 100) break; // Hard limit for safety
            }
        }

        // Sort: Rank first, then alphabetically
        results.sort(function(a, b) {
            if (a.rank !== b.rank) return a.rank - b.rank;
            return a.name.localeCompare(b.name);
        });

        var displayLimit = results.slice(0, 30);
        
        if (displayLimit.length > 0) {
            displayLimit.forEach(function(res) {
                var itemDiv = document.createElement('div');
                itemDiv.className = 'suggestion-item';
                itemDiv.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px 12px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);';
                
                itemDiv.innerHTML = 
                    '<img src="items/' + window.sanitize(res.id) + '.gif" style="width:24px;height:24px;image-rendering:pixelated;" onerror="this.style.visibility=\'hidden\'">' +
                    '<div style="flex:1; font-size:13px; color:#eee;">' + window.sanitize(res.name) + '</div>' +
                    '<div style="font-size:11px; color:#666;">' + window.sanitize(res.id) + '</div>';
                
                itemDiv.onclick = function() {
                    searchInput.value = res.name;
                    window.NPC.selectedItem = { id: res.id, name: res.name };
                    gid('shop-buy-price').focus();
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(itemDiv);
            });

            dropdown.style.display = 'block';
            dropdown.style.zIndex = '9999999';
        } else {
            dropdown.style.display = 'none';
        }
    }

    // Bind multiple events for broad compatibility
    searchInput.addEventListener('input', handleInput);
    searchInput.addEventListener('focus', handleInput);

    // Close on outside click
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.autocomplete-wrapper')) {
            dropdown.style.display = 'none';
        }
    });
}




// Palette
const TIBIA_PALETTE = [
    "#FFFFFF", "#FFD5BF", "#FFEABF", "#FFFFBF", "#EAFFBF", "#D5FFBF", "#BFFFBF", "#BFFFD5", "#BFFFEA", "#BFFFFF", "#BFEAFF", "#BFD5FF", "#BFBFFF", "#D5BFFF", "#EABFFF", "#FFBFFF", "#FFBFEA", "#FFBFD5", "#FFBFBF", // Row 1
    "#DBDBDB", "#BF9F8F", "#BFAF8F", "#BFBF8F", "#AFBF8F", "#9FBF8F", "#8FBF8F", "#8FBF9F", "#8FBFAF", "#8FBFBF", "#8FAFBF", "#8F9FBF", "#8F8FBF", "#9F8FBF", "#AF8FBF", "#BF8FBF", "#BF8FAF", "#BF8F9F", "#BF8F8F", // Row 2
    "#B6B6B6", "#BF7F5F", "#BF9F5F", "#BFBF5F", "#9FBF5F", "#7FBF5F", "#5FBF5F", "#5FBF7F", "#5FBF9F", "#5FBFBF", "#5F9FBF", "#5F7FBF", "#5F5FBF", "#7F5FBF", "#9F5FBF", "#BF5FBF", "#BF5F9F", "#BF5F7F", "#BF5F5F", // Row 3
    "#929292", "#BF6A3F", "#BF953F", "#BFBF3F", "#95BF3F", "#6ABF3F", "#3FBF3F", "#3FBF6A", "#3FBF95", "#3FBFBF", "#3F95BF", "#3F6ABF", "#3F3FBF", "#6A3FBF", "#953FBF", "#BF3FBF", "#BF3F95", "#BF3F6A", "#BF3F3F", // Row 4
    "#6D6D6D", "#FF5500", "#FFAA00", "#FFFF00", "#AAFF00", "#55FF00", "#00FF00", "#00FF55", "#00FFAA", "#00FFFF", "#00AAFF", "#0055FF", "#0000FF", "#5500FF", "#AA00FF", "#FF00FF", "#FF00AA", "#FF0055", "#FF0000", // Row 5 (Pure)
    "#494949", "#BF4000", "#BF7F00", "#BFBF00", "#7FBF00", "#40BF00", "#00BF00", "#00BF40", "#00BF7F", "#00BFBF", "#007FBF", "#0040BF", "#0000BF", "#4000BF", "#7F00BF", "#BF00BF", "#BF007F", "#BF0040", "#BF0000", // Row 6
    "#242424", "#802A00", "#805500", "#808000", "#558000", "#2A8000", "#008000", "#00802A", "#008055", "#008080", "#005580", "#002A80", "#000080", "#2A0080", "#550080", "#800080", "#800055", "#80002A", "#800000"  // Row 7
];

function getTibiaColor(index) {
    return TIBIA_PALETTE[index] || "#000000";
}

window.selectColor = function(idx) {
    var part = window.NPC.activeColorPart;
    if (part === 'head') window.NPC.state.outfit.lookHead = idx;
    if (part === 'body') window.NPC.state.outfit.lookBody = idx;
    if (part === 'legs') window.NPC.state.outfit.lookLegs = idx;
    if (part === 'feet') window.NPC.state.outfit.lookFeet = idx;
    updatePreview();
};

function initPalette() {
    var palette = gid('palette-grid');
    if (!palette) return;
    palette.innerHTML = '';
    
    for (var i = 0; i < TIBIA_PALETTE.length; i++) {
        var block = document.createElement('div');
        block.className = 'color-block';
        block.dataset.colorId = i;
        block.style.background = TIBIA_PALETTE[i];
        block.onclick = function() {
            var cid = parseInt(this.dataset.colorId);
            window.selectColor(cid);
            document.querySelectorAll('.color-block').forEach(function(b) { b.classList.remove('selected'); });
            this.classList.add('selected');
        };
        palette.appendChild(block);
    }

    // Attach listeners to part buttons
    document.querySelectorAll('.part-btn').forEach(function (btn) {
        btn.onclick = function () {
            document.querySelectorAll('.part-btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            window.NPC.activeColorPart = btn.dataset.part;
            
            // Highlight current selection for this part
            var val = 0;
            var p = window.NPC.activeColorPart;
            if (p === 'head') val = window.NPC.state.outfit.lookHead;
            if (p === 'body') val = window.NPC.state.outfit.lookBody;
            if (p === 'legs') val = window.NPC.state.outfit.lookLegs;
            if (p === 'feet') val = window.NPC.state.outfit.lookFeet;
            
            document.querySelectorAll('.color-block').forEach(function (d) { d.classList.remove('selected'); });
            var tgt = document.querySelector('.color-block[data-color-id="' + val + '"]');
            if (tgt) tgt.classList.add('selected');
        };
    });
}

window.randomizeColors = function(mode) {
    function rand() { return Math.floor(Math.random() * TIBIA_PALETTE.length); }
    
    // 1. Randomize Colors (for both modes)
    window.NPC.state.outfit.lookHead = rand();
    window.NPC.state.outfit.lookBody = rand();
    window.NPC.state.outfit.lookLegs = rand();
    window.NPC.state.outfit.lookFeet = rand();

    // 2. Randomize Outfit (only for 'full' mode)
    if (mode === 'full') {
        var activeFilterBtn = document.querySelector('.outfit-filter-btn.active');
        var gender = activeFilterBtn ? activeFilterBtn.dataset.filter : 'male';
        
        var source = (typeof OUTFIT_DATA !== 'undefined') ? OUTFIT_DATA : {};
        var validOutfits = Object.keys(source).filter(function(id) {
            return source[id].type === gender && !(/^ID \d+$/.test(source[id].name));
        });

        if (validOutfits.length > 0) {
            var randomOutfitId = validOutfits[Math.floor(Math.random() * validOutfits.length)];
            gid('outfit-select').value = randomOutfitId;
            window.NPC.state.outfit.lookType = parseInt(randomOutfitId);
        }
    }

    updatePreview();
    // Refresh selection highlights in palette for active part
    var val = 0;
    var p = window.NPC.activeColorPart;
    if (p === 'head') val = window.NPC.state.outfit.lookHead;
    if (p === 'body') val = window.NPC.state.outfit.lookBody;
    if (p === 'legs') val = window.NPC.state.outfit.lookLegs;
    if (p === 'feet') val = window.NPC.state.outfit.lookFeet;
    
    document.querySelectorAll('.color-block').forEach(function(b) { 
        b.classList.remove('selected');
        if (b.dataset.colorId == val) b.classList.add('selected');
    });
};


// Preview
function updatePreview() {
    var outfitSelect = gid('outfit-select');
    var previewImg   = gid('preview-outfit');
    if (!outfitSelect || !previewImg) return;
    var type   = outfitSelect.value || '128';
    var a1     = gid('addon1').checked ? 1 : 0;
    var a2     = gid('addon2').checked ? 2 : 0;
    var addons = a1 + a2;
    var o      = window.NPC.state.outfit;
    var mountChecked = gid('mount-check').checked;
    var mountId = mountChecked ? (gid('mount-select') ? gid('mount-select').value || '0' : '0') : '0';
    previewImg.src =
        'https://outfit-images-oracle.ots.me/latest_walk/animoutfit.php?id=' + type +
        '&addons=' + addons + '&head=' + o.lookHead + '&body=' + o.lookBody +
        '&legs=' + o.lookLegs + '&feet=' + o.lookFeet + '&mount=' + mountId + '&direction=3';
    window.NPC.state.outfit.lookType   = parseInt(type);
    window.NPC.state.outfit.lookAddons = addons;
    window.NPC.state.outfit.mount      = parseInt(mountId);
}

function updatePreviewName(value) {
    var previewName = gid('preview-name');
    if (!previewName) return;
    previewName.textContent = String(value || '').trim() || 'Unnamed NPC';
}

function getPreviewOutfitBounds(width, height) {
    var outfit = window.NPC.state.outfit;
    var boundsTable = typeof OUTFIT_BOUNDS !== 'undefined' ? OUTFIT_BOUNDS : {};
    var mountLookType = 0;

    if (outfit.mount) {
        mountLookType = outfit.mount;
        if (mountLookType < 300 && typeof TFS_MOUNT_LOOKTYPES !== 'undefined') {
            mountLookType = TFS_MOUNT_LOOKTYPES[String(mountLookType)] || mountLookType;
        }
    }

    return PREVIEW_GEOMETRY.resolveBounds(
        boundsTable,
        outfit.lookType,
        outfit.lookAddons,
        mountLookType,
        width,
        height
    );
}

function fitPreviewOutfit() {
    var preview = document.querySelector('.character-preview');
    var stage = gid('character-stage');
    var image = gid('preview-outfit');
    if (!preview || !stage || !image || !image.naturalWidth || !image.naturalHeight) return;

    var availableWidth = Math.max(1, preview.clientWidth - 28);
    var availableHeight = Math.max(1, preview.clientHeight - 46);
    var scale = Math.min(2, availableWidth / image.naturalWidth, availableHeight / image.naturalHeight);
    scale = Math.max(0.25, scale);

    var bounds = getPreviewOutfitBounds(image.naturalWidth, image.naturalHeight);
    var labelCenterX = bounds.anchor.x * scale;
    var labelTop = bounds.anchor.y * scale;

    stage.style.width = Math.round(image.naturalWidth * scale) + 'px';
    stage.style.height = Math.round(image.naturalHeight * scale) + 'px';
    stage.style.setProperty('--outfit-scale', scale.toFixed(4));
    stage.style.setProperty('--label-center-x', labelCenterX.toFixed(2) + 'px');
    stage.style.setProperty('--label-anchor-top', labelTop.toFixed(2) + 'px');
}

// Initialization
document.addEventListener('DOMContentLoaded', function () {

    document.querySelectorAll('.modal-overlay').forEach(function (modal) {
        modal.addEventListener('click', function (event) {
            if (event.target !== modal) return;
            closeModal(modal);
        });
    });

    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' && event.key !== 'Esc') return;
        var activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) closeModal(activeModal);
    });

    var templateSearch = gid('shop-template-search');
    var templateType = gid('shop-template-type');
    if (templateSearch) templateSearch.addEventListener('input', function () {
        shopTemplatePage = 0;
        clearTimeout(shopTemplateRenderTimer);
        shopTemplateRenderTimer = setTimeout(function () {
            loadShopTemplateData().then(renderTemplateList).catch(function () {});
        }, 80);
    });
    if (templateType) templateType.addEventListener('change', function () {
        shopTemplatePage = 0;
        loadShopTemplateData().then(renderTemplateList).catch(function () {});
    });
    var shopTemplatePrevious = gid('shop-template-prev');
    var shopTemplateNext = gid('shop-template-next');
    if (shopTemplatePrevious) shopTemplatePrevious.addEventListener('click', function () {
        shopTemplatePage = Math.max(0, shopTemplatePage - 1);
        loadShopTemplateData().then(renderTemplateList).catch(function () {});
    });
    if (shopTemplateNext) shopTemplateNext.addEventListener('click', function () {
        shopTemplatePage += 1;
        loadShopTemplateData().then(renderTemplateList).catch(function () {});
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
            tab.classList.add('active');
            gid(tab.dataset.target).classList.add('active');
        });
    });

    var previewImage = gid('preview-outfit');
    if (previewImage) {
        previewImage.addEventListener('load', fitPreviewOutfit);
        if (previewImage.complete) fitPreviewOutfit();
    }
    if (typeof ResizeObserver !== 'undefined') {
        var previewResizeObserver = new ResizeObserver(fitPreviewOutfit);
        previewResizeObserver.observe(document.querySelector('.character-preview'));
    } else {
        window.addEventListener('resize', fitPreviewOutfit);
    }

    // Outfit dropdown — powered by OUTFIT_DATA
    var outfitSelect = gid('outfit-select');

    window.filterOutfits = function (type, btnEl) {
        // Highlight active button
        document.querySelectorAll('.outfit-filter-btn').forEach(function (b) { b.classList.remove('active'); });
        if (btnEl) btnEl.classList.add('active');

        outfitSelect.innerHTML = '';
        var source = (typeof OUTFIT_DATA !== 'undefined') ? OUTFIT_DATA : {};
        var firstId = null;

        Object.keys(source).forEach(function (oid) {
            var info = source[oid];
            if (info.type !== type) return;
            // Skip placeholder entries with no real name ("ID XXX")
            if (/^ID \d+$/.test(info.name)) return;
            
            var opt = document.createElement('option');
            opt.value = oid;
            opt.textContent = info.name + ' (' + oid + ')';
            
            // Auto-select 128 for male, or the first available for others
            if (!firstId) firstId = oid;
            if (oid === '128' && type === 'male') {
                opt.selected = true;
                firstId = oid;
            }
            outfitSelect.appendChild(opt);
        });

        // Fallback: if OUTFIT_DATA not available, use APP_DATA
        if (outfitSelect.options.length === 0 && typeof APP_DATA !== 'undefined' && APP_DATA.outfits) {
            APP_DATA.outfits.forEach(function (o) {
                var opt = document.createElement('option');
                opt.value = o;
                var name = (APP_DATA.outfits_map && APP_DATA.outfits_map[o]) ? APP_DATA.outfits_map[o] : 'Outfit ID: ' + o;
                opt.textContent = name + ' (' + o + ')';
                if (!firstId) firstId = o;
                if (o == '128') {
                    opt.selected = true;
                    firstId = o;
                }
                outfitSelect.appendChild(opt);
            });
        }

        // Force selection of the first item matching the filter
        if (type !== 'male' && firstId) {
            outfitSelect.value = firstId;
        }

        updatePreview();
    };

    // Initial load — show male outfits
    window.filterOutfits('male', document.querySelector('.outfit-filter-btn[data-filter="male"]'));

    outfitSelect.addEventListener('change', updatePreview);
    gid('addon1').addEventListener('change', updatePreview);
    gid('addon2').addEventListener('change', updatePreview);
    gid('mount-check').addEventListener('change', function () {
        var group = gid('mount-selector-group');
        if (group) group.style.display = this.checked ? 'block' : 'none';
        updatePreview();
    });
    gid('mount-select').addEventListener('change', updatePreview);

    // Autocomplete
    initAutocomplete();

    // Mounts
    var mountSel = gid('mount-select');
    if (mountSel && typeof APP_DATA !== 'undefined' && APP_DATA.mounts_map) {
        var mountIds = Object.keys(APP_DATA.mounts_map).sort(function(a,b){ return parseInt(a)-parseInt(b); });
        mountIds.forEach(function (mid) {
            var opt = document.createElement('option');
            opt.value = mid;
            var mname = APP_DATA.mounts_map[mid] || 'Mount ' + mid;
            opt.textContent = mname + ' (' + mid + ')';
            mountSel.appendChild(opt);
        });
    }


    initPalette();
    updatePreview();


    // Category buttons
    if (typeof APP_DATA !== 'undefined' && APP_DATA.categories) {
        var filters = gid('category-filters');
        var categories = APP_DATA.categories;
        
        // Clear existing filters if any (safety)
        filters.innerHTML = '';

        categories.forEach(function (cat, idx) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rpg-btn cat-btn' + (idx === 0 ? ' highlight' : '');
            btn.textContent = cat;
            btn.onclick = (function (c, b) { return function () { window.renderCatalog(c, b); }; }(cat, btn));
            filters.appendChild(btn);
        });
        
        if (filters && filters.firstElementChild) {
            window.renderCatalog(categories[0], filters.firstElementChild);
        }
    }
    // Basic config fields
    gid('npc-name').addEventListener('input',          function (e) { window.NPC.state.name = e.target.value; updatePreviewName(e.target.value); });
    gid('npc-walk-interval').addEventListener('input', function (e) { window.NPC.state.walkInterval           = parseInt(e.target.value); });
    gid('npc-health').addEventListener('input',        function (e) { window.NPC.state.health                 = parseInt(e.target.value); });
    gid('npc-walk-radius').addEventListener('input',   function (e) { window.NPC.state.walkRadius             = parseInt(e.target.value); });
    gid('msg-greet').addEventListener('input',         function (e) { window.NPC.state.dialogue.greet         = e.target.value; });
    gid('msg-farewell').addEventListener('input',      function (e) { window.NPC.state.dialogue.farewell       = e.target.value; });
    gid('msg-walkaway').addEventListener('input',      function (e) { window.NPC.state.dialogue.walkaway       = e.target.value; });
});
