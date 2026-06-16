import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, handleApply, handleSpendDice, handleClearWard } from './bastionOfLawHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
    getDistanceFeet: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
    resolveMapPositions: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { addEntry } = await import('../../../ui/logService.js');
const { rangeToFeet, getDistanceFeet } = await import('../../../rules/combat/rangeValidation.js');
const { resolveTarget, resolveMapPositions } = await import('../../common/targetResolver.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'PaladinRogue',
        level: 5,
        resources: {
            sorceryPoints: { max: 5 },
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Bastion of Law',
        automation: {
            type: 'bastion_of_law',
            range: '30_ft',
            maxSP: 5,
            minSP: 1,
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('bastionOfLawHandler', () => {
    describe('handle - target and range', () => {
        it('returns popup when no target selected', async () => {
            resolveTarget.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires selecting a creature');
        });

        it('returns popup when target is out of range', async () => {
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            rangeToFeet.mockReturnValue(30);
            resolveMapPositions.mockResolvedValue({
                attackerPos: { gridX: 0, gridY: 0 },
                targetPos: { gridX: 10, gridY: 0 },
            });
            getDistanceFeet.mockReturnValue(50);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('out of range');
        });

        it('returns modal when target exists and is in range', async () => {
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            rangeToFeet.mockReturnValue(30);
            resolveMapPositions.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bastionOfLaw');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.playerName).toBe('PaladinRogue');
        });

        it('skips range check when no mapName provided', async () => {
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
        });

        it('skips range check when positions unavailable', async () => {
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            rangeToFeet.mockReturnValue(30);
            resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.type).toBe('modal');
        });

        it('uses default feature name when not provided', async () => {
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            rangeToFeet.mockReturnValue(30);
            resolveMapPositions.mockResolvedValue(null);

            const action = makeAction({ name: '' });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.featureName).toBe('Bastion of Law');
        });
    });

    describe('handleApply', () => {
        it('returns popup when not enough sorcery points', async () => {
            getRuntimeValue.mockReturnValue(2);

            const result = await handleApply(makeAction(), makePlayerStats(), 'test-campaign', 4, 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Sorcery Points');
        });

        it('deducts sorcery points on apply', async () => {
            getRuntimeValue.mockReturnValue(5);

            await handleApply(makeAction(), makePlayerStats(), 'test-campaign', 3, 'Goblin');

            expect(setRuntimeValue).toHaveBeenCalledWith('PaladinRogue', 'sorceryPoints', 2, 'test-campaign');
        });

        it('creates ward dice equal to SP spent', async () => {
            getRuntimeValue.mockReturnValue(5);

            await handleApply(makeAction(), makePlayerStats(), 'test-campaign', 3, 'Goblin');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'PaladinRogue',
                'bastionOfLawWardDice',
                ['1d8', '1d8', '1d8'],
                'test-campaign'
            );
        });

        it('sets ward active to true', async () => {
            getRuntimeValue.mockReturnValue(5);

            await handleApply(makeAction(), makePlayerStats(), 'test-campaign', 3, 'Goblin');

            expect(setRuntimeValue).toHaveBeenCalledWith('PaladinRogue', 'bastionOfLawActive', true, 'test-campaign');
        });

        it('stores ward target', async () => {
            getRuntimeValue.mockReturnValue(5);

            await handleApply(makeAction(), makePlayerStats(), 'test-campaign', 3, 'Goblin');

            expect(setRuntimeValue).toHaveBeenCalledWith('PaladinRogue', 'bastionOfLawWardTarget', 'Goblin', 'test-campaign');
        });

        it('returns popup with ward info', async () => {
            getRuntimeValue.mockReturnValue(5);

            const result = await handleApply(makeAction(), makePlayerStats(), 'test-campaign', 3, 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Bastion of Law');
            expect(result.payload.description).toContain('Ward has 3d8');
        });

        it('clamps SP to min when below minimum', async () => {
            getRuntimeValue.mockReturnValue(5);

            await handleApply(makeAction(), makePlayerStats(), 'test-campaign', 0, 'Goblin');

            // SP should be clamped to minSP (1)
            expect(setRuntimeValue).toHaveBeenCalledWith('PaladinRogue', 'sorceryPoints', 4, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'PaladinRogue',
                'bastionOfLawWardDice',
                ['1d8'],
                'test-campaign'
            );
        });

        it('clamps SP to max when above maximum', async () => {
            getRuntimeValue.mockReturnValue(10);

            await handleApply(makeAction(), makePlayerStats(), 'test-campaign', 10, 'Goblin');

            // SP should be clamped to maxSP (5)
            expect(setRuntimeValue).toHaveBeenCalledWith('PaladinRogue', 'sorceryPoints', 5, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'PaladinRogue',
                'bastionOfLawWardDice',
                ['1d8', '1d8', '1d8', '1d8', '1d8'],
                'test-campaign'
            );
        });

        it('uses default maxSP of 5', async () => {
            getRuntimeValue.mockReturnValue(10);
            const action = makeAction({ automation: {} });

            await handleApply(action, makePlayerStats(), 'test-campaign', 10, 'Goblin');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'PaladinRogue',
                'bastionOfLawWardDice',
                ['1d8', '1d8', '1d8', '1d8', '1d8'],
                'test-campaign'
            );
        });

        it('logs ability use on apply', async () => {
            getRuntimeValue.mockReturnValue(5);

            await handleApply(makeAction(), makePlayerStats(), 'test-campaign', 3, 'Goblin');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'PaladinRogue',
                abilityName: 'Bastion of Law',
            }));
        });
    });

    describe('handleSpendDice', () => {
        it('returns popup when no ward active', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return null;
                if (key === 'bastionOfLawWardDice') return [];
                return null;
            });

            const result = await handleSpendDice(makeAction(), makePlayerStats(), 'test-campaign', 1);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No ward active');
        });

        it('rolls dice and returns reduction total', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return 'Goblin';
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 12 });

            const result = await handleSpendDice(makeAction(), makePlayerStats(), 'test-campaign', 2);

            expect(result.type).toBe('popup');
            expect(result.damageReduction).toBe(12);
            expect(result.remainingDice).toBe(1);
        });

        it('updates remaining dice after spending', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return 'Goblin';
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 10 });

            await handleSpendDice(makeAction(), makePlayerStats(), 'test-campaign', 2);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'PaladinRogue',
                'bastionOfLawWardDice',
                ['1d8'],
                'test-campaign'
            );
        });

        it('deactivates ward when no dice remain', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return 'Goblin';
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 9 });

            await handleSpendDice(makeAction(), makePlayerStats(), 'test-campaign', 2);

            expect(setRuntimeValue).toHaveBeenCalledWith('PaladinRogue', 'bastionOfLawActive', false, 'test-campaign');
        });

        it('does not deactivate ward when dice remain', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return 'Goblin';
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 7 });

            await handleSpendDice(makeAction(), makePlayerStats(), 'test-campaign', 2);

            expect(setRuntimeValue).not.toHaveBeenCalledWith('PaladinRogue', 'bastionOfLawActive', false, 'test-campaign');
        });

        it('defaults to 1 dice when numDice not provided', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return 'Goblin';
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 5 });

            await handleSpendDice(makeAction(), makePlayerStats(), 'test-campaign', undefined);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'PaladinRogue',
                'bastionOfLawWardDice',
                ['1d8'],
                'test-campaign'
            );
        });

        it('returns popup with roll result description', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return 'Goblin';
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 8 });

            const result = await handleSpendDice(makeAction(), makePlayerStats(), 'test-campaign', 1);

            expect(result.payload.description).toContain('Rolled 1d8 for total 8');
            expect(result.payload.description).toContain('Damage reduced by 8');
        });

        it('handles null roll result total', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return 'Goblin';
                if (key === 'bastionOfLawWardDice') return ['1d8'];
                return null;
            });
            rollExpression.mockReturnValue(null);

            const result = await handleSpendDice(makeAction(), makePlayerStats(), 'test-campaign', 1);

            expect(result.damageReduction).toBe(0);
        });

        it('logs ability use on spend', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return 'Goblin';
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 6 });

            await handleSpendDice(makeAction(), makePlayerStats(), 'test-campaign', 1);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'PaladinRogue',
                abilityName: 'Bastion of Law',
            }));
        });
    });

    describe('handleClearWard', () => {
        it('clears all ward state', async () => {
            await handleClearWard(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('PaladinRogue', 'bastionOfLawActive', false, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('PaladinRogue', 'bastionOfLawWardDice', [], 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('PaladinRogue', 'bastionOfLawWardTarget', null, 'test-campaign');
        });

        it('returns popup with cleared message', async () => {
            const result = await handleClearWard(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('ward cleared');
        });
    });
});
