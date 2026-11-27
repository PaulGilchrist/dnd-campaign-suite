// @maintained-by-ai 2026-11-26
// Spell Thief reaction handler (CLA-325). Fully mocked runtime/log/save-prompt/
// combat-context — deterministic, no timers, Date.now frozen. Full-shape census pins:
// refusal family (spend nothing, exactly one refusal log entry), success and failure
// commit censuses (exact addEntry/setRuntimeValue mock.calls arrays in write ORDER).
// Consumer key contract (isBlockedBySpellThief/hasStolenSpell) pinned here; long-rest
// recharge lives in restRules-longRest tests, discovery in postCastRiderService tests,
// stolen-spell injection in spellCalc tests.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isBlockedBySpellThief, hasStolenSpell } from './spellThiefHandler.js';
import { makeAction, makePlayerStats } from './spellThief.test-utils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));
vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));
vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));
vi.mock('../../common/damageRollback.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, rollbackSpellEffects: vi.fn() };
});

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { buildSaveDc, createSaveListener } = await import('../../common/savePrompt.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { rollbackSpellEffects } = await import('../../common/damageRollback.js');

const CAMPAIGN = 'test-campaign';
const THIEF = 'FighterRogue';
const NOW = 1700000000000;
const COMBAT = {
    creatures: [{ name: 'Goblin' }, { name: 'Wizard' }, { name: 'HiddenAttacker' }, { name: 'Orc' }],
    round: 1,
};
const ROLLBACK_NOTHING = { targetsHealed: 0, conditionsRemoved: [], effectsRemoved: 0, damageHealed: 0 };

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    getCombatContext.mockResolvedValue(COMBAT);
    rollbackSpellEffects.mockResolvedValue(ROLLBACK_NOTHING);
});

// CLA-325 trigger gate: handler refuses unless lastAttack is a spell-origin cast by
// another creature that targeted the thief. This stamp satisfies the gate by default.
function spellCastStamp(overrides = {}) {
    return {
        attackerName: 'Goblin',
        targetName: THIEF,
        rollType: 'spell-save',
        saveType: 'DEX',
        saveDc: 13,
        isSpellDamage: true,
        actualDamage: 7,
        primaryDamage: 7,
        affectedTargets: [THIEF],
        ...overrides,
    };
}

// The campaign `lastAttack` stub lives here (findLastAttack reads it via the mocked
// runtime); every other runtime key reads as null unless a test layers its own impl.
function mockUses(uses, lastAttack) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spellThiefUses') return uses;
        if (name === 'campaign' && key === 'lastAttack') return lastAttack !== undefined ? lastAttack : spellCastStamp();
        return null;
    });
}

function mockSave(saveResult) {
    createSaveListener.mockReturnValue({ promptId: 'test-prompt-id', promise: Promise.resolve(saveResult) });
}

const SUCCESS_SAVE = { success: true, roll: 12, total: 16, saveBonus: 4 };
const FAILURE_SAVE = { success: false, roll: 5, total: 9, saveBonus: 4 };

const refusalLog = (description) => [CAMPAIGN, {
    type: 'automation',
    characterName: THIEF,
    automationType: 'spell_thief_refused',
    name: 'Spell Thief',
    description,
    timestamp: NOW,
}];

const promptLog = (dc = 13) => [CAMPAIGN, {
    type: 'ability_use',
    characterName: THIEF,
    abilityName: 'Spell Thief',
    description: `FighterRogue used Spell Thief — Goblin must make INT save (DC ${dc}) or lose the spell.`,
}];

const rollLog = (dc, saveResult, save, formula) => [CAMPAIGN, {
    type: 'roll',
    name: 'Spell Thief',
    characterName: THIEF,
    rollType: 'save-damage',
    targetName: 'Goblin',
    saveDc: dc,
    saveType: 'INT',
    saveResult,
    total: save.total,
    rolls: [save.roll],
    bonus: save.saveBonus,
    formula,
    timestamp: NOW,
}];

const abilityLog = (description) => [CAMPAIGN, {
    type: 'ability_use',
    characterName: THIEF,
    abilityName: 'Spell Thief',
    description,
}];

describe('spellThiefHandler', () => {
    it.each([0, -1])('refuses with %i uses remaining and spends/logs nothing', async (uses) => {
        mockUses(uses);
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), CAMPAIGN, null);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Spell Thief',
                description: 'Spell Thief has no uses remaining. Recharges after a Long Rest.',
                automation: action.automation,
            },
        });
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(rollbackSpellEffects).not.toHaveBeenCalled();
    });

    describe('CLA-325 trigger-gate refusals', () => {
        // Refusal family: each gate branch returns the refusal popup, logs exactly one
        // `automation`/`spell_thief_refused` entry, and touches no runtime write, no
        // save prompt, no rollback.
        it.each([
            ['no combat summary',
                () => { mockUses(1); getCombatContext.mockResolvedValue(null); },
                'Spell Thief requires an active combat. Select a creature in combat and try again.'],
            ['no recent attack',
                () => mockUses(1, null),
                'Spell Thief — no recent spell cast to respond to.'],
            ['last attack was a weapon attack',
                () => mockUses(1, { attackerName: 'Goblin', targetName: THIEF, rollType: 'attack', saveType: null, saveDc: null, isSpellDamage: false, actualDamage: 5 }),
                'Spell Thief — the most recent attack was not a spell cast. No spell to steal.'],
            ['thief cast the spell themselves',
                () => mockUses(1, spellCastStamp({ attackerName: THIEF })),
                "Spell Thief responds to another creature's spell — you cannot steal from yourself."],
            ['unidentifiable caster',
                () => mockUses(1, spellCastStamp({ attackerName: null })),
                'Spell Thief — could not identify the spellcaster.'],
            ['spell did not target the thief',
                () => mockUses(1, spellCastStamp({ targetName: 'Orc', affectedTargets: ['Orc'] })),
                'Spell Thief — the most recent spell did not target you.'],
            ['caster is not in combat',
                () => mockUses(1, spellCastStamp({ attackerName: 'FarAwayCaster' })),
                'Spell Thief — FarAwayCaster is not in combat.'],
        ])('refuses for %s and spends nothing', async (_label, setup, description) => {
            setup();
            buildSaveDc.mockReturnValue(13);
            const action = makeAction({ casterName: null });

            const result = await handle(action, makePlayerStats(), CAMPAIGN, null);

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Spell Thief', description, automation: action.automation },
            });
            expect(addEntry.mock.calls).toEqual([refusalLog(description)]);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(createSaveListener).not.toHaveBeenCalled();
            expect(rollbackSpellEffects).not.toHaveBeenCalled();
        });

        it('passes the target gate when the thief is one of several AoE affected targets', async () => {
            mockUses(1, spellCastStamp({ attackScope: 'aoe', targetName: null, affectedTargets: ['DivinationWizard', THIEF] }));
            buildSaveDc.mockReturnValue(14);
            mockSave(SUCCESS_SAVE);

            const result = await handle(makeAction({ casterName: null }), makePlayerStats(), CAMPAIGN, null);

            expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, { targetName: 'Goblin', saveType: 'INT', saveDc: 14 });
            expect(result.payload.description).toBe('Goblin succeeded on INT save (DC 14). Spell Thief has no effect.');
        });
    });

    describe('save flow commit censuses', () => {
        it.each([
            [{ ...SUCCESS_SAVE }, '1d20+4'],
            // saveBonus 0 renders a bare 1d20 formula with bonus pinned at 0
            [{ success: true, roll: 12, total: 12, saveBonus: 0 }, '1d20'],
        ])('defaults uses to 1 when unset and commits the full success sequence (formula %s)', async (save, formula) => {
            mockUses(undefined);
            buildSaveDc.mockReturnValue(13);
            mockSave(save);
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), CAMPAIGN, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Spell Thief',
                    description: 'Goblin succeeded on INT save (DC 13). Spell Thief has no effect.',
                    automation: action.automation,
                },
            });
            expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, { targetName: 'Goblin', saveType: 'INT', saveDc: 13 });
            expect(setRuntimeValue.mock.calls).toEqual([[THIEF, 'spellThiefUses', 0, CAMPAIGN]]);
            expect(addEntry.mock.calls).toEqual([
                promptLog(),
                rollLog(13, 'success', save, formula),
                abilityLog('Goblin succeeded on INT save (DC 13). Spell Thief has no effect.'),
            ]);
            expect(rollbackSpellEffects).not.toHaveBeenCalled();
        });

        it.each([
            ['rolled-back damage, conditions and effects',
                { targetsHealed: 1, conditionsRemoved: ['frightened'], effectsRemoved: 2, damageHealed: 9 },
                'Goblin failed INT save (DC 13). Spell negated. 9 HP restored, 1 condition(s) and 2 effect(s) rolled back. FighterRogue steals Burning Hands for 8 hours.',
                "Spell Thief negated 'Burning Hands' — 9 HP restored, 1 condition(s) removed, 2 target effect(s) cleared."],
            ['nothing left to roll back',
                ROLLBACK_NOTHING,
                'Goblin failed INT save (DC 13). Spell negated. FighterRogue steals Burning Hands for 8 hours.',
                null],
        ])('commits the full steal sequence on a failed save with %s', async (_label, rollback, description, negationLine) => {
            rollbackSpellEffects.mockResolvedValue(rollback);
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSave(FAILURE_SAVE);
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), CAMPAIGN, null);

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Spell Thief', description, automation: action.automation },
            });
            expect(rollbackSpellEffects).toHaveBeenCalledWith(
                expect.objectContaining({ attackerName: 'Goblin', targetName: THIEF, rollType: 'spell-save' }),
                CAMPAIGN,
                'Spell Thief',
                COMBAT,
            );
            // Uses decrement first, then blocked bool -> blocked list -> caster list,
            // then stolen bool -> stolen list. The Goblin stamp has no type: 'player',
            // so the monster-caster advisory block wording applies.
            const spellEntry = JSON.stringify([{ casterName: 'Goblin', spellName: 'Burning Hands' }]);
            const casterEntry = JSON.stringify([{ thiefName: THIEF, spellName: 'Burning Hands' }]);
            expect(setRuntimeValue.mock.calls).toEqual([
                [THIEF, 'spellThiefUses', 0, CAMPAIGN],
                [THIEF, 'spellThiefBlocked_Goblin_Burning Hands', true, CAMPAIGN],
                [THIEF, '_spellThiefBlockedList', spellEntry, CAMPAIGN],
                ['Goblin', '_spellThiefCasterBlock', casterEntry, CAMPAIGN],
                [THIEF, 'spellThiefStolen_Goblin_Burning Hands', true, CAMPAIGN],
                [THIEF, '_spellThiefStolenList', spellEntry, CAMPAIGN],
            ]);
            const expectedLog = [promptLog(), rollLog(13, 'failure', FAILURE_SAVE, '1d20+4')];
            if (negationLine) expectedLog.push(abilityLog(negationLine));
            expectedLog.push(abilityLog(
                `${description} Goblin is blocked from recasting Burning Hands for 8 hours (recorded; GM-enforced for monsters).`,
            ));
            expect(addEntry.mock.calls).toEqual(expectedLog);
            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
            dispatchSpy.mockRestore();
        });

        it('propagates a save-listener rejection instead of swallowing it', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.reject(new Error('save prompt failed')),
            });

            await expect(handle(makeAction(), makePlayerStats(), CAMPAIGN, null))
                .rejects.toThrow('save prompt failed');
        });

        it.each([
            ['automation saveType', { saveType: 'WIS' }, 'WIS'],
            ['missing automation.saveType defaulting to INT', {}, 'INT'],
        ])('prompts and logs the save with %s', async (_label, automation, saveType) => {
            mockUses(1);
            buildSaveDc.mockReturnValue(15);
            mockSave(SUCCESS_SAVE);

            await handle(makeAction({ automation }), makePlayerStats(), CAMPAIGN, null);

            expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, { targetName: 'Goblin', saveType, saveDc: 15 });
            expect(addEntry.mock.calls[1][1]).toEqual(expect.objectContaining({ type: 'roll', rollType: 'save-damage', saveType }));
        });
    });

    describe('feature naming and uses-key derivation', () => {
        it.each([
            ['Custom Feature', 'customFeatureUses'],
            [undefined, 'spellThiefUses'],
        ])('names the popup %s and reads/writes the derived uses key', async (name, usesKey) => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSave(SUCCESS_SAVE);
            const label = name || 'Spell Thief';
            const action = makeAction({ name });

            const result = await handle(action, makePlayerStats(), CAMPAIGN, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: label,
                    description: `Goblin succeeded on INT save (DC 13). ${label} has no effect.`,
                    automation: action.automation,
                },
            });
            expect(getRuntimeValue).toHaveBeenCalledWith(THIEF, usesKey);
            expect(setRuntimeValue.mock.calls).toEqual([[THIEF, usesKey, 0, CAMPAIGN]]);
        });
    });

    describe('stolen-spell bookkeeping', () => {
        it.each([
            ['action.casterName wins over the stamp attacker',
                { casterName: 'Wizard' }, spellCastStamp(), 'Wizard', 'Burning Hands'],
            ['falls back to the stamp attacker',
                { casterName: null }, spellCastStamp({ attackerName: 'HiddenAttacker' }), 'HiddenAttacker', 'Burning Hands'],
            ['falls back to attackName for the spell name',
                { casterName: null, spellName: null }, spellCastStamp({ attackerName: 'HiddenAttacker', attackName: 'Hidden Spell' }), 'HiddenAttacker', 'Hidden Spell'],
            ['falls back to "unknown spell" when every spell source is missing',
                { casterName: null, spellName: null }, spellCastStamp({ attackName: null }), 'Goblin', 'unknown spell'],
        ])('resolves keys: %s', async (_label, actionOverrides, stamp, caster, spell) => {
            mockUses(1, stamp);
            buildSaveDc.mockReturnValue(13);
            mockSave(FAILURE_SAVE);

            await handle(makeAction(actionOverrides), makePlayerStats(), CAMPAIGN, null);

            expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ targetName: caster }));
            const spellEntry = JSON.stringify([{ casterName: caster, spellName: spell }]);
            const casterEntry = JSON.stringify([{ thiefName: THIEF, spellName: spell }]);
            expect(setRuntimeValue.mock.calls).toEqual([
                [THIEF, 'spellThiefUses', 0, CAMPAIGN],
                [THIEF, `spellThiefBlocked_${caster}_${spell}`, true, CAMPAIGN],
                [THIEF, '_spellThiefBlockedList', spellEntry, CAMPAIGN],
                [caster, '_spellThiefCasterBlock', casterEntry, CAMPAIGN],
                [THIEF, `spellThiefStolen_${caster}_${spell}`, true, CAMPAIGN],
                [THIEF, '_spellThiefStolenList', spellEntry, CAMPAIGN],
            ]);
        });

        it('strips the leading action number from monster-card spell labels', async () => {
            mockUses(1, spellCastStamp({ attackName: '3. Frost Ray' }));
            buildSaveDc.mockReturnValue(13);
            mockSave(FAILURE_SAVE);

            await handle(makeAction({ casterName: null, spellName: null }), makePlayerStats(), CAMPAIGN, null);

            const spellEntry = JSON.stringify([{ casterName: 'Goblin', spellName: 'Frost Ray' }]);
            expect(setRuntimeValue.mock.calls).toEqual([
                [THIEF, 'spellThiefUses', 0, CAMPAIGN],
                [THIEF, 'spellThiefBlocked_Goblin_Frost Ray', true, CAMPAIGN],
                [THIEF, '_spellThiefBlockedList', spellEntry, CAMPAIGN],
                ['Goblin', '_spellThiefCasterBlock', JSON.stringify([{ thiefName: THIEF, spellName: 'Frost Ray' }]), CAMPAIGN],
                [THIEF, 'spellThiefStolen_Goblin_Frost Ray', true, CAMPAIGN],
                [THIEF, '_spellThiefStolenList', spellEntry, CAMPAIGN],
            ]);
        });

        it('does not rewrite any stored list when the entries are already present', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSave(FAILURE_SAVE);
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'spellThiefUses') return 1;
                if (name === 'campaign' && key === 'lastAttack') return spellCastStamp();
                if (key === '_spellThiefBlockedList' || key === '_spellThiefStolenList') {
                    return JSON.stringify([{ casterName: 'Goblin', spellName: 'Burning Hands' }]);
                }
                if (key === '_spellThiefCasterBlock') {
                    return JSON.stringify([{ thiefName: THIEF, spellName: 'Burning Hands' }]);
                }
                return null;
            });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(setRuntimeValue.mock.calls).toEqual([
                [THIEF, 'spellThiefUses', 0, CAMPAIGN],
                [THIEF, 'spellThiefBlocked_Goblin_Burning Hands', true, CAMPAIGN],
                [THIEF, 'spellThiefStolen_Goblin_Burning Hands', true, CAMPAIGN],
            ]);
        });

        it('parses stored JSON lists and appends the new entry', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSave(FAILURE_SAVE);
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'spellThiefUses') return 1;
                if (name === 'campaign' && key === 'lastAttack') return spellCastStamp();
                if (key === '_spellThiefBlockedList') return JSON.stringify([{ casterName: 'Other', spellName: 'Other Spell' }]);
                if (key === '_spellThiefStolenList') return '[]';
                if (key === '_spellThiefCasterBlock') return JSON.stringify([{ thiefName: 'OtherThief', spellName: 'Other Spell' }]);
                return null;
            });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            const single = JSON.stringify([{ casterName: 'Goblin', spellName: 'Burning Hands' }]);
            expect(setRuntimeValue.mock.calls).toEqual([
                [THIEF, 'spellThiefUses', 0, CAMPAIGN],
                [THIEF, 'spellThiefBlocked_Goblin_Burning Hands', true, CAMPAIGN],
                [THIEF, '_spellThiefBlockedList', JSON.stringify([
                    { casterName: 'Other', spellName: 'Other Spell' },
                    { casterName: 'Goblin', spellName: 'Burning Hands' },
                ]), CAMPAIGN],
                ['Goblin', '_spellThiefCasterBlock', JSON.stringify([
                    { thiefName: 'OtherThief', spellName: 'Other Spell' },
                    { thiefName: THIEF, spellName: 'Burning Hands' },
                ]), CAMPAIGN],
                [THIEF, 'spellThiefStolen_Goblin_Burning Hands', true, CAMPAIGN],
                [THIEF, '_spellThiefStolenList', single, CAMPAIGN],
            ]);
        });
    });

    describe('log resilience', () => {
        it.each([true, false])('still completes the handler when every addEntry rejects (save %s)', async (success) => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSave(success ? SUCCESS_SAVE : FAILURE_SAVE);
            addEntry.mockRejectedValue(new Error('log error'));
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(result.payload.description).toContain(success ? 'succeeded on INT save' : 'failed INT save');
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('consumer key contract', () => {
        it.each([[true, true], [false, false], [undefined, false], [null, false], [0, false], ['', false]])(
            'isBlockedBySpellThief returns %s when the blocked key reads %s',
            async (stored, expected) => {
                getRuntimeValue.mockReturnValue(stored);

                expect(isBlockedBySpellThief(THIEF, 'Goblin', 'Burning Hands', CAMPAIGN)).toBe(expected);
                expect(getRuntimeValue).toHaveBeenCalledWith(THIEF, 'spellThiefBlocked_Goblin_Burning Hands', CAMPAIGN);
            },
        );

        it.each([[true, true], [false, false], [undefined, false], [null, false], [0, false], ['', false]])(
            'hasStolenSpell returns %s when the stolen key reads %s',
            async (stored, expected) => {
                getRuntimeValue.mockReturnValue(stored);

                expect(hasStolenSpell(THIEF, 'Goblin', 'Burning Hands', CAMPAIGN)).toBe(expected);
                expect(getRuntimeValue).toHaveBeenCalledWith(THIEF, 'spellThiefStolen_Goblin_Burning Hands', CAMPAIGN);
            },
        );
    });
});
