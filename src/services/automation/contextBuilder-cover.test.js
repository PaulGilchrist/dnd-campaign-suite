// @maintained-by-ai
// ── contextBuilder COVER lane: bait-and-switch AC bonus ──────────────
// Tests the bait-and-switch bump in applyCoverModifiers() of
// contextBuilder-map.js (buildAttackContext with a mapName): when the
// target has baitAndSwitchActive, the stored baitAndSwitchBonus RAISES the
// cover AC bonus (never lowers it). Deterministic and fully mocked — no AI
// churn needed when the app changes; only when applyCoverModifiers'
// dependencies change does this harness need a mechanical mock update.
//
// Lane notes (do not confuse these cover implementations):
// - contextBuilder-map.js applyCoverModifiers: the live map lane. Applies
//   cover on every non-auto-miss attack with a resolved target position,
//   plus Sharpshooter ignore, half-cover grants, Defensive Duelist, and
//   bait-and-switch. Covered here (bait-and-switch) and in
//   contextBuilder-map.test.js (Sharpshooter/levels/auto-miss). The grants
//   and Defensive Duelist branches have no coverage anywhere yet.
// - common/damageRoll.js computeMapAwareContext: a separate, simpler cover
//   path (buildAttackContextForDamage) with NO grants/bait-and-switch and a
//   self-contradictory guard — `isRanged` (numericRange > 8) implies
//   rangeToFeet(range) is truthy, so its `!rangeToFeet(...)` cover branch
//   never fires in production; its tests force it via
//   rangeToFeet.mockReturnValueOnce(60).mockReturnValueOnce(0). Known issue,
//   not fixed here.
// - Split note: contextBuilder-map.test.js owns a `cover calculations`
//   describe block; consolidating it with this file is left to that file's
//   owner (this file must not edit it).

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
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../combat/buffs/buffService.js';
import { getWolfAdvantageAgainst } from '../combat/auras/wolfAuraUtils.js';
import { getDuplicityAdvantageAgainst } from '../combat/auras/duplicityAuraUtils.js';
import { getLionDisadvantageAgainst } from '../combat/auras/lionAuraUtils.js';
import { getCoronaSaveDisadvantage } from '../combat/auras/coronaAuraUtils.js';
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
vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
  isActive: vi.fn(), isAuraTarget: vi.fn(), handle: vi.fn(),
}));

function setupDefaults() {
  buildBaseAttackContext.mockResolvedValue({ target: { name: 'Orc' }, targetName: 'Orc', resistanceNotice: null });
  loadMapData.mockResolvedValue(null);
  loadNPCs.mockResolvedValue([]);
  rangeToFeet.mockImplementation((r) => (typeof r === 'number' ? r : 5));
  getRuntimeValue.mockReturnValue(undefined);
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
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

// Put the attacker and a placed-NPC target on the map so the cover lane runs.
function setupCoverPath() {
  loadMapData.mockResolvedValue(makeMapData(
    [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
    [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
  ));
  getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
  getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
  getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
}

function mockBaitAndSwitch(bonus) {
  getRuntimeValue.mockImplementation((entityType, key) => {
    if (key === 'baitAndSwitchActive' && entityType === 'Orc') return true;
    if (key === 'baitAndSwitchBonus' && entityType === 'Orc') return bonus;
    return undefined;
  });
}

function buildCoverContext(attack = mockRangedAttack) {
  return buildAttackContext({ attack, playerStats: mockStats, campaignName: 'camp', mapName: 'test-map', conditionAttackMode: 'normal', featRangeEffects: {} });
}

describe('contextBuilder cover: bait-and-switch AC bonus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
    setupCoverPath();
  });

  it('raises cover AC bonus when baitAndSwitchBonus exceeds computed cover', async () => {
    computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
    mockBaitAndSwitch(5);

    const result = await buildCoverContext();

    expect(result.coverAcBonus).toBe(5);
    expect(result.coverLevel).toBe('half');
  });

  it('keeps computed cover when baitAndSwitchBonus is below it', async () => {
    computeCover.mockReturnValue({ level: 'threeQuarter', acBonus: 5 });
    mockBaitAndSwitch(2);

    const result = await buildCoverContext();

    expect(result.coverAcBonus).toBe(5);
    expect(result.coverLevel).toBe('threeQuarter');
  });

  it('applies bait-and-switch bonus even when computed cover is none', async () => {
    computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
    mockBaitAndSwitch(5);

    const result = await buildCoverContext();

    expect(result.coverAcBonus).toBe(5);
    expect(result.coverLevel).toBe('none');
  });
});
