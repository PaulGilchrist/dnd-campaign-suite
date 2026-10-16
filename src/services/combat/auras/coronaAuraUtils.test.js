// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => false),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCombatContext: vi.fn(async () => null),
}));

import { getCoronaSaveDisadvantage, getCoronaSaveDisadvantageSync } from './coronaAuraUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatSummary, getCombatContext } from '../../encounters/combatData.js';

// Corona (source semantics): a non-target player holding an 'sunlight_aura' activeBuff
// imposes save disadvantage on a target listed in their 'coronaOfLightEnemies' when the
// damageType is in the buff's enemiesDisadvantageSaves (case-normalized). Grid lane
// measures range via isWithinRange (buff.distance parsed, default 60 ft); the CLA-063
// skipRangeCheck lane is gridless and pulls players from the cached combat summary.
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
  ])('returns false with no grid (%s) and never consults the combat summary without skipRangeCheck', async (_label, mapData) => {
    seed({ buffs: { Paladin: [corona()] }, inRange: true });

    expect(await getCoronaSaveDisadvantage({ targetName: 'Target', campaignName: CAMPAIGN, mapData, damageType: 'Fire' }))
      .toEqual({ disadvantage: false });
    expect(getCombatSummary).not.toHaveBeenCalled();
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

// ── CLA-063: skipRangeCheck gridless lane — participants come from the combat
// summary cache (cold-cache falls back to one awaited context fetch). ──
describe('getCoronaSaveDisadvantage — skipRangeCheck gridless lane (CLA-063)', () => {
  beforeEach(resetMocks);

  function seed({ enemies = ['Bandit 1'], summary = makeSummary() } = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
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

    expect(await getCoronaSaveDisadvantage({ targetName: 'Bandit 1', campaignName: CAMPAIGN, damageType, skipRangeCheck: true }))
      .toEqual(expected);
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('never measures range even when mapData players are present, and skips the summary entirely', async () => {
    seed();
    getCombatSummary.mockReturnValue(null);

    expect(await getCoronaSaveDisadvantage({
      targetName: 'Bandit 1',
      campaignName: CAMPAIGN,
      mapData: grid('War_Cleric', 'Bandit 1'),
      damageType: 'Fire',
      skipRangeCheck: true,
    })).toEqual({ disadvantage: true, source: 'War_Cleric' });
    expect(isWithinRange).not.toHaveBeenCalled();
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it('falls back to one combat-context fetch when the summary cache is cold', async () => {
    seed({ summary: null });
    getCombatContext.mockResolvedValue(makeSummary());

    expect(await getCoronaSaveDisadvantage({ targetName: 'Bandit 1', campaignName: CAMPAIGN, damageType: 'Fire', skipRangeCheck: true }))
      .toEqual({ disadvantage: true, source: 'War_Cleric' });
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
  });
});

// ── CLA-063: sync lane for save consumers that cannot await (aoeService). ──
describe('getCoronaSaveDisadvantageSync (CLA-063)', () => {
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

    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: CAMPAIGN, mapData, damageType, skipRangeCheck: true }))
      .toEqual(expected);
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it('stays conservative-false without skipRangeCheck (cannot measure range sync)', () => {
    seed();

    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: CAMPAIGN, damageType: 'Fire' }))
      .toEqual({ disadvantage: false });
  });
});
