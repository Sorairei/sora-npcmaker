const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveBounds } = require('../preview_geometry');

test('addons do not move the Tibia tile anchor', () => {
    const bounds = {
        '128': [
            [31, 31, 64, 64],
            [31, 31, 64, 64],
            [26, 17, 64, 64],
            [26, 17, 64, 64]
        ]
    };

    const withoutAddon = resolveBounds(bounds, 128, 0, 0, 96, 96);
    const withTallAddon = resolveBounds(bounds, 128, 2, 0, 96, 96);

    assert.deepEqual(withTallAddon.visible, [26, 17, 64, 64]);
    assert.deepEqual(withTallAddon.anchor, withoutAddon.anchor);
    assert.deepEqual(withTallAddon.anchor, { x: 80, y: 64 });
});

test('mounts affect visible bounds without moving the tile anchor', () => {
    const bounds = {
        '128': [[31, 31, 64, 64], [20, 10, 64, 64]],
        '400': [[24, 28, 72, 80]]
    };

    const result = resolveBounds(bounds, 128, 1, 400, 96, 96);

    assert.deepEqual(result.visible, [20, 10, 72, 80]);
    assert.deepEqual(result.anchor, { x: 80, y: 64 });
});

test('different monster silhouettes share the same anchor for the same canvas', () => {
    const bounds = {
        '12': [[0, 1, 64, 64]],
        '21': [[45, 31, 55, 61]],
        '55': [[4, 2, 64, 64]]
    };

    const anchors = [12, 21, 55].map((lookType) =>
        resolveBounds(bounds, lookType, 0, 0, 64, 64).anchor
    );

    assert.deepEqual(anchors, [
        { x: 48, y: 32 },
        { x: 48, y: 32 },
        { x: 48, y: 32 }
    ]);
});

test('32px creatures anchor to their single tile', () => {
    const result = resolveBounds({ '5': [[1, 0, 31, 32]] }, 5, 0, 0, 32, 32);

    assert.deepEqual(result.anchor, { x: 16, y: 0 });
});
