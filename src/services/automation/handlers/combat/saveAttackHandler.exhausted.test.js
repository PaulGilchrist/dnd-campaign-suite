// @maintained-by-ai 2026-11-27
// Deterministic unit contract for the exported isExhausted() predicate
// (channel divinity / wild shape / tracked-uses refusal gating). Pure logic
// over action.automation + playerStats; the only module boundary mocked is
// useRuntimeState (resolveUses runs REAL, mirroring
// saveAttackHandler.handle-2.test.js — diceRoller stays mocked because
// automationExpressions.js imports it). Exact single-read mock.calls censuses
// pin: channel divinity's campaignName-less 2-arg read and POSITIONAL
// class_levels[level - 1] lookup (unlike wild shape's level-matched find), the
// derived-vs-custom uses key, and that resource lanes never churn the uses
// lane. Stable unless the predicate's branches or runtime keys change.
// handle()'s consumption lanes live in saveAttackHandler.handle.test.js and
// saveAttackHandler.handle-2.test.js — do not cross-remove.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

// Needed only because automationExpressions.js (imported for the REAL
// resolveUses) pulls diceRoller in at module load.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { isExhausted } from './saveAttackHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Breath Weapon',
    automation: {
      type: 'save_attack',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('saveAttackHandler - isExhausted', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it.each([
    ['the action has no automation object', { name: 'Test' }],
    ['automation declares no uses/usesMax', makeAction({ damage: '1d6' })],
  ])('returns false without a single runtime read when %s', (_label, action) => {
    expect(isExhausted(action, makePlayerStats(), campaignName)).toBe(false);
    expect(runtimeState.getRuntimeValue.mock.calls).toEqual([]);
  });

  describe('channel divinity resource cost', () => {
    // Quirk pinned honestly: this lane reads 'channelDivinityCharges' with
    // only 2 args (campaignName is dropped at :35) and looks class data up
    // POSITIONALLY at class_levels[level - 1] — fixtures use level 1 with the
    // entry at index 0. The exact censuses below are the contract.

    it('reports exhaustion at 0 stored charges, reading only channelDivinityCharges', () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats({
        level: 1,
        class: { class_levels: [{ level: 1, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      expect(isExhausted(action, ps, campaignName)).toBe(true);
      expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
        ['TestCaster', 'channelDivinityCharges'],
      ]);
    });

    it.each([
      ['stored charges are available', 1, { class_levels: [{ level: 1, channel_divinity: 2 }] }],
      ['no stored value defaults to the class max', null, { class_levels: [{ level: 1, channel_divinity: 2 }] }],
      // channel_divinity 0 is falsy so the || chain falls to class_specific;
      // a `??` read would report exhausted here.
      ['channel_divinity 0 falls through || to class_specific.channel_divinity_charges', null, { class_levels: [{ level: 1, channel_divinity: 0, class_specific: { channel_divinity_charges: 3 } }] }],
      ['missing class data defaults to 2 charges', null, {}],
    ])('returns false when %s', (_label, stored, cls) => {
      runtimeState.getRuntimeValue.mockReturnValue(stored);
      const ps = makePlayerStats({ level: 1, class: cls });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      expect(isExhausted(action, ps, campaignName)).toBe(false);
      expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
        ['TestCaster', 'channelDivinityCharges'],
      ]);
    });
  });

  describe('wild shape resource cost', () => {
    // maxWS comes from class_levels.find(cl => cl.level === level) (level-
    // matched, unlike channel divinity's positional read) and the runtime
    // read forwards campaignName — both pinned by the exact censuses.

    it.each([
      ['stored uses are 0', 0, { class_levels: [{ level: 5, wild_shape: 2 }] }],
      ['the level-matched wild_shape max is 0', null, { class_levels: [{ level: 5, wild_shape: 0 }] }],
    ])('reports exhaustion when %s', (_label, stored, cls) => {
      runtimeState.getRuntimeValue.mockReturnValue(stored);
      const ps = makePlayerStats({ class: cls });
      const action = makeAction({ resourceCost: 'wild_shape' });

      expect(isExhausted(action, ps, campaignName)).toBe(true);
      expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
        ['TestCaster', 'wildShapeUses', campaignName],
      ]);
    });

    it.each([
      ['stored uses are available', 2],
      ['no stored value defaults to the class max', null],
    ])('returns false when %s', (_label, stored) => {
      runtimeState.getRuntimeValue.mockReturnValue(stored);
      const ps = makePlayerStats({ class: { class_levels: [{ level: 5, wild_shape: 2 }] } });
      const action = makeAction({ resourceCost: 'wild_shape' });

      expect(isExhausted(action, ps, campaignName)).toBe(false);
      expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
        ['TestCaster', 'wildShapeUses', campaignName],
      ]);
    });
  });

  describe('uses / usesMax resource cost', () => {
    // usesMax absent delegates max resolution to the REAL resolveUses:
    // 'proficiency_bonus' -> playerStats.proficiency || 0, so a proficiency
    // of 0 with nothing stored exhausts — the `?? 1` fallback would have
    // said fresh, so this discriminates the delegation behaviorally.
    it.each([
      ['derived action-name key reads 0', makeAction({ usesMax: 1 }), makePlayerStats(), 0, true],
      ['derived action-name key reads 1', makeAction({ usesMax: 1 }), makePlayerStats(), 1, false],
      ['uses string with nothing stored resolves a positive max (level 5)', makeAction({ uses: '1_per_long_rest' }), makePlayerStats(), null, false],
      ['proficiency_bonus resolves to a max of 0 and nothing is stored', makeAction({ uses: 'proficiency_bonus' }), makePlayerStats({ proficiency: 0 }), null, true],
    ])('when the %s', (_label, action, ps, stored, expected) => {
      runtimeState.getRuntimeValue.mockReturnValue(stored);

      expect(isExhausted(action, ps, campaignName)).toBe(expected);
      expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
        ['TestCaster', 'breathWeaponUses', campaignName],
      ]);
    });

    it('prefers an explicit resourceKey over the derived action-name key', () => {
      // Only the custom key is depleted; the derived key would say fresh.
      runtimeState.getRuntimeValue.mockImplementation(
        (_name, key) => (key === 'customUses' ? 0 : 5),
      );
      const action = makeAction({ usesMax: 1, resourceKey: 'customUses' });

      expect(isExhausted(action, makePlayerStats(), campaignName)).toBe(true);
      // Exact census proves the derived 'breathWeaponUses' key was never read.
      expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
        ['TestCaster', 'customUses', campaignName],
      ]);
    });

    it.each([
      ['channel_divinity', ['TestCaster', 'channelDivinityCharges']],
      ['wild_shape', ['TestCaster', 'wildShapeUses', campaignName]],
    ])('resourceCost %s short-circuits before the tracked-uses lane', (cost, expectedRead) => {
      // The co-declared tracked key reads fresh (5): only the resource lane
      // can produce `true` here, and the census proves the uses key is not
      // even consulted.
      runtimeState.getRuntimeValue.mockImplementation(
        (_name, key) => (key === expectedRead[1] ? 0 : 5),
      );
      const action = makeAction({ resourceCost: cost, usesMax: 1, resourceKey: 'customUses' });
      const ps = makePlayerStats({
        level: 1,
        class: { class_levels: [{ level: 1, channel_divinity: 2, wild_shape: 2 }] },
      });

      expect(isExhausted(action, ps, campaignName)).toBe(true);
      expect(runtimeState.getRuntimeValue.mock.calls).toEqual([expectedRead]);
    });
  });
});
