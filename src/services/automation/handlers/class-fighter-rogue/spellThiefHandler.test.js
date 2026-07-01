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

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
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

function dispatchSaveResult(promptId, success) {
    window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId, success },
    }));
}

function waitForAsync() {
    return new Promise(r => setTimeout(r, 10));
}

function withUses(uses) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spellthiefUses') return uses;
        return null;
    });
}

function withDefaults() {
    withUses(1);
    buildSaveDc.mockReturnValue(13);
    createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
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
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('INT saving throw');
            expect(result.payload.description).toContain('DC 13');
        });
    });

    describe('handle - successful initialization', () => {
        beforeEach(withDefaults);

        it('returns popup with save DC info', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Spell Thief');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.description).toContain('INT saving throw');
            expect(result.payload.description).toContain('DC 13');
            expect(result.payload.casterName).toBe('Goblin');
            expect(result.payload.spellName).toBe('Burning Hands');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('uses custom saveType from automation', async () => {
            const action = makeAction({ automation: { saveType: 'WIS' } });
            buildSaveDc.mockReturnValue(15);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                saveType: 'WIS',
            }));
        });

        it('uses action casterName for save prompt target when provided', async () => {
            const action = makeAction({ casterName: 'Orc' });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Orc',
            }));
        });

        it('uses action targetName as caster fallback for save prompt when no casterName', async () => {
            const action = makeAction({ casterName: null });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('uses action targetName as caster fallback for save prompt when casterName is undefined', async () => {
            const action = makeAction();
            delete action.casterName;

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('logs ability use on initialization', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'FighterRogue',
                abilityName: 'Spell Thief',
            }));
        });

        it('registers save-result event listener', async () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));

            addEventListenerSpy.mockRestore();
        });
    });

    describe('handle - save result failure', () => {
        beforeEach(withDefaults);

        it('decrements uses after save failure', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            expect(setRuntimeValue).toHaveBeenCalledWith('FighterRogue', 'spellthiefUses', 0, 'test-campaign');
        });

        it('sets blocked key for caster+spell on failure', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'FighterRogue',
                'spellThiefBlocked_Goblin_Burning Hands',
                true,
                'test-campaign'
            );
        });

        it('sets stolen key for caster+spell on failure', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'FighterRogue',
                'spellThiefStolen_Goblin_Burning Hands',
                true,
                'test-campaign'
            );
        });

        it('adds add_prepared_spell expiration on failure', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            expect(addExpiration).toHaveBeenCalledWith(
                'FighterRogue',
                'FighterRogue',
                [{ type: 'add_prepared_spell', spellName: 'Burning Hands' }],
                'test-campaign',
                480
            );
        });

        it('adds remove_prepared_spell expiration on failure', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            expect(addExpiration).toHaveBeenCalledWith(
                'FighterRogue',
                'FighterRogue',
                [{ type: 'remove_prepared_spell', spellName: 'Burning Hands' }],
                'test-campaign',
                480
            );
        });

        it('logs save result failure entry', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'save_result',
                success: false,
                targetName: 'Goblin',
                saveDc: 13,
                saveType: 'INT',
            }));
        });

        it('dispatches combat-summary-updated event on failure', async () => {
            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'combat-summary-updated',
            }));

            dispatchEventSpy.mockRestore();
        });

        it('removes save-result listener after handling failure', async () => {
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));

            removeEventListenerSpy.mockRestore();
        });

        it('uses action casterName when provided for blocked/stolen keys', async () => {
            const action = makeAction({ casterName: 'Wizard' });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

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

            await handle(action, makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefBlocked')
            );
            expect(blockedCalls[0][1]).toBe('spellThiefBlocked_Goblin_Fireball');
        });

        it('uses targetName as fallback caster when no casterName', async () => {
            const action = makeAction({ casterName: null });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefBlocked')
            );
            expect(blockedCalls[0][1]).toBe('spellThiefBlocked_Goblin_Burning Hands');
        });

        it('uses "unknown spell" fallback when no spellName', async () => {
            const action = makeAction({ spellName: null });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', false);
            await waitForAsync();

            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1].includes('spellThiefStolen')
            );
            expect(stolenCalls[0][1]).toBe('spellThiefStolen_Goblin_unknown spell');
        });

        it('ignores save-result events with mismatched promptId', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('wrong-prompt-id', false);
            await waitForAsync();

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'FighterRogue',
                'spellthiefUses',
                expect.any(Number),
                'test-campaign'
            );
        });
    });

    describe('handle - save result success', () => {
        beforeEach(withDefaults);

        it('logs save result success entry', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', true);
            await waitForAsync();

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'save_result',
                success: true,
                targetName: 'Goblin',
                saveDc: 13,
                saveType: 'INT',
            }));
        });

        it('does not set blocked or stolen keys on success', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', true);
            await waitForAsync();

            const blockedCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] && call[1].includes('spellThiefBlocked')
            );
            const stolenCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] && call[1].includes('spellThiefStolen')
            );

            expect(blockedCalls).toHaveLength(0);
            expect(stolenCalls).toHaveLength(0);
        });

        it('does not add spell expirations on success', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', true);
            await waitForAsync();

            expect(addExpiration).not.toHaveBeenCalled();
        });

        it('decrements uses on success (uses are consumed regardless of save result)', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', true);
            await waitForAsync();

            expect(setRuntimeValue).toHaveBeenCalledWith('FighterRogue', 'spellthiefUses', 0, 'test-campaign');
        });

        it('removes save-result listener after handling success', async () => {
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            dispatchSaveResult('test-prompt-id', true);
            await waitForAsync();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));

            removeEventListenerSpy.mockRestore();
        });
    });

    describe('handle - custom feature name', () => {
        it('uses action name for uses key derivation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'customfeatureUses') return 1;
                return null;
            });
            buildSaveDc.mockReturnValue(13);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            const action = makeAction({ name: 'Custom Feature' });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(getRuntimeValue).toHaveBeenCalledWith('FighterRogue', 'customfeatureUses');
        });

        it('uses action name in popup when provided', async () => {
            withUses(1);
            buildSaveDc.mockReturnValue(13);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

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
