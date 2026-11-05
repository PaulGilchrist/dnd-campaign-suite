// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
}));

// isWithinRange stays the mocked universal checker; the pure comparator runs
// as the real one-liner implementation so the sync lane measures honestly.
vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => false),
  isDistanceInRange: (dist, rangeFt) => rangeFt == null || dist == null || dist <= rangeFt,
}));

vi.mock('../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(async () => null),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCombatContext: vi.fn(async () => null),
}));

import { getCoronaSaveDisadvantage, getCoronaSaveDisadvantageSync } from './coronaAuraUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { loadMapData } from '../../maps/mapsService.js';
import { getCombatSummary, getCombatContext } from '../../encounters/combatData.js';

// Corona (source semantics): a non-target player holding an 'sunlight_aura' activeBuff
// imposes save disadvantage on a target listed in their 'coronaOfLightEnemies' when the
// damageType is in the buff's enemiesDisadvantageSaves (case-normalized). The 2026-11-04
// range fix retires the skipRangeCheck escape hatch: BOTH lanes now carry a measured/
// lenient fork — bearer↔victim distance is measured when the active map tracks positioned
// tokens for both creatures, and unmeasurable pairs (no active map, gridless tokens,
// tokenless creatures) stay consulted-and-passes lenient (house law §44).
const CAMPAIGN = 'test-campaign';

const grid = (...names) => ({ players: names.map(name => ({ name, gridX: 0, gridY: 0 })) });
const corona = (extra = {}) => ({ effect: 'sunlight_aura', enemiesDisadvantageSaves: ['Fire', 'Radiant'], ...extra });
const makeSummary = (names = ['War_Cleric', 'Bandit 1']) => ({
  round: 1,
  creatures: names.map((name, i) => ({ name, type: i === 0 ? 'player' : 'npc' })),
});

function resetMocks() {
  getRuntimeValue.mockReset().mockReturnValue([]);
  isWithinRange.mockReset().mockResolvedValue(false);
  loadMapData.mockReset().mockResolvedValue(null);
  getCombatSummary.mockReset().mockReturnValue(null);
  getCombatContext.mockReset().mockResolvedValue(null);
}

describe('getCoronaSaveDisadvantage — grid lane', () => {
  beforeEach(resetMocks);

  // Seeds runtime per (name, key) and returns the mapData grid to pass in.
  function seed({ players = ['Target', 'Paladin'], buffs = {}, enemies = {}, inRange = true } = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return name in buffs ? buffs[name] : [];
      if (key === 'coronaOfLightEnemies') return name in enemies ? enemies[name] : [];
      return [];
    });
    isWithinRange.mockImplementation(async (source) =>
      typeof inRange === 'function' ? inRange(source) : inRange);
    return grid(...players);
  }

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['players list empty', { players: [] }],
  ])('returns false with no grid (%s) and no combat summary to pool bearers from', async (_label, mapData) => {
    seed({ buffs: { Paladin: [corona()] }, inRange: true });

    expect(await getCoronaSaveDisadvantage({ targetName: 'Target', campaignName: CAMPAIGN, mapData, damageType: 'Fire' }))
      .toEqual({ disadvantage: false });
    expect(getCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it.each([
    ['in-range source, matching Fire save', { buffs: { Paladin: [corona()] } }, 'Fire', { disadvantage: true, source: 'Paladin' }],
    ['damageType omitted passes the type gate', { buffs: { Paladin: [corona()] } }, undefined, { disadvantage: true, source: 'Paladin' }],
    ['lowercase incoming damageType matches', { buffs: { Paladin: [corona({ enemiesDisadvantageSaves: ['Fire'] })] } }, 'fire', { disadvantage: true, source: 'Paladin' }],
    ['non-string first enemies-list entry stays lenient', { buffs: { Paladin: [corona()] }, enemies: { Paladin: [42] } }, 'Fire', { disadvantage: true, source: 'Paladin' }],
    ['target holding the buff is skipped', { buffs: { Target: [corona()] } }, 'Fire', { disadvantage: false }],
    ['no player holds the buff', {}, 'Fire', { disadvantage: false }],
    ['only source out of range', { inRange: false }, 'Fire', { disadvantage: false }],
    ['second source used when first is out of range', { players: ['Target', 'P1', 'P2'], buffs: { P1: [corona()], P2: [corona()] }, inRange: (s) => s === 'P2' }, 'Fire', { disadvantage: true, source: 'P2' }],
    ['garbage buff payloads skipped, loop reaches valid source', { buffs: { P1: null, P2: 'not-an-array', P3: [corona()] }, players: ['Target', 'P1', 'P2', 'P3'], inRange: (s) => s === 'P3' }, 'Fire', { disadvantage: true, source: 'P3' }],
    ['damageType not in enemiesDisadvantageSaves', { buffs: { Paladin: [corona({ enemiesDisadvantageSaves: ['Radiant'] })] } }, 'Fire', { disadvantage: false }],
    ['empty enemiesDisadvantageSaves blocks everything', { buffs: { Paladin: [corona({ enemiesDisadvantageSaves: [] })] } }, 'Fire', { disadvantage: false }],
    ['buff without enemiesDisadvantageSaves matches nothing', { buffs: { Paladin: [{ effect: 'sunlight_aura' }] } }, 'Fire', { disadvantage: false }],
    ['target absent from coronaOfLightEnemies', { enemies: { Paladin: ['Other'] } }, 'Fire', { disadvantage: false }],
  ])('%s', async (_label, setup, damageType, expected) => {
    const mapData = seed(setup);

    expect(await getCoronaSaveDisadvantage({ targetName: 'Target', campaignName: CAMPAIGN, mapData, damageType }))
      .toEqual(expected);
  });

  it.each([
    ['missing distance defaults to 60 ft', undefined, 60],
    ['"60 ft" parses to 60', '60 ft', 60],
    ['"30 ft" parses to 30', '30 ft', 30],
    ['unparseable distance falls back to 60', 'far away', 60],
  ])('range passed to isWithinRange: %s', async (_label, distance, expectedFeet) => {
    const mapData = seed({ buffs: { Paladin: [corona({ distance })] } });

    expect(await getCoronaSaveDisadvantage({ targetName: 'Target', campaignName: CAMPAIGN, mapData, damageType: 'Fire' }))
      .toEqual({ disadvantage: true, source: 'Paladin' });
    expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Target', expectedFeet);
  });
});

// ── Gridless lenient lane — participants come from the combat-summary cache
// (cold-cache falls back to one awaited context fetch) and nothing is measured. ──
describe('getCoronaSaveDisadvantage — gridless lenient lane', () => {
  beforeEach(resetMocks);

  function seed({ enemies = ['Bandit 1'], summary = makeSummary() } = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === '__map__') return null;
      if (name !== 'War_Cleric') return [];
      if (key === 'activeBuffs') return [corona()];
      if (key === 'coronaOfLightEnemies') return enemies;
      return [];
    });
    getCombatSummary.mockReturnValue(summary);
  }

  it.each([
    ['Fire save on a marked enemy', {}, { disadvantage: true, source: 'War_Cleric' }],
    ['damageType case normalized ("radiant")', { damageType: 'radiant' }, { disadvantage: true, source: 'War_Cleric' }],
    ['non-Fire/Radiant damage type', { damageType: 'Cold' }, { disadvantage: false }],
    ['target absent from coronaOfLightEnemies', { enemies: ['Other'] }, { disadvantage: false }],
    ['no combat summary and no context', { summary: null }, { disadvantage: false }],
  ])('%s', async (_label, { enemies, summary, damageType = 'Fire' }, expected) => {
    seed({ enemies, summary });

    expect(await getCoronaSaveDisadvantage({ targetName: 'Bandit 1', campaignName: CAMPAIGN, damageType }))
      .toEqual(expected);
    expect(isWithinRange).not.toHaveBeenCalled();
    expect(loadMapData).not.toHaveBeenCalled();
  });

  it('falls back to one combat-context fetch when the summary cache is cold', async () => {
    seed({ summary: null });
    getCombatContext.mockResolvedValue(makeSummary());

    expect(await getCoronaSaveDisadvantage({ targetName: 'Bandit 1', campaignName: CAMPAIGN, damageType: 'Fire' }))
      .toEqual({ disadvantage: true, source: 'War_Cleric' });
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
  });
});

// ── Regression lock: Corona's authored 60 ft "in the Bright Light" range must
// be MEASURED on an active map with positioned tokens for both bearer and
// victim (bug-corona-save-disadvantage-ignores-60ft-range.md — every runtime
// consumer used to hardcode skipRangeCheck:true, paying Disadvantage at 65 ft). ──
describe('getCoronaSaveDisadvantage — 60 ft range gate regression (2026-11-04)', () => {
  beforeEach(resetMocks);

  // Battle-arena shape: bearer (5,5), victim 13 cells away = 65 ft > 60 ft.
  function seedMap({ victimPlaced = true, bearerOnMap = true, activeMap = 'battle-arena' } = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === '__map__' && key === 'activeMapName') return activeMap;
      if (name === '__campaign__' && key === 'campaignName') return CAMPAIGN;
      if (name === 'ElderPaladin' && key === 'activeBuffs') return [corona({ distance: '60 ft' })];
      if (name === 'ElderPaladin' && key === 'coronaOfLightEnemies') return ['Winged Kobold'];
      return [];
    });
    loadMapData.mockResolvedValue({
      players: bearerOnMap ? [{ name: 'ElderPaladin', gridX: 5, gridY: 5 }] : [],
      placedItems: victimPlaced ? [{ name: 'Winged Kobold', type: 'npc', gridX: 18, gridY: 5 }] : [],
    });
    getCombatSummary.mockReturnValue(makeSummary(['ElderPaladin', 'Winged Kobold']));
  }

  it('MEASURES the aura on an active positioned map: out-of-range victim (65 ft) gets NO disadvantage', async () => {
    seedMap();
    isWithinRange.mockResolvedValue(false);

    expect(await getCoronaSaveDisadvantage({ targetName: 'Winged Kobold', campaignName: CAMPAIGN, damageType: 'Radiant' }))
      .toEqual({ disadvantage: false });
    expect(loadMapData).toHaveBeenCalledWith(CAMPAIGN, 'battle-arena');
    expect(isWithinRange).toHaveBeenCalledWith('ElderPaladin', 'Winged Kobold', 60);
  });

  it('in-range victim on a measured map still gets disadvantage', async () => {
    seedMap();
    isWithinRange.mockResolvedValue(true);

    expect(await getCoronaSaveDisadvantage({ targetName: 'Winged Kobold', campaignName: CAMPAIGN, damageType: 'Radiant' }))
      .toEqual({ disadvantage: true, source: 'ElderPaladin' });
    expect(isWithinRange).toHaveBeenCalledWith('ElderPaladin', 'Winged Kobold', 60);
  });

  it('tokenless victim on a positioned map stays LENIENT (phantoms cannot be gated)', async () => {
    seedMap({ victimPlaced: false });

    expect(await getCoronaSaveDisadvantage({ targetName: 'Winged Kobold', campaignName: CAMPAIGN, damageType: 'Radiant' }))
      .toEqual({ disadvantage: true, source: 'ElderPaladin' });
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('tokenless bearer on a positioned map stays LENIENT', async () => {
    seedMap({ bearerOnMap: false });

    expect(await getCoronaSaveDisadvantage({ targetName: 'Winged Kobold', campaignName: CAMPAIGN, damageType: 'Radiant' }))
      .toEqual({ disadvantage: true, source: 'ElderPaladin' });
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('no active map (gridless) never loads map data and stays LENIENT', async () => {
    seedMap({ activeMap: null });

    expect(await getCoronaSaveDisadvantage({ targetName: 'Winged Kobold', campaignName: CAMPAIGN, damageType: 'Radiant' }))
      .toEqual({ disadvantage: true, source: 'ElderPaladin' });
    expect(loadMapData).not.toHaveBeenCalled();
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('map fetch failure stays LENIENT', async () => {
    seedMap();
    loadMapData.mockRejectedValue(new Error('Failed to load map data'));

    expect(await getCoronaSaveDisadvantage({ targetName: 'Winged Kobold', campaignName: CAMPAIGN, damageType: 'Radiant' }))
      .toEqual({ disadvantage: true, source: 'ElderPaladin' });
    expect(isWithinRange).not.toHaveBeenCalled();
  });
});

// ── Sync lane for save consumers that cannot await (aoeService). mapData
// carries the active map document; positioned pairs are measured with the
// pure comparator, everything else stays lenient. ──
describe('getCoronaSaveDisadvantageSync', () => {
  beforeEach(resetMocks);

  function seed({ enemies = ['Bandit 1'], mapData, summary = makeSummary() } = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name !== 'War_Cleric') return [];
      if (key === 'activeBuffs') return [corona()];
      if (key === 'coronaOfLightEnemies') return enemies;
      return [];
    });
    getCombatSummary.mockReturnValue(summary);
    return mapData;
  }

  it.each([
    ['Fire save on a marked enemy', {}, { disadvantage: true, source: 'War_Cleric' }],
    ['damageType case normalized ("radiant")', { damageType: 'radiant' }, { disadvantage: true, source: 'War_Cleric' }],
    ['non-Fire/Radiant damage type', { damageType: 'Cold' }, { disadvantage: false }],
    ['target absent from coronaOfLightEnemies', { enemies: ['Other'] }, { disadvantage: false }],
    ['mapData players used without any combat summary', { mapData: grid('War_Cleric', 'Bandit 1'), summary: null }, { disadvantage: true, source: 'War_Cleric' }],
    ['no summary and no mapData', { summary: null }, { disadvantage: false }],
  ])('%s', async (_label, { enemies, mapData, summary, damageType = 'Fire' }, expected) => {
    seed({ enemies, mapData, summary });

    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: CAMPAIGN, mapData, damageType }))
      .toEqual(expected);
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it('measures positioned tokens from mapData: 65 ft victim gets NO disadvantage', () => {
    seed();
    const mapData = {
      players: [{ name: 'War_Cleric', gridX: 5, gridY: 5 }],
      placedItems: [{ name: 'Bandit 1', type: 'npc', gridX: 18, gridY: 5 }],
    };

    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: CAMPAIGN, mapData, damageType: 'Fire' }))
      .toEqual({ disadvantage: false });
  });

  it('measures positioned tokens from mapData: exactly-60 ft victim still gets disadvantage', () => {
    seed();
    const mapData = {
      players: [{ name: 'War_Cleric', gridX: 5, gridY: 5 }],
      placedItems: [{ name: 'Bandit 1', type: 'npc', gridX: 17, gridY: 5 }],
    };

    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: CAMPAIGN, mapData, damageType: 'Fire' }))
      .toEqual({ disadvantage: true, source: 'War_Cleric' });
  });

  it('gridless tokens (no positions) stay lenient', () => {
    seed();
    const mapData = {
      players: [{ name: 'War_Cleric' }],
      placedItems: [{ name: 'Bandit 1', type: 'npc' }],
    };

    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: CAMPAIGN, mapData, damageType: 'Fire' }))
      .toEqual({ disadvantage: true, source: 'War_Cleric' });
  });
});
