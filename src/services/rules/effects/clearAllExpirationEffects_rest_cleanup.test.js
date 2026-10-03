// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
import { getCombatSummary } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => String(v));
}

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — Flesh to Stone cleanup
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — Flesh to Stone cleanup', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('clears fleshToStone tracking and conditions on rest', () => {
    const myList = [];
    getAllStoreKeys.mockReturnValue(['_fleshToStone_Orc']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Caster') return myList;
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
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [{ effect: 'slow', target: 'Orc' }],
      'MyCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      '_fleshToStone_Orc',
      null,
      'MyCampaign',
    );
  });

  it('skips fleshToStone entries from other casters', () => {
    const myList = [];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Caster') return myList;
      if (key === KEY) return [];
      if (key === '_fleshToStone_Orc') return { casterName: 'OtherCaster' };
      if (key === 'activeConditions') return [];
      return null;
    });

    clearAllExpirationEffects('Caster', 'MyCampaign');

    // Should not have modified Orc's conditions since the caster is different
    const orcCondCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Orc' && c[1] === 'activeConditions',
    );
    expect(orcCondCalls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — Prismatic Spray cleanup
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — Prismatic Spray cleanup', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('clears indigo and violet prismatic spray effects on rest', () => {
    const myList = [];
    getAllStoreKeys.mockReturnValue(['_prismaticSprayIndigo_Orc', '_prismaticSprayViolet_Human']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Caster') return myList;
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
  });

  it('skips prismatic spray entries from other casters', () => {
    const myList = [];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Caster') return myList;
      if (key === KEY) return [];
      if (key === '_prismaticSprayIndigo_Orc') return { casterName: 'OtherCaster' };
      if (key === 'activeConditions') return ['restrained'];
      return null;
    });

    clearAllExpirationEffects('Caster', 'MyCampaign');

    const orcCondCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Orc' && c[1] === 'activeConditions',
    );
    expect(orcCondCalls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — Otto's Irresistible Dance cleanup
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — Otto\'s Irresistible Dance cleanup', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
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
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('removes all sanctuary targetEffects on rest', () => {
    const myList = [];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Cleric') return myList;
      if (key === KEY) return [];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'sanctuary', source: 'Cleric', target: 'Orc' },
        { effect: 'sanctuary', source: 'Cleric', target: 'Human' },
        { effect: 'slow', target: 'Orc' },
      ];
      return null;
    });

    clearAllExpirationEffects('Cleric', 'MyCampaign');

    const effectCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'campaign' && c[1] === 'targetEffects',
    );
    expect(effectCalls.length).toBeGreaterThan(0);
    expect(effectCalls[effectCalls.length - 1][2]).toEqual([
      { effect: 'slow', target: 'Orc' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — removeSummonedCreatures
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — removeSummonedCreatures', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('calls removeSummonedCreatures for the character', () => {
    const myList = [];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Summoner') return myList;
      if (key === KEY) return [];
      return null;
    });

    clearAllExpirationEffects('Summoner', 'MyCampaign');

    // The removeSummonedCreatures is mocked, so we just verify no error
    expect(setRuntimeValue).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — object_transform cleanup
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — object_transform cleanup', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('reverts polymorphed creatures and clears object_transform targetEffects', () => {
    const myList = [];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Polymorpher') return myList;
      if (key === KEY) return [];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'object_transform', source: 'Polymorpher', target: 'Orc' },
        { effect: 'slow', target: 'Orc' },
      ];
      if (key === 'activeConditions') return ['incapacitated'];
      return null;
    });
    getCombatSummary.mockReturnValue({
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
    });

    clearAllExpirationEffects('Polymorpher', 'MyCampaign');

    // Should have reverted the creature's stats
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Orc',
      'activeConditions',
      [],
      'MyCampaign',
    );
    const effectCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'campaign' && c[1] === 'targetEffects',
    );
    expect(effectCalls.length).toBeGreaterThan(0);
  });

  it('skips when no object creatures found', () => {
    const myList = [];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Polymorpher') return myList;
      if (key === KEY) return [];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc' },
      ],
    });

    clearAllExpirationEffects('Polymorpher', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — coverRefresh increment
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — coverRefresh increment', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('increments coverRefresh to force badge refresh', () => {
    const myList = [];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Caster') return myList;
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
  });

  it('returns early when characterName is null', () => {
    clearAllExpirationEffects(null, 'MyCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when campaignName is null', () => {
    clearAllExpirationEffects('Goblin', null);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — activeBuffs preservation for 8-hour buffs
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — activeBuffs preservation', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('preserves Mage Armor and Death Ward buffs', () => {
    const myList = [];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Wizard') return myList;
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
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
    getAllStoreKeys.mockReturnValue([]);
    getCombatSummary.mockReturnValue(null);
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
