/**
 * Pure-function smoke tests for soundcloud-background-music.
 *
 * No network, no DB, no audio. Operates on the compiled `build/`.
 * Run `npm run build` first.
 *
 *   node tests/unit.cjs
 */
'use strict';

const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(path.join(buildDir, 'search', 'scorer.js'))) {
  console.error('build/ not found — run `npm run build` first.');
  process.exit(2);
}

const { inRange, scoreResults } = require(path.join(buildDir, 'search', 'scorer.js'));

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

// ─── inRange ───────────────────────────────────────────────────────
test('inRange: returns 1 inside the range', () => {
  assert.equal(inRange(120, 100, 140), 1);
  assert.equal(inRange(100, 100, 140), 1);
  assert.equal(inRange(140, 100, 140), 1);
});

test('inRange: returns 0.5 for null (neutral)', () => {
  assert.equal(inRange(null, 100, 140), 0.5);
});

test('inRange: decays linearly outside the range', () => {
  // range=40, distance=20 → score = 1 - 20/40 = 0.5
  assert.equal(inRange(80, 100, 140), 0.5);
  assert.equal(inRange(160, 100, 140), 0.5);
});

test('inRange: floors at 0 for far values', () => {
  // range=40, distance=200 → 1 - 5 = -4 → clamp to 0
  assert.equal(inRange(-100, 100, 140), 0);
  assert.equal(inRange(500, 100, 140), 0);
});

test('inRange: handles zero-width range gracefully', () => {
  // min === max → range collapses, distance=0 inside, else proportional
  assert.equal(inRange(120, 120, 120), 1);
  assert.ok(inRange(125, 120, 120) >= 0); // doesn't NaN/Infinity
});

// ─── scoreResults ──────────────────────────────────────────────────
test('scoreResults: ranks an exact-match track above an off-target one', () => {
  const tracks = [
    {
      sc_track_id: 1, similarity: 0.9, bpm_detected: 80, energy: 0.3,
      genre: 'lofi hip hop', tags: ['chill', 'lofi'],
    },
    {
      sc_track_id: 2, similarity: 0.4, bpm_detected: 180, energy: 0.95,
      genre: 'metal', tags: ['heavy'],
    },
  ];
  const analysis = {
    bpm_range: [70, 90],
    energy_range: [0.2, 0.4],
    genre_hints: ['lofi'],
  };
  const ranked = scoreResults(tracks, analysis);
  assert.equal(ranked[0].track.sc_track_id, 1, 'track 1 should rank first');
  assert.ok(ranked[0].score > ranked[1].score);
  assert.ok(ranked[0].reasons.length > 0);
});

test('scoreResults: returns 0.5 neutral feature score when analysis is empty', () => {
  const tracks = [{ sc_track_id: 1, similarity: 0.6, bpm_detected: 120, energy: 0.5, genre: 'pop', tags: [] }];
  const analysis = { bpm_range: null, energy_range: null, genre_hints: [] };
  const ranked = scoreResults(tracks, analysis);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].feature_score, 0.5);
});

// ─── runner ────────────────────────────────────────────────────────
(async () => {
  let passed = 0;
  let failed = 0;
  for (const c of cases) {
    try {
      await c.fn();
      passed++;
      console.log(`  PASS  ${c.name}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL  ${c.name}`);
      console.error(`    ${err.stack || err.message}`);
    }
  }
  console.log(`\n${passed}/${cases.length} passed${failed ? `, ${failed} failed` : ''}`);
  process.exit(failed === 0 ? 0 : 1);
})();
