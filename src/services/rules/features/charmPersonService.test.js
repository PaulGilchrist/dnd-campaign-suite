// @maintained-by-ai
// CLA-219 + producer lane (Charm-Person twin of charmMonsterService.test.js #1343): this is the
// ONLY lane exercising the REAL charmPersonService — every hook consumer
// (useSpellMetamagicFlow.* — 13 lanes, all verified vi.mock'ing the service) and the downstream
// handler lanes (charmPersonHandler.test.js:21, charmSpellUtils.aura-immunity.test.js:22 — both
// hand-write configs and call handleCharmSpell directly, bypassing this service) never reach it.
// Twin boundary: resolveCharmSaveDc / getTargetHealthAdvantage / isTargetHumanoid are LOCAL
// copies in charmPersonService.js (grep: no shared charm helper util exists; charmSpellUtils is
// handler-layer only), so the DC chain, advantage truth table (incl downed-0) and the CLA-219
// !! metamagicHeighten coercion (charmPersonService.js:113,142) are charmPerson-produced bytes
// pinned HERE; charmMonster #1343 pins its own twin copies in its own file, no overlap.
// Disk spells.json (read 2026-10-20): 'Charm Person' level 1, Enchantment, WIS save
// (dc_success none), humanoid target only, duration 1 hour (combat-scoped — this service stores
// no timer, per no-timers policy). Near-miss rows 'Charm Monster' (level 4) and 'Dominate
// Person' must never route through the name gate. slotLevel transport feeds the
// CreatureSelectionModal multi-target path (charmPersonTargets).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    addEntry: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { triggerCharmPerson } from './charmPersonService.js';

// 'Charm Person' level 1 mirrors the disk row; card saveDc 15 vs proficiency 3
// (fallback 8+3=11) and bare caster (8+2=10) keep the DC branches distinguishable.
const spell = { name: 'Charm Person', level: 1 };
const caster = { name: 'Bard', proficiency: 3, spellAbilities: { saveDc: 15 } };
const CAMPAIGN = 'TestCampaign';
const HANDLED = { type: 'popup', payload: { type: 'automation', name: 'handled' } };

const npc = (name, currentHp, maxHp = 10) => ({ name, type: 'npc', currentHp, maxHp });

beforeEach(() => {
    // vitest-4 re-seed: resetAllMocks drops factory defaults, so re-establish every stub.
    // getMonsterData is seeded Humanoid explicitly so envelope tests pass by intent, not by
    // an undefined-returning mock silently hitting the default-Humanoid branch.
    vi.resetAllMocks();
    executeHandler.mockResolvedValue(HANDLED);
    getCombatContext.mockResolvedValue({ creatures: [casterAsCreature(), npc('Goblin', 5)] });
    getTargetFromAttacker.mockReturnValue(undefined);
    getMonsterData.mockResolvedValue({ type: 'Humanoid' });
    addEntry.mockResolvedValue({});
    getRuntimeValue.mockReturnValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

function casterAsCreature() {
    return { name: 'Bard', type: 'player' };
}

const infoPopup = (description) => ({
    type: 'popup',
    payload: { type: 'automation_info', name: 'Charm Person', description },
});

describe('charmPersonService.triggerCharmPerson (producer lane)', () => {
    it('gate: only "Charm Person" routes here, case-insensitively; near-miss and malformed names return null', async () => {
        for (const name of [null, undefined, '', 'Charm', 'Person', 'Charming Person', 'Charm Monster', 'Dominate Person']) {
            expect(await triggerCharmPerson({ name }, { targetName: 'Goblin' }, caster, CAMPAIGN, null)).toBeNull();
        }
        expect(executeHandler).not.toHaveBeenCalled();

        for (const name of ['CHARM PERSON', 'charm person', 'ChArM PeRsOn']) {
            expect(await triggerCharmPerson({ name }, { targetName: 'Goblin' }, caster, CAMPAIGN, null)).toBe(HANDLED);
        }
        expect(executeHandler).toHaveBeenCalledTimes(3);
    });

    it('single target: exact rebuilt envelope, upcast slotLevel, CLA-219 transport, arg and return identity', async () => {
        const characters = [{ name: 'Bard' }];

        const result = await triggerCharmPerson(
            spell,
            { targetName: 'Goblin', slotLevel: 2, metamagicHeighten: true, characters },
            caster, CAMPAIGN, 'dungeon-map');

        const [action, stats, campaign, map] = executeHandler.mock.calls[0];
        expect(action).toEqual({
            name: 'Charm Person',
            automation: { type: 'charm_person', saveDc: 15, targetName: 'Goblin', advantage: true },
            // rebuilt metaCtx: targetName/slotLevel are consumed and stripped; only the transport survives
            metaCtx: { characters, metamagicHeighten: true },
            spell,
            spellSlotLevel: 2, // metaCtx.slotLevel beats spell.level 1 (upcast transport)
        });
        expect(action.spell).toBe(spell);
        expect(action.metaCtx.characters).toBe(characters);
        expect(stats).toBe(caster);
        expect(campaign).toBe(CAMPAIGN);
        expect(map).toBe('dungeon-map');
        expect(result).toBe(HANDLED);
    });

    it('DC chain is produced here: metaCtx.spellSaveDc beats card saveDc beats 8+proficiency beats 8+2; no-flag metaCtx coerces metamagicHeighten false', async () => {
        const profOnlyCaster = { name: 'Rook', proficiency: 3 };
        const bareCaster = { name: 'Rook' };

        await triggerCharmPerson(spell, { targetName: 'Goblin', spellSaveDc: 20 }, caster, CAMPAIGN, null);
        await triggerCharmPerson(spell, { targetName: 'Goblin' }, caster, CAMPAIGN, null);
        await triggerCharmPerson(spell, { targetName: 'Goblin' }, profOnlyCaster, CAMPAIGN, null);
        await triggerCharmPerson(spell, { targetName: 'Goblin' }, bareCaster, CAMPAIGN, null);

        // 20 (metaCtx beats card 15), 15 (card), 11 (8+prof 3), 10 (8+default prof 2) — distinguishable by design
        expect(executeHandler.mock.calls.map(([a]) => a.automation.saveDc)).toEqual([20, 15, 11, 10]);
        // CLA-219 control: absent flag arrives at the handler as explicit false, once per rebuild
        expect(executeHandler.mock.calls[3][0].metaCtx).toEqual({ characters: [], metamagicHeighten: false });
    });

    it('advantage truth table (produced here): hurt NPC true, full-health NPC false, downed-0 NPC false; player lane reads runtime store, not initiative row, and skips getMonsterData', async () => {
        await triggerCharmPerson(spell, { targetName: 'Goblin' }, caster, CAMPAIGN, null); // 5/10 hurt
        getCombatContext.mockResolvedValue({ creatures: [casterAsCreature(), npc('Goblin', 10)] });
        await triggerCharmPerson(spell, { targetName: 'Goblin' }, caster, CAMPAIGN, null); // full
        getCombatContext.mockResolvedValue({ creatures: [casterAsCreature(), npc('Goblin', 0)] });
        await triggerCharmPerson(spell, { targetName: 'Goblin' }, caster, CAMPAIGN, null); // downed

        getCombatContext.mockResolvedValue({ creatures: [casterAsCreature(), { name: 'Cleric', type: 'player' }] });
        getRuntimeValue.mockImplementation((charName, key) =>
            charName === 'Cleric' && key === 'currentHitPoints' ? 10
                : charName === 'Cleric' && key === 'hitPoints' ? 20 : undefined);
        const monsterCallsBeforePlayer = getMonsterData.mock.calls.length;
        await triggerCharmPerson(spell, { targetName: 'Cleric' }, caster, CAMPAIGN, null); // runtime 10/20 hurt

        getRuntimeValue.mockReturnValue(undefined); // runtime store empty: 0 HP fails the currentHp > 0 guard
        await triggerCharmPerson(spell, { targetName: 'Cleric' }, caster, CAMPAIGN, null);

        expect(executeHandler.mock.calls.map(([a]) => a.automation.advantage)).toEqual([true, false, false, true, false]);
        expect(getRuntimeValue).toHaveBeenCalledWith('Cleric', 'currentHitPoints', CAMPAIGN);
        expect(getRuntimeValue).toHaveBeenCalledWith('Cleric', 'hitPoints', CAMPAIGN);
        // player-type creatures are Humanoid by definition — no bestiary lookup
        expect(getMonsterData).toHaveBeenCalledTimes(monsterCallsBeforePlayer);
    });

    it('humanoid-only gate: Beast refusal is an exact popup plus exact campaign log, pipeline never opens', async () => {
        getCombatContext.mockResolvedValue({ creatures: [casterAsCreature(), npc('Wolf', 10)] });
        getMonsterData.mockResolvedValue({ type: 'Beast' });

        const result = await triggerCharmPerson(spell, { targetName: 'Wolf' }, caster, CAMPAIGN, null);

        expect(result).toEqual(infoPopup('No effect. Wolf is not a Humanoid.'));
        expect(executeHandler).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'ability_use',
            characterName: 'Bard',
            abilityName: 'Charm Person',
            description: 'Bard casts Charm Person on Wolf but it has no effect — Wolf is not a Humanoid.',
        });
    });

    it('indeterminate monster type defaults to Humanoid (proceeds): null context, empty roster, unknown name, typeless or throwing monster data', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const contexts = [
            null,
            { creatures: [] },
            { creatures: [casterAsCreature()] }, // target name absent from roster
        ];
        for (const cs of contexts) {
            getCombatContext.mockResolvedValue(cs);
            await triggerCharmPerson(spell, { targetName: 'Mystery' }, caster, CAMPAIGN, null);
        }

        getCombatContext.mockResolvedValue({ creatures: [casterAsCreature(), npc('Mystery', 10)] });
        getMonsterData.mockResolvedValue({}); // row without type falls through to default
        await triggerCharmPerson(spell, { targetName: 'Mystery' }, caster, CAMPAIGN, null);
        const err = new Error('Failed to load');
        getMonsterData.mockRejectedValue(err);
        await triggerCharmPerson(spell, { targetName: 'Mystery' }, caster, CAMPAIGN, null);

        expect(executeHandler).toHaveBeenCalledTimes(5);
        expect(executeHandler.mock.calls.map(([a]) => a.automation.targetName)).toEqual(['Mystery', 'Mystery', 'Mystery', 'Mystery', 'Mystery']);
        expect(warnSpy).toHaveBeenCalledWith('[charmPersonService] Monster data unavailable, defaulting to Humanoid:', err);
    });

    it('no-target refusal: exact console.error and automation_info popup; empty initiative refuses without consulting getTargetFromAttacker', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        getTargetFromAttacker.mockReturnValue(null);

        const popup = await triggerCharmPerson(spell, {}, caster, CAMPAIGN, null);

        expect(spy).toHaveBeenCalledWith('[charmPersonService] No target selected for Charm Person by Bard. Caster has no target in initiative view.');
        expect(popup).toEqual(infoPopup('No target selected for Charm Person.'));
        expect(executeHandler).not.toHaveBeenCalled();
        expect(getTargetFromAttacker).toHaveBeenCalledTimes(1);

        // undefined metaCtx and empty initiative both refuse without ever consulting the attacker target
        getCombatContext.mockResolvedValue({ creatures: [] });
        expect(await triggerCharmPerson(spell, undefined, caster, CAMPAIGN, null)).toEqual(infoPopup('No target selected for Charm Person.'));
        expect(await triggerCharmPerson(spell, {}, caster, CAMPAIGN, null)).toEqual(infoPopup('No target selected for Charm Person.'));
        expect(getTargetFromAttacker).toHaveBeenCalledTimes(1);
    });

    it('multi target: exact envelope with charmPersonAdvantages map, upcast slotLevel, CLA-219 transport; automation.advantage stays false', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [casterAsCreature(), npc('Goblin', 5), npc('Bandit', 11, 11)],
        });
        const characters = [{ name: 'Bard' }];

        const result = await triggerCharmPerson(
            spell,
            { charmPersonTargets: ['Goblin', 'Bandit'], characters, metamagicHeighten: true, slotLevel: 2 },
            caster, CAMPAIGN, 'dungeon-map');

        const [action] = executeHandler.mock.calls[0];
        expect(action).toEqual({
            name: 'Charm Person',
            // per-target advantage lives ONLY in charmPersonAdvantages; top-level advantage stays false
            automation: { type: 'charm_person', saveDc: 15, advantage: false },
            metaCtx: {
                charmPersonTargets: ['Goblin', 'Bandit'],
                charmPersonAdvantages: { Goblin: true, Bandit: false },
                characters,
                metamagicHeighten: true,
            },
            spell,
            spellSlotLevel: 2, // disk upcast transport: higher slot adds targets via the modal
        });
        expect(action.metaCtx.characters).toBe(characters);
        expect(result).toBe(HANDLED);
    });

    it('multi target: non-humanoids are filtered from the envelope and each rejection is logged; all-invalid refuses with exact popup', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [casterAsCreature(), npc('Goblin', 5), npc('Wolf', 10)],
        });
        getMonsterData.mockImplementation((name) =>
            Promise.resolve(name === 'Wolf' ? { type: 'Beast' } : { type: 'Humanoid' }));

        const result = await triggerCharmPerson(
            spell, { charmPersonTargets: ['Goblin', 'Wolf'] }, caster, CAMPAIGN, null);

        const [action] = executeHandler.mock.calls[0];
        expect(result).toBe(HANDLED);
        expect(action.metaCtx.charmPersonTargets).toEqual(['Goblin']); // Wolf filtered out before dispatch
        expect(action.metaCtx.charmPersonAdvantages).toEqual({ Goblin: true });
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            characterName: 'Bard',
            abilityName: 'Charm Person',
            description: 'Bard casts Charm Person on Wolf but it has no effect — Wolf is not a Humanoid.',
        }));

        // all targets invalid: refusal popup, pipeline never opens, one log per rejected target
        executeHandler.mockClear();
        addEntry.mockClear();
        const popup = await triggerCharmPerson(
            spell, { charmPersonTargets: ['Wolf'] }, caster, CAMPAIGN, null);

        expect(popup).toEqual(infoPopup('No valid Humanoid targets for Charm Person.'));
        expect(executeHandler).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledTimes(1);
    });

    it('handler crash fallback: console.error with the identical Error, exact info popup returned (owned here, not by a handler lane)', async () => {
        const err = new Error('handler boom');
        executeHandler.mockRejectedValue(err);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const popup = await triggerCharmPerson(spell, { targetName: 'Goblin' }, caster, CAMPAIGN, null);

        expect(spy).toHaveBeenCalledWith('[charmPersonService] Failed to execute Charm Person handler:', err);
        expect(popup).toEqual(infoPopup('Failed to execute Charm Person.'));
    });
});
