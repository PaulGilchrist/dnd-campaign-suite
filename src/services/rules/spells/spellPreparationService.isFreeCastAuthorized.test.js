import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Static mocks — the service heavily depends on runtime state, combat data,
// concentration, storage, and logging.  We mock at the module boundary.
// ---------------------------------------------------------------------------

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const setRuntimeValue = vi.fn();
  const getRuntimeValue = vi.fn(() => undefined);
  const clearRuntimeState = vi.fn();
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  addConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Test-data factories
// ---------------------------------------------------------------------------

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    class: { name: 'Wizard' },
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    hitPoints: 100,
    ...overrides,
  };
}

function makeCombatSummary(overrides = {}) {
  return {
    creatures: [{ name: 'TestWizard', concentration: null }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { isFreeCastAuthorized } from './spellPreparationService.js';

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Natural Recovery
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — Natural Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true when spell is in naturalRecoveryFreeCast list', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'naturalRecoveryFreeCast') return ['Fireball'];
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false when spell is not in naturalRecoveryFreeCast list', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'naturalRecoveryFreeCast') return ['Fireball'];
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Lightning Bolt', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Spell Mastery
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — Spell Mastery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true for level 1 spell matching SpellMastery_level1', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'SpellMastery_level1') return 'Magic Missile';
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Magic Missile', 1, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns true for level 2 spell matching SpellMastery_level2', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'SpellMastery_level2') return 'Shield';
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Shield', 2, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false when spell matches but level does not', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'SpellMastery_level1') return 'Magic Missile';
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Magic Missile', 2, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Signature Spells
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — Signature Spells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true for level 3 spell in SignatureSpells when not used', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'SignatureSpells_selection') return ['Teleportation Circle'];
      if (key2 === 'SignatureSpells_Teleportation_Circle_used') return false;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Teleportation Circle', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false for used Signature Spell', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'SignatureSpells_selection') return ['Teleportation Circle'];
      if (key2 === 'SignatureSpells_Teleportation_Circle_used') return true;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Teleportation Circle', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Divination Savant
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — Divination Savant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true for spell in Divination Savant selection when not used', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Divination_Savant_selection') return ['Warding Bond'];
      if (key2 === '_Divination_Savant_Warding_Bond_used') return false;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Warding Bond', 2, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false for used Divination Savant spell', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Divination_Savant_selection') return ['Warding Bond'];
      if (key2 === '_Divination_Savant_Warding_Bond_used') return true;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Warding Bond', 2, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Mystic Arcanum
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — Mystic Arcanum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true when arcanum spell has available resource count', async () => {
    const playerStats = makePlayerStats({
      class: { arcanums: ['Teleport'] },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'mysticArcanumLevel6') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Teleport', 6, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false when arcanum spell has zero resource count', async () => {
    const playerStats = makePlayerStats({
      class: { arcanums: ['Teleport'] },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'mysticArcanumLevel6' || key2 === 'mysticArcanumLevel7' || key2 === 'mysticArcanumLevel8' || key2 === 'mysticArcanumLevel9') return 0;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Teleport', 6, playerStats, 'camp');
    expect(authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Phantasmal Creatures
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — Phantasmal Creatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  const phantasmalStats = () => makePlayerStats({
    automation: {
      passives: [{
        type: 'phantasmal_creatures',
        name: 'Phantasmal Creatures',
        freeCastSpells: ['Summon Beast', 'Summon Fey'],
        usesMax: 1,
        recharge: 'long_rest',
        halvesHp: true,
      }],
    },
  });

  it('returns true for Summon Beast/Summon Fey when per-spell counter is fresh (null = available)', async () => {
    const playerStats = phantasmalStats();
    getRuntimeValue.mockReturnValue(undefined);

    const authorized1 = await isFreeCastAuthorized('TestWizard', 'Summon Beast', 2, playerStats, 'camp');
    expect(authorized1).toBe(true);

    const authorized2 = await isFreeCastAuthorized('TestWizard', 'Summon Fey', 4, playerStats, 'camp');
    expect(authorized2).toBe(true);
  });

  it('returns false for Summon Beast once its per-spell counter is consumed (0)', async () => {
    const playerStats = phantasmalStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Phantasmal_Creatures_Summon_Beast_freeCastCount') return 0;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Summon Beast', 2, playerStats, 'camp');
    expect(authorized).toBe(false);
  });

  it('consumed Summon Beast does not block Summon Fey (per-spell independence)', async () => {
    const playerStats = phantasmalStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Phantasmal_Creatures_Summon_Beast_freeCastCount') return 0;
      if (key2 === '_Phantasmal_Creatures_Summon_Fey_freeCastCount') return 1;
      return undefined;
    });

    expect(await isFreeCastAuthorized('TestWizard', 'Summon Beast', 2, playerStats, 'camp')).toBe(false);
    expect(await isFreeCastAuthorized('TestWizard', 'Summon Fey', 4, playerStats, 'camp')).toBe(true);
  });

  it('returns false for non-freeCastSpells spells with phantasmal creatures', async () => {
    const playerStats = phantasmalStats();
    getRuntimeValue.mockReturnValue(undefined);

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(false);
  });

  it('returns false without the phantasmal_creatures passive', async () => {
    const playerStats = makePlayerStats({ automation: { passives: [] } });
    getRuntimeValue.mockReturnValue(undefined);

    const authorized = await isFreeCastAuthorized('TestWizard', 'Summon Beast', 2, playerStats, 'camp');
    expect(authorized).toBe(false);
  });

  it('passes campaignName through to the runtime store read', async () => {
    const playerStats = phantasmalStats();
    getRuntimeValue.mockReturnValue(undefined);

    await isFreeCastAuthorized('TestWizard', 'Summon Beast', 2, playerStats, 'camp');
    expect(getRuntimeValue).toHaveBeenCalledWith(
      'TestWizard',
      '_Phantasmal_Creatures_Summon_Beast_freeCastCount',
      'camp',
    );
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Concentration recast spells
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — concentration recast spells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true for Eyebite when already concentrating on Eyebite', async () => {
    const cs = makeCombatSummary({
      creatures: [{ name: 'TestWizard', concentration: { spell: 'Eyebite', dc: 12 } }],
    });
    getCombatSummary.mockReturnValue(cs);

    const authorized = await isFreeCastAuthorized('TestWizard', 'Eyebite', 8, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns true for Spiritual Weapon when already concentrating on it', async () => {
    const cs = makeCombatSummary({
      creatures: [{ name: 'TestWizard', concentration: { spell: 'Spiritual Weapon', dc: 10 } }],
    });
    getCombatSummary.mockReturnValue(cs);

    const authorized = await isFreeCastAuthorized('TestWizard', 'Spiritual Weapon', 2, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns true for Shapechange when already concentrating on it', async () => {
    const cs = makeCombatSummary({
      creatures: [{ name: 'TestWizard', concentration: { spell: 'Shapechange', dc: 15 } }],
    });
    getCombatSummary.mockReturnValue(cs);

    const authorized = await isFreeCastAuthorized('TestWizard', 'Shapechange', 9, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false for Eyebite when not concentrating on it', async () => {
    const cs = makeCombatSummary({
      creatures: [{ name: 'TestWizard', concentration: { spell: 'Fireball', dc: 10 } }],
    });
    getCombatSummary.mockReturnValue(cs);

    const authorized = await isFreeCastAuthorized('TestWizard', 'Eyebite', 8, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });

  it('returns false when combat summary is null', async () => {
    getCombatSummary.mockReturnValue(null);

    const authorized = await isFreeCastAuthorized('TestWizard', 'Eyebite', 8, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Aura of Vitality
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — Aura of Vitality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true when aura_of_vitality targetEffect is active on player', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'targetEffects') return [{ effect: 'aura_of_vitality', target: 'TestWizard' }];
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Aura of Vitality', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false when aura_of_vitality targetEffect is not active', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'targetEffects') return [];
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Aura of Vitality', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });

  it('returns false for non-Aura of Vitality spells even with aura effect', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'targetEffects') return [{ effect: 'aura_of_vitality', target: 'TestWizard' }];
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Mantle of Majesty
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — Mantle of Majesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true for Command when Mantle of Majesty buff is active', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'activeBuffs') return [{ name: 'Mantle of Majesty' }];
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Command', 1, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false for Command when Mantle of Majesty is not active', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'activeBuffs') return [];
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Command', 1, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Bewitching Magic
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — Bewitching Magic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true for Misty Step when Bewitching Magic free cast is active', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bewitching_Magic_freeCast') return true;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Misty Step', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false for Misty Step when Bewitching Magic free cast is not active', async () => {
    getRuntimeValue.mockReturnValue(undefined);

    const authorized = await isFreeCastAuthorized('TestWizard', 'Misty Step', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });

  it('returns false for non-Misty Step spells with Bewitching Magic active', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bewitching_Magic_freeCast') return true;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — War God's Blessing
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — War God\'s Blessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true for Shield of Faith when War God\'s Blessing is active', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_War_Gods_Blessing_active') return true;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Shield of Faith', 1, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns true for Spiritual Weapon when War God\'s Blessing is active', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_War_Gods_Blessing_active') return true;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Spiritual Weapon', 2, makePlayerStats(), 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false for non-WGB spells when WGB is active', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_War_Gods_Blessing_active') return true;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, makePlayerStats(), 'camp');
    expect(authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — Free spell actions
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — free spell actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true for free_spell action with available uses', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Test Feature',
          spell: 'Fireball',
          uses: 1,
          recharge: true,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Test_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false for free_spell action with zero uses', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Test Feature',
          spell: 'Fireball',
          uses: 1,
          recharge: true,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Test_Feature_freeCastCount') return 0;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(false);
  });

  it('handles perSpellTracking actions (FT-070 per-spell counter, null = fresh)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Test Feature',
          spell: 'Fireball',
          uses: 1,
          recharge: 'long_rest',
          perSpellTracking: true,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Test_Feature_Fireball_freeCastCount') return undefined;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false for perSpellTracking when the spell counter is spent', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Test Feature',
          spell: 'Fireball',
          uses: 1,
          recharge: 'long_rest',
          perSpellTracking: true,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Test_Feature_Fireball_freeCastCount') return 0;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(false);
  });

  it('handles shared freeCast array storage', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Test Feature',
          spell: 'Fireball',
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Test_Feature_freeCast') return ['Fireball', 'Lightning Bolt'];
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });
});
