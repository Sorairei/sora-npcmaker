const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveBounds } = require('../preview_geometry');

test('addons do not move the name and health bar anchor', () => {
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
    assert.deepEqual(withTallAddon.label, withoutAddon.label);
    assert.deepEqual(withTallAddon.label, [31, 31, 64, 64]);
});

test('mounts still affect both visible and label bounds', () => {
    const bounds = {
        '128': [[31, 31, 64, 64], [20, 10, 64, 64]],
        '400': [[24, 28, 72, 80]]
    };

    const result = resolveBounds(bounds, 128, 1, 400, 96, 96);

    assert.deepEqual(result.visible, [20, 10, 72, 80]);
    assert.deepEqual(result.label, [24, 28, 72, 80]);
});
