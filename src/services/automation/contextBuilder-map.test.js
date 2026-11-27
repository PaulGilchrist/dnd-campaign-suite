// @maintained-by-ai 2026-11-26
// ── contextBuilder MAP lane: buildAttackContext with a mapName ─────────
// Owns the whole map lane of contextBuilder-map.js: sync delegation,
// map/NPC loading, target-position resolution, range + improved-illusion
// effective range, melee proximity, aura accumulation, and the FULL cover
// lane (computeCover → Sharpshooter ignore → half-cover grants → Defensive
// Duelist → bait-and-switch → finalizeCover).
//
// Absorbs the former contextBuilder-cover.test.js bait-and-switch tests
// (that file is a redundant duplicate — recommend deletion to the
// orchestrator). Assertion-identical pairs ride it.each tables.
//
// Lane notes (do not confuse these cover implementations):
// - common/damageRoll.js computeMapAwareContext is a separate, simpler
//   cover path tested in common/buildAttackContext-map.test.js — not here.
//
// Envelope honesty (#1181): loadNPCs is mocked but resolves the REAL wire
// envelope { npcs: [...] } (server GET /api/campaigns/:campaign/npcs,
// jsonEntityCrud.js:49 responseWrapper) — a bare-array mock hid the
// envelope-vs-array TypeError at contextBuilder-map.js applyMeleeProximity.
// The melee-proximity table test behavior-gates on the filtered threats, so
// the crash regresses as a missing forcedMode, not a mock-call failure.
// Teardown hygiene (#1181): this lane stubs NO global fetch (all transport
// is vi.mock'd above) — no afterEach vi.unstubAllGlobals pairing needed.
//
// Mock-call assertions survive ONLY where the argument IS the observable
// contract (position fed to computeCover, opts mode fed to aura utils,
// effective range fed to computeRangeEffect). Everything else asserts the
// final context; guards like "cover skipped on auto-miss" prove themselves
// by a live computeCover return that never reaches the context.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContext } from './contextBuilder.js';
import { getCombatContext, getTargetFromAttacker } from '../rules/combat/damageUtils.js';
import { buildBaseAttackContext } from './common/damageRoll.js';
import { loadMapData } from '../maps/mapsService.js';
import { loadNPCs } from '../npcs/npcsService.js';
import {
  computeRangeEffect,
  computeMeleeProximityEffect,
  getDistanceFeet,
  isHostileNPC,
  getNearestPlacedItem,
  rangeToFeet,
} from '../rules/combat/rangeValidation.js';
import { computeCover } from '../rules/combat/coverService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../combat/buffs/buffService.js';
import { getWolfAdvantageAgainst } from '../combat/auras/wolfAuraUtils.js';
import { getDuplicityAdvantageAgainst } from '../combat/auras/duplicityAuraUtils.js';
import { getLionDisadvantageAgainst } from '../combat/auras/lionAuraUtils.js';
import { getCoronaSaveDisadvantage } from '../combat/auras/coronaAuraUtils.js';
import { hasAuraOfProtection } from '../combat/auras/auraOfProtection.js';
import { isActive, isAuraTarget } from './handlers/class-cleric-paladin/avengingAngelHandler.js';
import { mockStats, mockRangedAttack, makeCombatContext, makeMapData } from './contextBuilder-map.test-utils.js';

vi.mock('./common/damageRoll.js', () => ({ buildBaseAttackContext: vi.fn() }));
vi.mock('../rules/combat/damageUtils.js', () => ({ getCombatContext: vi.fn(), getTargetFromAttacker: vi.fn() }));
vi.mock('../maps/mapsService.js', () => ({ loadMapData: vi.fn() }));
vi.mock('../rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(), computeMeleeProximityEffect: vi.fn(), getDistanceFeet: vi.fn(),
  isHostileNPC: vi.fn(), getNearestPlacedItem: vi.fn(), rangeToFeet: vi.fn(),
}));
vi.mock('../rules/combat/rangeCheck.js', () => ({ isWithinRange: vi.fn().mockResolvedValue(true) }));
vi.mock('../rules/combat/coverService.js', () => ({ computeCover: vi.fn() }));
vi.mock('../npcs/npcsService.js', () => ({ loadNPCs: vi.fn() }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()), useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(), getRuntimeValue: vi.fn(), setRuntimeValue: vi.fn(),
}));
vi.mock('../combat/buffs/buffService.js', () => ({ getInnateSorceryBonus: vi.fn() }));
vi.mock('../combat/auras/wolfAuraUtils.js', () => ({ getWolfAdvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/duplicityAuraUtils.js', () => ({ getDuplicityAdvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/lionAuraUtils.js', () => ({ getLionDisadvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/coronaAuraUtils.js', () => ({ getCoronaSaveDisadvantage: vi.fn() }));
vi.mock('../combat/auras/auraOfProtection.js', () => ({ hasAuraOfProtection: vi.fn() }));
vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
  isActive: vi.fn(), isAuraTarget: vi.fn(), handle: vi.fn(),
}));

function setupDefaults() {
  buildBaseAttackContext.mockResolvedValue({ target: { name: 'Orc' }, targetName: 'Orc', resistanceNotice: null });
  loadMapData.mockResolvedValue(null);
  // Real wire envelope from GET /api/campaigns/:campaign/npcs (jsonEntityCrud.js:49) (#1181).
  loadNPCs.mockResolvedValue({ npcs: [] });
  rangeToFeet.mockImplementation((r) => (typeof r === 'number' ? r : 5));
  getRuntimeValue.mockReturnValue(undefined);
  setRuntimeValue.mockReturnValue(undefined);
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  hasAuraOfProtection.mockReturnValue(false);
  isActive.mockReturnValue(false);
  isAuraTarget.mockReturnValue(false);
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  getCombatContext.mockResolvedValue(null);
  getTargetFromAttacker.mockReturnValue(null);
  getDistanceFeet.mockReturnValue(5);
  computeRangeEffect.mockReturnValue({ mode: 'ok' });
  computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
  computeMeleeProximityEffect.mockReturnValue({ mode: 'ok' });
  getNearestPlacedItem.mockReturnValue(null);
  isHostileNPC.mockReturnValue(false);
}

// Full-lane fixture: attacker Fighter1 (1,1) on the map, target resolved via
// combat context + nearest placed item at (gridX, gridY).
function setupMapPathWithTarget(targetName, gridX, gridY) {
  loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
  getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', targetName, gridX, gridY));
  getTargetFromAttacker.mockReturnValue({ name: targetName, gridX, gridY });
  getNearestPlacedItem.mockReturnValue({ name: targetName, gridX, gridY });
  getDistanceFeet.mockReturnValue(50);
}

// The standard cover/aura/range stage: Fighter1 (1,1) firing at a placed
// Orc (10,10) so range, cover and proximity lanes all run.
function setupTargetOnMap(npc = { name: 'Orc', gridX: 10, gridY: 10 }) {
  setupMapPathWithTarget(npc.name, npc.gridX, npc.gridY);
  loadMapData.mockResolvedValue(makeMapData(
    [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
    [npc],
  ));
}

// Route runtime lookups by "entity:key" (getRuntimeValue(entity, key, campaign)).
function mockRuntimeKeys(map) {
  getRuntimeValue.mockImplementation((entity, key) => map[`${entity}:${key}`]);
}

function statsWith(passives) {
  return { ...mockStats, automation: { passives } };
}

const SHARPSHOOTER = [{ type: 'passive_rule', effect: 'ignore_cover_ranged' }];

function buildAttack(attack = mockRangedAttack, playerStats = mockStats, featRangeEffects = {}) {
  return buildAttackContext({ attack, playerStats, campaignName: 'camp', mapName: 'test-map', conditionAttackMode: 'normal', featRangeEffects });
}

describe('contextBuilder: buildAttackContext (map-based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  describe('no map name — delegates to sync path', () => {
    it('returns the sync context untouched and loads no map data', async () => {
      for (const mapName of [null, undefined]) {
        const result = await buildAttackContext({ attack: mockRangedAttack, playerStats: mockStats, campaignName: 'camp', mapName, conditionAttackMode: 'normal', featRangeEffects: {} });
        expect(result.targetName).toBe('Orc');
      }
      expect(loadMapData).not.toHaveBeenCalled();
    });
  });

  describe('map data loading', () => {
    it('fetches map and NPC data for the campaign when mapName is provided', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      await buildAttack();
      expect(loadMapData).toHaveBeenCalledWith('camp', 'test-map');
      expect(loadNPCs).toHaveBeenCalledWith('camp');
    });

    it('returns base context when attacker is not found on map', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Other', gridX: 1, gridY: 1 }]));
      const result = await buildAttack();
      expect(result.targetName).toBe('Orc');
      expect(computeCover).not.toHaveBeenCalled();
    });

    it('returns base context for degraded map and combat inputs', async () => {
      // null map data, players-less map data, and a rejected map load all
      // resolve to the sync base context; so does a rejected combat context
      // (the outer .catch(() => basePromise) of buildAttackContext).
      loadMapData.mockResolvedValue(null);
      expect((await buildAttack()).targetName).toBe('Orc');
      loadMapData.mockResolvedValue({});
      expect((await buildAttack()).targetName).toBe('Orc');
      loadMapData.mockRejectedValue(new Error('map load failed'));
      expect((await buildAttack()).targetName).toBe('Orc');
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      getCombatContext.mockRejectedValue(new Error('combat context failed'));
      expect((await buildAttack()).targetName).toBe('Orc');
    });
  });

  describe('range effects', () => {
    it('marks attack as auto miss when range effect returns miss', async () => {
      setupTargetOnMap();
      computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });
      const result = await buildAttack();
      expect(result.isAutoMiss).toBe(true);
      expect(result.rangeReason).toBe('Out of range');
      expect(result.forcedMode).toBeUndefined();
    });

    it('sets disadvantage when range effect returns disadvantage', async () => {
      setupTargetOnMap();
      computeRangeEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Long range' });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('disadvantage');
      expect(result.rangeReason).toBe('Long range');
    });
  });

  describe('effective range fed to computeRangeEffect', () => {
    const ILLUSIONS = [{ type: 'improved_illusions' }];

    it.each([
      ['Illusion spell with range 10+ feet gets +60', { ...mockRangedAttack, damage: '1d4', damageType: 'Force', range: 120, school: 'Illusion' }, ILLUSIONS, {}, 180],
      ['non-Illusion spell gets no illusion bonus', { ...mockRangedAttack, school: 'Evocation' }, ILLUSIONS, {}, 150],
      ['Illusion spell under 10 feet gets no bonus', { ...mockRangedAttack, range: 5, school: 'Illusion' }, ILLUSIONS, {}, 5],
      ['feat spellRangeBonus stacks on improved illusions', { ...mockRangedAttack, damage: '1d4', damageType: 'Force', range: 120, school: 'Illusion' }, ILLUSIONS, { spellRangeBonus: 30 }, 210],
      ['spellRangeBonus applies to plain weapon attacks too', mockRangedAttack, [], { rangeMultiplier: 1, spellRangeBonus: 10 }, 160],
    ])('%s', async (_label, attack, passives, featRangeEffects, expectedRange) => {
      setupTargetOnMap();
      await buildAttack(attack, statsWith(passives), featRangeEffects);
      expect(computeRangeEffect).toHaveBeenCalledWith(expectedRange, expect.any(Number), expect.any(Object));
    });

    it('resolves missing featRangeEffects to defaults without crashing', async () => {
      setupTargetOnMap();
      for (const featRangeEffects of [undefined, null]) {
        await buildAttackContext({ attack: mockRangedAttack, playerStats: mockStats, campaignName: 'camp', mapName: 'test-map', conditionAttackMode: 'normal', featRangeEffects });
        expect(computeRangeEffect).toHaveBeenCalledWith(150, expect.any(Number), expect.any(Object));
      }
    });
  });

  describe('cover calculations', () => {
    // ── Sharpshooter: ranged WEAPON attacks ignore half/three-quarters only ──

    it.each(['half', 'threeQuarter'])(
      'ignores %s cover for ranged weapon attacks with ignore_cover_ranged passive',
      async (level) => {
        setupTargetOnMap();
        computeCover.mockReturnValue({ level, acBonus: level === 'half' ? 2 : 5 });
        const result = await buildAttack(mockRangedAttack, statsWith(SHARPSHOOTER));
        expect(result.coverAcBonus).toBeUndefined();
        expect(result.isAutoMiss).toBeUndefined();
        expect(result.coverReason).toBe('Sharpshooter');
      },
    );

    it('does not ignore full cover for ranged weapon attacks with ignore_cover_ranged passive', async () => {
      setupTargetOnMap();
      computeCover.mockReturnValue({ level: 'full', acBonus: null });
      const result = await buildAttack(mockRangedAttack, statsWith(SHARPSHOOTER));
      expect(result.isAutoMiss).toBe(true);
      expect(result.coverReason).toBe('Target has full cover');
    });

    it('respects coverTypes metadata on the ignore_cover_ranged passive', async () => {
      setupTargetOnMap();
      computeCover.mockReturnValue({ level: 'threeQuarter', acBonus: 5 });
      const stats = statsWith([{ type: 'passive_rule', effect: 'ignore_cover_ranged', coverTypes: ['Half'] }]);
      const result = await buildAttack(mockRangedAttack, stats);
      expect(result.coverAcBonus).toBe(5);
      expect(result.coverLevel).toBe('threeQuarter');
    });

    // ── Baseline application and auto-miss / unresolved-position guards ──

    it('applies cover AC bonus when cover is not none and not full', async () => {
      setupTargetOnMap();
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
    });

    it('does not apply cover when attack is auto miss from range', async () => {
      setupTargetOnMap();
      computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      const result = await buildAttack();
      expect(result.isAutoMiss).toBe(true);
      // A live half-cover return that never reaches the context proves the
      // cover lane was skipped (no mock-call assertion needed).
      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not apply cover when target position cannot be resolved', async () => {
      setupTargetOnMap();
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      // Branch 1: no combat context at all.
      getCombatContext.mockResolvedValue(null);
      expect((await buildAttack()).coverAcBonus).toBeUndefined();
      // Branch 2: combat context exists but no target from attacker.
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue(null);
      expect((await buildAttack()).coverAcBonus).toBeUndefined();
    });

    // ── Sharpshooter is ranged-WEAPON only: other attack shapes keep cover ──

    it.each([
      ['melee weapon', { ...mockRangedAttack, weaponType: 'melee', range: 5 }, 'half', 2],
      ['melee spell', { name: 'Inflict Wounds', damage: '3d10', damageType: 'Necrotic', hitBonus: 7, weaponType: 'melee', range: 5, school: 'Necromancy' }, 'threeQuarter', 5],
      ['ranged spell', { name: 'Fire Bolt', damage: '4d10', damageType: 'Fire', hitBonus: 9, range: 120, school: 'Evocation' }, 'half', 2],
    ])('applies cover for %s attacks even when ignore_cover_ranged passive exists', async (_label, attack, level, acBonus) => {
      setupTargetOnMap();
      computeCover.mockReturnValue({ level, acBonus });
      const result = await buildAttack(attack, statsWith(SHARPSHOOTER));
      expect(result.coverAcBonus).toBe(acBonus);
      expect(result.coverLevel).toBe(level);
    });

    // ── Half-cover grants: Nature's Sanctuary / Bulwark of Force / Smite of Protection ──

    it.each([
      ["Nature's Sanctuary", 'half cover to listed creatures', () => mockRuntimeKeys({ 'Fighter1:naturesSanctuaryCreatures': ['Orc'] })],
      ['Bulwark of Force', 'half cover to its marked targets', () => mockRuntimeKeys({ 'Fighter1:bulwarkOfForceActive': true, 'Fighter1:bulwarkOfForceTargets': ['Orc'] })],
      ['Smite of Protection', 'half cover while attacker aura covers the target', () => { hasAuraOfProtection.mockReturnValue(true); mockRuntimeKeys({ 'Fighter1:smiteOfProtectionActive': true }); }],
    ])('%s grants %s', async (reason, _blurb, arrange) => {
      setupTargetOnMap();
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      arrange();
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
      expect(result.coverReason).toBe(reason);
    });

    it('does not override real cover with a half-cover grant', async () => {
      setupTargetOnMap();
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      mockRuntimeKeys({ 'Fighter1:naturesSanctuaryCreatures': ['Orc'] });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
      expect(result.coverReason).toBeUndefined();
    });

    it('does not grant cover when the runtime keys do not match the target', async () => {
      setupTargetOnMap();
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      mockRuntimeKeys({
        'Fighter1:naturesSanctuaryCreatures': ['Troll'],
        'Fighter1:bulwarkOfForceActive': true,
        'Fighter1:bulwarkOfForceTargets': ['Troll'],
      });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBeUndefined();
      expect(result.coverLevel).toBeUndefined();
    });

    // ── Furniture cover names its source (backlog 2026-11-21 EEE) ──
    // computeCover stamps sourceLabel on the half/¾ furniture tiers
    // (rules/combat/coverService.js pins the label law); finalizeCover rides
    // it into coverReason so a barrel row is distinguishable from a grant row.

    it.each([
      [{ level: 'half', acBonus: 2, sourceLabel: 'Barrel' }],
      [{ level: 'threeQuarter', acBonus: 5, sourceLabel: 'Altar' }],
    ])('names the covering furniture item in coverReason', async (cover) => {
      setupTargetOnMap();
      computeCover.mockReturnValue(cover);
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(cover.acBonus);
      expect(result.coverLevel).toBe(cover.level);
      expect(result.coverReason).toBe(cover.sourceLabel);
    });

    it('keeps the furniture source label when bait-and-switch raises the AC bonus', async () => {
      setupTargetOnMap();
      computeCover.mockReturnValue({ level: 'half', acBonus: 2, sourceLabel: 'Barrel' });
      mockRuntimeKeys({ 'Orc:baitAndSwitchActive': true, 'Orc:baitAndSwitchBonus': 5 });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(5);
      expect(result.coverReason).toBe('Barrel');
    });

    // ── Defensive Duelist (2024): proficiency floor on AC bonus ──

    it.each([
      [{ level: 'none', acBonus: 0 }, mockStats.proficiency, 'none'],
      [{ level: 'threeQuarter', acBonus: 5 }, 5, 'threeQuarter'],
    ])('Defensive Duelist raises to the proficiency floor but never lowers computed cover', async (cover, expectedBonus, expectedLevel) => {
      setupTargetOnMap();
      computeCover.mockReturnValue(cover);
      mockRuntimeKeys({ 'Orc:activeBuffs': [{ effect: 'defensive_duelist' }] });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(expectedBonus);
      expect(result.coverLevel).toBe(expectedLevel);
    });

    // ── Bait and Switch (2024): raises AC bonus, never lowers it ──
    // (consolidated from the retired contextBuilder-cover.test.js)

    it.each([
      ['half', { level: 'half', acBonus: 2 }, 5, 5, 'half'],
      ['threeQuarter', { level: 'threeQuarter', acBonus: 5 }, 2, 5, 'threeQuarter'],
      ['none', { level: 'none', acBonus: 0 }, 5, 5, 'none'],
    ])('bait-and-switch raises AC bonus over %s cover (never lowers)', async (_level, cover, storedBonus, expectedBonus, expectedLevel) => {
      setupTargetOnMap();
      computeCover.mockReturnValue(cover);
      mockRuntimeKeys({ 'Orc:baitAndSwitchActive': true, 'Orc:baitAndSwitchBonus': storedBonus });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(expectedBonus);
      expect(result.coverLevel).toBe(expectedLevel);
      // Furniture-less bonus faces carry no coverReason.
      expect(result.coverReason).toBeUndefined();
    });
  });

  describe('melee proximity disadvantage', () => {
    // type:'npc' is required to reach the npcs lookup inside applyMeleeProximity (#1181).
    it('sets disadvantage when firing in melee range of hostile NPC', async () => {
      setupTargetOnMap({ type: 'npc', name: 'Orc', gridX: 10, gridY: 10 });
      isHostileNPC.mockReturnValue(true);
      computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Firing in melee' });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('disadvantage');
      expect(result.rangeReason).toBe('Firing in melee');
    });

    it('skips melee proximity check when attack is auto miss', async () => {
      setupTargetOnMap({ type: 'npc', name: 'Orc', gridX: 10, gridY: 10 });
      isHostileNPC.mockReturnValue(true);
      computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });
      computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Firing in melee' });
      const result = await buildAttack();
      expect(result.isAutoMiss).toBe(true);
      // Had the proximity check run, _meleeDis would tip resolveMapMode to
      // disadvantage — forcedMode staying empty proves the skip.
      expect(result.forcedMode).toBeUndefined();
    });

    it('enriches placed NPCs from the npcs envelope and passes only hostile threats to the proximity check', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [
          { type: 'npc', name: 'Friendly', gridX: 2, gridY: 2 },
          { type: 'npc', name: 'Hostile', gridX: 3, gridY: 3 },
        ],
      ));
      // ENVELOPE-FIXTURE pin (#1181): GET /api/campaigns/:campaign/npcs resolves
      // { npcs:[...] } (jsonEntityCrud.js:49) — the old bare-array mock hid the
      // npcs?.find TypeError in applyMeleeProximity (contextBuilder-map.js),
      // which now regresses as a missing forcedMode.
      loadNPCs.mockResolvedValue({
        npcs: [
          { name: 'Friendly', attitude: 'friendly' },
          { name: 'Hostile', attitude: 'negative' },
        ],
      });
      isHostileNPC.mockImplementation((npc) => npc.attitude === 'negative');
      // Behavior gate: disadvantage only when the threat list holds exactly
      // the hostile NPC at its map coordinates.
      computeMeleeProximityEffect.mockImplementation((_flag, _attacker, threats) =>
        threats.length === 1 && threats[0].name === 'Hostile' && threats[0].gridX === 3 && threats[0].gridY === 3
          ? { mode: 'disadvantage', reason: 'Firing in melee' }
          : { mode: 'ok' });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('disadvantage');
      expect(result.rangeReason).toBe('Firing in melee');
    });
  });

  describe('target position resolution', () => {
    // Position precedence is only observable through the coordinates fed to
    // computeCover — that argument IS the seam contract here.
    it('resolves player target position from map players (not placed items)', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 12, gridY: 12 }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      const result = await buildAttack();
      expect(result.targetName).toBe('Orc');
      expect(getNearestPlacedItem).not.toHaveBeenCalled();
      // Cover rides the map-player coords (12,12), not the combat-context coords.
      expect(computeCover).toHaveBeenCalledWith(
        { gridX: 1, gridY: 1 }, { gridX: 12, gridY: 12 }, expect.any(Set), [],
      );
    });

    it('resolves NPC target position from nearest placed item', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 11, gridY: 11, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 11, gridY: 11 });
      const result = await buildAttack();
      expect(result.targetName).toBe('Orc');
      expect(getNearestPlacedItem).toHaveBeenCalledWith(
        expect.any(Array), 'Orc', expect.objectContaining({ gridX: 1, gridY: 1 }),
      );
      // Cover is computed from the placed-item position (11,11), not the combat-context coords.
      expect(computeCover).toHaveBeenCalledWith(
        { gridX: 1, gridY: 1 }, { gridX: 11, gridY: 11 }, expect.any(Set), expect.any(Array),
      );
    });
  });

  describe('aura effects with map data — target position resolved', () => {
    it('threads the resolved targetPos and mapData into the wolf aura check', async () => {
      setupTargetOnMap();
      getWolfAdvantageAgainst.mockImplementation((opts) => (opts.targetPos ? { advantage: true } : { advantage: false }));
      const result = await buildAttack();
      expect(result.forcedMode).toBe('advantage');
      expect(getWolfAdvantageAgainst).toHaveBeenCalledWith(
        expect.objectContaining({ targetPos: { gridX: 10, gridY: 10 }, targetName: 'Orc', mapData: expect.any(Object) }),
      );
    });

    it.each([
      ['duplicity aura advantage', () => getDuplicityAdvantageAgainst.mockReturnValue({ advantage: true }), 'advantage'],
      ['lion aura disadvantage', () => getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true }), 'disadvantage'],
      ['protection target effect on the target', () => getRuntimeValue.mockImplementation((entity, key) =>
        key === 'targetEffects' ? [{ effect: 'protection', target: 'Orc', source: 'Paladin' }] : undefined), 'disadvantage'],
      ['advantage outweighs disadvantage when wolf and lion both apply', () => {
        getWolfAdvantageAgainst.mockReturnValue({ advantage: true });
        getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });
      }, 'advantage'],
    ])('map auras: %s sets forcedMode', async (_label, arrange, expected) => {
      setupTargetOnMap();
      arrange();
      const result = await buildAttack();
      expect(result.forcedMode).toBe(expected);
    });

    it('corona is NEVER counted into mapDis on the attack lane (save-only effect)', async () => {
      setupTargetOnMap();
      // bug-corona-save-disadv-applied-to-attack-roll: accumulateAuraCounts used
      // to tax the ATTACK roll when the weapon's own damageType matched the
      // corona buff's enemiesDisadvantageSaves. Corona rides the SAVE lane only
      // (handleNpcSaveDamage / handlePlayerSaveDamage / aoeService / DivineSparkModal).
      getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true, source: 'ElderPaladin' });
      const result = await buildAttack();
      expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled();
      expect(result.forcedMode).toBeUndefined();
    });
  });

  describe('aura effects with map data — no target position', () => {
    it('falls back to no-map aura checks when target position is null', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      getCombatContext.mockResolvedValue(null);
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('advantage');
      expect(getWolfAdvantageAgainst).toHaveBeenCalledWith(
        expect.objectContaining({ skipRangeCheck: true, targetName: 'Orc' }),
      );
    });
  });
});
