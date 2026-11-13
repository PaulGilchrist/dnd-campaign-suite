// @maintained-by-ai
//
// ── liveTargetHp.js — chooser HP precedence (bucket-first / row-fallback) ──
// Locks the EH 2026-11-13 cs-row-staleness fix face: heal writes commit to the
// bucket `currentHitPoints` and never move the combatSummary row, so the heal
// target-choosers (collectTouchTargets + healingPoolHandler scan) must display
// the BUCKET value whenever available, with the cs row used ONLY as fallback.
// Monster rows have no runtime HP keys at all (playbook §80) — their fallback
// leg IS the canonical display.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

import { resolveLiveTargetHp } from './liveTargetHp.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const staleRow = { name: 'Fighting_Rogue', type: 'player', currentHp: 100, maxHp: 100 };

describe('resolveLiveTargetHp — bucket-first / row-fallback precedence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bucket currentHitPoints + hitPoints win over the stale combatSummary row', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 134;
      if (key === 'hitPoints') return 143;
      return null;
    });

    expect(resolveLiveTargetHp(staleRow)).toEqual({ currentHp: 134, maxHp: 143 });
    expect(getRuntimeValue).toHaveBeenCalledWith('Fighting_Rogue', 'currentHitPoints');
    expect(getRuntimeValue).toHaveBeenCalledWith('Fighting_Rogue', 'hitPoints');
  });

  it('missing bucket (null) falls back to the row values', () => {
    getRuntimeValue.mockReturnValue(null);

    expect(resolveLiveTargetHp(staleRow)).toEqual({ currentHp: 100, maxHp: 100 });
  });

  it('empty-string bucket is treated as no data (row fallback, never NaN)', () => {
    getRuntimeValue.mockImplementation((name, key) => (key === 'currentHitPoints' ? '' : null));

    expect(resolveLiveTargetHp(staleRow)).toEqual({ currentHp: 100, maxHp: 100 });
  });

  it('non-numeric bucket is refused to the fallback, numeric strings coerce', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 'not-hp';
      if (key === 'hitPoints') return '143';
      return null;
    });

    expect(resolveLiveTargetHp(staleRow)).toEqual({ currentHp: 100, maxHp: 143 });
  });

  it('resolves per-field: bucket current with row max when only the current key exists', () => {
    getRuntimeValue.mockImplementation((name, key) => (key === 'currentHitPoints' ? 90 : null));

    expect(resolveLiveTargetHp(staleRow)).toEqual({ currentHp: 90, maxHp: 100 });
  });

  it('monster row (no runtime HP keys ever) keeps the combatSummary truth', () => {
    getRuntimeValue.mockReturnValue(null);
    const bandit = { name: 'Bandit 1', type: 'monster', currentHp: 1, maxHp: 11 };

    expect(resolveLiveTargetHp(bandit)).toEqual({ currentHp: 1, maxHp: 11 });
  });
});
