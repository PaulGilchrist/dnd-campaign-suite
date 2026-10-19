// @maintained-by-ai
// CLA-019/CLA-020 ticket lane: aura-immunity gate on the addCondition GM-add seam
// (conditionSaveService.js auraSuppressesCondition + optional auraImmunities channel).
//
// Family map (behaviors owned elsewhere, not duplicated here):
// - auras/auraConditionImmunity.test.js — channel delegation, auraCoversCondition
//   membership engine, log envelope + Aura of Courage/Devotion label mapping.
// - conditionSaveService.conditionManagement.test.js — generic management: playerIsImmuneToCondition
//   gate (:110), append/dedup/spread-new (:188), npc/not-found (:239).
// - saveProcessing.aura-of-{courage,devotion}.test.js + charmSpellUtils.aura-immunity.test.js —
//   failed-save resolution legs consuming the same channel (distinct seams).
// Range/self-filter gating is delegated wholesale upstream to computeAuraComboEffects,
// so there is no range-boundary pair at this seam. Aura has no wall-clock ticks (turn-based).
//
// old -> new: t1→test1 | t2+t5→test2 | t4+t6→test3 | t3+t7→test4 | t8 removed
// (dedup/spread-new owned by conditionManagement.test.js:188 + charmSpellUtils.aura-immunity.test.js:193).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../automation/automationService.js', () => ({
  // auto-immunity lane kept inert (owned by conditionManagement lane)
  playerIsImmuneToCondition: vi.fn(() => false),
}));

const logCalls = [];
vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn((campaignName, entry) => {
    logCalls.push({ campaignName, entry });
    return Promise.resolve();
  }),
}));

import { addCondition } from './conditionSaveService.js';
import { playerIsImmuneToCondition } from '../automation/automationService.js';

const cs = { creatures: [{ name: 'ElderPaladin', type: 'player' }, { name: 'EvasiveFighter', type: 'player' }, { name: 'Thug 1', type: 'npc' }] };
const campaignName = 'test-campaign';

function makeRuntime(initial = {}) {
  // faithful store: captures campaign pin on every write
  const store = new Map(Object.entries(initial));
  const setCalls = [];
  return {
    getRuntimeValue: vi.fn((name, key) => store.get(`${name}:${key}`)),
    setRuntimeValue: vi.fn((name, key, value, campaign) => { setCalls.push({ name, key, value, campaignName: campaign }); }),
    setCalls,
  };
}

beforeEach(() => {
  vi.clearAllMocks(); // clears calls only — vi.fn(impl) implementations are kept
  logCalls.length = 0;
});

describe('addCondition — CLA-019/020 aura-immunity gate (GM-add seam)', () => {
  it('CLA-019 armed: aura-covered frightened suppressed — zero writes, byte-exact Aura of Courage log', () => {
    const rt = makeRuntime();
    const result = addCondition({
      combatSummary: cs,
      creatureName: 'ElderPaladin',
      conditionDef: { key: 'frightened', label: 'Frightened' },
      dc: 16,
      ability: 'WIS',
      getRuntimeValue: rt.getRuntimeValue,
      setRuntimeValue: rt.setRuntimeValue,
      campaignName,
      playerStats: { name: 'ElderPaladin' },
      auraImmunities: ['frightened'],
      auraImmunitySources: { frightened: 'ElderPaladin' },
    });

    expect(result).toEqual({ suppressed: true });
    expect(rt.setCalls).toEqual([]);
    // gate order: the aura channel short-circuits before the stats-dependent auto-immunity lane
    expect(playerIsImmuneToCondition).not.toHaveBeenCalled();
    expect(logCalls).toHaveLength(1);
    expect(logCalls[0].campaignName).toBe(campaignName);
    const { timestamp, ...entry } = logCalls[0].entry;
    expect(typeof timestamp).toBe('number');
    expect(entry).toEqual({
      type: 'automation',
      automationType: 'condition_immunity_aura',
      characterName: 'ElderPaladin',
      sourceName: 'ElderPaladin',
      abilityName: 'Aura of Courage',
      description: 'ElderPaladin is immune to Frightened (Aura of Courage from ElderPaladin) — condition not applied.',
    });
  });

  it('CLA-020 armed twin: charmed suppressed for ally in aura without playerStats — Aura of Devotion log', () => {
    const rt = makeRuntime();
    const result = addCondition({
      combatSummary: cs,
      creatureName: 'EvasiveFighter',
      conditionDef: { key: 'charmed', label: 'Charmed' },
      dc: 16,
      ability: 'WIS',
      getRuntimeValue: rt.getRuntimeValue,
      setRuntimeValue: rt.setRuntimeValue,
      campaignName,
      playerStats: null, // aura gate needs no playerStats
      auraImmunities: ['charmed'],
      auraImmunitySources: { charmed: 'ElderPaladin' },
    });

    expect(result).toEqual({ suppressed: true });
    expect(rt.setCalls).toEqual([]);
    expect(playerIsImmuneToCondition).not.toHaveBeenCalled();
    expect(logCalls).toHaveLength(1);
    expect(logCalls[0].campaignName).toBe(campaignName);
    const { timestamp, ...entry } = logCalls[0].entry;
    expect(typeof timestamp).toBe('number');
    expect(entry).toEqual({
      type: 'automation',
      automationType: 'condition_immunity_aura',
      characterName: 'EvasiveFighter',
      sourceName: 'ElderPaladin',
      abilityName: 'Aura of Devotion',
      description: 'EvasiveFighter is immune to Charmed (Aura of Devotion from ElderPaladin) — condition not applied.',
    });
  });

  it('unarmed control pair: same adds with channel omitted or empty — byte-identical legacy write lane, no immunity log', () => {
    const rt = makeRuntime({ 'Thug 1:activeConditions': [] });
    const result = addCondition({
      combatSummary: cs,
      creatureName: 'Thug 1',
      conditionDef: { key: 'frightened', label: 'Frightened' },
      dc: 16,
      ability: 'WIS',
      getRuntimeValue: rt.getRuntimeValue,
      setRuntimeValue: rt.setRuntimeValue,
      campaignName,
      playerStats: null,
    }); // legacy caller: aura channel args omitted entirely

    expect(result).toEqual({ suppressed: false });
    expect(rt.setCalls).toEqual([
      { name: 'Thug 1', key: 'activeConditions', value: ['frightened'], campaignName },
      { name: 'Thug 1', key: 'activeConditionMeta', value: { frightened: { dc: 16, ability: 'WIS' } }, campaignName },
    ]);

    const rt2 = makeRuntime({ 'Thug 1:activeConditions': [] });
    const result2 = addCondition({
      combatSummary: cs,
      creatureName: 'Thug 1',
      conditionDef: { key: 'charmed', label: 'Charmed' },
      dc: 16,
      ability: 'WIS',
      getRuntimeValue: rt2.getRuntimeValue,
      setRuntimeValue: rt2.setRuntimeValue,
      campaignName,
      playerStats: null,
      auraImmunities: [],
      auraImmunitySources: {},
    });

    expect(result2).toEqual({ suppressed: false });
    expect(rt2.setCalls).toEqual([
      { name: 'Thug 1', key: 'activeConditions', value: ['charmed'], campaignName },
      { name: 'Thug 1', key: 'activeConditionMeta', value: { charmed: { dc: 16, ability: 'WIS' } }, campaignName },
    ]);
    expect(logCalls).toEqual([]);
  });

  it('falsifier: near-miss keys on a covered target still apply — membership is exact, meta stamped only with dc/ability', () => {
    const rt = makeRuntime({ 'EvasiveFighter:activeConditions': [] });
    // target inside charmed-only Aura of Devotion: frightened is a near-miss and must apply
    const result = addCondition({
      combatSummary: cs,
      creatureName: 'EvasiveFighter',
      conditionDef: { key: 'frightened', label: 'Frightened' },
      dc: 16,
      ability: 'WIS',
      getRuntimeValue: rt.getRuntimeValue,
      setRuntimeValue: rt.setRuntimeValue,
      campaignName,
      playerStats: null,
      auraImmunities: ['charmed'],
      auraImmunitySources: { charmed: 'ElderPaladin' },
    });

    expect(result).toEqual({ suppressed: false });
    expect(rt.setCalls).toEqual([
      { name: 'EvasiveFighter', key: 'activeConditions', value: ['frightened'], campaignName },
      { name: 'EvasiveFighter', key: 'activeConditionMeta', value: { frightened: { dc: 16, ability: 'WIS' } }, campaignName },
    ]);

    // prone is in no aura channel; omitting dc/ability writes exactly one entry (no meta stamp)
    const rt2 = makeRuntime({ 'EvasiveFighter:activeConditions': [] });
    const result2 = addCondition({
      combatSummary: cs,
      creatureName: 'EvasiveFighter',
      conditionDef: { key: 'prone', label: 'Prone' },
      getRuntimeValue: rt2.getRuntimeValue,
      setRuntimeValue: rt2.setRuntimeValue,
      campaignName,
      playerStats: null,
      auraImmunities: ['charmed'],
      auraImmunitySources: { charmed: 'ElderPaladin' },
    });

    expect(result2).toEqual({ suppressed: false });
    expect(rt2.setCalls).toEqual([
      { name: 'EvasiveFighter', key: 'activeConditions', value: ['prone'], campaignName },
    ]);
    expect(logCalls).toEqual([]); // no suppression log for uncovered legs
  });
});
