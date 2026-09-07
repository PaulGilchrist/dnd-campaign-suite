// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
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
    getCombatContext: vi.fn(async () => ({
        creatures: [{ name: 'Goblin' }, { name: 'Wizard' }, { name: 'HiddenAttacker' }, { name: 'Orc' }],
        round: 1,
    })),
}));
vi.mock('../../common/damageRollback.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        rollbackSpellEffects: vi.fn(async () => ({
            targetsHealed: 1,
            conditionsRemoved: [],
            effectsRemoved: 0,
            damageHealed: 7,
            logDescription: 'mock rollback',
        })),
    };
});

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { buildSaveDc, createSaveListener } = await import('../../common/savePrompt.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { rollbackSpellEffects } = await import('../../common/damageRollback.js');

beforeEach(() => {
    vi.resetAllMocks();
    getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin' }, { name: 'Wizard' }, { name: 'HiddenAttacker' }, { name: 'Orc' }],
        round: 1,
    });
    rollbackSpellEffects.mockResolvedValue({
        targetsHealed: 1,
        conditionsRemoved: [],
        effectsRemoved: 0,
        damageHealed: 7,
        logDescription: 'mock rollback',
    });
});

// CLA-325 trigger gate: handler refuses unless lastAttack is a spell-origin cast by
// another creature that targeted the thief. This stamp satisfies the gate by default.
function spellCastStamp(overrides = {}) {
    return {
        attackerName: 'Goblin',
        targetName: 'FighterRogue',
        rollType: 'spell-save',
        saveType: 'DEX',
        saveDc: 13,
        isSpellDamage: true,
        actualDamage: 7,
        primaryDamage: 7,
        affectedTargets: ['FighterRogue'],
        ...overrides,
    };
}

function mockUses(uses, lastAttack) {
    getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (key === 'spellthiefUses') return uses;
        if (name === 'campaign' && key === 'lastAttack') return lastAttack !== undefined ? lastAttack : spellCastStamp();
        return null;
    });
}

function mockSaveResult(success) {
    createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success, roll: 12, total: 16, saveBonus: 4 }),
    });
}

describe('spellThiefHandler', () => {
    describe('handle - no uses remaining', () => {
        it('returns popup with no-uses message when uses are 0', async () => {
            mockUses(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Spell Thief');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('returns popup with no-uses message when uses are negative', async () => {
            mockUses(-1);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('defaults to 1 use when runtime value is undefined', async () => {
            mockUses(undefined);
            buildSaveDc.mockReturnValue(13);
            mockSaveResult(true);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Spell Thief');
            expect(result.payload.description).toContain('INT save');
            expect(result.payload.description).toContain('DC 13');
        });
    });

    describe('handle - save flow', () => {
        beforeEach(() => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
        });

        it('sends save prompt via createSaveListener with correct parameters', async () => {
            mockSaveResult(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin',
                saveType: 'INT',
                saveDc: 13,
            }));
        });

        it('uses custom saveType from automation', async () => {
            const action = makeAction({ automation: { saveType: 'WIS' } });
            buildSaveDc.mockReturnValue(15);
            mockSaveResult(true);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                saveType: 'WIS',
            }));
        });

        it('uses action casterName for save prompt target when provided', async () => {
            const action = makeAction({ casterName: 'Orc' });
            mockSaveResult(true);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Orc',
            }));
        });

        it('falls back to targetName when casterName is null or undefined', async () => {
            mockSaveResult(true);

            await handle(makeAction({ casterName: null }), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('logs ability_use on initialization with feature name', async () => {
            mockSaveResult(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'FighterRogue',
                abilityName: 'Spell Thief',
            }));
        });

        it('returns popup with success description after save success', async () => {
            mockSaveResult(true);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Spell Thief');
            expect(result.payload.description).toContain('succeeded on INT save');
        });

        it('returns popup with failure description after save failure', async () => {
            mockSaveResult(false);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Spell Thief');
            expect(result.payload.description).toContain('failed INT save');
        });

        it('logs save result roll entry with correct details', async () => {
            mockSaveResult(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                targetName: 'Goblin',
                saveDc: 13,
                saveType: 'INT',
                saveResult: 'success',
                total: 16,
                rolls: [12],
                bonus: 4,
                formula: '1d20+4',
            }));
        });

        it('logs ability_use entry with save result description', async () => {
            mockSaveResult(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'FighterRogue',
                abilityName: 'Spell Thief',
                description: expect.stringContaining('succeeded on INT save'),
            }));
        });

        it('logs failure ability_use description on save failure', async () => {
            mockSaveResult(false);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'FighterRogue',
                abilityName: 'Spell Thief',
                description: expect.stringContaining('failed INT save'),
            }));
        });

        it('dispatches combat-summary-updated event on failure', async () => {
            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
            mockSaveResult(false);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'combat-summary-updated',
            }));

            dispatchEventSpy.mockRestore();
        });

        it('sets blocked and stolen keys for caster+spell on failure', async () => {
            mockSaveResult(false);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'spellThiefBlocked_Goblin_Burning Hands'
            );
            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'spellThiefStolen_Goblin_Burning Hands'
            );

            expect(blockedCalls).toHaveLength(1);
            expect(blockedCalls[0]).toEqual([
                'FighterRogue',
                'spellThiefBlocked_Goblin_Burning Hands',
                true,
                'test-campaign'
            ]);
            expect(stolenCalls).toHaveLength(1);
            expect(stolenCalls[0]).toEqual([
                'FighterRogue',
                'spellThiefStolen_Goblin_Burning Hands',
                true,
                'test-campaign'
            ]);
        });

        it('sets caster blocked entry on failure', async () => {
            mockSaveResult(false);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const casterBlockCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_spellThiefCasterBlock'
            );
            expect(casterBlockCalls).toHaveLength(1);
            expect(casterBlockCalls[0][0]).toBe('Goblin');
            expect(casterBlockCalls[0][1]).toBe('_spellThiefCasterBlock');
            const entries = JSON.parse(casterBlockCalls[0][2]);
            expect(entries).toEqual([{ thiefName: 'FighterRogue', spellName: 'Burning Hands' }]);
        });

        it('uses action casterName when provided for blocked/stolen keys', async () => {
            const action = makeAction({ casterName: 'Wizard' });
            mockSaveResult(false);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefBlocked')
            );
            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefStolen')
            );

            expect(blockedCalls).toHaveLength(2);
            expect(blockedCalls[0][1]).toBe('spellThiefBlocked_Wizard_Burning Hands');
            expect(stolenCalls).toHaveLength(2);
            expect(stolenCalls[0][1]).toBe('spellThiefStolen_Wizard_Burning Hands');
        });

        it('uses action spellName when provided for blocked/stolen keys', async () => {
            const action = makeAction({ spellName: 'Fireball' });
            mockSaveResult(false);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefBlocked')
            );
            expect(blockedCalls[0][1]).toBe('spellThiefBlocked_Goblin_Fireball');
        });

        it('uses targetName as fallback caster when no casterName', async () => {
            const action = makeAction({ casterName: null });
            mockSaveResult(false);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefBlocked')
            );
            expect(blockedCalls[0][1]).toBe('spellThiefBlocked_Goblin_Burning Hands');
        });

        it('uses "unknown spell" fallback when no spellName', async () => {
            const action = makeAction({ spellName: null });
            mockSaveResult(false);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefStolen')
            );
            expect(stolenCalls[0][1]).toBe('spellThiefStolen_Goblin_unknown spell');
        });

        it('decrements uses regardless of save result', async () => {
            mockSaveResult(false);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('FighterRogue', 'spellthiefUses', 0, 'test-campaign');
        });
    });

    describe('handle - custom feature name', () => {
        it('uses action name in popup when provided', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });
            const action = makeAction({ name: 'Custom Feature' });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Custom Feature');
        });
    });

    describe('handle - lastAttack fallback', () => {
        it('uses lastAttack.attackerName when casterName is missing', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellthiefUses') return 1;
                if (_name === 'campaign' && _key === 'lastAttack') return spellCastStamp({ attackerName: 'HiddenAttacker' });
                return null;
            });
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true, roll: 10, total: 14, saveBonus: 4 }),
            });
            const action = makeAction({ casterName: null });
            action.spellName = null;

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'HiddenAttacker',
            }));
        });

        it('uses lastAttack.attackName as spellName fallback', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellthiefUses') return 1;
                if (_name === 'campaign' && _key === 'lastAttack') return spellCastStamp({ attackerName: 'HiddenAttacker', attackName: 'Hidden Spell' });
                return null;
            });
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: false, roll: 5, total: 9, saveBonus: 4 }),
            });
            const action = makeAction({ casterName: null, spellName: null });
            await handle(action, makePlayerStats(), 'test-campaign', null);

            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefStolen')
            );
            expect(stolenCalls[0][1]).toBe('spellThiefStolen_HiddenAttacker_Hidden Spell');
        });

        it('uses zero saveBonus in formula when bonus is 0', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSaveResult(true);

            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true, roll: 12, total: 12, saveBonus: 0 }),
            });
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                formula: '1d20',
                bonus: 0,
            }));
        });
    });

    describe('handle - duplicate prevention in addBlockedSpell', () => {
        it('does not add duplicate blocked entry when already in list', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellthiefUses') return 1;
                if (_name === 'campaign' && _key === 'lastAttack') return spellCastStamp();
                if (_name === 'FighterRogue' && _key === '_spellThiefBlockedList') return JSON.stringify([{ casterName: 'Goblin', spellName: 'Burning Hands' }]);
                if (_name === 'Goblin' && _key === '_spellThiefCasterBlock') return JSON.stringify([{ thiefName: 'FighterRogue', spellName: 'Burning Hands' }]);
                return null;
            });
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: false, roll: 5, total: 9, saveBonus: 4 }),
            });
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const blockedListCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_spellThiefBlockedList'
            );
            const casterBlockCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_spellThiefCasterBlock'
            );
            expect(blockedListCalls).toHaveLength(0);
            expect(casterBlockCalls).toHaveLength(0);
        });

        it('does not add duplicate stolen entry when already in list', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellthiefUses') return 1;
                if (_name === 'campaign' && _key === 'lastAttack') return spellCastStamp();
                if (_name === 'FighterRogue' && _key === '_spellThiefStolenList') return JSON.stringify([{ casterName: 'Goblin', spellName: 'Burning Hands' }]);
                return null;
            });
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: false, roll: 5, total: 9, saveBonus: 4 }),
            });
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const stolenListCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_spellThiefStolenList'
            );
            expect(stolenListCalls).toHaveLength(0);
        });

        it('adds to blocked list when entry is not duplicate', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellthiefUses') return 1;
                if (_name === 'campaign' && _key === 'lastAttack') return spellCastStamp();
                if (_name === 'FighterRogue' && _key === '_spellThiefBlockedList') return JSON.stringify([{ casterName: 'Other', spellName: 'Other Spell' }]);
                if (_name === 'Goblin' && _key === '_spellThiefCasterBlock') return JSON.stringify([{ thiefName: 'OtherThief', spellName: 'Other Spell' }]);
                return null;
            });
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: false, roll: 5, total: 9, saveBonus: 4 }),
            });
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const blockedListCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_spellThiefBlockedList'
            );
            expect(blockedListCalls).toHaveLength(1);
            const entries = JSON.parse(blockedListCalls[0][2]);
            expect(entries).toEqual([
                { casterName: 'Other', spellName: 'Other Spell' },
                { casterName: 'Goblin', spellName: 'Burning Hands' }
            ]);
        });

        it('adds to stolen list when entry is not duplicate', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellthiefUses') return 1;
                if (_name === 'campaign' && _key === 'lastAttack') return spellCastStamp();
                if (_name === 'FighterRogue' && _key === '_spellThiefStolenList') return JSON.stringify([{ casterName: 'Other', spellName: 'Other Spell' }]);
                return null;
            });
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: false, roll: 5, total: 9, saveBonus: 4 }),
            });
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const stolenListCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_spellThiefStolenList'
            );
            expect(stolenListCalls).toHaveLength(1);
            const entries = JSON.parse(stolenListCalls[0][2]);
            expect(entries).toEqual([
                { casterName: 'Other', spellName: 'Other Spell' },
                { casterName: 'Goblin', spellName: 'Burning Hands' }
            ]);
        });

        it('handles empty blocked list string', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellthiefUses') return 1;
                if (_name === 'campaign' && _key === 'lastAttack') return spellCastStamp();
                if (_name === 'FighterRogue' && _key === '_spellThiefBlockedList') return '[]';
                if (_name === 'Goblin' && _key === '_spellThiefCasterBlock') return '[]';
                return null;
            });
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: false, roll: 5, total: 9, saveBonus: 4 }),
            });
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const blockedListCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_spellThiefBlockedList'
            );
            expect(blockedListCalls).toHaveLength(1);
            const entries = JSON.parse(blockedListCalls[0][2]);
            expect(entries).toEqual([{ casterName: 'Goblin', spellName: 'Burning Hands' }]);
        });

        it('handles empty stolen list string', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellthiefUses') return 1;
                if (_name === 'campaign' && _key === 'lastAttack') return spellCastStamp();
                if (_name === 'FighterRogue' && _key === '_spellThiefStolenList') return '[]';
                return null;
            });
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: false, roll: 5, total: 9, saveBonus: 4 }),
            });
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const stolenListCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_spellThiefStolenList'
            );
            expect(stolenListCalls).toHaveLength(1);
            const entries = JSON.parse(stolenListCalls[0][2]);
            expect(entries).toEqual([{ casterName: 'Goblin', spellName: 'Burning Hands' }]);
        });
    });

    describe('handle - save listener rejection', () => {
        it('propagates save listener promise rejection', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.reject(new Error('save prompt failed')),
            });

            await expect(handle(makeAction(), makePlayerStats(), 'test-campaign', null))
                .rejects.toThrow('save prompt failed');
        });
    });

    describe('isBlockedBySpellThief', () => {
        it('returns true when blocked key is true', async () => {
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellThiefBlocked_Goblin_Burning Hands') return true;
                return null;
            });
            const result = isBlockedBySpellThief('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign');

            expect(result).toBe(true);
        });

        it.each([false, undefined, null, 0, ''])('returns false when blocked key is %s', async (value) => {
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellThiefBlocked_Goblin_Burning Hands') return value;
                return null;
            });
            const result = isBlockedBySpellThief('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign');

            expect(result).toBe(false);
        });
    });

    describe('hasStolenSpell', () => {
        it('returns true when stolen key is true', async () => {
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellThiefStolen_Goblin_Burning Hands') return true;
                return null;
            });
            const result = hasStolenSpell('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign');

            expect(result).toBe(true);
        });

        it.each([false, undefined, null, 0, ''])('returns false when stolen key is %s', async (value) => {
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => {
                if (_key === 'spellThiefStolen_Goblin_Burning Hands') return value;
                return null;
            });
            const result = hasStolenSpell('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign');

            expect(result).toBe(false);
        });
    });

    describe('handle - error paths', () => {
        it('handles addEntry rejection without throwing regardless of save result', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSaveResult(true);
            addEntry.mockImplementation(() => Promise.reject(new Error('log error')));

            const successResult = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);
            expect(successResult.type).toBe('popup');
            expect(successResult.payload.description).toContain('succeeded on INT save');

            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSaveResult(false);
            addEntry.mockImplementation(() => Promise.reject(new Error('log error')));

            const failureResult = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);
            expect(failureResult.type).toBe('popup');
            expect(failureResult.payload.description).toContain('failed INT save');
        });
    });

    describe('handle - default fallbacks', () => {
        it('uses Spell Thief default when action.name is missing', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSaveResult(true);

            const action = makeAction({ name: undefined });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Spell Thief');
        });

        it('refuses when no spellcaster can be identified (no lastAttack attacker)', async () => {
            mockUses(1, spellCastStamp({ attackerName: null }));
            buildSaveDc.mockReturnValue(13);
            mockSaveResult(true);

            const action = makeAction({ casterName: null });
            action.targetName = null;

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('could not identify the spellcaster');
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('uses INT as default saveType when auto.saveType is missing', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSaveResult(true);

            const action = makeAction({ automation: {} });
            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                saveType: 'INT',
            }));
        });

        it('logs save entry with INT as default saveType', async () => {
            mockUses(1);
            buildSaveDc.mockReturnValue(13);
            mockSaveResult(false);

            const action = makeAction({ automation: {} });
            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                saveType: 'INT',
            }));
        });

        it('uses unknown spell fallback when all spellName sources are missing', async () => {
            mockUses(1, spellCastStamp({ attackName: null, damageName: null }));
            buildSaveDc.mockReturnValue(13);
            mockSaveResult(false);

            const action = makeAction({ casterName: null, spellName: null });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefStolen')
            );
            expect(stolenCalls[0][1]).toBe('spellThiefStolen_Goblin_unknown spell');
        });
    });

    describe('handle - CLA-325 spell_cast trigger gate', () => {
        beforeEach(() => {
            mockUses(1);
            buildSaveDc.mockReturnValue(14);
        });

        it('refuses when there is no recent attack and spends nothing', async () => {
            mockUses(1, null);
            mockSaveResult(false);

            const result = await handle(makeAction({ casterName: null }), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no recent spell cast');
            expect(createSaveListener).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith('FighterRogue', 'spellthiefUses', 0, 'test-campaign');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'spell_thief_refused',
            }));
        });

        it('refuses when the last attack was a weapon attack (not spell-origin)', async () => {
            mockUses(1, { attackerName: 'Goblin', targetName: 'FighterRogue', rollType: 'attack', saveType: null, saveDc: null, isSpellDamage: false, actualDamage: 5 });
            mockSaveResult(false);

            const result = await handle(makeAction({ casterName: null }), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('not a spell cast');
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('refuses when the spell was cast by the thief themselves (no self-steal)', async () => {
            mockUses(1, spellCastStamp({ attackerName: 'FighterRogue' }));
            mockSaveResult(false);

            const result = await handle(makeAction({ casterName: 'FighterRogue' }), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('another creature');
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('refuses when the spell did not target the thief', async () => {
            mockUses(1, spellCastStamp({ targetName: 'DivinationWizard', affectedTargets: ['DivinationWizard'] }));
            mockSaveResult(false);

            const result = await handle(makeAction({ casterName: null }), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('did not target you');
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('includes the thief when they are one of several AoE affected targets', async () => {
            mockUses(1, spellCastStamp({ attackScope: 'aoe', targetName: null, affectedTargets: ['DivinationWizard', 'FighterRogue'] }));
            mockSaveResult(false);

            const result = await handle(makeAction({ casterName: null, spellName: null }), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin',
                saveDc: 14,
            }));
            expect(result.payload.description).toContain('failed INT save');
        });

        it('refuses when the caster is not in combat', async () => {
            mockUses(1, spellCastStamp({ attackerName: 'FarAwayCaster' }));
            mockSaveResult(false);

            const result = await handle(makeAction({ casterName: 'FarAwayCaster' }), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('is not in combat');
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('refuses outside combat (no combat summary)', async () => {
            getCombatContext.mockResolvedValueOnce(null);
            mockUses(1);
            mockSaveResult(false);

            const result = await handle(makeAction({ casterName: null }), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('requires an active combat');
            expect(createSaveListener).not.toHaveBeenCalled();
        });
    });

    describe('handle - CLA-325 negate spell rollback', () => {
        beforeEach(() => {
            mockUses(1);
            buildSaveDc.mockReturnValue(14);
        });

        it('rolls back spell effects via rollbackSpellEffects on failed INT save', async () => {
            mockSaveResult(false);

            await handle(makeAction({ casterName: null }), makePlayerStats(), 'test-campaign', null);

            expect(rollbackSpellEffects).toHaveBeenCalledWith(
                expect.objectContaining({ attackerName: 'Goblin', targetName: 'FighterRogue' }),
                'test-campaign',
                'Spell Thief',
                expect.objectContaining({ creatures: expect.any(Array) })
            );
        });

        it('does not roll back on successful INT save', async () => {
            mockSaveResult(true);

            await handle(makeAction({ casterName: null }), makePlayerStats(), 'test-campaign', null);

            expect(rollbackSpellEffects).not.toHaveBeenCalled();
        });

        it('logs the negation rollback detail with HP restored on failed save', async () => {
            rollbackSpellEffects.mockResolvedValue({
                targetsHealed: 1, conditionsRemoved: ['frightened'], effectsRemoved: 2, damageHealed: 9, logDescription: 'x',
            });
            mockSaveResult(false);

            const result = await handle(makeAction({ casterName: null }), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Spell Thief',
                description: expect.stringContaining('9 HP restored'),
            }));
            expect(result.payload.description).toContain('9 HP restored');
        });
    });

    describe('handle - CLA-325 monster action label normalization', () => {
        beforeEach(() => {
            mockUses(1);
            buildSaveDc.mockReturnValue(14);
        });

        it('strips the leading action number from monster-card spell labels', async () => {
            mockUses(1, spellCastStamp({ attackName: '3. Frost Ray' }));
            mockSaveResult(false);

            await handle(makeAction({ casterName: null, spellName: null }), makePlayerStats(), 'test-campaign', null);

            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefStolen')
            );
            expect(stolenCalls[0][1]).toBe('spellThiefStolen_Goblin_Frost Ray');
            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefBlocked_')
            );
            expect(blockedCalls[0][1]).toBe('spellThiefBlocked_Goblin_Frost Ray');
            const casterBlockCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_spellThiefCasterBlock'
            );
            expect(JSON.parse(casterBlockCalls[0][2])).toEqual([{ thiefName: 'FighterRogue', spellName: 'Frost Ray' }]);
        });
    });
});
