// @maintained-by-ai
// Lane: combatLoggingService.js — service-side log entry PRODUCTION bytes only.
// UI consumers (initiative handlers, CharConditions, LogEntryRendering #885, LogRoll #887)
// own call-site args + rendering and mock this service; exact entry bytes live ONLY here.
// Cites: #829/#1007 exact full-object entries, #934 campaign pinned every write,
// #951 one-write-exact, #1010 exact transport tuple, #903 it.each tables,
// #1065 interpolation-defect honesty, #1007 afterEach re-arm, zero-network (addEntry fully mocked).
//
// Old -> new:
//   - 7 describes / 20 tests -> 2 it.each tables (13 exact-byte rows + 6 rejection rows)
//   - campaign arg was never asserted -> every row pins the exact (campaign, entry) tuple, once
//   - duplicate logConcentrationSave rejection test inside its own describe (leaked a permanent
//     mockRejectedValue onto the mock) -> removed; covered by the rejection table
//   - initiative nat20/nat1 chain test -> two full-byte rows (roll 20 / roll 1)
//   - CLA-209 advantage row pins total=max via [8, 14] -> 14 (kills take-first/last/min impls)
//   - logHpChange heal row + unconscious row kept (they cover disjoint field semantics);
//     plain-damage row folded into the unconscious row
import { describe, it, expect, vi, afterEach } from 'vitest';

const mockGuid = 'test-guid-1234';
vi.mock('../ui/utils.js', () => ({
    default: {
        guid: vi.fn(() => mockGuid),
    },
}));

const mockAddEntry = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../ui/logService.js', () => ({
    addEntry: mockAddEntry,
}));

import {
    logInitiativeRoll,
    logConditionEvent,
    logConcentrationSave,
    logConditionSave,
    logHpChange,
    logNpcThreshold,
} from './combatLoggingService.js';

const campaignName = 'Dragonfall';

afterEach(() => {
    vi.clearAllMocks(); // preserves addEntry's default resolve; clears calls + expired Once queues
});

// Every write must be exactly ONE addEntry(campaignName, exactEntry) call (#934/#951/#1010).
function postedCall() {
    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    return mockAddEntry.mock.calls[0];
}

describe('entry production', () => {
    it.each([
        {
            title: 'logInitiativeRoll (mid roll)',
            invoke: () => logInitiativeRoll(campaignName, 'Gortha', 15, 3),
            expected: {
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
                id: mockGuid,
            },
        },
        {
            title: 'logInitiativeRoll (natural 20)',
            invoke: () => logInitiativeRoll(campaignName, 'Gortha', 20, 3),
            expected: {
                type: 'roll',
                characterName: 'Gortha',
                rollType: 'initiative',
                name: 'Initiative',
                rolls: [20],
                total: 20,
                bonus: 3,
                mode: 'normal',
                isNatural20: true,
                isNatural1: false,
                timestamp: expect.any(Number),
                id: mockGuid,
            },
        },
        {
            title: 'logInitiativeRoll (natural 1, negative bonus)',
            invoke: () => logInitiativeRoll(campaignName, 'Gortha', 1, -2),
            expected: {
                type: 'roll',
                characterName: 'Gortha',
                rollType: 'initiative',
                name: 'Initiative',
                rolls: [1],
                total: 1,
                bonus: -2,
                mode: 'normal',
                isNatural20: false,
                isNatural1: true,
                timestamp: expect.any(Number),
                id: mockGuid,
            },
        },
        {
            title: 'logConditionEvent (add with dc/ability)',
            invoke: () => logConditionEvent({ campaignName, action: 'add', creatureName: 'Orc', conditionLabel: 'charmed', dc: 12, ability: 'CHA' }),
            expected: {
                type: 'condition',
                action: 'add',
                characterName: 'Orc',
                condition: 'charmed',
                dc: 12,
                ability: 'CHA',
                timestamp: expect.any(Number),
                id: mockGuid,
            },
        },
        {
            title: 'logConditionEvent (remove without dc/ability)',
            invoke: () => logConditionEvent({ campaignName, action: 'remove', creatureName: 'Goblin', conditionLabel: 'stunned' }),
            expected: {
                type: 'condition',
                action: 'remove',
                characterName: 'Goblin',
                condition: 'stunned',
                timestamp: expect.any(Number),
                id: mockGuid,
            },
        },
        {
            title: 'logConcentrationSave (success, default mode)',
            invoke: () => logConcentrationSave({ campaignName, creatureName: 'Gortha', roll: 14, bonus: 2, bonusDetail: '+2 DEX', spellName: 'Fireball', dc: 15, success: true }),
            expected: {
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
                id: mockGuid,
            },
        },
        {
            title: 'logConcentrationSave (failure, custom mode)',
            invoke: () => logConcentrationSave({ campaignName, creatureName: 'Gortha', roll: 5, bonus: 3, bonusDetail: '+3 CON', spellName: 'Bless', dc: 12, success: false, mode: 'disadvantage' }),
            expected: {
                type: 'roll',
                rollType: 'concentration-save',
                characterName: 'Gortha',
                name: 'Constitution',
                rolls: [5],
                mode: 'disadvantage',
                total: 5,
                bonus: 3,
                bonusDetail: '+3 CON',
                condition: 'Concentration: Bless',
                dc: 12,
                success: false,
                timestamp: expect.any(Number),
                id: mockGuid,
            },
        },
        {
            // Defect pin FLIPPED (fix#337S #1075): combatLoggingService.js:45 now emits the
            // honest bare 'Concentration' label when spellName is omitted — never the literal
            // 'Concentration: undefined' prose.
            title: 'logConcentrationSave (missing spellName -> honest "Concentration")',
            invoke: () => logConcentrationSave({ campaignName, creatureName: 'Gortha', roll: 10, bonus: 2, bonusDetail: '+2 CON', dc: 15, success: true }),
            expected: {
                type: 'roll',
                rollType: 'concentration-save',
                characterName: 'Gortha',
                name: 'Constitution',
                rolls: [10],
                mode: 'normal',
                total: 10,
                bonus: 2,
                bonusDetail: '+2 CON',
                condition: 'Concentration',
                dc: 15,
                success: true,
                timestamp: expect.any(Number),
                id: mockGuid,
            },
        },
        {
            title: 'logConditionSave (scalar roll, normal mode)',
            invoke: () => logConditionSave({ campaignName, creatureName: 'Gortha', roll: 13, bonus: 3, bonusDetail: '+3 WIS', conditionLabel: 'poisoned', abilityLabel: 'Wisdom', dc: 14, success: true }),
            expected: {
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
                id: mockGuid,
            },
        },
        {
            // CLA-209: multi-dice array logs BOTH dice, mode 'advantage', total = max.
            // [8, 14] -> 14 also kills take-first / take-last / take-min implementations.
            title: 'logConditionSave (advantage multi-dice array, CLA-209)',
            invoke: () => logConditionSave({ campaignName, creatureName: 'Gortha', roll: [8, 14], bonus: 3, bonusDetail: '+3 STR', conditionLabel: 'grappled', abilityLabel: 'Strength', dc: 13, success: true }),
            expected: {
                type: 'roll',
                rollType: 'condition-save',
                characterName: 'Gortha',
                name: 'Strength',
                rolls: [8, 14],
                mode: 'advantage',
                total: 14,
                bonus: 3,
                bonusDetail: '+3 STR',
                condition: 'grappled',
                dc: 13,
                success: true,
                timestamp: expect.any(Number),
                id: mockGuid,
            },
        },
        {
            title: 'logHpChange (damage to unconscious)',
            invoke: () => logHpChange({ campaignName, targetName: 'Orc', delta: -15, currentHp: 0, maxHp: 30, isHealing: false, isUnconscious: true }),
            expected: {
                type: 'hp_change',
                targetName: 'Orc',
                delta: -15,
                currentHp: 0,
                maxHp: 30,
                isHealing: false,
                isUnconscious: true,
            },
        },
        {
            title: 'logHpChange (healing)',
            invoke: () => logHpChange({ campaignName, targetName: 'Ally', delta: 10, currentHp: 25, maxHp: 30, isHealing: true, isUnconscious: false }),
            expected: {
                type: 'hp_change',
                targetName: 'Ally',
                delta: 10,
                currentHp: 25,
                maxHp: 30,
                isHealing: true,
                isUnconscious: false,
            },
        },
        {
            title: 'logNpcThreshold',
            invoke: () => logNpcThreshold(campaignName, 'Bandit Leader', -10, 5, 10),
            expected: {
                type: 'hp_change',
                targetName: 'Bandit Leader',
                delta: -10,
                threshold: 5,
                maxHp: 10,
            },
        },
    ])('$title posts one campaign-pinned entry with exact bytes', ({ invoke, expected }) => {
        invoke();
        expect(postedCall()).toEqual([campaignName, expected]);
    });
});

describe('rejection guards', () => {
    it.each([
        { name: 'logInitiativeRoll', invoke: () => logInitiativeRoll(campaignName, 'Gortha', 15, 3) },
        { name: 'logConditionEvent', invoke: () => logConditionEvent({ campaignName, action: 'add', creatureName: 'Orc', conditionLabel: 'charmed', dc: 12, ability: 'CHA' }) },
        { name: 'logConcentrationSave', invoke: () => logConcentrationSave({ campaignName, creatureName: 'Gortha', roll: 14, bonus: 2, bonusDetail: '+2 CON', spellName: 'Fireball', dc: 15, success: true }) },
        { name: 'logConditionSave', invoke: () => logConditionSave({ campaignName, creatureName: 'Gortha', roll: 13, bonus: 3, bonusDetail: '+3 WIS', conditionLabel: 'poisoned', abilityLabel: 'Wisdom', dc: 14, success: true }) },
        { name: 'logHpChange', invoke: () => logHpChange({ campaignName, targetName: 'Orc', delta: -5, currentHp: 20, maxHp: 30, isHealing: false, isUnconscious: false }) },
        { name: 'logNpcThreshold', invoke: () => logNpcThreshold(campaignName, 'Bandit Leader', -10, 5, 10) },
    ])('$name resolves (never throws) and logs to console.error when addEntry rejects', async ({ invoke }) => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockAddEntry.mockRejectedValueOnce(new Error('network down'));
        try {
            await expect(invoke()).resolves.toBeUndefined();
            expect(mockAddEntry).toHaveBeenCalledTimes(1); // attempt happened, no retry storm
            expect(consoleError).toHaveBeenCalledTimes(1); // swallowed loudly, not silently
        } finally {
            consoleError.mockRestore();
        }
    });
});
