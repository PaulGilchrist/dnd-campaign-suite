// @maintained-by-ai
// ── contextBuilder MAP lane: buildAttackContext with a mapName ─────────
// Owns the whole map lane of contextBuilder-map.js: sync delegation,
// map/NPC loading, target-position resolution, range + improved-illusion
// range, melee proximity, aura accumulation, and the FULL cover lane
// (computeCover → Sharpshooter ignore → half-cover grants → Defensive
// Duelist → bait-and-switch → finalizeCover).
//
// Absorbs the former contextBuilder-cover.test.js bait-and-switch tests
// (that file is now redundant — recommend deletion to the orchestrator).
// Fully mocked and deterministic; only a rename/removal of a mocked
// collaborator in contextBuilder-map.js forces a mechanical update here.
//
// Lane notes (do not confuse these cover implementations):
// - common/damageRoll.js computeMapAwareContext is a separate, simpler
//   cover path tested in common/buildAttackContext-map.test.js — not here.
//
// Envelope honesty (#1181): loadNPCs is mocked but resolves the REAL wire
// envelope { npcs: [...] } (server GET /api/campaigns/:campaign/npcs,
// jsonEntityCrud.js:49 responseWrapper) — a bare-array mock hid the
// envelope-vs-array TypeError at contextBuilder-map.js applyMeleeProximity.
// Teardown hygiene (#1181): this lane stubs NO global fetch (all transport
// is vi.mock'd above) — no afterEach vi.unstubAllGlobals pairing needed.

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

function setupMapPathWithTarget(targetName, gridX, gridY) {
  loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
  getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', targetName, gridX, gridY));
  getTargetFromAttacker.mockReturnValue({ name: targetName, gridX, gridY });
  getNearestPlacedItem.mockReturnValue({ name: targetName, gridX, gridY });
  getDistanceFeet.mockReturnValue(50);
}

// Helper to create NPC map data with placed items
function makeMapDataWithNPCs(players, npcs) {
  return makeMapData(
    players || [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
    npcs || []
  );
}

// Route runtime lookups by "entity:key" (getRuntimeValue(entity, key, campaign)).
function mockRuntimeKeys(map) {
  getRuntimeValue.mockImplementation((entity, key) => map[`${entity}:${key}`]);
}

function buildAttack(attack = mockRangedAttack, playerStats = mockStats, featRangeEffects = {}) {
  return buildAttackContext({ attack, playerStats, campaignName: 'camp', mapName: 'test-map', conditionAttackMode: 'normal', featRangeEffects });
}

describe('contextBuilder: buildAttackContext (map-based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  describe('no map name — delegates to sync path', () => {
    it('returns base attack context when mapName is null or undefined', async () => {
      let result = await buildAttackContext({ attack: mockRangedAttack, playerStats: mockStats, campaignName: 'camp', mapName: null, conditionAttackMode: 'normal', featRangeEffects: {} });
      expect(result.targetName).toBe('Orc');
      expect(result.attackerName).toBe('Fighter1');
      expect(result.damageType).toBe('Piercing');
      expect(result.isMelee).toBe(false);
      result = await buildAttackContext({ attack: mockRangedAttack, playerStats: mockStats, campaignName: 'camp', mapName: undefined, conditionAttackMode: 'normal', featRangeEffects: {} });
      expect(result.targetName).toBe('Orc');
      expect(loadMapData).not.toHaveBeenCalled();
    });
  });

  describe('map data loading', () => {
    it('loads map data and NPC data when mapName is provided', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      await buildAttack('Longbow');
      expect(loadMapData).toHaveBeenCalledWith('camp', 'test-map');
      expect(loadNPCs).toHaveBeenCalledWith('camp');
    });

    it('returns base context when attacker is not found on map', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Other', gridX: 1, gridY: 1 }]));
      const result = await buildAttack();
      expect(result.targetName).toBe('Orc');
      expect(computeCover).not.toHaveBeenCalled();
    });

    it('returns base context when map data is null or has no players array', async () => {
      let result = await buildAttack(); // loadMapData defaults to null
      expect(result.targetName).toBe('Orc');
      loadMapData.mockResolvedValue({});
      result = await buildAttack();
      expect(result.targetName).toBe('Orc');
    });

    it('handles map loading rejection gracefully', async () => {
      loadMapData.mockRejectedValue(new Error('map load failed'));
      const result = await buildAttack();
      expect(result.targetName).toBe('Orc');
    });

    it('handles getCombatContext rejection gracefully', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      getCombatContext.mockRejectedValue(new Error('combat context failed'));
      const result = await buildAttack();
      expect(result.targetName).toBe('Orc');
    });
  });

  describe('range effects', () => {
    it('marks attack as auto miss when range effect returns miss', async () => {
      setupMapPathWithTarget('Orc', 10, 10);
      loadMapData.mockResolvedValue(makeMapDataWithNPCs(null, [{ name: 'Orc', gridX: 10, gridY: 10 }]));
      computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });
      const result = await buildAttack();
      expect(result.isAutoMiss).toBe(true);
      expect(result.rangeReason).toBe('Out of range');
      expect(result.forcedMode).toBeUndefined();
    });

    it('sets disadvantage when range effect returns disadvantage', async () => {
      setupMapPathWithTarget('Orc', 10, 10);
      loadMapData.mockResolvedValue(makeMapDataWithNPCs(null, [{ name: 'Orc', gridX: 10, gridY: 10 }]));
      computeRangeEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Long range' });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('disadvantage');
      expect(result.rangeReason).toBe('Long range');
    });
  });

  describe('cover calculations', () => {
    // Puts attacker (1,1) and a placed-NPC target Orc (10,10) on the map so
    // the full cover lane (applyCoverModifiers) runs.
    function setupCoverTest() {
      setupMapPathWithTarget('Orc', 10, 10);
      loadMapData.mockResolvedValue(makeMapDataWithNPCs(null, [{ name: 'Orc', gridX: 10, gridY: 10 }]));
    }

    // ── Sharpshooter: ranged WEAPON attacks ignore half/three-quarters only ──

    it('ignores half cover for ranged weapon attacks with ignore_cover_ranged passive', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      const stats = { ...mockStats, automation: { passives: [{ type: 'passive_rule', effect: 'ignore_cover_ranged' }] } };
      const result = await buildAttack(mockRangedAttack, stats);
      expect(result.coverAcBonus).toBeUndefined();
      expect(result.isAutoMiss).toBeUndefined();
      expect(result.coverReason).toBe('Sharpshooter');
    });

    it('ignores three-quarter cover for ranged weapon attacks with ignore_cover_ranged passive', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'threeQuarter', acBonus: 5 });
      const stats = { ...mockStats, automation: { passives: [{ type: 'passive_rule', effect: 'ignore_cover_ranged' }] } };
      const result = await buildAttack(mockRangedAttack, stats);
      expect(result.coverAcBonus).toBeUndefined();
      expect(result.isAutoMiss).toBeUndefined();
      expect(result.coverReason).toBe('Sharpshooter');
    });

    it('does not ignore full cover for ranged weapon attacks with ignore_cover_ranged passive', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'full', acBonus: null });
      const stats = { ...mockStats, automation: { passives: [{ type: 'passive_rule', effect: 'ignore_cover_ranged' }] } };
      const result = await buildAttack(mockRangedAttack, stats);
      expect(result.isAutoMiss).toBe(true);
      expect(result.coverReason).toBe('Target has full cover');
    });

    it('respects coverTypes metadata on the ignore_cover_ranged passive', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'threeQuarter', acBonus: 5 });
      const stats = { ...mockStats, automation: { passives: [{ type: 'passive_rule', effect: 'ignore_cover_ranged', coverTypes: ['Half'] }] } };
      const result = await buildAttack(mockRangedAttack, stats);
      expect(result.coverAcBonus).toBe(5);
      expect(result.coverLevel).toBe('threeQuarter');
    });

    // ── Baseline application and auto-miss guard ──

    it('applies cover AC bonus when cover is not none and not full', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
    });

    it('does not apply cover when attack is auto miss from range', async () => {
      setupCoverTest();
      computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      const result = await buildAttack();
      expect(result.isAutoMiss).toBe(true);
      expect(result.coverAcBonus).toBeUndefined();
      expect(computeCover).not.toHaveBeenCalled();
    });

    it('does not apply cover when target position cannot be resolved', async () => {
      // Branch 1: no combat context at all.
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      getCombatContext.mockResolvedValue(null);
      await buildAttack();
      expect(computeCover).not.toHaveBeenCalled();
      // Branch 2: combat context exists but no target from attacker.
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue(null);
      await buildAttack();
      expect(computeCover).not.toHaveBeenCalled();
    });

    // ── Melee attacks always keep cover (Sharpshooter is ranged-only) ──

    it('applies cover for melee attacks even when ignore_cover_ranged passive exists', async () => {
      setupCoverTest();
      const stats = { ...mockStats, automation: { passives: [{ type: 'passive_rule', effect: 'ignore_cover_ranged' }] } };
      const meleeWeapon = { ...mockRangedAttack, weaponType: 'melee', range: 5 };
      const meleeSpell = { name: 'Inflict Wounds', damage: '3d10', damageType: 'Necrotic', hitBonus: 7, weaponType: 'melee', range: 5, school: 'Necromancy' };

      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      let result = await buildAttack(meleeWeapon, stats);
      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');

      computeCover.mockReturnValue({ level: 'threeQuarter', acBonus: 5 });
      result = await buildAttack(meleeSpell, stats);
      expect(result.coverAcBonus).toBe(5);
      expect(result.coverLevel).toBe('threeQuarter');
    });

    it('applies cover for ranged spell attacks even when ignore_cover_ranged passive exists', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      const rangedSpellAttack = { name: 'Fire Bolt', damage: '4d10', damageType: 'Fire', hitBonus: 9, range: 120, school: 'Evocation' };
      const stats = { ...mockStats, automation: { passives: [{ type: 'passive_rule', effect: 'ignore_cover_ranged' }] } };
      const result = await buildAttack(rangedSpellAttack, stats);
      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
    });

    // ── Half-cover grants: Nature's Sanctuary / Bulwark of Force / Smite of Protection ──

    it("Nature's Sanctuary grants half cover to listed creatures", async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      mockRuntimeKeys({ 'Fighter1:naturesSanctuaryCreatures': ['Orc'] });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
      expect(result.coverReason).toBe("Nature's Sanctuary");
    });

    it('Bulwark of Force grants half cover to its marked targets', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      mockRuntimeKeys({
        'Fighter1:bulwarkOfForceActive': true,
        'Fighter1:bulwarkOfForceTargets': ['Orc'],
      });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
      expect(result.coverReason).toBe('Bulwark of Force');
    });

    it('Smite of Protection grants half cover while attacker aura covers the target', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      hasAuraOfProtection.mockReturnValue(true);
      mockRuntimeKeys({ 'Fighter1:smiteOfProtectionActive': true });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
      expect(result.coverReason).toBe('Smite of Protection');
    });

    it('does not override real cover with a half-cover grant', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      mockRuntimeKeys({ 'Fighter1:naturesSanctuaryCreatures': ['Orc'] });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
      expect(result.coverReason).toBeUndefined();
    });

    it('does not grant cover when the runtime keys do not match the target', async () => {
      setupCoverTest();
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

    // ── Defensive Duelist (2024): proficiency floor on AC bonus ──

    it('applies Defensive Duelist proficiency bonus when it exceeds computed cover', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      mockRuntimeKeys({ 'Orc:activeBuffs': [{ effect: 'defensive_duelist' }] });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(mockStats.proficiency);
      expect(result.coverLevel).toBe('none');
    });

    it('does not lower cover when Defensive Duelist proficiency is below it', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'threeQuarter', acBonus: 5 });
      mockRuntimeKeys({ 'Orc:activeBuffs': [{ effect: 'defensive_duelist' }] });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(5);
      expect(result.coverLevel).toBe('threeQuarter');
    });

    // ── Bait and Switch (2024): raises AC bonus, never lowers it ──
    // (consolidated from the retired contextBuilder-cover.test.js)

    it('raises cover AC bonus when baitAndSwitchBonus exceeds computed cover', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      mockRuntimeKeys({ 'Orc:baitAndSwitchActive': true, 'Orc:baitAndSwitchBonus': 5 });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(5);
      expect(result.coverLevel).toBe('half');
    });

    it('keeps computed cover when baitAndSwitchBonus is below it', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'threeQuarter', acBonus: 5 });
      mockRuntimeKeys({ 'Orc:baitAndSwitchActive': true, 'Orc:baitAndSwitchBonus': 2 });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(5);
      expect(result.coverLevel).toBe('threeQuarter');
    });

    it('applies bait-and-switch bonus even when computed cover is none', async () => {
      setupCoverTest();
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      mockRuntimeKeys({ 'Orc:baitAndSwitchActive': true, 'Orc:baitAndSwitchBonus': 5 });
      const result = await buildAttack();
      expect(result.coverAcBonus).toBe(5);
      expect(result.coverLevel).toBe('none');
    });
  });

  describe('melee proximity disadvantage', () => {
    // type:'npc' is required to reach the npcs lookup inside applyMeleeProximity (#1181).
    function setupMeleeProxTest() {
      setupMapPathWithTarget('Orc', 10, 10);
      loadMapData.mockResolvedValue(makeMapDataWithNPCs(null, [{ type: 'npc', name: 'Orc', gridX: 10, gridY: 10 }]));
    }

    it('sets disadvantage when firing in melee range of hostile NPC', async () => {
      setupMeleeProxTest();
      isHostileNPC.mockReturnValue(true);
      computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Firing in melee' });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('disadvantage');
      expect(result.rangeReason).toBe('Firing in melee');
    });

    it('skips melee proximity check when attack is auto miss', async () => {
      setupMeleeProxTest();
      isHostileNPC.mockReturnValue(true);
      computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });
      computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Firing in melee' });
      const result = await buildAttack();
      expect(result.isAutoMiss).toBe(true);
      expect(result.forcedMode).toBeUndefined();
      expect(computeMeleeProximityEffect).not.toHaveBeenCalled();
    });

    it('passes filtered hostile NPCs to proximity check', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [
          { type: 'npc', name: 'Friendly', gridX: 2, gridY: 2, attitude: 'friendly' },
          { type: 'npc', name: 'Hostile', gridX: 3, gridY: 3, attitude: 'negative' },
        ]
      ));
      // ENVELOPE-FIXTURE pin (#1181): GET /api/campaigns/:campaign/npcs resolves
      // { npcs:[...] } (jsonEntityCrud.js:49) — the old bare-array mock hid the
      // npcs?.find TypeError in applyMeleeProximity (contextBuilder-map.js).
      loadNPCs.mockResolvedValue({
        npcs: [
          { name: 'Friendly', attitude: 'friendly' },
          { name: 'Hostile', attitude: 'negative' },
        ],
      });
      isHostileNPC.mockImplementation((npc) => npc.attitude === 'negative');
      await buildAttack();
      expect(isHostileNPC).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Hostile', attitude: 'negative' }),
      );
      expect(computeMeleeProximityEffect).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ name: 'Fighter1' }),
        [{ gridX: 3, gridY: 3, name: 'Hostile' }],
        expect.any(Object),
      );
    });
  });

  describe('target position resolution', () => {
    it('resolves player target position from map players (not placed items)', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 12, gridY: 12 }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      const result = await buildAttack();
      expect(result.targetName).toBe('Orc');
      expect(getNearestPlacedItem).not.toHaveBeenCalled();
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

  describe('improved illusions', () => {
    function setupIllusionTest() {
      setupMapPathWithTarget('Orc', 10, 10);
      loadMapData.mockResolvedValue(makeMapDataWithNPCs(null, [{ name: 'Orc', gridX: 10, gridY: 10 }]));
    }

    it('applies range bonus for illusion spells with range 10+ feet', async () => {
      setupIllusionTest();
      const stats = { ...mockStats, automation: { passives: [{ type: 'improved_illusions' }] } };
      const illusionAttack = { ...mockRangedAttack, damage: '1d4', damageType: 'Force', range: 120, school: 'Illusion' };
      await buildAttack(illusionAttack, stats);
      expect(computeRangeEffect).toHaveBeenCalledWith(180, expect.any(Number), expect.any(Object));
    });

    it('does not apply range bonus for non-illusion spells', async () => {
      setupIllusionTest();
      const stats = { ...mockStats, automation: { passives: [{ type: 'improved_illusions' }] } };
      const fireAttack = { ...mockRangedAttack, school: 'Evocation' };
      await buildAttack(fireAttack, stats);
      expect(computeRangeEffect).toHaveBeenCalledWith(150, expect.any(Number), expect.any(Object));
    });

    it('does not apply range bonus when spell range is less than 10 feet', async () => {
      setupIllusionTest();
      const stats = { ...mockStats, automation: { passives: [{ type: 'improved_illusions' }] } };
      const illusionAttack = { ...mockRangedAttack, range: 5, school: 'Illusion' };
      await buildAttack(illusionAttack, stats);
      expect(computeRangeEffect).toHaveBeenCalledWith(5, expect.any(Number), expect.any(Object));
    });

    it('applies feat spell range bonus on top of improved illusions', async () => {
      setupIllusionTest();
      const stats = { ...mockStats, automation: { passives: [{ type: 'improved_illusions' }] } };
      const illusionAttack = { ...mockRangedAttack, range: 120, school: 'Illusion' };
      await buildAttack(illusionAttack, stats, { spellRangeBonus: 30 });
      expect(computeRangeEffect).toHaveBeenCalledWith(210, expect.any(Number), expect.any(Object));
    });
  });

  describe('feat range effects', () => {
    it('handles undefined/null featRangeEffects and applies spellRangeBonus', async () => {
      setupMapPathWithTarget('Orc', 10, 10);
      loadMapData.mockResolvedValue(makeMapDataWithNPCs(null, [{ name: 'Orc', gridX: 10, gridY: 10 }]));
      let result = await buildAttackContext({ attack: mockRangedAttack, playerStats: mockStats, campaignName: 'camp', mapName: 'test-map', conditionAttackMode: 'normal', featRangeEffects: undefined });
      expect(result).toBeDefined();
      result = await buildAttackContext({ attack: mockRangedAttack, playerStats: mockStats, campaignName: 'camp', mapName: 'test-map', conditionAttackMode: 'normal', featRangeEffects: null });
      expect(result).toBeDefined();
      result = await buildAttack(mockRangedAttack, mockStats, { ignoresMeleeDisadvantage: true, ignoresLongRangeDisadvantage: true, rangeMultiplier: 1, spellRangeBonus: 10 });
      expect(result).toBeDefined();
      expect(computeRangeEffect).toHaveBeenCalledWith(160, expect.any(Number), expect.objectContaining({ spellRangeBonus: 10 }));
    });
  });

  describe('aura effects with map data — target position resolved', () => {
    function setupAuraTest() {
      setupMapPathWithTarget('Orc', 10, 10);
      loadMapData.mockResolvedValue(makeMapDataWithNPCs(null, [{ name: 'Orc', gridX: 10, gridY: 10 }]));
    }

    it('applies wolf aura advantage when target position is resolved', async () => {
      setupAuraTest();
      getWolfAdvantageAgainst.mockImplementation((opts) => opts.targetPos ? { advantage: true } : { advantage: false });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('advantage');
      expect(getWolfAdvantageAgainst).toHaveBeenCalledWith(
        expect.objectContaining({ targetPos: { gridX: 10, gridY: 10 }, mapData: expect.any(Object) }),
      );
    });

    it('applies duplicity aura advantage when wolf does not', async () => {
      setupAuraTest();
      getDuplicityAdvantageAgainst.mockReturnValue({ advantage: true });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('advantage');
    });

    it('applies lion aura disadvantage when no advantage auras apply', async () => {
      setupAuraTest();
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('disadvantage');
    });

    it('applies protection buff disadvantage when target has it', async () => {
      setupAuraTest();
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'targetEffects') return [{ effect: 'protection', target: 'Orc', source: 'Paladin' }];
        return undefined;
      });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('disadvantage');
    });

    it('prefers advantage over disadvantage when multiple auras apply', async () => {
      setupAuraTest();
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });
      const result = await buildAttack();
      expect(result.forcedMode).toBe('advantage');
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
        expect.objectContaining({ skipRangeCheck: true }),
      );
    });
  });
});
