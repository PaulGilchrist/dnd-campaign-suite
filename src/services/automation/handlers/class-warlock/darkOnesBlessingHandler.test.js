import { handle, grantDarkOnesBlessing } from './darkOnesBlessingHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
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
    addEntry: vi.fn(() => Promise.resolve()),
}));

const makeAction = (auto = {}) => ({
    name: "Dark One's Blessing",
    automation: { type: 'dark_ones_blessing', ...auto },
});

const makeFiendWarlockStats = (overrides = {}) => ({
    name: 'TestWarlock',
    class: { subclass: { name: 'Fiend Patron' } },
    characterAdvancement: [{ name: "Dark One's Blessing", automation: { tempHpExpression: 'CHA modifier + warlock level', range: '10_ft' } }],
    abilities: [{ name: 'Charisma', bonus: 5 }],
    level: 1,
    ...overrides,
});

const makeOtherWarlockStats = (overrides = {}) => ({
    name: 'TestWarlock',
    class: { subclass: { name: 'Other Patron' } },
    characterAdvancement: [{ name: "Dark One's Blessing" }],
    ...overrides,
});

describe('darkOnesBlessingHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        automationService.evaluateAutoExpression.mockReturnValue(5);
        runtimeState.getRuntimeValue.mockReturnValue('0');
        rangeValidation.rangeToFeet.mockReturnValue(10);
    });

    describe('grantDarkOnesBlessing', () => {
        it('should return null when not a Fiend patron', async () => {
            const result = await grantDarkOnesBlessing(makeOtherWarlockStats(), 'campaign', null, null);

            expect(result).toBeNull();
        });

        it('should return null when feature not in characterAdvancement', async () => {
            const playerStats = {
                name: 'TestWarlock',
                class: { subclass: { name: 'Fiend Patron' } },
                characterAdvancement: [],
            };

            const result = await grantDarkOnesBlessing(playerStats, 'campaign', null, null);

            expect(result).toBeNull();
        });

        it('should return null when feature has no automation', async () => {
            const playerStats = {
                name: 'TestWarlock',
                class: { subclass: { name: 'Fiend Patron' } },
                characterAdvancement: [{ name: "Dark One's Blessing" }],
            };

            const result = await grantDarkOnesBlessing(playerStats, 'campaign', null, null);

            expect(result).toBeNull();
        });

        it('should use minimum of 1 when evaluated amount is zero', async () => {
            automationService.evaluateAutoExpression.mockReturnValue(0);

            const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', null, null);

            expect(result).not.toBeNull();
            expect(result.amount).toBe(1);
        });

        it('should apply temp HP and return result', async () => {
            const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', null, null);

            expect(result).not.toBeNull();
            expect(result.amount).toBe(5);
            expect(result.message).toContain('temporary hit points');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'tempHp',
                5,
                'campaign'
            );
        });

        it('should use minimum of 1 when evaluated amount is negative', async () => {
            automationService.evaluateAutoExpression.mockReturnValue(-3);

            const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', null, null);

            expect(result.amount).toBe(1);
        });

        it('should check range when mapName and attackerName provided', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(10);
            mapsService.loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestWarlock', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 5, gridY: 5 },
                ],
            });
            rangeValidation.getDistanceFeet.mockReturnValue(5);

            const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', 'Goblin', 'test-map');

            expect(result).not.toBeNull();
            expect(result.outOfRange).toBeUndefined();
        });

        it('should set outOfRange when distance exceeds range', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(10);
            mapsService.loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestWarlock', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 20, gridY: 20 },
                ],
            });
            rangeValidation.getDistanceFeet.mockReturnValue(15);

            const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', 'Goblin', 'test-map');

            expect(result.outOfRange).toBe(true);
        });

        it('should set outOfRange when distance is null', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(10);
            mapsService.loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestWarlock', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 20, gridY: 20 },
                ],
            });
            rangeValidation.getDistanceFeet.mockReturnValue(null);

            const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', 'Goblin', 'test-map');

            expect(result.outOfRange).toBe(true);
        });

        it('should skip range check when attackerPlayer not found', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(10);
            mapsService.loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestWarlock', gridX: 5, gridY: 5 },
                ],
            });

            const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', 'Goblin', 'test-map');

            expect(result).not.toBeNull();
            expect(result.outOfRange).toBeUndefined();
        });

        it('should skip range check when no mapName provided', async () => {
            const result = await grantDarkOnesBlessing(makeFiendWarlockStats(), 'campaign', null, null);

            expect(result).not.toBeNull();
            expect(result.outOfRange).toBeUndefined();
        });
    });

    describe('handle', () => {
        it('should return null when grantDarkOnesBlessing returns null', async () => {
            const result = await handle(makeAction(), makeOtherWarlockStats(), 'campaign', null);

            expect(result).toBeNull();
        });

        it('should add campaign log entry', async () => {
            const result = await handle(makeAction(), makeFiendWarlockStats(), 'campaign', null);

            expect(result.type).toBe('popup');
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestWarlock',
                abilityName: "Dark One's Blessing",
            }));
        });

        it('should return popup with result message', async () => {
            const result = await handle(makeAction(), makeFiendWarlockStats(), 'campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('temporary hit points');
        });

        it('should include automation in result', async () => {
            const result = await handle(makeAction({ type: 'dark_ones_blessing' }), makeFiendWarlockStats(), 'campaign', null);

            expect(result.payload.automation).toEqual({ type: 'dark_ones_blessing' });
        });
    });
});
