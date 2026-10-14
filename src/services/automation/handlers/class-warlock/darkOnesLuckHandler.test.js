import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle } from './darkOnesLuckHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationService.js');

const campaignName = 'TestCampaign';
const playerName = 'TestWarlock';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 6,
        class: { name: 'Warlock' },
        abilities: [{ name: 'Charisma', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: "Dark One's Own Luck",
        automation: { type: 'dark_ones_luck', diceExpression: '1d10' },
        ...overrides,
    };
}

function makeCheck(overrides = {}) {
    return {
        rollType: 'check',
        attackerName: playerName,
        d20: 8,
        bonus: 5,
        checkName: 'Stealth check',
        ...overrides,
    };
}

function makeSave(overrides = {}) {
    return {
        rollType: 'save',
        attackerName: playerName,
        d20: 12,
        bonus: 3,
        saveType: 'wisdom',
        ...overrides,
    };
}

function mockRuntime(uses, lastAttack, chaMod = 3) {
    getRuntimeValue.mockImplementation((_name, key, _campaign) => {
        if (key === 'darkOnesLuckUses') return uses;
        if (key === 'lastAttack') return lastAttack;
        return null;
    });
    evaluateAutoExpression.mockReturnValue(chaMod);
}

function mockDieRoll(value) {
    vi.spyOn(Math, 'random').mockReturnValue((value - 1) / 10);
}

describe('darkOnesLuckHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('guard: no uses remaining', () => {
        it('should return popup when uses are zero', async () => {
            mockRuntime(0, makeCheck());

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Dark One's Own Luck");
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

    });

    describe('guard: fallback to maxUses when runtime value is null', () => {
        it('should use maxUses as default when darkOnesLuckUses is null', async () => {
            mockRuntime(null, makeCheck(), 3);

            mockDieRoll(5);
            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Stealth check');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'darkOnesLuckUses', 2, campaignName
            );
        });

    });

    describe('guard: CHA modifier affects maxUses', () => {
        it('should clamp maxUses to minimum of 1 when CHA modifier is negative', async () => {
            mockRuntime(1, makeCheck(), -4);
            mockDieRoll(5);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Modified: d20(8) + 5 + 1d10(5) = <b>18</b>');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'darkOnesLuckUses', 0, campaignName
            );
        });

        it('should use CHA modifier as maxUses when positive', async () => {
            mockRuntime(5, makeCheck(), 3);
            mockDieRoll(5);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'darkOnesLuckUses', 4, campaignName
            );
        });
    });

    describe('guard: no recent check or save', () => {
        it('should reject when lastAttack is null', async () => {
            mockRuntime(1, null, 3);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent ability check');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should reject when lastAttack is by a different character', async () => {
            mockRuntime(1, makeCheck({ attackerName: 'Goblin', checkName: 'Stealth' }), 3);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent ability check');
            expect(result.payload.description).toContain(playerName);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should reject when lastAttack has no matching rollType', async () => {
            mockRuntime(1, makeCheck({ rollType: 'attack' }), 3);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent ability check');
        });
    });

    describe('ability check handling', () => {
        it('should enhance check result with d10 roll', async () => {
            mockRuntime(1, makeCheck({ d20: 8, bonus: 5, checkName: 'Stealth check' }), 3);
            mockDieRoll(10);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Dark One's Own Luck");
            expect(result.payload.description).toContain('Stealth check');
            expect(result.payload.description).toContain('d20(8) + 5 = 13');
            expect(result.payload.description).toContain('1d10(10)');
            expect(result.payload.description).toContain('1d10(10) = <b>23</b>');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('should handle rollType skill the same as check', async () => {
            mockRuntime(1, makeCheck({ rollType: 'skill', checkName: 'Athletics check' }), 3);
            mockDieRoll(7);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Athletics check');
            expect(result.payload.description).toContain('1d10(7) = <b>20</b>');
        });

        it('should log the ability use', async () => {
            mockRuntime(1, makeCheck(), 3);
            mockDieRoll(7);

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: "Dark One's Own Luck",
                description: expect.stringContaining('+1d10(7)'),
                timestamp: expect.any(Number),
            }));
        });

        it('should consume one use after processing a check', async () => {
            mockRuntime(5, makeCheck(), 3);
            mockDieRoll(5);

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'darkOnesLuckUses', 4, campaignName
            );
        });
    });

    describe('saving throw handling', () => {
        it('should enhance save result with d10 roll', async () => {
            mockRuntime(1, makeSave({ d20: 12, bonus: 3, saveType: 'wisdom' }), 3);
            mockDieRoll(3);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('WIS');
            expect(result.payload.description).toContain('d20(12) + 3 = 15');
            expect(result.payload.description).toContain('1d10(3)');
            expect(result.payload.description).toContain('1d10(3) = <b>18</b>');
        });

        it('should use Save label when saveType is null', async () => {
            mockRuntime(1, makeSave({ saveType: null }), 3);
            mockDieRoll(5);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Save');
            expect(result.payload.description).toContain('1d10(5) = <b>20</b>');
        });

    });

    describe('priority: check over save', () => {
        it('should prefer ability check over saving throw', async () => {
            mockRuntime(1, makeCheck({ d20: 5, bonus: 2, checkName: 'Arcana check' }), 3);
            mockDieRoll(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Arcana check');
            expect(result.payload.description).not.toContain('WIS');
            expect(result.payload.description).not.toContain('save');
        });
    });
});
