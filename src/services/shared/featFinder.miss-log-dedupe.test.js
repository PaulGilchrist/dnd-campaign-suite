// @maintained-by-ai 2026-11-23
import { describe, it, expect, vi, afterEach } from 'vitest';
import { findFeat, resetFeatFinderMissLog } from './featFinder.js';
import feats5e from '../../../public/data/feats.json';

// XY 2026-11-23 dedupe lane: a repeated miss on the SAME feat name logs the
// '[findFeat] NOT FOUND:' console.error AT MOST ONCE per page load (the old
// ×3-identical-per-mount spam made console-diff probes on flipped-ruleset
// fixtures expensive). Laws pinned here:
//  1. first miss logs once; repeat misses of the SAME name log nothing further;
//  2. a DISTINCT missing name still gets its own first-occurrence log
//     (dedupe keyed by name — not a global one-shot suppression);
//  3. the first-occurrence log shape is byte-familiar: same prefix + args
//     (featName, 'allFeats sample:', first-5 names), so console-keyed probes match;
//  4. the dedupe does NOT change the return value — every miss still returns null.
// resetFeatFinderMissLog() is the test-isolation hook (module-scoped Set).

const FIRST5_5E = feats5e.slice(0, 5).map(f => f.name);

afterEach(() => {
  vi.restoreAllMocks();
  resetFeatFinderMissLog();
});

describe('findFeat — miss-log dedupe: once-per-name-per-load (XY 2026-11-23)', () => {
  it('same-name repeat: first miss logs once, 2nd and 3rd identical miss log nothing further', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Xmissing = 'X: Zzz Dedupe Probe'; // synthetic miss name; absent from 5e disk table
    expect(findFeat(Xmissing, feats5e)).toBeNull();
    expect(findFeat(Xmissing, feats5e)).toBeNull(); // ×2 render-pass repeats
    expect(findFeat(Xmissing, feats5e)).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toEqual([
      '[findFeat] NOT FOUND:', Xmissing, 'allFeats sample:', FIRST5_5E,
    ]);
  });

  it('distinct names: each missing name keeps its own first-occurrence log (per-name key, not a global one-shot)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Xa = 'X: Dedupe First';
    const Xb = 'X: Dedupe Second';
    expect(findFeat(Xa, feats5e)).toBeNull();
    expect(findFeat(Xa, feats5e)).toBeNull(); // Xa repeat — silent
    expect(findFeat(Xb, feats5e)).toBeNull(); // distinct name — logs
    expect(findFeat(Xb, feats5e)).toBeNull(); // Xb repeat — silent
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.map(c => [c[0], c[1]])).toEqual([
      ['[findFeat] NOT FOUND:', Xa],
      ['[findFeat] NOT FOUND:', Xb],
    ]);
  });

  it('first-occurrence log content stays byte-familiar: same prefix, marker and first-5 sample args', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Xmissing = 'X: Log Shape Probe';
    findFeat(Xmissing, feats5e);
    const call = spy.mock.calls[0];
    expect(call[0]).toBe('[findFeat] NOT FOUND:');
    expect(call[1]).toBe(Xmissing); // raw queried name verbatim (paren-queries included)
    expect(call[2]).toBe('allFeats sample:');
    expect(call[3]).toEqual(FIRST5_5E);
    expect(call.length).toBe(4);
  });

  it('dedupe is log-only: every repeat miss still returns null (one miss vocabulary preserved)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Xmissing = 'X: Null Contract Probe';
    expect(findFeat(Xmissing, feats5e)).toBeNull();
    expect(findFeat(Xmissing, feats5e)).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
