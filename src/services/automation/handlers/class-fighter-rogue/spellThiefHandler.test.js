// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isBlockedBySpellThief, hasStolenSpell } from './spellThiefHandler.js';

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

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { buildSaveDc, createSaveListener } = await import('../../common/savePrompt.js');

beforeEach(() => {
    vi.clearAllMocks();
    delete window.customEvents;
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'FighterRogue',
        proficiency: 3,
        abilities: [{ name: 'CHA', bonus: 4 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Spell Thief',
        targetName: 'Goblin',
        casterName: 'Goblin',
        spellName: 'Burning Hands',
        automation: {
            type: 'spell_thief',
            saveType: 'INT',
            saveDc: 13,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function withUses(uses) {
    getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (key === 'spellthiefUses') return uses;
        return null;
    });
}

function withSaveResult(success) {
    createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success, roll: 12, total: 16, saveBonus: 4 }),
    });
}

describe('spellThiefHandler', () => {
    describe('handle - no uses remaining', () => {
        it('returns popup with no-uses message when uses are 0', async () => {
            withUses(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Spell Thief');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('returns popup with no-uses message when uses are negative', async () => {
            withUses(-1);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('defaults to 1 use when runtime value is undefined', async () => {
            withUses(undefined);
            buildSaveDc.mockReturnValue(13);
            withSaveResult(true);

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
            withUses(1);
            buildSaveDc.mockReturnValue(13);
        });

        it('sends save prompt via createSaveListener', async () => {
            withSaveResult(true);

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
            withSaveResult(true);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                saveType: 'WIS',
            }));
        });

        it('uses action casterName for save prompt target when provided', async () => {
            const action = makeAction({ casterName: 'Orc' });
            withSaveResult(true);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Orc',
            }));
        });

        it('uses action targetName as caster fallback for save prompt when no casterName', async () => {
            const action = makeAction({ casterName: null });
            withSaveResult(true);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('uses action targetName as caster fallback for save prompt when casterName is undefined', async () => {
            const action = makeAction();
            delete action.casterName;
            withSaveResult(true);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('logs ability use on initialization', async () => {
            withSaveResult(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'FighterRogue',
                abilityName: 'Spell Thief',
            }));
        });

        it('returns popup with success result after save success', async () => {
            withSaveResult(true);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Spell Thief');
            expect(result.payload.description).toContain('succeeded on INT save');
        });

        it('returns popup with failure result after save failure', async () => {
            withSaveResult(false);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Spell Thief');
            expect(result.payload.description).toContain('failed INT save');
        });

        it('logs save result roll entry', async () => {
            withSaveResult(true);

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

        it('decrements uses after save success', async () => {
            withSaveResult(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('FighterRogue', 'spellthiefUses', 0, 'test-campaign');
        });

        it('does not set blocked or stolen keys on success', async () => {
            withSaveResult(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] && call[1].includes('spellThiefBlocked')
            );
            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] && call[1].includes('spellThiefStolen')
            );

            expect(blockedCalls).toHaveLength(0);
            expect(stolenCalls).toHaveLength(0);
        });

        it('logs ability_use entry on failure with stolen spell details', async () => {
            withSaveResult(false);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'FighterRogue',
                abilityName: 'Spell Thief',
                description: expect.stringContaining('failed INT save'),
            }));
        });

        it('logs ability_use entry on success', async () => {
            withSaveResult(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'FighterRogue',
                abilityName: 'Spell Thief',
                description: expect.stringContaining('succeeded on INT save'),
            }));
        });

        it('dispatches combat-summary-updated event on failure', async () => {
            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
            withSaveResult(false);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'combat-summary-updated',
            }));

            dispatchEventSpy.mockRestore();
        });

        it('sets blocked key for caster+spell on failure', async () => {
            withSaveResult(false);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'spellThiefBlocked_Goblin_Burning Hands'
            );
            expect(blockedCalls).toHaveLength(1);
            expect(blockedCalls[0]).toEqual([
                'FighterRogue',
                'spellThiefBlocked_Goblin_Burning Hands',
                true,
                'test-campaign'
            ]);
        });

        it('sets caster blocked entry on failure', async () => {
            withSaveResult(false);

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

        it('sets stolen key for caster+spell on failure', async () => {
            withSaveResult(false);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'FighterRogue',
                'spellThiefStolen_Goblin_Burning Hands',
                true,
                'test-campaign'
            );
        });

        it('uses action casterName when provided for blocked/stolen keys', async () => {
            const action = makeAction({ casterName: 'Wizard' });
            withSaveResult(false);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefBlocked')
            );
            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefStolen')
            );
            const casterBlockCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_spellThiefCasterBlock'
            );

            expect(blockedCalls).toHaveLength(2);
            expect(blockedCalls[0][1]).toBe('spellThiefBlocked_Wizard_Burning Hands');
            expect(stolenCalls).toHaveLength(2);
            expect(stolenCalls[0][1]).toBe('spellThiefStolen_Wizard_Burning Hands');
            expect(casterBlockCalls).toHaveLength(1);
            expect(casterBlockCalls[0][0]).toBe('Wizard');
        });

        it('uses action spellName when provided for blocked/stolen keys', async () => {
            const action = makeAction({ spellName: 'Fireball' });
            withSaveResult(false);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefBlocked')
            );
            expect(blockedCalls[0][1]).toBe('spellThiefBlocked_Goblin_Fireball');
        });

        it('uses targetName as fallback caster when no casterName', async () => {
            const action = makeAction({ casterName: null });
            withSaveResult(false);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefBlocked')
            );
            expect(blockedCalls[0][1]).toBe('spellThiefBlocked_Goblin_Burning Hands');
        });

        it('uses "unknown spell" fallback when no spellName', async () => {
            const action = makeAction({ spellName: null });
            withSaveResult(false);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefStolen')
            );
            expect(stolenCalls[0][1]).toBe('spellThiefStolen_Goblin_unknown spell');
        });

        it('decrements uses on failure (uses are consumed regardless of save result)', async () => {
            withSaveResult(false);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('FighterRogue', 'spellthiefUses', 0, 'test-campaign');
        });
    });

    describe('handle - custom feature name', () => {
        it('uses action name for uses key derivation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'customfeatureUses') return 1;
                return null;
            });
            buildSaveDc.mockReturnValue(13);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });

            const action = makeAction({ name: 'Custom Feature' });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(getRuntimeValue).toHaveBeenCalledWith('FighterRogue', 'customfeatureUses');
        });

        it('uses action name in popup when provided', async () => {
            withUses(1);
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

    describe('isBlockedBySpellThief', () => {
        it('returns true when blocked key is true', () => {
            getRuntimeValue.mockReturnValue(true);

            expect(isBlockedBySpellThief('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign')).toBe(true);
        });

        it('returns false when blocked key is false', () => {
            getRuntimeValue.mockReturnValue(false);

            expect(isBlockedBySpellThief('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign')).toBe(false);
        });

        it('returns false when blocked key is null', () => {
            getRuntimeValue.mockReturnValue(null);

            expect(isBlockedBySpellThief('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign')).toBe(false);
        });

        it('returns false when blocked key is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(isBlockedBySpellThief('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign')).toBe(false);
        });

        it('uses correct key format with caster and spell names', () => {
            getRuntimeValue.mockReturnValue(true);

            isBlockedBySpellThief('Player', 'Caster', 'Fireball', 'campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith('Player', 'spellThiefBlocked_Caster_Fireball', 'campaign');
        });
    });

    describe('hasStolenSpell', () => {
        it('returns true when stolen key is true', () => {
            getRuntimeValue.mockReturnValue(true);

            expect(hasStolenSpell('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign')).toBe(true);
        });

        it('returns false when stolen key is false', () => {
            getRuntimeValue.mockReturnValue(false);

            expect(hasStolenSpell('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign')).toBe(false);
        });

        it('returns false when stolen key is null', () => {
            getRuntimeValue.mockReturnValue(null);

            expect(hasStolenSpell('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign')).toBe(false);
        });

        it('returns false when stolen key is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(hasStolenSpell('FighterRogue', 'Goblin', 'Burning Hands', 'test-campaign')).toBe(false);
        });

        it('uses correct key format with caster and spell names', () => {
            getRuntimeValue.mockReturnValue(true);

            hasStolenSpell('Player', 'Caster', 'Fireball', 'campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith('Player', 'spellThiefStolen_Caster_Fireball', 'campaign');
        });
    });
});
