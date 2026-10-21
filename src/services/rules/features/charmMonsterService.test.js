// @maintained-by-ai
// CLA-219 + producer lane: charmMonsterService rebuilds the Charm Monster action on its way to
// executeHandler. This is the ONLY lane exercising the REAL service — every hook consumer
// (useComplexSpellHandlers/useSimpleSpellHandlers lanes) mocks it, and
// charmSpellUtils.metamagic-disadvantage.test.js hand-writes a charmMonster-shaped config that
// BYPASSES this service (its KNOWN FLAG header). So the service's own productions must be pinned
// exactly here: action envelope (single + multi), the DC it composes (resolveCharmMonsterSaveDc
// is a producer, not a forwarder — charmConfirmMetaCtx at useComplexSpellHandlers.js:26-28
// carries metamagicHeighten/characters but NO spellSaveDc), the charmMonsterAdvantages map
// (cited live by charmSpellUtils.metamagic-disadvantage.test.js:366-369), the CLA-219
// metamagicHeighten transport, no-target refusal, and the executeHandler catch-popup fallback
// (charmMonsterHandler.test.js:109 explicitly disclaims owning that fallback).
// Disk spells.json (read 2026-10-20): 'Charm Monster' level 4, Wisdom save, beast/monstrosity/
// humanoid target; near-miss family rows 'Charm Person' (level 1, humanoid) and 'Dominate
// Monster' (level 8) must never route through this service — the name gate refuses them.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { triggerCharmMonster } from './charmMonsterService.js';

// 'Charm Monster' level 4 mirrors the disk row; caster card saveDc 14 vs proficiency 5
// (fallback 8+5=13) keeps the DC branches distinguishable.
const spell = { name: 'Charm Monster', level: 4 };
const caster = { name: 'AasimarTest', proficiency: 5, spellAbilities: { saveDc: 14 } };
const HANDLED = { type: 'popup', payload: { type: 'automation', name: 'handled' } };

const bandit = (name, currentHp) => ({ name, type: 'npc', currentHp, maxHp: 11 });

beforeEach(() => {
    // vitest-4 re-seed: resetAllMocks drops factory defaults, so re-establish every stub.
    vi.resetAllMocks();
    executeHandler.mockResolvedValue(HANDLED);
    getCombatContext.mockResolvedValue({ creatures: [bandit('Bandit 1', 5)] });
    getTargetFromAttacker.mockReturnValue(undefined);
    getRuntimeValue.mockReturnValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('charmMonsterService.triggerCharmMonster (producer lane)', () => {
    it('gate: near-miss disk spell names never route here — Charm Person returns null, handler untouched', async () => {
        const charmPerson = { name: 'Charm Person', level: 1 };

        const result = await triggerCharmMonster(charmPerson, { targetName: 'Bandit 1' }, caster, 'test-campaign', null);

        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('single target: exact rebuilt envelope, CLA-219 metamagicHeighten transport, arg and return identity', async () => {
        const characters = [{ name: 'AasimarTest' }];

        const result = await triggerCharmMonster(
            spell,
            { targetName: 'Bandit 1', metamagicHeighten: true, characters },
            caster, 'test-campaign', 'dungeon-map');

        const [action, stats, campaign, map] = executeHandler.mock.calls[0];
        expect(action).toEqual({
            name: 'Charm Monster',
            automation: { type: 'charm_monster', saveDc: 14, targetName: 'Bandit 1', advantage: true },
            // rebuilt metaCtx: targetName/slotLevel are consumed and stripped; only the transport survives
            metaCtx: { characters, metamagicHeighten: true },
            spell,
            spellSlotLevel: 4,
        });
        expect(action.spell).toBe(spell);
        expect(action.metaCtx.characters).toBe(characters);
        expect(stats).toBe(caster);
        expect(campaign).toBe('test-campaign');
        expect(map).toBe('dungeon-map');
        expect(result).toBe(HANDLED);
    });

    it('DC chain is produced here: metaCtx.spellSaveDc beats card saveDc beats 8+proficiency beats 8+2; no-flag metaCtx coerces metamagicHeighten false', async () => {
        const profOnlyCaster = { name: 'Rook', proficiency: 5 };
        const bareCaster = { name: 'Rook' };

        await triggerCharmMonster(spell, { targetName: 'Bandit 1', spellSaveDc: 17 }, caster, 'test-campaign', null);
        await triggerCharmMonster(spell, { targetName: 'Bandit 1' }, profOnlyCaster, 'test-campaign', null);
        await triggerCharmMonster(spell, { targetName: 'Bandit 1' }, bareCaster, 'test-campaign', null);

        // 17 (metaCtx beats caster card 14), 13 (8+prof 5), 10 (8+default prof 2) — distinguishable by design
        expect(executeHandler.mock.calls.map(([a]) => a.automation.saveDc)).toEqual([17, 13, 10]);
        // CLA-219 control: absent flag arrives at the handler as explicit false, once per rebuild
        expect(executeHandler.mock.calls[2][0].metaCtx).toEqual({ characters: [], metamagicHeighten: false });
    });

    it('single-target save advantage truth: hurt NPC true, full-health NPC false, downed NPC false, runtime-store player hurt true', async () => {
        getCombatContext.mockResolvedValue({ creatures: [bandit('Bandit 1', 5)] });
        await triggerCharmMonster(spell, { targetName: 'Bandit 1' }, caster, 'test-campaign', null);
        getCombatContext.mockResolvedValue({ creatures: [bandit('Bandit 1', 11)] });
        await triggerCharmMonster(spell, { targetName: 'Bandit 1' }, caster, 'test-campaign', null);
        getCombatContext.mockResolvedValue({ creatures: [bandit('Bandit 1', 0)] });
        await triggerCharmMonster(spell, { targetName: 'Bandit 1' }, caster, 'test-campaign', null);
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'Player 1', type: 'player', maxHp: 20 }] });
        getRuntimeValue.mockImplementation((key, k) => (k === 'currentHitPoints' ? 10 : k === 'hitPoints' ? 20 : undefined));
        await triggerCharmMonster(spell, { targetName: 'Player 1' }, caster, 'test-campaign', null);

        expect(executeHandler.mock.calls.map(([a]) => a.automation.advantage)).toEqual([true, false, false, true]);
        // player lane reads HP from the runtime store, not the initiative row
        expect(getRuntimeValue).toHaveBeenCalledWith('Player 1', 'currentHitPoints', 'test-campaign');
        expect(getRuntimeValue).toHaveBeenCalledWith('Player 1', 'hitPoints', 'test-campaign');
    });

    it('multi target: exact envelope with charmMonsterAdvantages map, slot upcast, CLA-219 transport; automation.advantage stays false', async () => {
        getCombatContext.mockResolvedValue({ creatures: [bandit('Bandit 1', 5), bandit('Bandit 2', 11)] });
        const characters = [{ name: 'AasimarTest' }];

        const result = await triggerCharmMonster(
            spell,
            { charmMonsterTargets: ['Bandit 1', 'Bandit 2'], characters, metamagicHeighten: true, slotLevel: 6 },
            caster, 'test-campaign', 'dungeon-map');

        const [action] = executeHandler.mock.calls[0];
        expect(action).toEqual({
            name: 'Charm Monster',
            // per-target advantage lives ONLY in charmMonsterAdvantages (consumed downstream by
            // charmSpellUtils per its metamagic-disadvantage.test.js:366-369 live-producer citation)
            automation: { type: 'charm_monster', saveDc: 14, advantage: false },
            metaCtx: {
                charmMonsterTargets: ['Bandit 1', 'Bandit 2'],
                charmMonsterAdvantages: { 'Bandit 1': true, 'Bandit 2': false },
                characters,
                metamagicHeighten: true,
            },
            spell,
            spellSlotLevel: 6,
        });
        expect(action.metaCtx.characters).toBe(characters);
        expect(result).toBe(HANDLED);
    });

    it('target resolution: with no metaCtx.targetName the attacker\'s initiative target is used', async () => {
        getTargetFromAttacker.mockReturnValue({ name: 'Ogre' });

        await triggerCharmMonster(spell, {}, caster, 'test-campaign', null);

        expect(getTargetFromAttacker).toHaveBeenCalledWith({ creatures: [bandit('Bandit 1', 5)] }, 'AasimarTest');
        const [action] = executeHandler.mock.calls[0];
        expect(action.automation.targetName).toBe('Ogre');
    });

    it('no-target refusal: exact console.error and automation_info popup, pipeline never opens', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        getTargetFromAttacker.mockReturnValue(null);

        const popup = await triggerCharmMonster(spell, {}, caster, 'test-campaign', null);

        expect(spy).toHaveBeenCalledWith('[charmMonsterService] No target selected for Charm Monster by AasimarTest. Caster has no target in initiative view.');
        expect(popup).toEqual({ type: 'popup', payload: { type: 'automation_info', name: 'Charm Monster', description: 'No target selected for Charm Monster.' } });
        expect(executeHandler).not.toHaveBeenCalled();

        // empty initiative also refuses without ever consulting getTargetFromAttacker
        getCombatContext.mockResolvedValue({ creatures: [] });
        const popup2 = await triggerCharmMonster(spell, {}, caster, 'test-campaign', null);

        expect(popup2.payload.description).toBe('No target selected for Charm Monster.');
        expect(getTargetFromAttacker).toHaveBeenCalledTimes(1);
    });

    it('handler crash fallback: console.error with the identical Error, exact info popup returned (owned here, not by charmMonsterHandler)', async () => {
        const err = new Error('handler boom');
        executeHandler.mockRejectedValue(err);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const popup = await triggerCharmMonster(spell, { targetName: 'Bandit 1' }, caster, 'test-campaign', null);

        expect(spy).toHaveBeenCalledWith('[charmMonsterService] Failed to execute Charm Monster handler:', err);
        expect(popup).toEqual({ type: 'popup', payload: { type: 'automation_info', name: 'Charm Monster', description: 'Failed to execute Charm Monster.' } });
    });
});
