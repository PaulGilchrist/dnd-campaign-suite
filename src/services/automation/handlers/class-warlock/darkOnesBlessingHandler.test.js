// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, grantDarkOnesBlessing } from './darkOnesBlessingHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as mapsService from '../../../maps/mapsService.js';
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

const { addEntry } = await import('../../../ui/logService.js');

function makeAction(auto = {}) {
    return {
        name: "Dark One's Blessing",
        automation: { type: 'dark_ones_blessing', ...auto },
    };
}

function makeFiendWarlockStats(overrides = {}) {
    return {
        name: 'TestWarlock',
        class: { subclass: { name: 'Fiend Patron' } },
        characterAdvancement: [{ name: "Dark One's Blessing", automation: { tempHpExpression: 'CHA modifier + warlock level', range: '10_ft' } }],
        abilities: [{ name: 'Charisma', bonus: 5 }],
        level: 1,
        ...overrides,
    };
}

function makeOtherWarlockStats(overrides = {}) {
    return {
        name: 'TestWarlock',
        class: { subclass: { name: 'Other Patron' } },
        characterAdvancement: [{ name: "Dark One's Blessing" }],
        ...overrides,
    };
}

describe('darkOnesBlessingHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        automationService.evaluateAutoExpression.mockReturnValue(5);
        runtimeState.getRuntimeValue.mockReturnValue('0');
        rangeValidation.rangeToFeet.mockReturnValue(10);
        addEntry.mockResolvedValue(undefined);
    });

    describe('grantDarkOnesBlessing', () => {
        describe('early returns', () => {
            it.each([
                ['not a Fiend patron', makeOtherWarlockStats()],
                ['Fiend patron without automation', {
                    name: 'TestWarlock',
                    class: { subclass: { name: 'Fiend Patron' } },
                    characterAdvancement: [{ name: "Dark One's Blessing" }],
                }],
                ['Fiend patron with feature but no automation property', {
                    name: 'TestWarlock',
                    class: { subclass: { name: 'Fiend Patron' } },
                    characterAdvancement: [{ name: "Dark One's Blessing", automation: null }],
                }],
            ])('returns null when %s', async (_, playerStats) => {
                const result = await grantDarkOnesBlessing(playerStats, 'campaign', null, null);

                expect(result).toBeNull();
            });
        });

        describe('successful granting', () => {
            it('applies temp HP and returns result with correct amount', async () => {
                const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', null, null);

                expect(result).not.toBeNull();
                expect(result.amount).toBe(5);
                expect(result.message).toContain('temporary hit points');
                expect(result.message).toContain('5');
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'TestWarlock',
                    'tempHp',
                    5,
                    'campaign'
                );
            });

            it('uses minimum of 1 when evaluated amount is zero or negative', async () => {
                automationService.evaluateAutoExpression.mockReturnValue(0);

                const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', null, null);

                expect(result.amount).toBe(1);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'TestWarlock',
                    'tempHp',
                    1,
                    'campaign'
                );
            });

            it('adds to existing temp HP', async () => {
                runtimeState.getRuntimeValue.mockReturnValue('3');

                const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', null, null);

                expect(result).not.toBeNull();
                expect(result.amount).toBe(5);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'TestWarlock',
                    'tempHp',
                    8,
                    'campaign'
                );
            });
        });

        describe('range checking', () => {
            function makeMapData(playerName, gridX, gridY) {
                return {
                    players: [
                        { name: 'TestWarlock', gridX: 5, gridY: 5 },
                        { name: 'Goblin', gridX, gridY },
                    ],
                };
            }

            it('checks range when mapName and attackerName are provided', async () => {
                mapsService.loadMapData.mockResolvedValue(makeMapData(5, 5));
                rangeValidation.getDistanceFeet.mockReturnValue(5);

                const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', 'Goblin', 'test-map');

                expect(result).not.toBeNull();
                expect(result.outOfRange).toBeUndefined();
            });

            it('sets outOfRange when attacker is out of range', async () => {
                mapsService.loadMapData.mockResolvedValue(makeMapData(20, 20));
                rangeValidation.getDistanceFeet.mockReturnValue(15);

                const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', 'Goblin', 'test-map');

                expect(result.outOfRange).toBe(true);
            });

            it('skips range check when attacker is not found on map', async () => {
                mapsService.loadMapData.mockResolvedValue({
                    players: [{ name: 'TestWarlock', gridX: 5, gridY: 5 }],
                });

                const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', 'Goblin', 'test-map');

                expect(result).not.toBeNull();
                expect(result.outOfRange).toBeUndefined();
            });
        });
    });

    describe('handle', () => {
        it('returns null and does not log when grantDarkOnesBlessing returns null', async () => {
            const result = await handle(makeAction(), makeOtherWarlockStats(), 'campaign', null);

            expect(result).toBeNull();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('logs the ability use and returns a popup on success', async () => {
            await handle(makeAction(), makeFiendWarlockStats(), 'campaign', null);

            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestWarlock',
                abilityName: "Dark One's Blessing",
                timestamp: expect.any(Number),
            }));
        });

        it('returns a popup with automation_info type and payload', async () => {
            const result = await handle(makeAction(), makeFiendWarlockStats(), 'campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Dark One's Blessing");
            expect(result.payload.description).toContain('temporary hit points');
            expect(result.payload.description).toContain('5');
            expect(result.payload.automation).toEqual({ type: 'dark_ones_blessing' });
        });

        it('does not throw when addEntry fails (fire-and-forget logging)', async () => {
            addEntry.mockRejectedValue(new Error('Log save failed'));

            const result = await handle(makeAction(), makeFiendWarlockStats(), 'campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });
    });
});
