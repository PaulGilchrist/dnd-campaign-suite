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
vi.mock('../shared/logPoster.js', () => ({
    postLogEntry: makeMockPostLogEntry(),
}));

import utils from '../ui/utils.js';
import { postLogEntry } from '../shared/logPoster.js';
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

const campaignName = 'Dragonfall';

// --- tests ---

describe('logInitiativeRoll', () => {
    beforeEach(() => {
        clearMocks();
     });

    it('calls postLogEntry with a roll-type initiative entry', () => {
        logInitiativeRoll(campaignName, 'Gortha', 15, 3);

        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.type).toBe('roll');
        expect(entry.characterName).toBe('Gortha');
        expect(entry.rollType).toBe('initiative');
        expect(entry.name).toBe('Initiative');
        expect(entry.rolls).toEqual([15]);
        expect(entry.total).toBe(15);
        expect(entry.bonus).toBe(3);
        expect(entry.mode).toBe('normal');
     });

    it('sets isNatural20 to true when roll is 20', () => {
        logInitiativeRoll(campaignName, 'Gortha', 20, 3);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.isNatural20).toBe(true);
        expect(entry.isNatural1).toBe(false);
     });

    it('sets isNatural1 to true when roll is 1', () => {
        logInitiativeRoll(campaignName, 'Gortha', 1, -2);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.isNatural1).toBe(true);
        expect(entry.isNatural20).toBe(false);
     });

    it('leaves both flags false for any other roll value', () => {
        logInitiativeRoll(campaignName, 'Gortha', 7, 0);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.isNatural20).toBe(false);
        expect(entry.isNatural1).toBe(false);
     });

    it('includes a populated timestamp field', () => {
        logInitiativeRoll(campaignName, 'Gortha', 12, 1);
        const entry = postLogEntry.mock.calls[0][1];
        expect(typeof entry.timestamp).toBe('number');
        expect(entry.timestamp).toBeGreaterThan(0);
     });

    it('uses utils.guid for the id field', () => {
        logInitiativeRoll(campaignName, 'Gortha', 12, 1);
        expect(utils.guid).toHaveBeenCalled();
    });
});

describe('logConditionEvent', () => {
    beforeEach(() => {
        clearMocks();
     });

    it('calls postLogEntry with a condition-type entry for add action', () => {
        logConditionEvent(campaignName, 'add', 'Orc', 'charmed', 12, 'CHA');
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.type).toBe('condition');
        expect(entry.action).toBe('add');
        expect(entry.characterName).toBe('Orc');
        expect(entry.condition).toBe('charmed');
        expect(entry.dc).toBe(12);
        expect(entry.ability).toBe('CHA');
     });

    it('calls postLogEntry with remove action', () => {
        logConditionEvent(campaignName, 'remove', 'Goblin', 'stunned', undefined, undefined);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.type).toBe('condition');
        expect(entry.action).toBe('remove');
        expect(entry.characterName).toBe('Goblin');
     });

    it('uses utils.guid for the id field', () => {
        logConditionEvent(campaignName, 'add', 'Orc', 'charmed', 15, 'WIS');
        expect(utils.guid).toHaveBeenCalled();
     });

    it('includes a populated timestamp field', () => {
        logConditionEvent(campaignName, 'add', 'Orc', 'charmed', 12, 'CHA');
        const entry = postLogEntry.mock.calls[0][1];
        expect(typeof entry.timestamp).toBe('number');
        expect(entry.timestamp).toBeGreaterThan(0);
     });
});

describe('logConcentrationSave', () => {
    beforeEach(() => {
        clearMocks();
     });

    it('calls postLogEntry with a concentration-save entry on success', () => {
        logConcentrationSave(campaignName, 'Gortha', 14, 2, '+2 DEX', 'Fireball', 15, true);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.type).toBe('roll');
        expect(entry.rollType).toBe('concentration-save');
        expect(entry.characterName).toBe('Gortha');
        expect(entry.name).toBe('Constitution');
        expect(entry.rolls).toEqual([14]);
        expect(entry.mode).toBe('normal');
        expect(entry.total).toBe(14);
        expect(entry.bonus).toBe(2);
        expect(entry.bonusDetail).toBe('+2 DEX');
        expect(entry.condition).toBe('Concentration: Fireball');
        expect(entry.dc).toBe(15);
        expect(entry.success).toBe(true);
     });

    it('logs a failed concentration save', () => {
        logConcentrationSave(campaignName, 'Gortha', 10, 2, '+2 DEX', 'Held Horror', 15, false);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.rollType).toBe('concentration-save');
        expect(entry.success).toBe(false);
     });

    it('uses utils.guid for the id field', () => {
        logConcentrationSave(campaignName, 'Gortha', 10, 2, '+2 DEX', 'Fireball', 15, true);
        expect(utils.guid).toHaveBeenCalled();
     });

    it('includes a populated timestamp field', () => {
        logConcentrationSave(campaignName, 'Gortha', 10, 2, '+2 DEX', 'Fireball', 15, true);
        const entry = postLogEntry.mock.calls[0][1];
        expect(typeof entry.timestamp).toBe('number');
        expect(entry.timestamp).toBeGreaterThan(0);
     });

    it('passes the campaignName to postLogEntry', () => {
        logConcentrationSave(campaignName, 'Gortha', 10, 2, '+2 DEX', 'Fireball', 15, true);
        expect(postLogEntry).toHaveBeenCalledWith(campaignName, expect.any(Object));
     });
});

describe('logConditionSave', () => {
    beforeEach(() => {
        clearMocks();
     });

    it('calls postLogEntry with a condition-save entry on success', () => {
        logConditionSave(campaignName, 'Gortha', 13, 3, '+3 WIS', 'poisoned', 'Wisdom', 14, true);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.type).toBe('roll');
        expect(entry.rollType).toBe('condition-save');
        expect(entry.characterName).toBe('Gortha');
        expect(entry.name).toBe('Wisdom');
        expect(entry.rolls).toEqual([13]);
        expect(entry.mode).toBe('normal');
        expect(entry.total).toBe(13);
        expect(entry.bonus).toBe(3);
        expect(entry.bonusDetail).toBe('+3 WIS');
        expect(entry.condition).toBe('poisoned');
        expect(entry.dc).toBe(14);
        expect(entry.success).toBe(true);
     });

    it('logs a failed condition save', () => {
        logConditionSave(campaignName, 'Gortha', 8, 0, '+0 CON', 'stunned', 'Constitution', 12, false);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.rollType).toBe('condition-save');
        expect(entry.success).toBe(false);
     });

    it('uses utils.guid for the id field', () => {
        logConditionSave(campaignName, 'Gortha', 8, 0, '+0 CON', 'stunned', 'Constitution', 12, false);
        expect(utils.guid).toHaveBeenCalled();
     });

    it('includes a populated timestamp field', () => {
        logConditionSave(campaignName, 'Gortha', 8, 0, '+0 CON', 'stunned', 'Constitution', 12, false);
        const entry = postLogEntry.mock.calls[0][1];
        expect(typeof entry.timestamp).toBe('number');
        expect(entry.timestamp).toBeGreaterThan(0);
     });

    it('passes the campaignName to postLogEntry', () => {
        logConditionSave(campaignName, 'Gortha', 8, 0, '+0 CON', 'stunned', 'Constitution', 12, false);
        expect(postLogEntry).toHaveBeenCalledWith(campaignName, expect.any(Object));
     });
});

describe('logHpChange', () => {
    beforeEach(() => {
        clearMocks();
     });

    it('calls postLogEntry with an hp_change entry on damage', () => {
        logHpChange(campaignName, 'Orc', -5, 20, 30, false, false);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.type).toBe('hp_change');
        expect(entry.targetName).toBe('Orc');
        expect(entry.delta).toBe(-5);
        expect(entry.currentHp).toBe(20);
        expect(entry.maxHp).toBe(30);
        expect(entry.isHealing).toBe(false);
        expect(entry.isUnconscious).toBe(false);
     });

    it('calls postLogEntry with an hp_change entry on healing', () => {
        logHpChange(campaignName, 'Gortha', 8, 25, 30, true, false);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.type).toBe('hp_change');
        expect(entry.delta).toBe(8);
        expect(entry.isHealing).toBe(true);
     });

    it('calls postLogEntry with isUnconscious flag', () => {
        logHpChange(campaignName, 'Orc', -25, 0, 30, false, true);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.isUnconscious).toBe(true);
     });

    it('does not include timestamp or id in hp_change entries', () => {
        logHpChange(campaignName, 'Orc', -5, 20, 30, false, false);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry).not.toHaveProperty('timestamp');
        expect(entry).not.toHaveProperty('id');
     });

    it('passes the campaignName to postLogEntry', () => {
        logHpChange(campaignName, 'Orc', -5, 20, 30, false, false);
        expect(postLogEntry).toHaveBeenCalledWith(campaignName, expect.any(Object));
     });
});

describe('logNpcThreshold', () => {
    beforeEach(() => {
        clearMocks();
     });

    it('calls postLogEntry with an hp_change entry for threshold damage', () => {
        logNpcThreshold(campaignName, 'Bandit Leader', -10, 5, 10);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.type).toBe('hp_change');
        expect(entry.targetName).toBe('Bandit Leader');
        expect(entry.delta).toBe(-10);
        expect(entry.threshold).toBe(5);
        expect(entry.maxHp).toBe(10);
     });

    it('handles zero threshold', () => {
        logNpcThreshold(campaignName, 'Goblin', -8, 0, 8);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry.threshold).toBe(0);
     });

    it('does not include timestamp or id in npc_threshold entries', () => {
        logNpcThreshold(campaignName, 'Bandit Leader', -10, 5, 10);
        const entry = postLogEntry.mock.calls[0][1];
        expect(entry).not.toHaveProperty('timestamp');
        expect(entry).not.toHaveProperty('id');
     });

    it('passes the campaignName to postLogEntry', () => {
        logNpcThreshold(campaignName, 'Bandit Leader', -10, 5, 10);
        expect(postLogEntry).toHaveBeenCalledWith(campaignName, expect.any(Object));
     });
});
