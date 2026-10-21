// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// True collaborators with their own test lanes (classRules.test.js,
// classRules2024.test.js, race-rules/5e-traits.test.js): stubbed here so
// this file pins ONLY getActions merge/dedup/sort/normalization semantics.
// featureCategorizationUtils is deliberately NOT mocked — it is deterministic
// and its wiring into getActions via playerSummary.features is pinned below.
vi.mock('../../character/classRules.js', () => ({
  default: {
    getFeatures: vi.fn(),
    featureCategories: {},
  },
}));

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getFeatures: vi.fn(),
    featureCategories: {},
  },
}));

vi.mock('../../character/race-rules/index.js', () => ({
  rules5e: {
    getTraits: vi.fn(),
  },
  rules2024: {
    getTraits: vi.fn(),
  },
}));

import rules from '../rules.js';
import classRules from '../../character/classRules.js';
import classRules2024 from '../../character/classRules2024.js';
import { rules5e as raceRules, rules2024 as raceRules2024 } from '../../character/race-rules/index.js';

const emptyCats = () => ({
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  characterAdvancement: [],
});

const makePlayerStats = (overrides = {}) => ({
  name: 'TestCharacter',
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  ...overrides,
});

const names = (arr) => arr.map((a) => a.name);

describe('rules getActions', () => {
  beforeEach(() => {
    classRules.getFeatures.mockReturnValue(emptyCats());
    classRules2024.getFeatures.mockReturnValue(emptyCats());
    raceRules.getTraits.mockReturnValue(emptyCats());
    raceRules2024.getTraits.mockReturnValue(emptyCats());
  });

  it('5e: merges playerStats, class features, and race traits across all five channels — first entry wins on duplicate names, rows keep all properties, every channel sorted', () => {
    classRules.getFeatures.mockReturnValue({
      actions: [{ name: 'Attack' }, { name: 'Action Surge' }],
      bonusActions: [{ name: 'Second Wind' }],
      reactions: [{ name: 'Opportunity Attack' }],
      specialActions: [{ name: 'Rage' }],
      characterAdvancement: [{ name: 'Ability Score Improvement' }],
    });
    raceRules.getTraits.mockReturnValue({
      actions: [{ name: 'Brave' }, { name: 'Zephyr' }],
      bonusActions: [],
      reactions: [{ name: 'Trait Reaction' }],
      specialActions: [{ name: 'Brave' }],
      characterAdvancement: [],
    });

    const playerStats = makePlayerStats({
      actions: [
        { name: 'Zephyr' },
        { name: 'Attack', description: 'Make a melee weapon attack', details: { damage: '1d8' } },
      ],
      bonusActions: [{ name: 'Cunning Action' }],
      reactions: [],
      specialActions: [],
    });

    const [actions, bonusActions, reactions, specialActions, characterAdvancement] = rules.getActions(playerStats);

    // 'Attack' keeps the playerStats row (first source wins), not the
    // feature stub row — pinning both dedup order and property preservation.
    expect(actions).toEqual([
      { name: 'Action Surge' },
      { name: 'Attack', description: 'Make a melee weapon attack', details: { damage: '1d8' } },
      { name: 'Brave' },
      { name: 'Zephyr' },
    ]);
    expect(bonusActions).toEqual([{ name: 'Cunning Action' }, { name: 'Second Wind' }]);
    expect(reactions).toEqual([{ name: 'Opportunity Attack' }, { name: 'Trait Reaction' }]);
    // Same name may appear independently in different channels.
    expect(specialActions).toEqual([{ name: 'Brave' }, { name: 'Rage' }]);
    expect(characterAdvancement).toEqual([{ name: 'Ability Score Improvement' }]);
  });

  it('5e: ignores 2024-only action arrays even when populated', () => {
    const playerStats = makePlayerStats({
      rules: '5e',
      magicActions: [{ name: 'Magic Action' }],
      utilizeActions: [{ name: 'Utilize Action' }],
      craftActions: [{ name: 'Craft Action' }],
      magicSpecialActions: [{ name: 'Magic Special Action' }],
      utilizeSpecialActions: [{ name: 'Utilize Special Action' }],
      craftSpecialActions: [{ name: 'Craft Special Action' }],
    });

    const [actions, bonusActions, reactions, specialActions, characterAdvancement] = rules.getActions(playerStats);

    expect(actions).toEqual([]);
    expect(bonusActions).toEqual([]);
    expect(reactions).toEqual([]);
    expect(specialActions).toEqual([]);
    expect(characterAdvancement).toEqual([]);
  });

  it('2024: folds magic/utilize/craft actions into actions and their specials into specialActions, dedupes across every source, sorted', () => {
    classRules2024.getFeatures.mockReturnValue({
      ...emptyCats(),
      actions: [{ name: 'Feature Action' }],
      specialActions: [{ name: 'Feature Special' }],
    });
    raceRules2024.getTraits.mockReturnValue({
      ...emptyCats(),
      actions: [{ name: 'Trait Action' }],
    });

    const playerStats = makePlayerStats({
      rules: '2024',
      actions: [{ name: 'Zephyr' }, { name: 'Attack' }],
      magicActions: [{ name: 'Alpha Magic' }, { name: 'Attack' }],
      utilizeActions: [{ name: 'Beta Use' }],
      craftActions: [{ name: 'Attack' }, { name: 'Gamma Craft' }],
      specialActions: [{ name: 'Player Special' }],
      magicSpecialActions: [{ name: 'Magic Special' }],
      utilizeSpecialActions: [{ name: 'Utilize Special' }],
      craftSpecialActions: [{ name: 'Feature Special' }],
    });

    const [actions, bonusActions, reactions, specialActions] = rules.getActions(playerStats);

    // 'Attack' arrives from 4 action sources and appears exactly once.
    expect(names(actions)).toEqual(['Alpha Magic', 'Attack', 'Beta Use', 'Feature Action', 'Gamma Craft', 'Trait Action', 'Zephyr']);
    expect(names(specialActions)).toEqual(['Feature Special', 'Magic Special', 'Player Special', 'Utilize Special']);
    expect(bonusActions).toEqual([]);
    expect(reactions).toEqual([]);
  });

  it('2024: normalizes string actions and specialActions to { name, description: "", details: null } rows, passing object rows through unchanged', () => {
    const playerStats = makePlayerStats({
      rules: '2024',
      actions: ['String Action', { name: 'Object Action', description: 'obj desc' }],
      specialActions: ['Special String Action'],
    });

    const [actions, , , specialActions] = rules.getActions(playerStats);

    expect(actions).toEqual([
      { name: 'Object Action', description: 'obj desc' },
      { name: 'String Action', description: '', details: null },
    ]);
    expect(specialActions).toEqual([{ name: 'Special String Action', description: '', details: null }]);
  });

  it('merges playerSummary.features through the real categorizeFeatures: casting_time routes the row, unmatched rows land in specialActions', () => {
    const playerStats = makePlayerStats({ rules: '5e' });
    const playerSummary = {
      features: [
        { name: 'Deflect Attacks', level: 5, casting_time: '1 reaction', description: 'Reduce damage', automation: [{ casting_time: '1 reaction' }] },
        { name: 'Ancient Wisdom', description: 'Passive boon' },
      ],
    };

    const [actions, bonusActions, reactions, specialActions] = rules.getActions(playerStats, playerSummary);

    expect(actions).toEqual([]);
    expect(bonusActions).toEqual([]);
    // Full categorized row bytes, including level/description passthrough.
    expect(reactions).toEqual([
      { name: 'Deflect Attacks', level: 5, description: 'Reduce damage', details: undefined, automation: [{ casting_time: '1 reaction' }] },
    ]);
    expect(specialActions).toEqual([
      { name: 'Ancient Wisdom', level: null, description: 'Passive boon', details: undefined, automation: undefined },
    ]);
  });
});
