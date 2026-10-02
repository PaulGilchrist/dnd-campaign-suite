// CLA-019: Aura of Courage — addCondition GM-add seam suppresses aura-covered
// conditions with a condition_immunity_aura automation log.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../automation/automationService.js', () => ({
  playerIsImmuneToCondition: vi.fn(() => false),
}));

const logEntries = [];
vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn((campaignName, entry) => {
    logEntries.push(entry);
    return Promise.resolve();
  }),
}));

import { addCondition } from './conditionSaveService.js';

const cs = { creatures: [{ name: 'ElderPaladin', type: 'player' }, { name: 'EvasiveFighter', type: 'player' }, { name: 'Thug 1', type: 'npc' }] };
const campaignName = 'test-campaign';

function makeRuntime(initial = {}) {
  const store = new Map(Object.entries(initial));
  const setCalls = [];
  return {
    getRuntimeValue: vi.fn((name, key) => store.get(`${name}:${key}`)),
    setRuntimeValue: vi.fn((name, key, value) => { setCalls.push({ name, key, value }); }),
    setCalls,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  logEntries.length = 0;
});

describe('addCondition — CLA-019 aura immunity gate', () => {
  it('suppresses frightened for aura-covered host: no write, immunity log, suppressed flag', () => {
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
    expect(rt.setCalls).toHaveLength(0);
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].type).toBe('automation');
    expect(logEntries[0].automationType).toBe('condition_immunity_aura');
    expect(logEntries[0].characterName).toBe('ElderPaladin');
    expect(logEntries[0].description).toContain('ElderPaladin is immune to Frightened (Aura of Courage from ElderPaladin)');
  });

  it('suppresses covered ally PC in aura (no stats required)', () => {
    const rt = makeRuntime();
    const result = addCondition({
      combatSummary: cs,
      creatureName: 'EvasiveFighter',
      conditionDef: { key: 'frightened', label: 'Frightened' },
      getRuntimeValue: rt.getRuntimeValue,
      setRuntimeValue: rt.setRuntimeValue,
      campaignName,
      playerStats: null,
      auraImmunities: ['frightened'],
      auraImmunitySources: { frightened: 'ElderPaladin' },
    });

    expect(result).toEqual({ suppressed: true });
    expect(rt.setCalls).toHaveLength(0);
    expect(logEntries).toHaveLength(1);
  });

  it('non-covered condition applies normally for aura member (only covered suppressed)', () => {
    const rt = makeRuntime({ 'EvasiveFighter:activeConditions': [] });
    const result = addCondition({
      combatSummary: cs,
      creatureName: 'EvasiveFighter',
      conditionDef: { key: 'prone', label: 'Prone' },
      dc: 10,
      ability: 'STR',
      getRuntimeValue: rt.getRuntimeValue,
      setRuntimeValue: rt.setRuntimeValue,
      campaignName,
      playerStats: { name: 'EvasiveFighter' },
      auraImmunities: ['frightened'],
      auraImmunitySources: { frightened: 'ElderPaladin' },
    });

    expect(result).toEqual({ suppressed: false });
    expect(rt.setCalls[0]).toEqual({ name: 'EvasiveFighter', key: 'activeConditions', value: ['prone'] });
    expect(logEntries).toHaveLength(0);
  });

  it('control target without aura channel: byte-identical legacy write + no immunity log', () => {
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
    });

    expect(result).toEqual({ suppressed: false });
    expect(rt.setCalls[0]).toEqual({ name: 'Thug 1', key: 'activeConditions', value: ['frightened'] });
    expect(rt.setCalls[1].key).toBe('activeConditionMeta');
    expect(logEntries).toHaveLength(0);
  });

  // CLA-020: Aura of Devotion charmed rides the identical gate + label mapping.
  it('CLA-020: suppresses charmed for aura-covered ally; log labels Aura of Devotion', () => {
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
      playerStats: { name: 'EvasiveFighter' },
      auraImmunities: ['charmed'],
      auraImmunitySources: { charmed: 'ElderPaladin' },
    });

    expect(result).toEqual({ suppressed: true });
    expect(rt.setCalls).toHaveLength(0);
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].automationType).toBe('condition_immunity_aura');
    expect(logEntries[0].description).toContain('EvasiveFighter is immune to Charmed (Aura of Devotion from ElderPaladin)');
  });

  it('CLA-020: control target with empty channel (outside aura) gets charmed (differential)', () => {
    const rt = makeRuntime({ 'Thug 1:activeConditions': [] });
    const result = addCondition({
      combatSummary: cs,
      creatureName: 'Thug 1',
      conditionDef: { key: 'charmed', label: 'Charmed' },
      dc: 16,
      ability: 'WIS',
      getRuntimeValue: rt.getRuntimeValue,
      setRuntimeValue: rt.setRuntimeValue,
      campaignName,
      playerStats: null,
      auraImmunities: [],
      auraImmunitySources: {},
    });

    expect(result).toEqual({ suppressed: false });
    expect(rt.setCalls[0]).toEqual({ name: 'Thug 1', key: 'activeConditions', value: ['charmed'] });
    expect(logEntries).toHaveLength(0);
  });

  it('CLA-019/020 parity: charmed coverage does not suppress frightened', () => {
    const rt = makeRuntime({ 'EvasiveFighter:activeConditions': [] });
    const result = addCondition({
      combatSummary: cs,
      creatureName: 'EvasiveFighter',
      conditionDef: { key: 'frightened', label: 'Frightened' },
      getRuntimeValue: rt.getRuntimeValue,
      setRuntimeValue: rt.setRuntimeValue,
      campaignName,
      playerStats: null,
      auraImmunities: ['charmed'],
      auraImmunitySources: { charmed: 'ElderPaladin' },
    });

    expect(result).toEqual({ suppressed: false });
    expect(rt.setCalls[0].value).toEqual(['frightened']);
  });

  it('replaces existing frightened when not covered (spread-new array preserved)', () => {
    const rt = makeRuntime({ 'Thug 1:activeConditions': ['Poisoned', 'frightened'] });
    addCondition({
      combatSummary: cs,
      creatureName: 'Thug 1',
      conditionDef: { key: 'frightened', label: 'Frightened' },
      getRuntimeValue: rt.getRuntimeValue,
      setRuntimeValue: rt.setRuntimeValue,
      campaignName,
      playerStats: null,
    });

    expect(rt.setCalls[0].value).toEqual(['Poisoned', 'frightened']);
  });
});
