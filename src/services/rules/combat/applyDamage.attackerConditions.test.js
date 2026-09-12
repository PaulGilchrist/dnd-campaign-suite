// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../combat/automation/automationPassives.js', () => ({
  getDamageReduction: vi.fn(() => null),
  getDamageResistances: vi.fn(() => []),
}));

// ── Globals ─────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name, maxHp, currentHp, extra = {}) {
  return {
    name,
    type: 'monster',
    maxHp,
    currentHp,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function createMinimalCharacter(name, extra = {}) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
      ...extra.computedExtra,
    },
    ...extra,
  };
}

function createPlayerCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('Psychic Veil — attacker condition removal on hit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  it('removes Psychic Veil buff and Invisible condition when attacker hits with damage', async () => {
    const goblin = createNpcCreature('Goblin', 10, 10);
    const player = createPlayerCreature('Warlock', { currentHp: 20 });
    player.currentHp = 20;
    const cs = makeCombatSummary([goblin, player]);

    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((charName, key, _campaignName) => {
      if (key === 'activeBuffs') {
        if (charName === 'Warlock') return [{ name: 'Psychic Veil' }];
        return [];
      }
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') {
        if (charName === 'Warlock') return ['invisible'];
        return [];
      }
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'tempHp') return 0;
      return undefined;
    });

    await applyDamageToTarget(cs, 'Goblin', 5, ['Psychic'], 'TestCampaign', [ createMinimalCharacter('Warlock'), createMinimalCharacter('Goblin'), ], { ignoreResistance: false, attackerName: 'Warlock' });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Warlock', 'activeConditions', [], 'TestCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Warlock', 'activeBuffs', [], 'TestCampaign',
    );
  });

  it('does not remove Psychic Veil when no damage is dealt (immune)', async () => {
    const skeleton = createNpcCreature('Skeleton', 10, 10, { immunities: ['psychic'] });
    const player = createPlayerCreature('Warlock', { currentHp: 20 });
    player.currentHp = 20;
    const cs = makeCombatSummary([skeleton, player]);
    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((charName, key, _campaignName) => {
      if (key === 'activeBuffs') { if (charName === 'Warlock') return [{ name: 'Psychic Veil' }]; return []; }
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') { if (charName === 'Warlock') return ['invisible']; return []; }
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'tempHp') return 0;
      return undefined;
    });
    await applyDamageToTarget(cs, 'Skeleton', 5, ['Psychic'], 'TestCampaign', [createMinimalCharacter('Warlock'), createMinimalCharacter('Skeleton')], { ignoreResistance: false, attackerName: 'Warlock' });
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Warlock', 'activeConditions', expect.any(Array), 'TestCampaign');
  });

  it('does not remove Psychic Veil when attacker lacks the buff', async () => {
    const goblin = createNpcCreature('Goblin', 10, 10);
    const player = createPlayerCreature('Fighter', { currentHp: 20 });
    player.currentHp = 20;
    const cs = makeCombatSummary([goblin, player]);
    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((charName, key, _campaignName) => {
      if (key === 'activeBuffs') { if (charName === 'Fighter') return [{ name: 'Shield' }]; return []; }
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') { if (charName === 'Fighter') return ['invisible']; return []; }
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'tempHp') return 0;
      return undefined;
    });
    await applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter'), createMinimalCharacter('Goblin')], { ignoreResistance: false, attackerName: 'Fighter' });
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Fighter', 'activeConditions', expect.any(Array), 'TestCampaign');
  });
});

describe('Supreme Sneak — preserve Invisible condition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  it('preserves Invisible when attacker has stealthAttackCost active and no Psychic Veil', async () => {
    const goblin = createNpcCreature('Goblin', 10, 10);
    const rogue = createPlayerCreature('Rogue', { currentHp: 20 });
    rogue.currentHp = 20;
    const cs = makeCombatSummary([goblin, rogue]);

    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((charName, key, _campaignName) => {
      if (key === 'activeBuffs') { if (charName === 'Rogue') return [{ name: 'Shield' }]; return []; }
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') { if (charName === 'Rogue') return ['invisible']; return []; }
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') { if (charName === 'Rogue') return 1; return undefined; }
      if (key === 'tempHp') return 0;
      return undefined;
    });

    await applyDamageToTarget(cs, 'Goblin', 5, ['Psychic'], 'TestCampaign', [createMinimalCharacter('Rogue'), createMinimalCharacter('Goblin')], { ignoreResistance: false, attackerName: 'Rogue' });
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Rogue', 'activeConditions', expect.any(Array), 'TestCampaign');
  });
});
