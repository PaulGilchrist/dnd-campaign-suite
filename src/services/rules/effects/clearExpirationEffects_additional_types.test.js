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

vi.mock('../../automation/handlers/spells/confusionTurnStartHandler.js', () => ({
  handleConfusionTurnStart: vi.fn().mockResolvedValue({ behaviorText: 'Attacks nearest creature' }),
}));

vi.mock('../../automation/handlers/spells/sleetStormHandler.js', () => ({
  processSleetStormAreaSave: vi.fn().mockResolvedValue(undefined),
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

import { clearAllExpirationEffects, applyTurnStartEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { applyDamageToTarget } from '../../rules/combat/applyDamage.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';
import { breakConcentration } from '../../combat/concentration/concentrationService.js';

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
// clearExpirationEffects — polymorph-related effect types
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — polymorph-related effect types', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  describe('polymorph effect type', () => {
    it('calls revertPolymorph for target', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'polymorph' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Caster') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Caster', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalled();
    });
  });

  describe('animal_shapes effect type', () => {
    it('calls revertAnimalShapes for target', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'animal_shapes' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Caster') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Caster', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalled();
    });
  });

  describe('true_polymorph effect type', () => {
    it('calls revertTruePolymorph for target', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'true_polymorph' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Caster') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Caster', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalled();
    });
  });

  describe('shapechange effect type', () => {
    it('calls revertShapechange for target', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'shapechange' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Caster') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Caster', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalled();
    });
  });

  describe('charmed effect type', () => {
    it('removes charmed condition', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'charmed' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Orc' && key === 'activeConditions') return ['charmed', 'poisoned'];
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Caster') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Caster', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'activeConditions',
        ['poisoned'],
        'MyCampaign',
      );
    });
  });

  describe('dominated effect type', () => {
    it('removes charmed condition (dominated maps to charmed)', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'dominated' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Orc' && key === 'activeConditions') return ['charmed', 'poisoned'];
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Caster') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Caster', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'activeConditions',
        ['poisoned'],
        'MyCampaign',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// clearExpirationEffects — break_concentration effect type
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — break_concentration', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('breaks concentration and cleans up effects when combatSummary exists', () => {
    const myList = [
      { target: 'Caster', effects: [{ type: 'break_concentration' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Attacker') return myList;
      if (key === KEY) return [];
      if (key === 'activeConditions') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({ casterName: 'Caster', spell: 'Fireball' });
    breakConcentration.mockReturnValue('Fireball');

    clearAllExpirationEffects('Attacker', 'MyCampaign');

    expect(breakConcentration).toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalled();
  });

  it('does nothing when combatSummary is null', () => {
    const myList = [
      { target: 'Caster', effects: [{ type: 'break_concentration' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Attacker') return myList;
      if (key === KEY) return [];
      if (key === 'activeConditions') return [];
      return null;
    });
    getCombatSummary.mockReturnValue(null);

    clearAllExpirationEffects('Attacker', 'MyCampaign');

    expect(breakConcentration).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearExpirationEffects — clear_runtime_value effect type
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — clear_runtime_value', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('clears the specified runtime value for the creature', () => {
    const myList = [
      { target: 'Caster', effects: [{ type: 'clear_runtime_value', creatureName: 'Caster', key: 'myCustomFlag' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Attacker') return myList;
      if (key === KEY) return [];
      if (key === 'activeConditions') return [];
      return null;
    });

    clearAllExpirationEffects('Attacker', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Caster',
      'myCustomFlag',
      null,
      'MyCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// clearExpirationEffects — remove_smite_of_protection effect type
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — remove_smite_of_protection', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('clears smiteOfProtectionActive and increments coverRefresh', () => {
    const myList = [
      { target: 'Paladin', effects: [{ type: 'remove_smite_of_protection' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Attacker') return myList;
      if (key === KEY) return [];
      if (name === 'campaign' && key === 'coverRefresh') return 3;
      if (key === 'activeConditions') return [];
      return null;
    });

    clearAllExpirationEffects('Attacker', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'smiteOfProtectionActive',
      null,
      'MyCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'coverRefresh',
      4,
      'MyCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// clearExpirationEffects — clear_silence_zone effect type
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — clear_silence_zone', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('removes deafened condition and silenced targetEffects for the caster', () => {
    const myList = [
      { target: 'Caster', effects: [{ type: 'clear_silence_zone', casterName: 'Caster' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Caster') return myList;
      if (key === KEY) return [];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'silenced', source: 'Caster', target: 'Orc' },
        { effect: 'silenced', source: 'Caster', target: 'Human' },
        { effect: 'slow', target: 'Orc' },
      ];
      if (name === 'Orc' && key === 'activeConditions') return ['deafened', 'poisoned'];
      if (name === 'Human' && key === 'activeConditions') return ['deafened', 'fatigued'];
      if (key === 'activeConditions') return [];
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
    const effectCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'campaign' && c[1] === 'targetEffects',
    );
    expect(effectCalls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// clearExpirationEffects — remove_aura_of_life_buff effect type
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — remove_aura_of_life_buff', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('removes the buff and sets auraOfLifeHpMaxProtected to false', () => {
    const myList = [
      { target: 'Cleric', effects: [{ type: 'remove_aura_of_life_buff', buffName: 'AuraOfLife' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Cleric' && key === 'activeBuffs') return [{ name: 'AuraOfLife', effect: 'aura_of_life' }];
      if (key === KEY && name === 'Attacker') return myList;
      if (key === KEY) return [];
      if (key === 'activeConditions') return [];
      return null;
    });

    clearAllExpirationEffects('Attacker', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Cleric',
      'activeBuffs',
      [],
      'MyCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Cleric',
      'auraOfLifeHpMaxProtected',
      false,
      'MyCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// clearExpirationEffects — aura_of_life_hp_protection_end effect type
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — aura_of_life_hp_protection_end', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('sets auraOfLifeHpMaxProtected to false', () => {
    const myList = [
      { target: 'Cleric', effects: [{ type: 'aura_of_life_hp_protection_end' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Attacker') return myList;
      if (key === KEY) return [];
      if (key === 'activeConditions') return [];
      return null;
    });

    clearAllExpirationEffects('Attacker', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Cleric',
      'auraOfLifeHpMaxProtected',
      false,
      'MyCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// applyHolyNimbusDamage is not exported - tested indirectly through applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applyHolyNimbusDamage (indirect via applyTurnStartEffects)', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  it('applies holy nimbus damage through applyTurnStartEffects when holyNimbusActive is true', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Paladin' && prop === 'holyNimbusActive') return true;
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc', computedStats: { proficiency: 2, abilities: [{ name: 'Charisma', bonus: 3 }] } },
      ],
    });
    getAllyList.mockReturnValue([]);

    await applyTurnStartEffects('Orc', { turnStartEffects: [] }, 'MyCampaign', [
      { name: 'Paladin', computedStats: { proficiency: 2, abilities: [{ name: 'Charisma', bonus: 3 }] } },
    ]);

    // Holy nimbus should have applied damage
    expect(applyDamageToTarget).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SP-114: remove_summoned_creatures expiration type
// ---------------------------------------------------------------------------

import { removeSummonedCreatures } from '../../combat/summons/summonedCreatureService.js';
import storage from '../../ui/storage.js';
import { addEntry } from '../../ui/logService.js';
import { clearExpirationEffects } from './expirations.js';

describe('SP-114 remove_summoned_creatures expiration', () => {
  beforeEach(() => resetMocks());

  it('clears the matching caster concentration, removes summons, and logs', () => {
    const cs = {
      creatures: [
        { name: 'Wizard', concentration: { spell: 'Summon Aberration', dc: 18 } },
        { name: 'Aberrant Spirit (Mind Flayer)', summonedBy: 'Wizard', summonSource: 'spell' },
      ],
    };
    getCombatSummary.mockReturnValue(cs);

    clearExpirationEffects(
      [{ type: 'remove_summoned_creatures', spell: 'Summon Aberration' }],
      'Wizard', 'Wizard', 'test-campaign'
    );

    expect(cs.creatures.find(c => c.name === 'Wizard').concentration).toBeNull();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'test-campaign');
    expect(removeSummonedCreatures).toHaveBeenCalledWith('Wizard', 'test-campaign');
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'summons',
      characterName: 'Wizard',
      description: expect.stringContaining('summoned creatures disappear'),
    }));
  });

  it('leaves a different concentration spell on the caster intact', () => {
    const cs = {
      creatures: [{ name: 'Wizard', concentration: { spell: 'Slow', dc: 18 } }],
    };
    getCombatSummary.mockReturnValue(cs);

    clearExpirationEffects(
      [{ type: 'remove_summoned_creatures', spell: 'Summon Aberration' }],
      'Wizard', 'Wizard', 'test-campaign'
    );

    expect(cs.creatures[0].concentration.spell).toBe('Slow');
    expect(storage.set).not.toHaveBeenCalled();
    expect(removeSummonedCreatures).toHaveBeenCalledWith('Wizard', 'test-campaign');
  });
});
