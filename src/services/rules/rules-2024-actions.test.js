// @maintained-by-ai
// Lane: rules-actions.js getActions2024 divergences vs the 5e twin (same file,
// getActions5e) — the half of the guard table and dedup precedence the 5e lanes
// do NOT cover:
//   - 5e throws on all four channels not-an-array: rules.helpers.test.js:226-267
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

describe('rules.getActions 2024 guard + precedence divergence from 5e twin', () => {
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
    ${'specialActions'}
  `('2024: required-array guard fires on $field for null and undefined (the untested half of the 5e throw table)', ({ field }) => {
    for (const bad of [null, undefined]) {
      const playerStats = stats({ rules: '2024' });
      delete playerStats[field];
      if (bad === null) playerStats[field] = null;
      expect(() => rules.getActions(playerStats, {})).toThrow(`Missing array: ${field} for TestCharacter`);
    }
  });

  it('2024-only tolerance: falsy bonusActions/reactions fall back to [] instead of throwing (5e twin throws — rules.helpers.test.js:237-260)', () => {
    const [actions, bonusActions, reactions, specialActions, characterAdvancement] = rules.getActions(
      stats({
        rules: '2024',
        actions: [{ name: 'Attack' }],
        bonusActions: null,
        reactions: undefined,
        magicActions: [{ name: 'Cast a Spell' }],
        specialActions: [],
      }),
      {},
    );
    expect(actions.map((a) => a.name)).toEqual(['Attack', 'Cast a Spell']);
    expect(bonusActions).toEqual([]);
    expect(reactions).toEqual([]);
    expect(specialActions).toEqual([]);
    expect(characterAdvancement).toEqual([]);
  });

  it('2024: duplicate-name conflict in specialActions resolves to the FEATURE row while actions resolve to the PLAYER row — inverted vs 5e where the player row wins both', () => {
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

    // 2024: actions list player-mapped first (rules-actions.js:38) but specialActions
    // list features first and player LAST (rules-actions.js:70-74) — uniqBy first-wins
    // therefore keeps the FEATURE special, the opposite of the player-first 5e path.
    const [actions2024, , , specialActions2024] = rules.getActions(
      stats({
        rules: '2024',
        actions: [{ name: 'Attack', description: 'player attack' }],
        specialActions: [{ name: 'Rally', description: 'player rally' }],
      }),
      {},
    );
    expect(actions2024).toEqual([{ name: 'Attack', description: 'player attack' }]);
    expect(specialActions2024).toEqual([{ name: 'Rally', description: '2024 feature rally' }]);

    // 5e twin, same names: player row wins in BOTH channels (rules-actions.js:107,110).
    const [actions5e, , , specialActions5e] = rules.getActions(
      stats({
        rules: '5e',
        actions: [{ name: 'Attack', description: 'player attack' }],
        specialActions: [{ name: 'Rally', description: 'player rally' }],
      }),
      {},
    );
    expect(actions5e).toEqual([{ name: 'Attack', description: 'player attack' }]);
    expect(specialActions5e).toEqual([{ name: 'Rally', description: 'player rally' }]);
  });
});
