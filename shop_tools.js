(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SHOP_TOOLS = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function price(value) {
        var number = Number(value);
        return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
    }

    function itemKey(item) {
        return String(item.id) + ':' + (Number(item.count) || 0);
    }

    function expandTemplateItems(template, catalog) {
        return (template.items || []).map(function (entry) {
            var id = String(entry[0]);
            var catalogItem = catalog && catalog[id];
            return {
                id: id,
                name: catalogItem ? catalogItem.name : 'Item ' + id,
                buy: price(entry[1]),
                sell: price(entry[2]),
                count: price(entry[3])
            };
        });
    }

    function mergeTradeItems(current, incoming) {
        var result = (current || []).map(function (item) { return Object.assign({}, item); });
        var keys = new Set(result.map(itemKey));
        (incoming || []).forEach(function (item) {
            var key = itemKey(item);
            if (!keys.has(key)) {
                result.push(Object.assign({}, item));
                keys.add(key);
            }
        });
        return result;
    }

    function buildCatalogSearchIndex(catalog) {
        return Object.keys(catalog || {}).map(function (id) {
            var item = catalog[id] || {};
            var name = String(item.name || '');
            return { id: id, name: name, normalizedName: name.toLowerCase() };
        });
    }

    function findCatalogItems(catalogOrIndex, query, limit) {
        var value = String(query || '').trim().toLowerCase();
        if (!value) return [];
        var results = [];
        var index = Array.isArray(catalogOrIndex) ? catalogOrIndex : buildCatalogSearchIndex(catalogOrIndex);
        index.forEach(function (item) {
            var id = item.id;
            var name = item.name;
            var normalizedName = item.normalizedName;
            var rank = -1;
            if (id === value || normalizedName === value) rank = 0;
            else if (normalizedName.indexOf(value) === 0) rank = 1;
            else if (normalizedName.indexOf(value) !== -1) rank = 2;
            if (rank >= 0) results.push({ id: id, name: name, rank: rank });
        });
        results.sort(function (left, right) {
            return left.rank - right.rank || left.name.localeCompare(right.name) || Number(left.id) - Number(right.id);
        });
        return results.slice(0, Math.max(1, Number(limit) || 30));
    }

    function percentDifference(actual, reference) {
        if (!actual || !reference) return null;
        return Math.round(((actual - reference) / reference) * 100);
    }

    function analyzeEconomy(items, references) {
        var seen = new Map();
        var results = [];
        var duplicateCount = 0;
        var loopCount = 0;
        var warningCount = 0;

        (items || []).forEach(function (item, index) {
            var id = String(item.id);
            var buy = price(item.buy);
            var sell = price(item.sell);
            var key = itemKey(item);
            var duplicate = seen.has(key);
            seen.set(key, true);
            if (duplicate) duplicateCount += 1;

            var loop = buy > 0 && sell > buy;
            if (loop) loopCount += 1;

            var reference = references && references[id] ? references[id] : [0, 0];
            var buyDifference = percentDifference(buy, price(reference[0]));
            var sellDifference = percentDifference(sell, price(reference[1]));
            var deviations = [buyDifference, sellDifference].filter(function (value) { return value !== null; });
            var largestDeviation = deviations.length ? Math.max.apply(null, deviations.map(Math.abs)) : 0;
            var severity = loop ? 'danger' : (duplicate || largestDeviation >= 25 ? 'warning' : 'ok');
            if (severity === 'warning') warningCount += 1;

            results.push({
                index: index,
                id: id,
                name: item.name || ('Item ' + id),
                buy: buy,
                sell: sell,
                count: price(item.count),
                referenceBuy: price(reference[0]),
                referenceSell: price(reference[1]),
                buyDifference: buyDifference,
                sellDifference: sellDifference,
                duplicate: duplicate,
                loop: loop,
                severity: severity,
                hasReference: price(reference[0]) > 0 || price(reference[1]) > 0
            });
        });

        var rank = { danger: 0, warning: 1, ok: 2 };
        results.sort(function (a, b) { return rank[a.severity] - rank[b.severity] || a.name.localeCompare(b.name); });
        return {
            summary: {
                items: (items || []).length,
                warnings: warningCount,
                duplicates: duplicateCount,
                loops: loopCount,
                referenced: results.filter(function (result) { return result.hasReference; }).length
            },
            results: results
        };
    }

    return {
        analyzeEconomy: analyzeEconomy,
        buildCatalogSearchIndex: buildCatalogSearchIndex,
        expandTemplateItems: expandTemplateItems,
        findCatalogItems: findCatalogItems,
        mergeTradeItems: mergeTradeItems
    };
}));
