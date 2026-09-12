// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- mocks ---

const mockGuid = 'test-guid-1234';
vi.mock('../ui/utils.js', () => ({
    default: {
        guid: vi.fn(() => mockGuid),
    },
}));

const mockAddEntry = vi.fn(() => Promise.resolve());
function makeMockPostLogEntry() {
    return vi.fn((campaignName, entry) => mockAddEntry(campaignName, entry));
}
vi.mock('../ui/logService.js', () => ({
    addEntry: makeMockPostLogEntry(),
}));

import { addEntry } from '../ui/logService.js';
import {
    logInitiativeRoll,
    logConditionEvent,
    logConcentrationSave,
    logConditionSave,
    logHpChange,
    logNpcThreshold,
} from './combatLoggingService.js';

// --- shared helpers ---

function clearMocks() {
    vi.clearAllMocks();
}

function capturedEntry() {
    return addEntry.mock.calls[0][1];
}

const campaignName = 'Dragonfall';

// --- tests ---

describe('logInitiativeRoll', () => {
    beforeEach(() => {
        clearMocks();
    });

    it('posts a roll entry with correct initiative fields', () => {
        logInitiativeRoll(campaignName, 'Gortha', 15, 3);

        const entry = capturedEntry();
        expect(entry).toEqual({
            type: 'roll',
            characterName: 'Gortha',
            rollType: 'initiative',
            name: 'Initiative',
            rolls: [15],
            total: 15,
            bonus: 3,
            mode: 'normal',
            isNatural20: false,
            isNatural1: false,
            timestamp: expect.any(Number),
            id: expect.any(String),
        });
    });

    it('marks isNatural20 when the die roll is 20 and isNatural1 when the die roll is 1', () => {
        logInitiativeRoll(campaignName, 'Gortha', 20, 3);
        expect(capturedEntry().isNatural20).toBe(true);

        clearMocks();
        logInitiativeRoll(campaignName, 'Gortha', 1, -2);
        expect(capturedEntry().isNatural1).toBe(true);
    });
});

describe('logConditionEvent', () => {
    beforeEach(() => {
        clearMocks();
    });

    it('posts a condition entry for add action', () => {
        logConditionEvent(campaignName, 'add', 'Orc', 'charmed', 12, 'CHA');

        const entry = capturedEntry();
        expect(entry).toEqual({
            type: 'condition',
            action: 'add',
            characterName: 'Orc',
            condition: 'charmed',
            dc: 12,
            ability: 'CHA',
            timestamp: expect.any(Number),
            id: expect.any(String),
        });
    });

    it('posts a condition entry for remove action without dc/ability', () => {
        logConditionEvent(campaignName, 'remove', 'Goblin', 'stunned', undefined, undefined);

        const entry = capturedEntry();
        expect(entry.type).toBe('condition');
        expect(entry.action).toBe('remove');
        expect(entry.characterName).toBe('Goblin');
        expect(entry.condition).toBe('stunned');
        expect(entry.dc).toBeUndefined();
        expect(entry.ability).toBeUndefined();
    });
});

describe('logConcentrationSave', () => {
    beforeEach(() => {
        clearMocks();
    });

    it('posts a roll entry with concentration-save details', () => {
        logConcentrationSave({ campaignName, creatureName: 'Gortha', roll: 14, bonus: 2, bonusDetail: '+2 DEX', spellName: 'Fireball', dc: 15, success: true });

        const entry = capturedEntry();
        expect(entry).toEqual({
            type: 'roll',
            rollType: 'concentration-save',
            characterName: 'Gortha',
            name: 'Constitution',
            rolls: [14],
            mode: 'normal',
            total: 14,
            bonus: 2,
            bonusDetail: '+2 DEX',
            condition: 'Concentration: Fireball',
            dc: 15,
            success: true,
            timestamp: expect.any(Number),
            id: expect.any(String),
        });
    });

    it('uses custom mode when provided', () => {
        logConcentrationSave({ campaignName, creatureName: 'Gortha', roll: 14, bonus: 2, bonusDetail: '+2 DEX', spellName: 'Fireball', dc: 15, success: true, mode: 'disadvantage' });

        const entry = capturedEntry();
        expect(entry.mode).toBe('disadvantage');
    });

    it('posts a failed concentration save entry', () => {
        logConcentrationSave({ campaignName, creatureName: 'Gortha', roll: 5, bonus: 3, bonusDetail: '+3 CON', spellName: 'Bless', dc: 12, success: false });

        const entry = capturedEntry();
        expect(entry.success).toBe(false);
        expect(entry.condition).toBe('Concentration: Bless');
    });

    it('logConcentrationSave does not throw when addEntry rejects', async () => {
        vi.mocked(addEntry).mockRejectedValue(new Error('fail'));
        await expect(logConcentrationSave({ campaignName, creatureName: 'Gortha', roll: 14, bonus: 2, bonusDetail: '+2', spellName: 'Fireball', dc: 15, success: true })).resolves.toBeUndefined();
    });

});

describe('logConditionSave', () => {
    beforeEach(() => {
        clearMocks();
    });

    it('posts a roll entry with condition-save details', () => {
        logConditionSave({ campaignName, creatureName: 'Gortha', roll: 13, bonus: 3, bonusDetail: '+3 WIS', conditionLabel: 'poisoned', abilityLabel: 'Wisdom', dc: 14, success: true });

        const entry = capturedEntry();
        expect(entry).toEqual({
            type: 'roll',
            rollType: 'condition-save',
            characterName: 'Gortha',
            name: 'Wisdom',
            rolls: [13],
            mode: 'normal',
            total: 13,
            bonus: 3,
            bonusDetail: '+3 WIS',
            condition: 'poisoned',
            dc: 14,
            success: true,
            timestamp: expect.any(Number),
            id: expect.any(String),
        });
    });

    it('posts a failed condition save entry', () => {
        logConditionSave({ campaignName, creatureName: 'Gortha', roll: 8, bonus: 3, bonusDetail: '+3 WIS', conditionLabel: 'poisoned', abilityLabel: 'Wisdom', dc: 14, success: false });

        const entry = capturedEntry();
        expect(entry.success).toBe(false);
        expect(entry.rollType).toBe('condition-save');
        expect(entry.condition).toBe('poisoned');
    });

    // CLA-209: multi-dice roll array (advantage) must log both dice + mode 'advantage'
    it('logs both dice with mode advantage when roll is passed as a multi-dice array (CLA-209)', () => {
        logConditionSave({ campaignName, creatureName: 'Gortha', roll: [8, 14], bonus: 3, bonusDetail: '+3 STR', conditionLabel: 'grappled', abilityLabel: 'Strength', dc: 13, success: true });

        const entry = capturedEntry();
        expect(entry.rolls).toEqual([8, 14]);
        expect(entry.mode).toBe('advantage');
        expect(entry.total).toBe(14);
        expect(entry.success).toBe(true);
    });

});

describe('logHpChange', () => {
    beforeEach(() => {
        clearMocks();
    });

    it('posts an hp_change entry with correct fields', () => {
        logHpChange({ campaignName, targetName: 'Orc', delta: -5, currentHp: 20, maxHp: 30, isHealing: false, isUnconscious: false });

        const entry = capturedEntry();
        expect(entry).toEqual({
            type: 'hp_change',
            targetName: 'Orc',
            delta: -5,
            currentHp: 20,
            maxHp: 30,
            isHealing: false,
            isUnconscious: false,
        });
    });

    it('posts an hp_change entry for healing', () => {
        logHpChange({ campaignName, targetName: 'Ally', delta: 10, currentHp: 25, maxHp: 30, isHealing: true, isUnconscious: false });

        const entry = capturedEntry();
        expect(entry).toEqual({
            type: 'hp_change',
            targetName: 'Ally',
            delta: 10,
            currentHp: 25,
            maxHp: 30,
            isHealing: true,
            isUnconscious: false,
        });
    });

    it('posts an hp_change entry with isUnconscious flag', () => {
        logHpChange({ campaignName, targetName: 'Orc', delta: -15, currentHp: 0, maxHp: 30, isHealing: false, isUnconscious: true });

        const entry = capturedEntry();
        expect(entry.isUnconscious).toBe(true);
        expect(entry.currentHp).toBe(0);
        expect(entry.isHealing).toBe(false);
    });

});

describe('logNpcThreshold', () => {
    beforeEach(() => {
        clearMocks();
    });

    it('posts an hp_change entry with threshold field', () => {
        logNpcThreshold(campaignName, 'Bandit Leader', -10, 5, 10);

        const entry = capturedEntry();
        expect(entry).toEqual({
            type: 'hp_change',
            targetName: 'Bandit Leader',
            delta: -10,
            threshold: 5,
            maxHp: 10,
        });
    });
});

describe('error handling', () => {
    beforeEach(() => {
        clearMocks();
    });

    it('logInitiativeRoll does not throw when addEntry rejects', async () => {
        mockAddEntry.mockRejectedValueOnce(new Error('network error'));
        await expect(logInitiativeRoll(campaignName, 'Gortha', 15, 3)).resolves.toBeUndefined();
    });

    it('logConditionEvent does not throw when addEntry rejects', async () => {
        mockAddEntry.mockRejectedValueOnce(new Error('network error'));
        await expect(logConditionEvent(campaignName, 'add', 'Orc', 'charmed', 12, 'CHA')).resolves.toBeUndefined();
    });

    it('logConcentrationSave does not throw when addEntry rejects', async () => {
        mockAddEntry.mockRejectedValueOnce(new Error('network error'));
        await expect(logConcentrationSave({ campaignName, creatureName: 'Gortha', roll: 14, bonus: 2, bonusDetail: '+2', spellName: 'Fireball', dc: 15, success: true })).resolves.toBeUndefined();
    });

    it('logConditionSave does not throw when addEntry rejects', async () => {
        mockAddEntry.mockRejectedValueOnce(new Error('network error'));
        await expect(logConditionSave({ campaignName, creatureName: 'Gortha', roll: 13, bonus: 3, bonusDetail: '+3', conditionLabel: 'poisoned', abilityLabel: 'Wisdom', dc: 14, success: true })).resolves.toBeUndefined();
    });

    it('logHpChange does not throw when addEntry rejects', async () => {
        mockAddEntry.mockRejectedValueOnce(new Error('network error'));
        await expect(logHpChange({ campaignName, targetName: 'Orc', delta: -5, currentHp: 20, maxHp: 30, isHealing: false, isUnconscious: false })).resolves.toBeUndefined();
    });

    it('logNpcThreshold does not throw when addEntry rejects', async () => {
        mockAddEntry.mockRejectedValueOnce(new Error('network error'));
        await expect(logNpcThreshold(campaignName, 'Bandit Leader', -10, 5, 10)).resolves.toBeUndefined();
    });
});
