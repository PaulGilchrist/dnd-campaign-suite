import { handle, applyProtectionFromPoison, isProtectionFromPoisonActive } from './protectionFromPoisonHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');

const makePlayerStats = (overrides = {}) => ({
    name: 'TestCharacter',
    level: 5,
    ...overrides,
});

describe('Protection from Poison handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns error popup when no combat context', async () => {
            getCombatContext.mockResolvedValue(null);
            const action = { name: 'Protection from Poison', automation: { duration: '1 hour', range: 'Touch' } };
            const result = await handle(action, makePlayerStats(), 'TestCampaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No combat context found');
        });

        it('returns target selection popup with combat context', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Ally1' },
                    { name: 'Ally2' },
                ],
            });
            getRuntimeValue.mockReturnValue([]);
            const action = { name: 'Protection from Poison', automation: { duration: '1 hour', range: 'Touch' } };
            const result = await handle(action, makePlayerStats(), 'TestCampaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.targets).toHaveLength(3);
            expect(result.payload.targets[0].isSelf).toBe(true);
        });
    });

    describe('applyProtectionFromPoison', () => {
        it('removes Poisoned condition and applies buff', async () => {
            getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([]);

            const action = { name: 'Protection from Poison', automation: { duration: '1 hour', range: 'Touch' } };
            const result = await applyProtectionFromPoison(action, makePlayerStats(), 'TestCampaign', null, { targetName: 'TestCharacter' });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeConditions', [], 'TestCampaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', expect.arrayContaining([
                expect.objectContaining({
                    name: 'Protection from Poison',
                    effect: 'protection_from_poison',
                    resistanceTypes: ['Poison'],
                }),
            ]), 'TestCampaign');
            expect(addExpiration).toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });

        it('applies buff to target with combat context update', async () => {
            getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([]);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestCharacter', conditions: [{ key: 'poisoned' }] }],
            });

            const action = { name: 'Protection from Poison', automation: { duration: '1 hour', range: 'Touch' } };
            const result = await applyProtectionFromPoison(action, makePlayerStats(), 'TestCampaign', null, { targetName: 'TestCharacter' });

            expect(result.payload.description).toContain('Protection from Poison');
        });

        it('returns null when no target provided', async () => {
            const action = { name: 'Protection from Poison', automation: {} };
            const result = await applyProtectionFromPoison(action, makePlayerStats(), 'TestCampaign', null, null);

            expect(result).toBeNull();
        });
    });

    describe('isProtectionFromPoisonActive', () => {
        it('returns true when buff is active', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Protection from Poison', effect: 'protection_from_poison' },
            ]);
            expect(isProtectionFromPoisonActive('TestCharacter', 'TestCampaign')).toBe(true);
        });

        it('returns false when buff is not active', () => {
            getRuntimeValue.mockReturnValue([]);
            expect(isProtectionFromPoisonActive('TestCharacter', 'TestCampaign')).toBe(false);
        });
    });
});
