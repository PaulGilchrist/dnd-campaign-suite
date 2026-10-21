// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

import { triggerDominateMonster } from './dominateMonsterService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';

const campaignName = 'TestCampaign';

// Disk canon (public/data/spells.json AND public/data/2024/spells.json): Dominate Monster
// is level 8, Enchantment, WIS save (dc.dc_type 'WIS'), concentration up to 1 hour.
// 5e disk carries "At Higher Levels" prose (9th slot -> concentration up to 8 hours);
// the reached tier is observable HERE only as spellSlotLevel 9 in the envelope — the
// service stores no clock (duration >= 1 minute is combat-scoped, no-fabricated-timer).
// OWNERSHIP (cited by dominateHandler.monster.test.js:18-23, which delegates
// "service-side gating is dominateMonsterService.test.js"): this lane owns the trigger
// gate, target resolution, the injury-advantage roll, saveDc/slot tier resolution, and the
// exact envelope. The monster shell is built WITHOUT saveType (beast's carries it) — the
// deep-equality envelope pins below prove its absence; the handler lane hardcodes WIS.
// Unlike beast/person there is NO type check and NO slot refund in this source (it imports
// neither monsterUtils nor the runtime store), so no refund-guard quirk exists here.
// Command-adjacent spells are separate lanes with distinct slot defaults
// (beast 4, person 5, monster 8).
// HONEST PIN: both editions' prose grant the save advantage "if you or creatures that are
// friendly to you are fighting it" (5e) / "if you or your allies are fighting it" (2024).
// The app proxies "is fighting it" with "target not at full health" (currentHp < maxHp).
// Pinned as-is. Same helper shape as beast: initiative-row-missing leaks advantage=undefined.

function makeSpell(overrides = {}) {
  return { name: 'Dominate Monster', level: 8, ...overrides };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    proficiency: 6,
    spellAbilities: { saveDc: 17 },
    ...overrides,
  };
}

function popup(description) {
  return { type: 'popup', payload: { type: 'automation_info', name: 'Dominate Monster', description } };
}

// Reset + re-seed: every table row starts from this identical baseline.
function reseed() {
  vi.clearAllMocks();
  executeHandler.mockResolvedValue(popup('cast ok'));
  getCombatContext.mockResolvedValue({ creatures: [] });
}

beforeEach(reseed);

describe('dominateMonsterService.triggerDominateMonster', () => {
  it('fires only for the exact name in any case; near-miss disk names are inert', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // Real disk rows from spells.json that must NOT be captured by this lane.
      for (const name of ['Fireball', 'Command', 'Dominate Beast', 'Dominate Person', 'Hold Monster', undefined]) {
        const result = await triggerDominateMonster(makeSpell({ name }), {}, makePlayerStats(), campaignName, null);
        expect(result).toBeNull();
      }
      expect(getCombatContext).not.toHaveBeenCalled();

      // Case-fold passes: gate opens, then the empty-combat baseline surfaces the popup.
      for (const name of ['Dominate Monster', 'dominate monster', 'DOMINATE MONSTER']) {
        reseed();
        const result = await triggerDominateMonster(makeSpell({ name }), {}, makePlayerStats(), campaignName, null);
        expect(result).toEqual(popup('No target selected for Dominate Monster.'));
      }
    } finally {
      errSpy.mockRestore();
    }
  });

  it('no target: exact popup and console.error on all three falsy resolution paths', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const scenarios = [
        { label: 'no combat context', cs: null },
        { label: 'empty initiative', cs: { creatures: [] } },
        { label: 'attacker has no target', cs: { creatures: [{ name: 'TestCaster' }, { name: 'Goblin' }] }, attacker: null },
      ];
      for (const sc of scenarios) {
        reseed();
        getCombatContext.mockResolvedValue(sc.cs);
        if ('attacker' in sc) getTargetFromAttacker.mockReturnValue(sc.attacker);

        const result = await triggerDominateMonster(makeSpell(), {}, makePlayerStats(), campaignName, null);

        expect(result).toEqual(popup('No target selected for Dominate Monster.'));
        expect(executeHandler).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(
          '[dominateMonsterService] No target selected for Dominate Monster by TestCaster. Caster has no target in initiative view.'
        );
      }
    } finally {
      errSpy.mockRestore();
    }
  });

  it('cast envelope: exact action per target state (no type gate, injury-advantage, undefined leak)', async () => {
    const goblin = { name: 'Goblin', type: 'npc' };
    const rows = [
      { label: 'damaged target (no type gate for monsters vs any)', meta: { targetName: 'Goblin' }, cs: [{ ...goblin, currentHp: 5, maxHp: 10 }], advantage: true },
      { label: 'full-health target', meta: { targetName: 'Goblin' }, cs: [{ ...goblin, currentHp: 10, maxHp: 10 }], advantage: false },
      { label: 'target with no HP data', meta: { targetName: 'Goblin' }, cs: [goblin], advantage: false },
      { label: 'player-character target (RAW: any creature)', meta: { targetName: 'Ally' }, cs: [{ name: 'Ally', type: 'player', currentHp: 10, maxHp: 10 }], advantage: false },
      { label: 'target absent from initiative rows', meta: { targetName: 'Nowhere' }, cs: [{ name: 'TestCaster' }], advantage: undefined },
      { label: 'target resolved from attacker view, injured', meta: {}, cs: [{ name: 'TestCaster' }, { ...goblin, currentHp: 1, maxHp: 10 }], attacker: { name: 'Goblin' }, advantage: true },
    ];
    for (const row of rows) {
      reseed();
      getCombatContext.mockResolvedValue({ creatures: row.cs });
      if ('attacker' in row) getTargetFromAttacker.mockReturnValue(row.attacker);

      const stats = makePlayerStats();
      const spell = makeSpell();
      await triggerDominateMonster(spell, row.meta, stats, campaignName, 'Map1');

      // Deep equality also pins the ABSENT saveType key (beast shell carries it).
      expect(executeHandler).toHaveBeenCalledWith(
        {
          name: 'Dominate Monster',
          automation: { type: 'dominate_monster', saveDc: 17, targetName: row.meta.targetName || 'Goblin', advantage: row.advantage },
          spell,
          spellSlotLevel: 8,
        },
        stats,
        campaignName,
        'Map1',
      );
      // metaCtx.targetName short-circuits the attacker lookup.
      expect(getTargetFromAttacker).toHaveBeenCalledTimes('attacker' in row ? 1 : 0);
    }
  });

  it('producer tier tables: saveDc and slot each resolve metaCtx > spell > derived default', async () => {
    // DC tiers mutually distinguishable: 18 > 17 (spellAbilities) > 14 (8+prof 6) > 10 (prof default 2).
    // Slot tiers: metaCtx 9 beats spell.level 8 (disk canon); a spell with no level falls to the
    // 8 default — indistinguishable from spell 8 by value, distinguished only by construction.
    // Row 1's slot 9 is the reached "At Higher Levels" disk tier (9th slot -> 8 hours); the
    // service merely carries the slot number to the handler lane and stores no clock.
    const rows = [
      { label: 'metaCtx wins (9th-slot higher-level tier)', meta: { targetName: 'Goblin', spellSaveDc: 18, slotLevel: 9 }, spell: makeSpell(), stats: makePlayerStats(), dc: 18, slot: 9 },
      { label: 'spellAbilities.saveDc and spell.level 8 canon', meta: { targetName: 'Goblin' }, spell: makeSpell(), stats: makePlayerStats(), dc: 17, slot: 8 },
      { label: 'derived 8+proficiency', meta: { targetName: 'Goblin' }, spell: { name: 'Dominate Monster' }, stats: makePlayerStats({ spellAbilities: undefined }), dc: 14, slot: 8 },
      { label: 'proficiency default 2', meta: { targetName: 'Goblin' }, spell: { name: 'Dominate Monster' }, stats: makePlayerStats({ spellAbilities: undefined, proficiency: undefined }), dc: 10, slot: 8 },
    ];
    for (const row of rows) {
      reseed();
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10 }] });

      await triggerDominateMonster(row.spell, row.meta, row.stats, campaignName, null);

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          automation: expect.objectContaining({ saveDc: row.dc, advantage: false }),
          spellSlotLevel: row.slot,
        }),
        row.stats,
        campaignName,
        null,
      );
    }
  });

  it('failure lanes: handler rejection pops up with prefixed console.error; combat-context rejection propagates', async () => {
    // executeHandler is the ONLY guarded call — its failure becomes the exact popup.
    const err = new Error('handler failed');
    executeHandler.mockRejectedValue(err);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await triggerDominateMonster(makeSpell(), { targetName: 'Goblin' }, makePlayerStats(), campaignName, null);

      expect(result).toEqual(popup('Failed to execute Dominate Monster.'));
      expect(console.error).toHaveBeenCalledWith('[dominateMonsterService] Failed to execute Dominate Monster handler:', err);
    } finally {
      errSpy.mockRestore();
    }

    // Never-executed branch discovery: getCombatContext sits OUTSIDE the try/catch
    // (dominateMonsterService.js:27/:33) — a transport rejection propagates to the caller.
    reseed();
    getCombatContext.mockRejectedValue(new Error('network down'));
    await expect(
      triggerDominateMonster(makeSpell(), {}, makePlayerStats(), campaignName, null)
    ).rejects.toThrow('network down');
    expect(executeHandler).not.toHaveBeenCalled();
  });
});
