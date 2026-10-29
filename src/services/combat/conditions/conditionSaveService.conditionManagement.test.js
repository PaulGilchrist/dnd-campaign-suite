// @maintained-by-ai
// Generic condition-management lane of conditionSaveService (owned here):
// removeCondition full lane (:101-115, incl. activeConditionMeta strip :109-114) and
// addCondition auto-immunity gate (:141-150), append/dedup replace-not-stack (:152-154),
// meta merge (:160-173), combatSummary guard (:130-133), and the { suppressed } return contract.
//
// Family map (behaviors owned elsewhere, not duplicated here):
// - conditionSaveService.aura-immunity.test.js (#1002) — CLA-019/020 aura suppression gate,
//   armed/unarmed channel, byte-exact immunity logs, fresh meta stamp only with dc/ability.
// - conditionSaveService.test.js — getCreatureSaveBonus / rollConditionSave engine lanes.
// - conditionSaveService.popup.test.js — buildConditionPopup envelope.
// Aura membership/fold math is delegated upstream (computeAuraComboEffects); not re-driven here.
// No timers, no network, no wall-clock at this seam (turn-based, pure store mediation).
//
// old -> new: rmT1→R1 | rmT2+rmT3→R2 | rmT4+rmT5→R3 | addT1→A1 | addT2+addT3→A2 |
// addT4→A3 | addT5(npc/not-found) split→A2(npc leg)+A5(not-found+guard) | new A4 meta merge.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

// Kept inert: purity/roll lanes owned by conditionSaveService.test.js; mock keeps this
// lane's module graph isolated (zero-network).
vi.mock('../../automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  handle: vi.fn(),
  isAuraOfPurityActive: vi.fn(() => false),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(() => []),
}));

vi.mock('../automation/automationService.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { removeCondition, addCondition } from './conditionSaveService.js';
import { playerIsImmuneToCondition } from '../automation/automationService.js';

// ── Helpers ───────────────────────────────────────────────────────

const cs = { creatures: [{ type: 'player', name: 'Hero' }, { type: 'monster', name: 'Orc' }, { type: 'npc', name: 'Goblin' }] };

function makeRuntime(initial = {}) {
  // faithful store: captures campaign pin on every write
  const store = new Map(Object.entries(initial));
  const setCalls = [];
  return {
    getRuntimeValue: vi.fn((name, key) => store.get(`${name}:${key}`)),
    setRuntimeValue: vi.fn((name, key, value, campaignName) => { setCalls.push({ name, key, value, campaignName }); }),
    setCalls,
  };
}

beforeEach(() => {
  vi.clearAllMocks(); // clears calls only — vi.fn(impl) implementations are kept
});

// ── removeCondition ──────────────────────────────────────────────

describe('removeCondition', () => {
  it('removes case-insensitively via key object or plain string; strips matching meta and leaves other meta intact', () => {
    const rt = makeRuntime({
      'Hero:activeConditions': ['blinded', 'Charmed'],
      'Hero:activeConditionMeta': { charmed: { dc: 15 }, poisoned: { dc: 12 } },
    });
    removeCondition({ combatSummary: cs, creatureName: 'Hero', condition: { key: 'CHARMED' }, getRuntimeValue: rt.getRuntimeValue, setRuntimeValue: rt.setRuntimeValue, campaignName: 'Campaign' });

    expect(rt.setCalls).toEqual([
      { name: 'Hero', key: 'activeConditions', value: ['blinded'], campaignName: 'Campaign' },
      { name: 'Hero', key: 'activeConditionMeta', value: { poisoned: { dc: 12 } }, campaignName: 'Campaign' },
    ]);

    // string condition shape, no stored meta for it → exactly one write, meta untouched
    const rt2 = makeRuntime({ 'Hero:activeConditions': ['frightened', 'grappled'] });
    removeCondition({ combatSummary: cs, creatureName: 'Hero', condition: 'Frightened', getRuntimeValue: rt2.getRuntimeValue, setRuntimeValue: rt2.setRuntimeValue, campaignName: 'Campaign' });

    expect(rt2.setCalls).toEqual([
      { name: 'Hero', key: 'activeConditions', value: ['grappled'], campaignName: 'Campaign' },
    ]);
  });

  it('treats null or missing stored lists as empty and writes the filtered array even when nothing matched', () => {
    const rtNull = makeRuntime({ 'Orc:activeConditions': null });
    removeCondition({ combatSummary: cs, creatureName: 'Orc', condition: { key: 'blinded' }, getRuntimeValue: rtNull.getRuntimeValue, setRuntimeValue: rtNull.setRuntimeValue, campaignName: '' });
    expect(rtNull.setCalls).toEqual([{ name: 'Orc', key: 'activeConditions', value: [], campaignName: '' }]);

    const rtMissing = makeRuntime(); // key never stored → undefined read
    removeCondition({ combatSummary: cs, creatureName: 'Orc', condition: { key: 'blinded' }, getRuntimeValue: rtMissing.getRuntimeValue, setRuntimeValue: rtMissing.setRuntimeValue, campaignName: '' });
    expect(rtMissing.setCalls).toEqual([{ name: 'Orc', key: 'activeConditions', value: [], campaignName: '' }]);

    // absent condition is a no-op on content but still a write (authored always-write)
    const rtAbsent = makeRuntime({ 'Hero:activeConditions': ['blinded'] });
    removeCondition({ combatSummary: cs, creatureName: 'Hero', condition: { key: 'charmed' }, getRuntimeValue: rtAbsent.getRuntimeValue, setRuntimeValue: rtAbsent.setRuntimeValue, campaignName: '' });
    expect(rtAbsent.setCalls).toEqual([{ name: 'Hero', key: 'activeConditions', value: ['blinded'], campaignName: '' }]);
  });

  it('writing stops entirely when the named creature is not in the combat summary', () => {
    const rt = makeRuntime({ 'Other:activeConditions': ['blinded'] });
    removeCondition({ combatSummary: cs, creatureName: 'NonExistent', condition: { key: 'blinded' }, getRuntimeValue: rt.getRuntimeValue, setRuntimeValue: rt.setRuntimeValue, campaignName: 'Campaign' });
    expect(rt.setCalls).toEqual([]);
    expect(rt.getRuntimeValue).not.toHaveBeenCalled();
  });
});

// ── addCondition ─────────────────────────────────────────────────

describe('addCondition', () => {
  it('auto-immunity hit suppresses the add: {suppressed:true}, zero writes, conditions never read', () => {
    playerIsImmuneToCondition.mockReturnValue(true);
    const rt = makeRuntime({ 'Hero:activeConditions': ['blinded'], 'Hero:activeConditionMeta': { blinded: { dc: 8 } } });

    const result = addCondition({ combatSummary: cs, creatureName: 'Hero', conditionDef: { key: 'charmed', label: 'Charmed' }, dc: 15, ability: 'wis', getRuntimeValue: rt.getRuntimeValue, setRuntimeValue: rt.setRuntimeValue, campaignName: 'Campaign', playerStats: { name: 'Hero', allFeatures: [] } });

    expect(result).toEqual({ suppressed: true, immunitySource: 'condition immunity' });
    expect(playerIsImmuneToCondition).toHaveBeenCalledTimes(1);
    expect(rt.setCalls).toEqual([]);
    expect(rt.getRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions')).toEqual([]);
  });

  it('immunity gate runs only with playerStats AND campaignName, in the exact argument envelope', () => {
    // leg a: playerStats null (npc lane) despite truthy campaign → gate skipped, exact legacy write bytes
    playerIsImmuneToCondition.mockReturnValue(true); // falsifier: if gating were type-based, this would suppress
    const rtA = makeRuntime({ 'Goblin:activeConditions': ['blinded'] });
    const resA = addCondition({ combatSummary: cs, creatureName: 'Goblin', conditionDef: { key: 'frightened', label: 'Frightened' }, dc: 13, ability: 'wis', getRuntimeValue: rtA.getRuntimeValue, setRuntimeValue: rtA.setRuntimeValue, campaignName: 'Campaign', playerStats: null });
    expect(playerIsImmuneToCondition).not.toHaveBeenCalled();
    expect(resA).toEqual({ suppressed: false });
    expect(rtA.setCalls).toEqual([
      { name: 'Goblin', key: 'activeConditions', value: ['blinded', 'frightened'], campaignName: 'Campaign' },
      { name: 'Goblin', key: 'activeConditionMeta', value: { frightened: { dc: 13, ability: 'wis' } }, campaignName: 'Campaign' },
    ]);

    // leg b: campaignName falsy with truthy playerStats → gate skipped, writes pin the empty campaign
    const rtB = makeRuntime({ 'Hero:activeConditions': [] });
    addCondition({ combatSummary: cs, creatureName: 'Hero', conditionDef: { key: 'charmed', label: 'Charmed' }, dc: 15, ability: 'wis', getRuntimeValue: rtB.getRuntimeValue, setRuntimeValue: rtB.setRuntimeValue, campaignName: '', playerStats: { name: 'Hero' } });
    expect(playerIsImmuneToCondition).not.toHaveBeenCalled();
    expect(rtB.setCalls).toEqual([
      { name: 'Hero', key: 'activeConditions', value: ['charmed'], campaignName: '' },
      { name: 'Hero', key: 'activeConditionMeta', value: { charmed: { dc: 15, ability: 'wis' } }, campaignName: '' },
    ]);

    // leg c: both truthy → gate invoked with the exact envelope
    playerIsImmuneToCondition.mockReturnValue(false);
    const rtC = makeRuntime({ 'Hero:activeConditions': [] });
    const playerStats = { name: 'Hero' };
    addCondition({ combatSummary: cs, creatureName: 'Hero', conditionDef: { key: 'charmed', label: 'Charmed' }, dc: 15, ability: 'wis', getRuntimeValue: rtC.getRuntimeValue, setRuntimeValue: rtC.setRuntimeValue, campaignName: 'Campaign', playerStats });
    expect(playerIsImmuneToCondition).toHaveBeenCalledWith({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: rtC.getRuntimeValue,
      campaignName: 'Campaign',
    });
  });

  it('appends new conditions and re-stamps a case-insensitive duplicate at the tail — replaced, never stacked', () => {
    playerIsImmuneToCondition.mockReturnValue(false);

    const rt1 = makeRuntime({ 'Hero:activeConditions': ['blinded'] });
    const res1 = addCondition({ combatSummary: cs, creatureName: 'Hero', conditionDef: { key: 'charmed', label: 'Charmed' }, dc: 15, ability: 'wis', getRuntimeValue: rt1.getRuntimeValue, setRuntimeValue: rt1.setRuntimeValue, campaignName: 'Campaign', playerStats: {} });
    expect(res1).toEqual({ suppressed: false });
    expect(rt1.setCalls).toEqual([
      { name: 'Hero', key: 'activeConditions', value: ['blinded', 'charmed'], campaignName: 'Campaign' },
      { name: 'Hero', key: 'activeConditionMeta', value: { charmed: { dc: 15, ability: 'wis' } }, campaignName: 'Campaign' },
    ]);

    // duplicate 'Charmed' is filtered out and re-appended lowercase; no dc/ability → no meta write
    const rt2 = makeRuntime({ 'Hero:activeConditions': ['Charmed', 'blinded'] });
    const res2 = addCondition({ combatSummary: cs, creatureName: 'Hero', conditionDef: { key: 'charmed', label: 'Charmed' }, getRuntimeValue: rt2.getRuntimeValue, setRuntimeValue: rt2.setRuntimeValue, campaignName: '', playerStats: {} });
    expect(res2).toEqual({ suppressed: false });
    expect(rt2.setCalls).toEqual([
      { name: 'Hero', key: 'activeConditions', value: ['blinded', 'charmed'], campaignName: '' },
    ]);
  });

  it('meta merge preserves other conditions and stale keys while refreshing dc/ability for the target', () => {
    playerIsImmuneToCondition.mockReturnValue(false);
    const rt = makeRuntime({
      'Hero:activeConditions': ['blinded'],
      'Hero:activeConditionMeta': { blinded: { dc: 8, source: 'hex' }, poisoned: { dc: 12, ability: 'con' } },
    });

    const result = addCondition({ combatSummary: cs, creatureName: 'Hero', conditionDef: { key: 'blinded', label: 'Blinded' }, dc: 15, ability: 'wis', getRuntimeValue: rt.getRuntimeValue, setRuntimeValue: rt.setRuntimeValue, campaignName: 'Campaign', playerStats: {} });

    expect(result).toEqual({ suppressed: false });
    expect(rt.setCalls).toEqual([
      { name: 'Hero', key: 'activeConditions', value: ['blinded'], campaignName: 'Campaign' },
      { name: 'Hero', key: 'activeConditionMeta', value: { blinded: { dc: 15, ability: 'wis', source: 'hex' }, poisoned: { dc: 12, ability: 'con' } }, campaignName: 'Campaign' },
    ]);
  });

  it('missing combatSummary logs an exact console.error; unknown creature no-writes — both {suppressed:false}, no writes', () => {
    playerIsImmuneToCondition.mockReturnValue(false);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rt = makeRuntime();
    try {
      const resMissing = addCondition({ combatSummary: undefined, creatureName: 'Hero', conditionDef: { key: 'charmed', label: 'Charmed' }, getRuntimeValue: rt.getRuntimeValue, setRuntimeValue: rt.setRuntimeValue, campaignName: 'Campaign', playerStats: null });
      expect(resMissing).toEqual({ suppressed: false });
      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(errSpy).toHaveBeenCalledWith('[addCondition] combatSummary is null/undefined or missing creatures when adding charmed to Hero');

      const resUnknown = addCondition({ combatSummary: cs, creatureName: 'NonExistent', conditionDef: { key: 'blinded', label: 'Blinded' }, dc: 10, ability: 'con', getRuntimeValue: rt.getRuntimeValue, setRuntimeValue: rt.setRuntimeValue, campaignName: 'Campaign', playerStats: null });
      expect(resUnknown).toEqual({ suppressed: false });
      expect(rt.setCalls).toEqual([]);
      expect(errSpy).toHaveBeenCalledTimes(1); // unknown-creature lane is silent
    } finally {
      errSpy.mockRestore();
    }
  });
});
