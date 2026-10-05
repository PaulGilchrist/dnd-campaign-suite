// CLA-138: Fey Reinforcements (2024 Ranger/Fey Wanderer lv11) free-cast latch and
// no-Concentration option. The arm modal stamps `_Fey_Reinforcements_freeCastCount
// = usesMax` and `_Fey_Reinforcements_noConcentration` to runtime; the OLD handler
// decremented at arm (0) while checkFreeCastEntry demands >0 on the SAME key —
// auth was dead and the lv4 slot was consumed despite the popup.
// Here: latch >0 authorizes, 0 denies; the free cast consumes the latch 1→0 via
// prepareSpellCast without touching spell_slots_level_4; the arm-time no-Concentration
// choice skips the caster concentration stamp, shortens duration to 1 minute on the
// modified spell, is consumed with the free cast, and logs the consumption.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const mem = new Map();
  const setRuntimeValue = vi.fn((_name, key, value) => { mem.set(key, value); });
  const getRuntimeValue = vi.fn((_name, key) => (mem.has(key) ? mem.get(key) : undefined));
  const clearRuntimeState = vi.fn(() => mem.clear());
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState, __mem: mem };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'FeyRanger', concentration: null }] })),
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
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { isFreeCastAuthorized, prepareSpellCast } from './spellPreparationService.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { __mem as mem } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'FeyRanger';

const feyReinforcementsEntry = {
  name: 'Fey Reinforcements',
  type: 'fey_reinforcements',
  spell: 'Summon Fey',
  uses_expression: '1',
  usesMax: 1,
  recharge: 'long_rest',
  action: 'action',
  duration: 'Concentration, up to 1 hour',
  casting_time: 'passive',
};

function rangerStats() {
  return {
    name: CASTER,
    level: 17,
    class: { name: 'Ranger' },
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    proficiency: 6,
    spellAbilities: { spellCastingAbility: 'Wisdom', toHit: 13, saveDc: 17, modifier: 4, spell_slots_level_4: 3 },
    automation: { actions: [], bonusActions: [], specialActions: [feyReinforcementsEntry], passives: [] },
  };
}

function summonFeySpell() {
  return {
    name: 'Summon Fey',
    level: 4,
    casting_time: 'Action',
    concentration: true,
    duration: 'Concentration, up to 1 hour',
    school: 'Conjuration',
    automation: { type: 'summon_spirit', typeLabel: 'Fey Spirit', baseLevel: 4 },
  };
}

function store(pairs) {
  Object.entries(pairs).forEach(([k, v]) => mem.set(k, v));
}

describe('CLA-138 Fey Reinforcements free-cast auth (latch counts down from usesMax at arm)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mem.clear();
  });

  it('authorizes Summon Fey while the armed latch is 1 (arm stamps usesMax, not 0)', () => {
    store({ '_Fey_Reinforcements_freeCastCount': 1 });
    expect(isFreeCastAuthorized(CASTER, 'Summon Fey', 4, rangerStats(), CAMPAIGN)).toBe(true);
  });

  it('denies Summon Fey once the latch is spent (0) — second cast pays the slot', () => {
    store({ '_Fey_Reinforcements_freeCastCount': 0 });
    expect(isFreeCastAuthorized(CASTER, 'Summon Fey', 4, rangerStats(), CAMPAIGN)).toBe(false);
  });

  it('consumes the latch 1→0 on the authorized free cast without touching spell_slots_level_4', async () => {
    store({ '_Fey_Reinforcements_freeCastCount': 1 });
    const result = await prepareSpellCast(summonFeySpell(), {}, {
      playerName: CASTER,
      playerStats: rangerStats(),
      campaignName: CAMPAIGN,
      isUpcast: false,
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(result.slotConsumed).toBe(false);
    const latchWrite = setRuntimeValue.mock.calls.find(c => c[1] === '_Fey_Reinforcements_freeCastCount');
    expect(latchWrite).toBeDefined();
    expect(latchWrite[2]).toBe(0);
    const slotWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'spell_slots_level_4');
    expect(slotWrite).toBeUndefined();
    // Free-cast consumption is logged (automation logging convention).
    const abilityLog = addEntry.mock.calls.find(c => c[1].abilityName === 'Fey Reinforcements');
    expect(abilityLog).toBeDefined();
    expect(abilityLog[1].note).toContain('no spell slot consumed');
    expect(abilityLog[1].note).toContain('0 free casts remaining');
  });

  it('pays the lv4 slot when the latch is spent (free exhausted)', async () => {
    store({ '_Fey_Reinforcements_freeCastCount': 0, 'spell_slots_level_4': 3 });
    const result = await prepareSpellCast(summonFeySpell(), {}, {
      playerName: CASTER,
      playerStats: rangerStats(),
      campaignName: CAMPAIGN,
      isUpcast: false,
      freeCastAuthorized: false,
    });

    expect(result.slotConsumed).toBe(true);
    expect(result.freeCastUsed).toBe(false);
    const slotWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'spell_slots_level_4');
    expect(slotWrite[2]).toBe(2);
  });
});

describe('CLA-138 no-Concentration option propagates through the free cast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mem.clear();
  });

  it('checked: no caster concentration stamp, duration 1 minute on the modified spell, choice consumed', async () => {
    store({
      '_Fey_Reinforcements_freeCastCount': 1,
      '_Fey_Reinforcements_noConcentration': true,
    });
    const result = await prepareSpellCast(summonFeySpell(), {}, {
      playerName: CASTER,
      playerStats: rangerStats(),
      campaignName: CAMPAIGN,
      isUpcast: false,
      freeCastAuthorized: true,
    });

    expect(addConcentration).not.toHaveBeenCalled();
    expect(result.metaCtx.shouldSetConcentration).toBe(false);
    expect(result.modifiedSpell.concentration).toBe(false);
    expect(result.modifiedSpell.duration).toBe('1 minute');
    expect(result.modifiedSpell._noConcentrationChoice).toBe(true);
    const choiceWrite = setRuntimeValue.mock.calls.find(c => c[1] === '_Fey_Reinforcements_noConcentration');
    expect(choiceWrite).toBeDefined();
    expect(choiceWrite[2]).toBe(null);
    const abilityLog = addEntry.mock.calls.find(c => c[1].abilityName === 'Fey Reinforcements');
    expect(abilityLog[1].note).toContain('Concentration skipped');
    expect(abilityLog[1].note).toContain('duration 1 minute');
  });

  it('unchecked: concentration stamped (default), duration untouched, choice still consumed', async () => {
    store({
      '_Fey_Reinforcements_freeCastCount': 1,
      '_Fey_Reinforcements_noConcentration': false,
    });
    const result = await prepareSpellCast(summonFeySpell(), {}, {
      playerName: CASTER,
      playerStats: rangerStats(),
      campaignName: CAMPAIGN,
      isUpcast: false,
      freeCastAuthorized: true,
    });

    expect(addConcentration).toHaveBeenCalled();
    expect(result.metaCtx.shouldSetConcentration).toBe(true);
    expect(result.modifiedSpell.concentration).toBe(true);
    expect(result.modifiedSpell.duration).toBe('Concentration, up to 1 hour');
    expect(result.modifiedSpell._noConcentrationChoice).toBeUndefined();
    const choiceWrite = setRuntimeValue.mock.calls.find(c => c[1] === '_Fey_Reinforcements_noConcentration');
    expect(choiceWrite[2]).toBe(null);
  });

  it('no-Concentration choice NEVER applies to a paid (slot-consuming) cast', async () => {
    store({
      '_Fey_Reinforcements_freeCastCount': 0,
      '_Fey_Reinforcements_noConcentration': true,
      'spell_slots_level_4': 3,
    });
    const result = await prepareSpellCast(summonFeySpell(), {}, {
      playerName: CASTER,
      playerStats: rangerStats(),
      campaignName: CAMPAIGN,
      isUpcast: false,
      freeCastAuthorized: false,
    });

    expect(addConcentration).toHaveBeenCalled();
    expect(result.modifiedSpell.concentration).toBe(true);
    expect(result.modifiedSpell._noConcentrationChoice).toBeUndefined();
    // paid path never runs the free-cast consume lane
    const choiceWrite = setRuntimeValue.mock.calls.find(c => c[1] === '_Fey_Reinforcements_noConcentration');
    expect(choiceWrite).toBeUndefined();
  });
});
