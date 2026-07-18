(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.PREVIEW_GEOMETRY = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function unionBounds(first, second) {
        if (!first) return second ? second.slice() : null;
        if (!second) return first.slice();
        return [
            Math.min(first[0], second[0]),
            Math.min(first[1], second[1]),
            Math.max(first[2], second[2]),
            Math.max(first[3], second[3])
        ];
    }

    function clampBounds(bounds, width, height) {
        if (!bounds) return [0, 0, width, height];
        return [
            Math.max(0, Math.min(width, bounds[0])),
            Math.max(0, Math.min(height, bounds[1])),
            Math.max(0, Math.min(width, bounds[2])),
            Math.max(0, Math.min(height, bounds[3]))
        ];
    }

    function resolveTileAnchor(width, height, mounted) {
        // Tibia anchors creature information to the bottom-right 32x32 tile
        // occupied by the creature, not to the highest visible sprite pixel.
        // Mounted riders use a small upward information displacement in-game.
        return {
            x: Math.max(0, width - 16),
            y: Math.max(0, height - 32 - (mounted ? 2 : 0))
        };
    }

    function resolveBounds(boundsTable, lookType, addonState, mountLookType, width, height) {
        var states = boundsTable[String(lookType)];
        var baseBounds = states && states[0] ? states[0] : null;
        var visibleBounds = states && states[addonState] ? states[addonState] : baseBounds;

        if (mountLookType) {
            var mountStates = boundsTable[String(mountLookType)];
            var mountBounds = mountStates && mountStates[0] ? mountStates[0] : null;
            visibleBounds = unionBounds(visibleBounds, mountBounds);
        }

        return {
            visible: clampBounds(visibleBounds, width, height),
            anchor: resolveTileAnchor(width, height, Boolean(mountLookType))
        };
    }

    return {
        unionBounds: unionBounds,
        clampBounds: clampBounds,
        resolveTileAnchor: resolveTileAnchor,
        resolveBounds: resolveBounds
    };
}));
