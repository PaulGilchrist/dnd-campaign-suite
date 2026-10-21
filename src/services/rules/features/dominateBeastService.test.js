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

import { triggerDominateBeast } from './dominateBeastService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

// Disk canon (public/data/spells.json AND public/data/2024/spells.json): Dominate Beast
// is level 4, Enchantment, WIS save, concentration up to 1 minute. No "At Higher Levels"
// text on disk, so no duration scaling is pinned here; the service stores no clock
// (duration >= 1 minute is combat-scoped — no-fabricated-timer policy).
// OWNERSHIP (cited by dominateHandler.beast.test.js:37-43): this lane owns the trigger
// envelope — automation.type 'dominate_beast', the injury-advantage roll, saveDc/slot
// tier resolution, and the slot refund. The handler lane owns save prompt, conditions,
// and the dominated expiration latch. Command-adjacent spells (Command via commandHandler,
// Dominate Person/Monster via their own services) are separate lanes with distinct
// default slot tiers (person 5, monster 8; beast is the 4 here).
// HONEST PIN: RAW prose (both editions) says the target has advantage on the save
// "if you or creatures that are friendly to you are fighting it". The app proxies
// "is fighting it" with "target not at full health" (currentHp < maxHp). Pinned as-is.

function makeSpell(overrides = {}) {
  return { name: 'Dominate Beast', level: 4, ...overrides };
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
  return { type: 'popup', payload: { type: 'automation_info', name: 'Dominate Beast', description } };
}

// Reset + re-seed: every table row starts from this identical baseline.
// clearAllMocks (not resetAllMocks) keeps the addEntry Promise impl from the factory.
function reseed() {
  vi.clearAllMocks();
  executeHandler.mockResolvedValue(popup('cast ok'));
  getCombatContext.mockResolvedValue({ creatures: [] });
  getMonsterData.mockResolvedValue({ type: 'Beast' });
  getRuntimeValue.mockReturnValue(3);
}

beforeEach(reseed);

describe('dominateBeastService.triggerDominateBeast', () => {
  it('fires only for the exact name in any case; near-miss disk names are inert', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // Real disk rows from spells.json that must NOT be captured by this lane.
      for (const name of ['Fireball', 'Command', 'Dominate Person', 'Dominate Monster', undefined]) {
        const result = await triggerDominateBeast(makeSpell({ name }), {}, makePlayerStats(), campaignName, null);
        expect(result).toBeNull();
      }
      expect(getCombatContext).not.toHaveBeenCalled();

      // Case-fold passes: gate opens, then the empty-combat baseline surfaces the popup.
      for (const name of ['Dominate Beast', 'dominate beast', 'DOMINATE BEAST']) {
        reseed();
        const result = await triggerDominateBeast(makeSpell({ name }), {}, makePlayerStats(), campaignName, null);
        expect(result).toEqual(popup('No target selected for Dominate Beast.'));
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

        const result = await triggerDominateBeast(makeSpell(), {}, makePlayerStats(), campaignName, null);

        expect(result).toEqual(popup('No target selected for Dominate Beast.'));
        expect(executeHandler).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(
          '[dominateBeastService] No target selected for Dominate Beast by TestCaster. Caster has no target in initiative view.'
        );
      }
    } finally {
      errSpy.mockRestore();
    }
  });

  it('beast cast envelope: exact action per health tier (injury-advantage) and attacker resolution', async () => {
    const wolf = { name: 'Wolf', type: 'npc' };
    const rows = [
      { label: 'damaged beast (lowercase disk type)', meta: { targetName: 'Wolf' }, cs: [{ ...wolf, currentHp: 5, maxHp: 10 }], monsterType: 'beast', advantage: true },
      { label: 'full-health beast', meta: { targetName: 'Wolf' }, cs: [{ ...wolf, currentHp: 10, maxHp: 10 }], advantage: false },
      { label: 'beast with no HP data', meta: { targetName: 'Wolf' }, cs: [wolf], advantage: false },
      { label: 'target resolved from attacker view, injured', meta: {}, cs: [{ name: 'TestCaster' }, { ...wolf, currentHp: 1, maxHp: 10 }], attacker: { name: 'Wolf' }, advantage: true },
    ];
    for (const row of rows) {
      reseed();
      getCombatContext.mockResolvedValue({ creatures: row.cs });
      if ('monsterType' in row) getMonsterData.mockResolvedValue({ type: row.monsterType });
      if ('attacker' in row) getTargetFromAttacker.mockReturnValue(row.attacker);

      const stats = makePlayerStats();
      const spell = makeSpell();
      await triggerDominateBeast(spell, row.meta, stats, campaignName, 'Map1');

      expect(executeHandler).toHaveBeenCalledWith(
        {
          name: 'Dominate Beast',
          automation: { type: 'dominate_beast', saveDc: 15, targetName: 'Wolf', advantage: row.advantage },
          spell,
          spellSlotLevel: 4,
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
    // DC tiers mutually distinguishable: 16 > 15 > 12 (8+prof 4) > 10 (prof default 2).
    // Slot tiers: metaCtx 7 beats spell 4; missing spell.level falls to the 4 canon default.
    const rows = [
      { label: 'metaCtx wins', meta: { targetName: 'Wolf', spellSaveDc: 16, slotLevel: 7 }, spell: makeSpell(), stats: makePlayerStats(), dc: 16, slot: 7 },
      { label: 'spellAbilities.saveDc and spell.level', meta: { targetName: 'Wolf' }, spell: makeSpell({ level: 4 }), stats: makePlayerStats(), dc: 15, slot: 4 },
      { label: 'derived 8+proficiency', meta: { targetName: 'Wolf' }, spell: { name: 'Dominate Beast' }, stats: makePlayerStats({ spellAbilities: undefined }), dc: 12, slot: 4 },
      { label: 'proficiency default 2', meta: { targetName: 'Wolf' }, spell: { name: 'Dominate Beast' }, stats: makePlayerStats({ spellAbilities: undefined, proficiency: undefined }), dc: 10, slot: 4 },
    ];
    for (const row of rows) {
      reseed();
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Wolf', type: 'npc', currentHp: 10, maxHp: 10 }] });

      await triggerDominateBeast(row.spell, row.meta, row.stats, campaignName, null);

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

  it('non-Beast targets: exact log+popup, no handler call, refund key/guard per slot tier', async () => {
    const rows = [
      { label: 'Monstrosity NPC refunds spell.level slot', target: 'Goblin', type: 'Monstrosity', meta: { targetName: 'Goblin' }, stored: 3, refunded: ['spell_slots_level_4', 4] },
      { label: 'metaCtx.slotLevel refunds that level', target: 'Goblin', type: 'monstrosity', meta: { targetName: 'Goblin', slotLevel: 6 }, stored: 0, refunded: ['spell_slots_level_6', 1] },
      { label: 'player target', target: 'Ally', playerType: true, meta: { targetName: 'Ally' }, stored: 2, refunded: ['spell_slots_level_4', 3] },
      { label: 'missing slot counter: guard skips write', target: 'Goblin', type: 'Dragon', meta: { targetName: 'Goblin' }, stored: null, refunded: null },
    ];
    for (const row of rows) {
      reseed();
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestCaster', type: 'player' }, { name: row.target, type: row.playerType ? 'player' : 'npc' }] });
      if (!row.playerType) getMonsterData.mockResolvedValue({ type: row.type });
      getRuntimeValue.mockReturnValue(row.stored);

      const result = await triggerDominateBeast(makeSpell(), row.meta, makePlayerStats(), campaignName, null);

      expect(result).toEqual(popup(`No effect. ${row.target} is not a Beast. Spell slot refunded.`));
      expect(executeHandler).not.toHaveBeenCalled();
      // Every automation logs its outcome.
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Dominate Beast',
        description: `TestCaster casts Dominate Beast on ${row.target} but it has no effect — ${row.target} is not a Beast.`,
      });
      // Player short-circuit: type check never loads monster data.
      if (row.playerType) {
        expect(getMonsterData).not.toHaveBeenCalled();
      } else {
        expect(getMonsterData).toHaveBeenCalledWith(row.target, null);
      }
      if (row.refunded) {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', ...row.refunded, campaignName);
      } else {
        expect(setRuntimeValue).not.toHaveBeenCalled();
      }
    }
  });

  it('fails open as Beast: missing combat context, unknown creature, or unreadable monster data still cast', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const rows = [
        { label: 'no combat context', cs: null, monsterCalls: 0, advantage: undefined },
        { label: 'target not in initiative list', cs: { creatures: [{ name: 'TestCaster', type: 'player' }] }, monsterCalls: 0, advantage: undefined },
        { label: 'monster data unreadable', cs: { creatures: [{ name: 'Mystery', type: 'npc' }] }, monsterRejected: true, monsterCalls: 1, advantage: false },
        { label: 'monster data without type', cs: { creatures: [{ name: 'Mystery', type: 'npc' }] }, monsterType: undefined, monsterCalls: 1, advantage: false },
      ];
      for (const row of rows) {
        reseed();
        getCombatContext.mockResolvedValue(row.cs);
        if (row.monsterRejected) getMonsterData.mockRejectedValue(new Error('not found'));
        if ('monsterType' in row) getMonsterData.mockResolvedValue({ type: row.monsterType });

        await triggerDominateBeast(makeSpell(), { targetName: 'Mystery' }, makePlayerStats(), campaignName, 'Map1');

        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler.mock.calls[0][0].automation).toMatchObject({ type: 'dominate_beast', targetName: 'Mystery' });
        // Honest pin: when the initiative row is absent, advantage flows as undefined, not false.
        expect(executeHandler.mock.calls[0][0].automation.advantage).toBe(row.advantage);
        expect(getMonsterData).toHaveBeenCalledTimes(row.monsterCalls);
        if (row.monsterRejected) {
          expect(console.warn).toHaveBeenCalledWith('[dominateBeastService] Monster data unavailable, defaulting to Beast:', expect.any(Error));
        }
      }
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('handler failure: swallowed with exact popup and prefixed console.error', async () => {
    const err = new Error('handler failed');
    executeHandler.mockRejectedValue(err);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await triggerDominateBeast(makeSpell(), { targetName: 'Wolf' }, makePlayerStats(), campaignName, null);

      expect(result).toEqual(popup('Failed to execute Dominate Beast.'));
      expect(console.error).toHaveBeenCalledWith('[dominateBeastService] Failed to execute Dominate Beast handler:', err);
    } finally {
      errSpy.mockRestore();
    }
  });
});
