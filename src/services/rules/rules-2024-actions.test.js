// @maintained-by-ai
// Lane: rules-actions.js getActions2024 vs the 5e twin (same file, getActions5e).
// #1435 CLOSED: both arms now share requireArray (rules-actions.js:12-19) and the
// player-first uniqBy order, so this lane pins 2024-side PARITY of the guard table:
//   - 5e throws on all four channels not-an-array: rules.helpers.test.js:197-220
//     and core/rules-error-handling.test.js:38-61 (both fixtures are rules:'5e').
//   - 2024 magic/utilize/craft folding + full-set dedup/sort: core/rules-actions.test.js:127
//   - 2024 string normalization all five channels: core/rules-actions.test.js:159, rules.helpers.test.js:176-201
//   - facade identity + language channels: core/rules-languages.test.js, core/rules-core.test.js:73
// getActions is pure merge/dedup/sort — zero-dice, zero-store (getRuntimeValue is
// imported by rules-helpers for mergeAutomationSpecialActions only, never invoked
// here). Only stubbed seams: classRules/classRules2024/raceRules feature providers
// (true collaborators with their own lanes: classRules2024.test.js, race-rules/).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../character/classRules.js', () => ({
  default: { getFeatures: vi.fn(), featureCategories: {} },
}));

vi.mock('../character/classRules2024.js', () => ({
  default: { getFeatures: vi.fn(), featureCategories: {} },
}));

vi.mock('../character/race-rules/index.js', () => ({
  rules5e: { getTraits: vi.fn() },
  rules2024: { getTraits: vi.fn() },
}));

import rules from './rules.js';
import classRules from '../character/classRules.js';
import classRules2024 from '../character/classRules2024.js';
import { rules5e as raceRules, rules2024 as raceRules2024 } from '../character/race-rules/index.js';

const emptyCats = () => ({
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  characterAdvancement: [],
});

const stats = (overrides = {}) => ({
  name: 'TestCharacter',
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  ...overrides,
});

describe('rules.getActions 2024 guard + precedence parity with 5e twin (#1435 closed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classRules.getFeatures.mockReturnValue(emptyCats());
    classRules2024.getFeatures.mockReturnValue(emptyCats());
    raceRules.getTraits.mockReturnValue(emptyCats());
    raceRules2024.getTraits.mockReturnValue(emptyCats());
  });

  it.each`
    field
    ${'actions'}
    ${'bonusActions'}
    ${'reactions'}
    ${'specialActions'}
  `('#1435 fixed: 2024 required-array guard fires on $field for null and undefined — parity with the 5e throw table (rules.helpers.test.js:197-220)', ({ field }) => {
    for (const bad of [null, undefined]) {
      const playerStats = stats({ rules: '2024' });
      delete playerStats[field];
      if (bad === null) playerStats[field] = null;
      expect(() => rules.getActions(playerStats, {})).toThrow(`Missing array: ${field} for TestCharacter`);
    }
  });

  it.each`
    field
    ${'actions'}
    ${'bonusActions'}
    ${'reactions'}
    ${'specialActions'}
  `('#1348 both-arms throw matching text shape: truthy-non-array $field now THROWS at the boundary in BOTH rulesets (was: 2024 ternary guard-hole passing garbage downstream)', ({ field }) => {
    for (const garbage of ['not an array', {}, () => {}, new Map()]) {
      for (const ruleset of ['2024', '5e']) {
        const playerStats = stats({ rules: ruleset });
        playerStats[field] = garbage;
        expect(() => rules.getActions(playerStats, {})).toThrow(`Missing array: ${field} for TestCharacter`);
      }
    }
  });

  it('2024 falsy bonusActions/reactions THROW (flipped from the old :73-90 tolerance pin — 5e parity, guard-hole closed #1435); optional magic/utilize/craft channels still default to []', () => {
    expect(() => rules.getActions(
      stats({ rules: '2024', bonusActions: null }), {},
    )).toThrow(new Error('Missing array: bonusActions for TestCharacter'));
    expect(() => rules.getActions(
      stats({ rules: '2024', reactions: undefined }), {},
    )).toThrow(new Error('Missing array: reactions for TestCharacter'));

    // magic/utilize/craft remain OPTIONAL (no 5e-twin counterpart): absent is []-by-contract,
    // pinned by core/rules-actions.test.js:127 folding.
    const [actions, bonusActions, reactions] = rules.getActions(
      stats({
        rules: '2024',
        actions: [{ name: 'Attack' }],
        magicActions: [{ name: 'Cast a Spell' }],
      }),
      {},
    );
    expect(actions.map((a) => a.name)).toEqual(['Attack', 'Cast a Spell']);
    expect(bonusActions).toEqual([]);
    expect(reactions).toEqual([]);
  });

  it('#1435 valid-array parity: 2024 merge/dedup/sort unchanged by the shared strict guard', () => {
    classRules2024.getFeatures.mockReturnValue({
      ...emptyCats(),
      bonusActions: [{ name: 'Second Wind' }, { name: 'Cunning Action' }],
    });
    const [, bonusActions, reactions] = rules.getActions(
      stats({ rules: '2024', bonusActions: [{ name: 'Cunning Action' }], reactions: [{ name: 'Opportunity Attack' }] }),
      {},
    );
    expect(bonusActions).toEqual([{ name: 'Cunning Action' }, { name: 'Second Wind' }]);
    expect(reactions).toEqual([{ name: 'Opportunity Attack' }]);
  });

  it('#1435(b) FIXED precedence: duplicate-name special action resolves to the PLAYER row in 2024 too — player-first is disk-law in all four channels, both rulesets', () => {
    classRules.getFeatures.mockReturnValue({
      ...emptyCats(),
      actions: [{ name: 'Attack', description: '5e feature attack' }],
      specialActions: [{ name: 'Rally', description: '5e feature rally' }],
    });
    classRules2024.getFeatures.mockReturnValue({
      ...emptyCats(),
      actions: [{ name: 'Attack', description: '2024 feature attack' }],
      specialActions: [{ name: 'Rally', description: '2024 feature rally' }],
    });

    // 2024: player-mapped rows list FIRST in actions (:49-:50) AND specialActions
    // (:79-:80) — uniqBy first-wins keeps the PLAYER row in both channels. The pre-fix
    // features-first ordering (:71-:74 old bytes, feature 'Rally' beat 'player rally')
    // was the documented inversion; captured pre-fix winner: {"name":"Rally","description":"2024 feature rally"}.
    const [actions2024, bonusActions2024, , specialActions2024] = rules.getActions(
      stats({
        rules: '2024',
        actions: [{ name: 'Attack', description: 'player attack' }],
        bonusActions: [{ name: 'Quickened', description: 'player quick' }],
        specialActions: [{ name: 'Rally', description: 'player rally' }],
      }),
      {},
    );
    expect(actions2024).toEqual([{ name: 'Attack', description: 'player attack' }]);
    expect(bonusActions2024).toEqual([{ name: 'Quickened', description: 'player quick' }]);
    expect(specialActions2024).toEqual([{ name: 'Rally', description: 'player rally' }]);

    // 5e twin, same names: player row wins in ALL channels (rules-actions.js:101-:104).
    const [actions5e, bonusActions5e, , specialActions5e] = rules.getActions(
      stats({
        rules: '5e',
        actions: [{ name: 'Attack', description: 'player attack' }],
        bonusActions: [{ name: 'Quickened', description: 'player quick' }],
        specialActions: [{ name: 'Rally', description: 'player rally' }],
      }),
      {},
    );
    expect(actions5e).toEqual([{ name: 'Attack', description: 'player attack' }]);
    expect(bonusActions5e).toEqual([{ name: 'Quickened', description: 'player quick' }]);
    expect(specialActions5e).toEqual([{ name: 'Rally', description: 'player rally' }]);
  });
});
