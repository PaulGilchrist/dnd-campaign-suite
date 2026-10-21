// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 5),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../combat/summons/summonedCreatureService.js', () => ({
  removeSummonedCreatures: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/polymorphService.js', () => ({
  revertPolymorph: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/animalShapesService.js', () => ({
  revertAnimalShapes: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({
  revertTruePolymorph: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/shapechangeService.js', () => ({
  revertShapechange: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => {
    if (typeof expr === 'number') return expr;
    return 1;
  }),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

import { clearAllExpirationEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import storage from '../../ui/storage.js';
import { getCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';
import { removeSummonedCreatures } from '../../combat/summons/summonedCreatureService.js';

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => String(v));
}

// Empty-store baseline: every read misses, every store scan is empty, no
// combat summary. Each test opts into exactly the state it asserts on, so
// negative paths prove the guard (not a leaked mock value) did the skipping.
function emptyRuntime() {
  getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  getAllStoreKeys.mockReturnValue([]);
  getCombatSummary.mockReturnValue(null);
}

const writesTo = (name, key) =>
  setRuntimeValue.mock.calls.filter((c) => c[0] === name && c[1] === key);

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — Flesh to Stone cleanup
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — Flesh to Stone cleanup', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('clears fleshToStone tracking and conditions on rest', () => {
    getAllStoreKeys.mockReturnValue(['_fleshToStone_Orc']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (key === '_fleshToStone_Orc') return { casterName: 'Caster' };
      if (name === 'Orc' && key === 'activeConditions') return ['restrained', 'poisoned'];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'flesh_to_stone', target: 'Orc', source: 'Caster' },
        { effect: 'slow', target: 'Orc' },
      ];
      return null;
    });

    clearAllExpirationEffects('Caster', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Orc',
      'activeConditions',
      ['poisoned'],
      'MyCampaign',
    );
    // The flesh_to_stone badge is gone, the unrelated slow badge survives.
    const effectWrites = writesTo('campaign', 'targetEffects');
    expect(effectWrites.length).toBe(1);
    expect(effectWrites[0][2]).toEqual([{ effect: 'slow', target: 'Orc' }]);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      '_fleshToStone_Orc',
      null,
      'MyCampaign',
    );
  });

  it('skips fleshToStone entries from other casters', () => {
    getAllStoreKeys.mockReturnValue(['_fleshToStone_Orc']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (key === '_fleshToStone_Orc') return { casterName: 'OtherCaster' };
      if (name === 'Orc' && key === 'activeConditions') return ['restrained'];
      return null;
    });

    clearAllExpirationEffects('Caster', 'MyCampaign');

    // Caster mismatch: conditions, targetEffects and the tracking key all survive.
    expect(writesTo('Orc', 'activeConditions').length).toBe(0);
    expect(writesTo('campaign', 'targetEffects').length).toBe(0);
    expect(writesTo('campaign', '_fleshToStone_Orc').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — Prismatic Spray cleanup
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — Prismatic Spray cleanup', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('clears indigo and violet prismatic spray effects on rest', () => {
    getAllStoreKeys.mockReturnValue(['_prismaticSprayIndigo_Orc', '_prismaticSprayViolet_Human']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (key === '_prismaticSprayIndigo_Orc') return { casterName: 'Caster' };
      if (key === '_prismaticSprayViolet_Human') return { casterName: 'Caster' };
      if (name === 'Orc' && key === 'activeConditions') return ['restrained', 'poisoned'];
      if (name === 'Human' && key === 'activeConditions') return ['blinded', 'fatigued'];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'prismatic_spray_indigo', target: 'Orc', source: 'Caster' },
        { effect: 'prismatic_spray_violet', target: 'Human', source: 'Caster' },
        { effect: 'slow', target: 'Orc' },
      ];
      return null;
    });

    clearAllExpirationEffects('Caster', 'MyCampaign');

    // Indigo removes only restrained; violet removes only blinded.
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Orc',
      'activeConditions',
      ['poisoned'],
      'MyCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      ['fatigued'],
      'MyCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      '_prismaticSprayIndigo_Orc',
      null,
      'MyCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      '_prismaticSprayViolet_Human',
      null,
      'MyCampaign',
    );
    // Each ray pass purges its own badge: some write no longer contains
    // indigo, some write no longer contains violet, and every write is a
    // subset of the original store (nothing foreign is introduced).
    const effectWrites = writesTo('campaign', 'targetEffects');
    expect(effectWrites.length).toBeGreaterThan(0);
    expect(effectWrites.some((c) => !c[2].some((te) => te.effect === 'prismatic_spray_indigo'))).toBe(true);
    expect(effectWrites.some((c) => !c[2].some((te) => te.effect === 'prismatic_spray_violet'))).toBe(true);
  });

  it('skips prismatic spray entries from other casters', () => {
    getAllStoreKeys.mockReturnValue(['_prismaticSprayIndigo_Orc']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (key === '_prismaticSprayIndigo_Orc') return { casterName: 'OtherCaster' };
      if (name === 'Orc' && key === 'activeConditions') return ['restrained'];
      return null;
    });

    clearAllExpirationEffects('Caster', 'MyCampaign');

    // Caster mismatch: nothing is cleared and the tracking key survives.
    expect(writesTo('Orc', 'activeConditions').length).toBe(0);
    expect(writesTo('campaign', '_prismaticSprayIndigo_Orc').length).toBe(0);
    expect(writesTo('campaign', 'targetEffects').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — Otto's Irresistible Dance cleanup
// (designated owner per #1285 — folded in from the _additional lane; preserve exact)
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — Otto\'s Irresistible Dance cleanup', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('removes all otto_irresistible_dance targetEffects where character is source or target', () => {
    const myList = [];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Dancer') return myList;
      if (key === KEY) return [];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'ottos_irresistible_dance', source: 'Dancer', target: 'Orc' },
        { effect: 'ottos_irresistible_dance', source: 'Orc', target: 'Dancer' },
        { effect: 'ottos_irresistible_dance', source: 'Orc', target: 'Human' },
        { effect: 'slow', target: 'Orc' },
      ];
      return null;
    });

    clearAllExpirationEffects('Dancer', 'MyCampaign');

    const effectCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'campaign' && c[1] === 'targetEffects',
    );
    expect(effectCalls.length).toBeGreaterThan(0);
    expect(effectCalls[effectCalls.length - 1][2]).toEqual([
      { effect: 'ottos_irresistible_dance', source: 'Orc', target: 'Human' },
      { effect: 'slow', target: 'Orc' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — Sanctuary cleanup
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — Sanctuary cleanup', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('removes every sanctuary targetEffect on rest, from any source or target', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'sanctuary', source: 'Cleric', target: 'Orc' },
        { effect: 'sanctuary', source: 'Other', target: 'Goblin' },
        { effect: 'slow', target: 'Orc' },
      ];
      return null;
    });

    clearAllExpirationEffects('Cleric', 'MyCampaign');

    // One exact write; even a foreign caster's sanctuary on an unrelated
    // target is purged (rest clears sanctuary app-wide), slow survives.
    const effectWrites = writesTo('campaign', 'targetEffects');
    expect(effectWrites.length).toBe(1);
    expect(effectWrites[0][2]).toEqual([{ effect: 'slow', target: 'Orc' }]);
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — removeSummonedCreatures
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — removeSummonedCreatures', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('removes the resting character\'s summons with exact store args', () => {
    clearAllExpirationEffects('Summoner', 'MyCampaign');

    expect(removeSummonedCreatures).toHaveBeenCalledTimes(1);
    expect(removeSummonedCreatures).toHaveBeenCalledWith('Summoner', 'MyCampaign');
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — object_transform cleanup
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — object_transform cleanup', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('reverts polymorphed creatures and clears object_transform targetEffects', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'object_transform', source: 'Polymorpher', target: 'Orc' },
        { effect: 'slow', target: 'Orc' },
      ];
      if (name === 'Orc' && key === 'activeConditions') return ['incapacitated'];
      return null;
    });
    const summary = {
      creatures: [
        {
          name: 'Orc',
          polymorphObject: { type: 'boulder' },
          polymorphSource: 'Polymorpher',
          polymorphOriginal: { maxHp: 15, ac: 13, speed: 30 },
          maxHp: 20,
          ac: 15,
          speed: 40,
        },
      ],
    };
    getCombatSummary.mockReturnValue(summary);

    clearAllExpirationEffects('Polymorpher', 'MyCampaign');

    // Original stats restored in the persisted summary and object flags gone.
    expect(summary.creatures[0]).toMatchObject({ maxHp: 15, ac: 13, speed: 30 });
    expect(summary.creatures[0].polymorphObject).toBeUndefined();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', summary, 'MyCampaign');
    expect(setCombatSummaryCache).toHaveBeenCalledWith(summary, 'MyCampaign');

    // Incapacitated dropped and the object_transform badge purged in one write.
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Orc',
      'activeConditions',
      [],
      'MyCampaign',
    );
    const effectWrites = writesTo('campaign', 'targetEffects');
    expect(effectWrites.length).toBe(1);
    expect(effectWrites[0][2]).toEqual([{ effect: 'slow', target: 'Orc' }]);
  });

  it('persists nothing when no object creature belongs to the caster', () => {
    // Covers both guard clauses of the object filter: a plain creature
    // (no polymorphObject) and another caster's object creature.
    const foreign = {
      name: 'Orc',
      polymorphObject: { type: 'boulder' },
      polymorphSource: 'OtherCaster',
      polymorphOriginal: { maxHp: 15, ac: 13, speed: 30 },
      maxHp: 20,
      ac: 15,
      speed: 40,
    };
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Human' }, foreign],
    });

    clearAllExpirationEffects('Polymorpher', 'MyCampaign');

    expect(storage.set).not.toHaveBeenCalled();
    expect(setCombatSummaryCache).not.toHaveBeenCalled();
    expect(writesTo('campaign', 'targetEffects').length).toBe(0);
    expect(writesTo('Orc', 'activeConditions').length).toBe(0);
    // Foreign transform survives untouched.
    expect(foreign).toMatchObject({ maxHp: 20, ac: 15, speed: 40 });
    expect(foreign.polymorphObject).toEqual({ type: 'boulder' });
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — coverRefresh increment
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — coverRefresh increment', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('increments coverRefresh to force badge refresh', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (name === 'campaign' && key === 'coverRefresh') return 5;
      return null;
    });

    clearAllExpirationEffects('Caster', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'coverRefresh',
      6,
      'MyCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — early returns
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — early returns', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('touches nothing when characterName or campaignName is missing', () => {
    clearAllExpirationEffects(null, 'MyCampaign');
    clearAllExpirationEffects('Goblin', null);

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — activeBuffs preservation for 8-hour buffs
// (owner cited by clearAllExpirationEffects_additional.test.js header)
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — activeBuffs preservation', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('preserves Mage Armor and Death Ward buffs', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (name === 'Wizard' && key === 'activeBuffs') return [
        { name: 'Mage Armor', effect: 'mage_armor', duration: '8 hours' },
        { name: 'Death Ward', effect: 'death_ward', duration: '8 hours' },
        { name: 'Shield', effect: 'shield', duration: '1 round' },
        { name: 'Haste', effect: 'haste', duration: '1 minute' },
      ];
      return null;
    });

    clearAllExpirationEffects('Wizard', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Wizard',
      'activeBuffs',
      [
        { name: 'Mage Armor', effect: 'mage_armor', duration: '8 hours' },
        { name: 'Death Ward', effect: 'death_ward', duration: '8 hours' },
      ],
      'MyCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — SP-012 rest purge log names the actual spell
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — SP-012 rest purge log names the spell', () => {
  const restLogs = () => addEntry.mock.calls
    .filter((c) => /^Rest; .+ ends\.$/.test(String(c[1]?.description)))
    .map((c) => c[1]);

  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('names the concentrated spell (Banishment) when the caster rests while concentrating', () => {
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Caster', concentration: { spell: 'Banishment', dc: 17 } }],
    });

    clearAllExpirationEffects('Caster', 'MyCampaign');

    const logs = restLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]).toEqual(expect.objectContaining({
      type: 'ability_use',
      characterName: 'Caster',
      abilityName: 'Banishment',
      description: 'Rest; Banishment ends.',
    }));
    expect(logs[0].description).not.toContain('Flesh to Stone');
  });

  it('keeps the byte-identical Flesh to Stone log when Flesh to Stone was concentrated', () => {
    getAllStoreKeys.mockReturnValue(['_fleshToStone_Orc']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (key === '_fleshToStone_Orc') return { casterName: 'Caster' };
      if (name === 'Orc' && key === 'activeConditions') return ['restrained'];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Caster', concentration: { spell: 'Flesh to Stone', dc: 17 } }],
    });

    clearAllExpirationEffects('Caster', 'MyCampaign');

    const logs = restLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].description).toBe('Rest; Flesh to Stone ends.');
    expect(logs[0].abilityName).toBe('Flesh to Stone');
  });

  it('logs nothing when resting with no concentration held and nothing cleaned', () => {
    clearAllExpirationEffects('Caster', 'MyCampaign');

    expect(restLogs().length).toBe(0);
  });

  it('names Flesh to Stone when only its stale tracking keys are cleaned', () => {
    getAllStoreKeys.mockReturnValue(['_fleshToStone_Orc']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (key === '_fleshToStone_Orc') return { casterName: 'Caster' };
      if (name === 'Orc' && key === 'activeConditions') return ['restrained'];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'flesh_to_stone', target: 'Orc', source: 'Caster' },
      ];
      return null;
    });

    clearAllExpirationEffects('Caster', 'MyCampaign');

    const logs = restLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].description).toBe('Rest; Flesh to Stone ends.');
  });
});
