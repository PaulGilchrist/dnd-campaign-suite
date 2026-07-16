// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, handleApply, handleSpendDice, handleClearWard } from './bastionOfLawHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
    resolveMapPositions: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { addEntry } = await import('../../../ui/logService.js');
const { rangeToFeet, getDistanceFeet } = await import('../../../rules/combat/rangeValidation.js');
const { isWithinRange } = await import('../../../rules/combat/rangeCheck.js');
const { resolveTarget, resolveMapPositions } = await import('../../common/targetResolver.js');

const campaignName = 'test-campaign';
const mapName = 'test-map';
const playerName = 'PaladinRogue';
const targetName = 'Goblin';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
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

function setupDefaultMocks() {
    resolveTarget.mockResolvedValue({ target: { name: targetName } });
    rangeToFeet.mockReturnValue(30);
    resolveMapPositions.mockResolvedValue(null);
    getRuntimeValue.mockReturnValue(5);
    rollExpression.mockReturnValue({ total: 5 });
    isWithinRange.mockResolvedValue(true);
}

describe('bastionOfLawHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    describe('handle', () => {
        it('returns popup when no target selected', async () => {
            resolveTarget.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('requires selecting a creature');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('returns popup when target is out of range', async () => {
            resolveTarget.mockResolvedValue({ target: { name: targetName } });
            rangeToFeet.mockReturnValue(30);
            resolveMapPositions.mockResolvedValue({
                attackerPos: { gridX: 0, gridY: 0 },
                targetPos: { gridX: 10, gridY: 0 },
            });
            getDistanceFeet.mockReturnValue(50);
            isWithinRange.mockResolvedValue(false);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('out of range');
        });

        it('returns modal when target exists and is in range', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bastionOfLaw');
            expect(result.payload.targetName).toBe(targetName);
            expect(result.payload.playerName).toBe(playerName);
            expect(result.payload.campaignName).toBe(campaignName);
        });

        it('skips range check when map conditions are unavailable', async () => {
            // rangeToFeet returns null — no range check
            rangeToFeet.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('modal');
        });

        it('skips range check when map positions are incomplete', async () => {
            // attackerPos present but targetPos missing
            resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('modal');
        });

        it('uses feature name from action or defaults to Bastion of Law', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.featureName).toBe('Bastion of Law');

            const customAction = makeAction({ name: 'Custom Bastion' });
            const customResult = await handle(customAction, makePlayerStats(), campaignName, null);
            expect(customResult.payload.featureName).toBe('Custom Bastion');
        });
    });

    describe('handleApply', () => {
        it('returns popup when not enough sorcery points', async () => {
            getRuntimeValue.mockReturnValue(2);

            const result = await handleApply(makeAction(), makePlayerStats(), campaignName, 4, targetName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Not enough Sorcery Points');
            expect(result.payload.description).toContain('Need 4, have 2');
        });

        it('deducts sorcery points and creates ward on apply', async () => {
            await handleApply(makeAction(), makePlayerStats(), campaignName, 3, targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'sorceryPoints', 2, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawActive', true, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8', '1d8', '1d8'],
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawWardTarget', targetName, campaignName);
        });

        it('returns popup with ward info on success', async () => {
            const result = await handleApply(makeAction(), makePlayerStats(), campaignName, 3, targetName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Bastion of Law');
            expect(result.payload.description).toContain('Ward has 3d8');
            expect(result.payload.description).toContain(targetName);
            expect(result.payload.automationType).toBe('bastion_of_law');
        });

        it('clamps SP to minSP when below minimum', async () => {
            await handleApply(makeAction(), makePlayerStats(), campaignName, 0, targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'sorceryPoints', 4, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8'],
                campaignName
            );
        });

        it('clamps SP to maxSP when above maximum', async () => {
            getRuntimeValue.mockReturnValue(10);

            await handleApply(makeAction(), makePlayerStats(), campaignName, 10, targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'sorceryPoints', 5, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8', '1d8', '1d8', '1d8', '1d8'],
                campaignName
            );
        });

        it('uses sorceryPoints.max from playerStats when runtime value not set', async () => {
            getRuntimeValue.mockReturnValue(null);
            const playerStats = makePlayerStats({ resources: { sorceryPoints: { max: 10 } } });

            await handleApply(makeAction(), playerStats, campaignName, 3, targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'sorceryPoints', 7, campaignName);
        });

        it('uses feature name from action or defaults to Bastion of Law', async () => {
            const result = await handleApply(makeAction(), makePlayerStats(), campaignName, 3, targetName);
            expect(result.payload.name).toBe('Bastion of Law');

            const customAction = makeAction({ name: 'Custom Bastion' });
            const customResult = await handleApply(customAction, makePlayerStats(), campaignName, 3, targetName);
            expect(customResult.payload.name).toBe('Custom Bastion');
        });

        it('logs ability use on apply', async () => {
            await handleApply(makeAction(), makePlayerStats(), campaignName, 3, targetName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Bastion of Law',
                description: expect.stringContaining('spending 3 Sorcery Points'),
            }));
        });
    });

    describe('handleSpendDice', () => {
        it('returns popup when no ward active', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return null;
                return null;
            });

            const result = await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 1);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No ward active');
        });

        it('rolls dice and returns reduction with remaining count', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 12 });

            const result = await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 2);

            expect(result.type).toBe('popup');
            expect(result.damageReduction).toBe(12);
            expect(result.remainingDice).toBe(1);
        });

        it('updates remaining dice after spending', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 10 });

            await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 2);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8'],
                campaignName
            );
        });

        it('deactivates ward when no dice remain after spending', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 9 });

            await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 2);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawActive', false, campaignName);
        });

        it('handles numDice edge cases: defaults to 1 and clamps to available', async () => {
            // defaults to 1 when numDice is falsy
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 5 });

            await handleSpendDice(makeAction(), makePlayerStats(), campaignName, undefined);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8'],
                campaignName
            );

            vi.clearAllMocks();
            setupDefaultMocks();

            // clamps when numDice exceeds available dice
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 10 });

            await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 5);

            expect(rollExpression).toHaveBeenCalledWith('1d8+1d8');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                [],
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawActive', false, campaignName);
        });

        it('returns popup with roll result description', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 8 });

            const result = await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 1);

            expect(result.payload.description).toContain('Rolled 1d8 for total 8');
            expect(result.payload.description).toContain('Damage reduced by 8');
            expect(result.payload.description).toContain('1 dice remaining');
        });

        it('logs ability use on spend', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 6 });

            await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 1);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Bastion of Law',
                description: expect.stringContaining('reducing damage by 6'),
            }));
        });
    });

    describe('handleClearWard', () => {
        it('clears all ward state', async () => {
            await handleClearWard(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawActive', false, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawWardDice', [], campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawWardTarget', null, campaignName);
        });

        it('returns popup with cleared message', async () => {
            const result = await handleClearWard(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Bastion of Law');
            expect(result.payload.description).toContain('ward cleared');
        });

        it('uses feature name from action or defaults to Bastion of Law', async () => {
            const result = await handleClearWard(makeAction(), makePlayerStats(), campaignName);
            expect(result.payload.name).toBe('Bastion of Law');

            const customAction = makeAction({ name: 'Custom Bastion' });
            const customResult = await handleClearWard(customAction, makePlayerStats(), campaignName);
            expect(customResult.payload.name).toBe('Custom Bastion');
            expect(customResult.payload.description).toContain('ward cleared');
        });
    });
});
