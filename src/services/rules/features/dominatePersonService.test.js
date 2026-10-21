// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { triggerDominatePerson } from './dominatePersonService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

// Disk canon (public/data/spells.json AND public/data/2024/spells.json): Dominate Person
// is level 5, Enchantment, WIS save (dc.dc_type 'WIS'), concentration up to 1 minute.
// 5e disk carries "At Higher Levels" prose (6th slot -> 10 min, 7th -> 1 hour, 8th+ ->
// 8 hours); the reached tier is observable HERE only as spellSlotLevel in the envelope —
// the service stores no clock (duration >= 1 minute is combat-scoped, no-fabricated-timer).
// OWNERSHIP (cited by dominateHandler.person.test.js:18, which delegates the shell's
// spell/spellSlotLevel extras to this service lane): this file owns the trigger gate,
// target resolution, the Humanoid type check, saveDc/slot tier resolution, the slot
// refund, and the exact envelope. The handler lane owns the save prompt, effects latch,
// and compelled-duel expiry. Command-adjacent spells are separate lanes with distinct
// slot defaults (beast 4, person 5, monster 8).
// FAMILY DIVERGENCE (person vs beast #1354 / monster #1355): this copy RETIRED the
// currentHp<maxHp injury-advantage proxy — RAW grants advantage "if you or your allies
// are fighting it" and the gridless app exposes no such signal, so advantage is the
// literal false at dominatePersonService.js:98 (comment :88-90). Consequently there is
// NO advantage:undefined leak here (no targetCreature && ... shape) — pinned honestly as
// a constant. Refund-popup-lies-on-guard-skip IS present (:50 guard, :85 popup), as in
// the beast copy. Both getCombatContext calls (:12, :38) sit OUTSIDE the try/catch.

function makeSpell(overrides = {}) {
  return { name: 'Dominate Person', level: 5, ...overrides };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    proficiency: 4,
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function popup(description) {
  return { type: 'popup', payload: { type: 'automation_info', name: 'Dominate Person', description } };
}

// Reset + re-seed: every table row starts from this identical baseline.
// clearAllMocks (not resetAllMocks) keeps the addEntry Promise impl from the factory.
function reseed() {
  vi.clearAllMocks();
  executeHandler.mockResolvedValue(popup('cast ok'));
  getCombatContext.mockResolvedValue({ creatures: [] });
  getMonsterData.mockResolvedValue({ type: 'Humanoid' });
  getRuntimeValue.mockReturnValue(2);
}

beforeEach(reseed);

describe('dominatePersonService.triggerDominatePerson', () => {
  it('fires only for the exact name in any case; near-miss disk names are inert', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // Real disk rows from spells.json that must NOT be captured by this lane.
      for (const name of ['Fireball', 'Command', 'Dominate Beast', 'Dominate Monster', 'Hold Person', undefined]) {
        const result = await triggerDominatePerson(makeSpell({ name }), {}, makePlayerStats(), campaignName, null);
        expect(result).toBeNull();
      }
      expect(getCombatContext).not.toHaveBeenCalled();

      // Case-fold passes: gate opens, then the empty-combat baseline surfaces the popup.
      for (const name of ['Dominate Person', 'dominate person', 'DOMINATE PERSON']) {
        reseed();
        const result = await triggerDominatePerson(makeSpell({ name }), {}, makePlayerStats(), campaignName, null);
        expect(result).toEqual(popup('No target selected for Dominate Person.'));
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
        { label: 'attacker has no target', cs: { creatures: [{ name: 'TestCaster' }, { name: 'Villager' }] }, attacker: null },
      ];
      for (const sc of scenarios) {
        reseed();
        getCombatContext.mockResolvedValue(sc.cs);
        if ('attacker' in sc) getTargetFromAttacker.mockReturnValue(sc.attacker);

        const result = await triggerDominatePerson(makeSpell(), {}, makePlayerStats(), campaignName, null);

        expect(result).toEqual(popup('No target selected for Dominate Person.'));
        expect(executeHandler).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(
          '[dominatePersonService] No target selected for Dominate Person by TestCaster. Caster has no target in initiative view.'
        );
      }
    } finally {
      errSpy.mockRestore();
    }
  });

  it('cast envelope: exact action per target kind; advantage is constant false (injury proxy retired)', async () => {
    const villager = { name: 'Villager', type: 'npc' };
    const rows = [
      { label: 'damaged NPC humanoid via metaCtx targetName', meta: { targetName: 'Villager' }, cs: [{ ...villager, currentHp: 5, maxHp: 10 }], target: 'Villager', contextCalls: 1 },
      { label: 'target resolved from attacker view (context fetched twice)', meta: {}, cs: [{ name: 'TestCaster', type: 'player' }, { ...villager, currentHp: 1, maxHp: 10 }], attacker: { name: 'Villager' }, target: 'Villager', contextCalls: 2 },
      { label: 'player target: type check short-circuits monster data', meta: { targetName: 'Ally' }, cs: [{ name: 'Ally', type: 'player' }], target: 'Ally', player: true, contextCalls: 1 },
    ];
    for (const row of rows) {
      reseed();
      getCombatContext.mockResolvedValue({ creatures: row.cs });
      if ('attacker' in row) getTargetFromAttacker.mockReturnValue(row.attacker);

      const stats = makePlayerStats();
      const spell = makeSpell();
      await triggerDominatePerson(spell, row.meta, stats, campaignName, 'Map1');

      // Deep equality pins the whole envelope (spell/spellSlotLevel owned HERE per
      // dominateHandler.person.test.js:18) and the absence of a saveType key.
      expect(executeHandler).toHaveBeenCalledWith(
        {
          name: 'Dominate Person',
          automation: { type: 'dominate_person', saveDc: 15, targetName: row.target, advantage: false },
          spell,
          spellSlotLevel: 5,
        },
        stats,
        campaignName,
        'Map1',
      );
      // HONEST PIN: injured targets get NO advantage — unlike beast/monster copies this
      // source hardcodes advantage:false (see family-divergence header note).
      // metaCtx.targetName short-circuits the attacker lookup; the attacker flow re-enters
      // isTargetHumanoid, so getCombatContext is fetched twice there.
      expect(getTargetFromAttacker).toHaveBeenCalledTimes('attacker' in row ? 1 : 0);
      expect(getCombatContext).toHaveBeenCalledTimes(row.contextCalls);
      if (row.player) expect(getMonsterData).not.toHaveBeenCalled();
    }
  });

  it('producer tier tables: saveDc and slot each resolve metaCtx > spell > derived default', async () => {
    // DC tiers mutually distinguishable: 16 > 15 (spellAbilities) > 12 (8+prof 4) > 10 (prof default 2).
    // Slot tiers: metaCtx 7 beats upcast spell.level 6; falsy slotLevel 0 falls through to
    // spell.level 6; missing spell.level falls to the 5 disk canon default.
    const rows = [
      { label: 'metaCtx wins', meta: { targetName: 'Villager', spellSaveDc: 16, slotLevel: 7 }, spell: makeSpell(), stats: makePlayerStats(), dc: 16, slot: 7 },
      { label: 'spellAbilities.saveDc and spell.level 5 canon', meta: { targetName: 'Villager' }, spell: makeSpell(), stats: makePlayerStats(), dc: 15, slot: 5 },
      { label: 'upcast spell.level beats default', meta: { targetName: 'Villager' }, spell: makeSpell({ level: 6 }), stats: makePlayerStats(), dc: 15, slot: 6 },
      { label: 'falsy slotLevel 0 falls to spell.level', meta: { targetName: 'Villager', slotLevel: 0 }, spell: makeSpell({ level: 6 }), stats: makePlayerStats(), dc: 15, slot: 6 },
      { label: 'derived 8+proficiency', meta: { targetName: 'Villager' }, spell: { name: 'Dominate Person' }, stats: makePlayerStats({ spellAbilities: undefined }), dc: 12, slot: 5 },
      { label: 'proficiency default 2', meta: { targetName: 'Villager' }, spell: { name: 'Dominate Person' }, stats: makePlayerStats({ spellAbilities: undefined, proficiency: undefined }), dc: 10, slot: 5 },
    ];
    for (const row of rows) {
      reseed();
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Villager', type: 'npc', currentHp: 10, maxHp: 10 }] });

      await triggerDominatePerson(row.spell, row.meta, row.stats, campaignName, null);

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

  it('non-Humanoid targets: exact log+popup, no handler call, refund key/guard per slot tier', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rows = [
        { label: 'Beast NPC refunds spell.level slot', target: 'Wolf', type: 'Beast', meta: { targetName: 'Wolf' }, stored: 2, refunded: ['spell_slots_level_5', 3] },
        { label: 'metaCtx.slotLevel refunds that level', target: 'Giant Ape', type: 'beast', meta: { targetName: 'Giant Ape', slotLevel: 6 }, stored: 0, refunded: ['spell_slots_level_6', 1] },
        { label: 'falsy slotLevel 0 refunds spell.level 5', target: 'Wolf', type: 'monstrosity', meta: { targetName: 'Wolf', slotLevel: 0 }, stored: 4, refunded: ['spell_slots_level_5', 5] },
        // QUIRK: guard skips the write but the popup still claims "Spell slot refunded."
        { label: 'missing slot counter: guard skips write, popup lies', target: 'Wolf', type: 'Dragon', meta: { targetName: 'Wolf' }, stored: null, refunded: null },
        { label: 'zero stored counter still refunds', target: 'Wolf', type: 'Construct', meta: { targetName: 'Wolf' }, stored: 0, refunded: ['spell_slots_level_5', 1] },
        { label: 'log write rejects: prefixed console.error', target: 'Wolf', type: 'Beast', meta: { targetName: 'Wolf' }, stored: 2, refunded: ['spell_slots_level_5', 3], addReject: true },
      ];
      for (const row of rows) {
        reseed();
        getCombatContext.mockResolvedValue({ creatures: [{ name: row.target, type: 'npc' }] });
        getMonsterData.mockResolvedValue({ type: row.type });
        getRuntimeValue.mockReturnValue(row.stored);
        if (row.addReject) addEntry.mockRejectedValueOnce(new Error('log down'));

        const result = await triggerDominatePerson(makeSpell(), row.meta, makePlayerStats(), campaignName, null);

        expect(result).toEqual(popup(`No effect. ${row.target} is not a Humanoid. Spell slot refunded.`));
        expect(executeHandler).not.toHaveBeenCalled();
        // Every automation logs its outcome.
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Dominate Person',
          description: `TestCaster casts Dominate Person on ${row.target} but it has no effect — ${row.target} is not a Humanoid.`,
        });
        expect(getMonsterData).toHaveBeenCalledWith(row.target, null);
        if (row.refunded) {
          expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', ...row.refunded, campaignName);
        } else {
          expect(setRuntimeValue).not.toHaveBeenCalled();
        }
        if (row.addReject) {
          expect(console.error).toHaveBeenCalledWith('[dominatePersonService:log-error]', expect.any(Error));
        }
      }
    } finally {
      errSpy.mockRestore();
    }
  });

  it('fails open as Humanoid: missing combat context, unknown creature, or unreadable monster data still cast', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Reject row LAST so "no warn yet" assertions stay honest across the table.
      const rows = [
        { label: 'no combat context', cs: null, monsterCalls: 0 },
        { label: 'target not in initiative list', cs: { creatures: [{ name: 'TestCaster', type: 'player' }] }, monsterCalls: 0 },
        { label: 'monster data without type', cs: { creatures: [{ name: 'Mystery', type: 'npc' }] }, monsterType: undefined, monsterCalls: 1 },
        { label: 'monster data unreadable', cs: { creatures: [{ name: 'Mystery', type: 'npc' }] }, monsterRejected: true, monsterCalls: 1 },
      ];
      for (const row of rows) {
        reseed();
        getCombatContext.mockResolvedValue(row.cs);
        if (row.monsterRejected) getMonsterData.mockRejectedValue(new Error('not found'));
        if ('monsterType' in row) getMonsterData.mockResolvedValue({ type: row.monsterType });

        await triggerDominatePerson(makeSpell(), { targetName: 'Mystery' }, makePlayerStats(), campaignName, 'Map1');

        expect(executeHandler).toHaveBeenCalledTimes(1);
        // advantage stays literal false even on fail-open rows (no undefined leak here,
        // unlike the beast/monster targetCreature && ... shape).
        expect(executeHandler.mock.calls[0][0].automation).toMatchObject({ type: 'dominate_person', targetName: 'Mystery', advantage: false });
        expect(getMonsterData).toHaveBeenCalledTimes(row.monsterCalls);
        if (row.monsterRejected) {
          expect(console.warn).toHaveBeenCalledWith('[dominatePersonService] Monster data unavailable, defaulting to Humanoid:', expect.any(Error));
        } else {
          expect(console.warn).not.toHaveBeenCalled();
        }
      }
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('failure lanes: handler rejection pops up with prefixed console.error; combat-context rejection propagates', async () => {
    // executeHandler is the ONLY guarded call — its failure becomes the exact popup.
    const err = new Error('handler failed');
    executeHandler.mockRejectedValue(err);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await triggerDominatePerson(makeSpell(), { targetName: 'Villager' }, makePlayerStats(), campaignName, null);

      expect(result).toEqual(popup('Failed to execute Dominate Person.'));
      expect(console.error).toHaveBeenCalledWith('[dominatePersonService] Failed to execute Dominate Person handler:', err);
    } finally {
      errSpy.mockRestore();
    }

    // Never-executed branch discovery: BOTH getCombatContext call sites sit OUTSIDE the
    // try/catch (:38 resolve, :12 type check) — a transport rejection propagates to the
    // caller on either lane (same finding shape as #1355).
    const propagates = [
      { label: 'attacker-resolution lane', meta: {} },
      { label: 'metaCtx-target type-check lane', meta: { targetName: 'Villager' } },
    ];
    for (const row of propagates) {
      reseed();
      getCombatContext.mockRejectedValue(new Error('network down'));
      await expect(
        triggerDominatePerson(makeSpell(), row.meta, makePlayerStats(), campaignName, null)
      ).rejects.toThrow('network down');
      expect(executeHandler).not.toHaveBeenCalled();
    }
  });
});
