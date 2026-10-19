// @maintained-by-ai
// POPUP lane of conditionSaveService (owned here): buildConditionPopup production
// envelope bytes (:175-192) — the popup payload the consumer builds after a rolled
// condition save. Pins every field byte-exact incl. bonus fields other lanes missed:
// rolls||[roll] fallback, rolls-array pass-through (CLA-209 multi-roll),
// forcedMode ternary leg, and the conditional starryDragonFloor spread
// (key ABSENT when falsy — #825/#932/#942 exact-envelope precedent).
//
// Family map (behaviors owned elsewhere, not duplicated here):
// - conditionSaveService.aura-immunity.test.js (#1002) — CLA-019/020 aura suppression gate.
// - conditionSaveService.conditionManagement.test.js (#1003) — removeCondition full lane +
//   addCondition auto-immunity gate, append/dedup, meta merge, { suppressed } contract.
// - conditionSaveService.test.js — getCreatureSaveBonus / rollConditionSave queue-NEXT
//   save/roll orchestration (engine lanes CLOSED #995-#1001, cite-only).
// - createRollConditionSaveHandler.test.jsx — consumer lane: pins the CALL ARGS into
//   buildConditionPopup (mocked here); rendering of the popup is owned by UI prompt lanes
//   (Initiative.jsx consumes popup.forcedMode / popup.starryDragonFloor).
// Suppression interplay cited, not re-driven (#1003 gate owns). Pure function: no timers,
// no network, no wall-clock — prompts wait indefinitely (turn-based CANON).
//
// old -> new: t1(all-fields)→P1 | t2(fail/null/negative legs)→folded P2 |
// t3(rolls-wrap)→removed ([roll] fallback pinned by P1 exact envelope; multi-roll
// pass-through up to new P3 CLA-209 leg).
import { describe, it, expect } from 'vitest';

// ── Imports ──────────────────────────────────────────────────────

import { buildConditionPopup } from './conditionSaveService.js';

// ── Tests ────────────────────────────────────────────────────────

describe('buildConditionPopup', () => {
  it('P1: plain save builds the exact popup envelope; forcedMode unset, starryDragonFloor key absent', () => {
    const popup = buildConditionPopup({ roll: 15, bonus: 5, bonusDetail: '+3 aura from Paladin', abilityLabel: 'Wisdom', conditionLabel: 'Charmed', dc: 18, success: true });

    expect(popup).toEqual({
      type: 'd20',
      rollType: 'condition-save',
      name: 'Wisdom',
      rolls: [15],
      bonus: 5,
      bonusDetail: '+3 aura from Paladin',
      targetName: null,
      targetAc: null,
      hit: undefined,
      condition: 'Charmed',
      dc: 18,
      success: true,
    });
    // falsifiers for the two conditional legs (toEqual alone cannot see key absence)
    expect(popup.forcedMode).toBeUndefined();
    expect('starryDragonFloor' in popup).toBe(false);
  });

  // Folded pass-through battery (was 4 partial-assert calls): full envelope per case.
  it.each([
    {
      name: 'failure with negative bonus',
      args: { roll: 1, bonus: -3, bonusDetail: 'detail', abilityLabel: 'Charisma', conditionLabel: 'Frightened', dc: 5, success: false },
      expected: { type: 'd20', rollType: 'condition-save', name: 'Charisma', rolls: [1], bonus: -3, bonusDetail: 'detail', targetName: null, targetAc: null, hit: undefined, condition: 'Frightened', dc: 5, success: false },
    },
    {
      name: 'null bonusDetail passes through as null (not dropped)',
      args: { roll: 10, bonus: 0, bonusDetail: null, abilityLabel: 'Constitution', conditionLabel: 'Paralyzed', dc: 12, success: true },
      expected: { type: 'd20', rollType: 'condition-save', name: 'Constitution', rolls: [10], bonus: 0, bonusDetail: null, targetName: null, targetAc: null, hit: undefined, condition: 'Paralyzed', dc: 12, success: true },
    },
    {
      name: 'omitted bonusDetail stays undefined',
      args: { roll: 8, bonus: 3, abilityLabel: 'Dexterity', conditionLabel: 'Blinded', dc: 11, success: false },
      expected: { type: 'd20', rollType: 'condition-save', name: 'Dexterity', rolls: [8], bonus: 3, bonusDetail: undefined, targetName: null, targetAc: null, hit: undefined, condition: 'Blinded', dc: 11, success: false },
    },
  ])('P2: $name', ({ args, expected }) => {
    expect(buildConditionPopup(args)).toEqual(expected);
  });

  it('P3: CLA-209 advantage multi-roll passes rolls through, sets forcedMode and emits starryDragonFloor', () => {
    const popup = buildConditionPopup({ roll: 15, bonus: 2, bonusDetail: undefined, abilityLabel: 'Constitution', conditionLabel: 'Blinded', dc: 12, success: true, rolls: [5, 15], advantage: true, starryDragonFloor: true });

    expect(popup).toEqual({
      type: 'd20',
      rollType: 'condition-save',
      name: 'Constitution',
      rolls: [5, 15],
      bonus: 2,
      bonusDetail: undefined,
      targetName: null,
      targetAc: null,
      hit: undefined,
      condition: 'Blinded',
      dc: 12,
      success: true,
      forcedMode: 'advantage',
      starryDragonFloor: true,
    });
  });
});
