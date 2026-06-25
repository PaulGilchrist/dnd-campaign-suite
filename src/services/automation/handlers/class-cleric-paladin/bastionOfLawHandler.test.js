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

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
    resolveMapPositions: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { addEntry } = await import('../../../ui/logService.js');
const { rangeToFeet, getDistanceFeet } = await import('../../../rules/combat/rangeValidation.js');
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

        it('returns popup when target exists but resolveTarget returns no target property', async () => {
            resolveTarget.mockResolvedValue({});

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires selecting a creature');
        });

        it('returns popup when target is out of range', async () => {
            resolveTarget.mockResolvedValue({ target: { name: targetName } });
            rangeToFeet.mockReturnValue(30);
            resolveMapPositions.mockResolvedValue({
                attackerPos: { gridX: 0, gridY: 0 },
                targetPos: { gridX: 10, gridY: 0 },
            });
            getDistanceFeet.mockReturnValue(50);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('out of range');
            expect(result.payload.description).toContain('50 ft');
            expect(result.payload.description).toContain('30 ft');
        });

        it('returns modal when target exists and is in range', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bastionOfLaw');
            expect(result.payload.targetName).toBe(targetName);
            expect(result.payload.playerName).toBe(playerName);
            expect(result.payload.campaignName).toBe(campaignName);
        });

        it('skips range check when no mapName provided', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(resolveMapPositions).not.toHaveBeenCalled();
        });

        it('skips range check when mapName provided but rangeToFeet returns null', async () => {
            rangeToFeet.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('modal');
            expect(resolveMapPositions).not.toHaveBeenCalled();
        });

        it('skips range check when map positions unavailable', async () => {
            resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('modal');
            expect(getDistanceFeet).not.toHaveBeenCalled();
        });

        it('skips range check when map positions return no targetPos', async () => {
            resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 }, targetPos: null });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('modal');
        });

        it('uses default feature name when action.name is empty', async () => {
            const action = makeAction({ name: '' });
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.featureName).toBe('Bastion of Law');
        });

        it('uses default feature name when action.name is undefined', async () => {
            const action = makeAction({ name: undefined });
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.featureName).toBe('Bastion of Law');
        });

        it('uses action name when provided', async () => {
            const action = makeAction({ name: 'Custom Bastion' });
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.featureName).toBe('Custom Bastion');
        });

        it('uses default range when automation.range is missing', async () => {
            const action = makeAction({ automation: { type: 'bastion_of_law' } });
            await handle(action, makePlayerStats(), campaignName, null);

            expect(rangeToFeet).toHaveBeenCalledWith('30_ft');
        });

        it('uses custom range from automation when provided', async () => {
            const action = makeAction({ automation: { range: '60_ft' } });
            await handle(action, makePlayerStats(), campaignName, null);

            expect(rangeToFeet).toHaveBeenCalledWith('60_ft');
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

        it('uses default maxSP of 5 when not provided', async () => {
            getRuntimeValue.mockReturnValue(10);
            const action = makeAction({ automation: {} });

            await handleApply(action, makePlayerStats(), campaignName, 10, targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8', '1d8', '1d8', '1d8', '1d8'],
                campaignName
            );
        });

        it('uses default minSP of 1 when not provided', async () => {
            const action = makeAction({ automation: { maxSP: 5 } });
            await handleApply(action, makePlayerStats(), campaignName, 0, targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'sorceryPoints', 4, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8'],
                campaignName
            );
        });

        it('handles SP amount as string', async () => {
            await handleApply(makeAction(), makePlayerStats(), campaignName, '3', targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'sorceryPoints', 2, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8', '1d8', '1d8'],
                campaignName
            );
        });

        it('handles invalid SP amount by defaulting to 1', async () => {
            await handleApply(makeAction(), makePlayerStats(), campaignName, 'abc', targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'sorceryPoints', 4, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8'],
                campaignName
            );
        });

        it('defaults to max SP when current pool is null', async () => {
            getRuntimeValue.mockReturnValue(null);

            await handleApply(makeAction(), makePlayerStats(), campaignName, 3, targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'sorceryPoints', 2, campaignName);
        });

        it('uses sorceryPoints.max from playerStats when runtime value not set', async () => {
            getRuntimeValue.mockReturnValue(null);
            const playerStats = makePlayerStats({ resources: { sorceryPoints: { max: 10 } } });

            await handleApply(makeAction(), playerStats, campaignName, 3, targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'sorceryPoints', 7, campaignName);
        });

        it('uses default feature name when action.name is empty', async () => {
            const action = makeAction({ name: '' });
            const result = await handleApply(action, makePlayerStats(), campaignName, 3, targetName);

            expect(result.payload.name).toBe('Bastion of Law');
            expect(result.payload.description).toContain('Bastion of Law');
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

        it('logs ability use with custom action name', async () => {
            const action = makeAction({ name: 'Custom Bastion' });
            await handleApply(action, makePlayerStats(), campaignName, 2, targetName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                abilityName: 'Custom Bastion',
                description: expect.stringContaining('Custom Bastion'),
            }));
        });

        it('does not create ward state when insufficient SP', async () => {
            getRuntimeValue.mockReturnValue(1);

            await handleApply(makeAction(), makePlayerStats(), campaignName, 4, targetName);

            const wardCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'bastionOfLawWardDice' || c[1] === 'bastionOfLawActive'
            );
            expect(wardCalls.length).toBe(0);
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

        it('returns popup when ward target exists but no dice', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return [];
                return null;
            });

            const result = await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 1);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No ward active');
        });

        it('rolls dice and returns reduction total', async () => {
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

        it('does not deactivate ward when dice remain', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 7 });

            await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 2);

            const activeCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'bastionOfLawActive'
            );
            expect(activeCalls.length).toBe(0);
        });

        it('defaults to 1 dice when numDice is undefined', async () => {
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
        });

        it('defaults to 1 dice when numDice is null', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 5 });

            await handleSpendDice(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8'],
                campaignName
            );
        });

        it('clamps numDice when exceeding available dice', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                return null;
            });
            rollExpression.mockReturnValue({ total: 10 });

            await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 5);

            // Should only roll 2 dice, not 5
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

        it('handles null roll result total by returning 0 reduction', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8'];
                return null;
            });
            rollExpression.mockReturnValue(null);

            const result = await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 1);

            expect(result.damageReduction).toBe(0);
        });

        it('handles undefined roll result total by returning 0 reduction', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8'];
                return null;
            });
            rollExpression.mockReturnValue(undefined);

            const result = await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 1);

            expect(result.damageReduction).toBe(0);
        });

        it('handles roll result with no total property by returning 0 reduction', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8'];
                return null;
            });
            rollExpression.mockReturnValue({});

            const result = await handleSpendDice(makeAction(), makePlayerStats(), campaignName, 1);

            expect(result.damageReduction).toBe(0);
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

        it('uses custom feature name on spend', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawWardTarget') return targetName;
                if (key === 'bastionOfLawWardDice') return ['1d8'];
                return null;
            });
            const action = makeAction({ name: 'Custom Bastion' });
            rollExpression.mockReturnValue({ total: 7 });

            const result = await handleSpendDice(action, makePlayerStats(), campaignName, 1);

            expect(result.payload.name).toBe('Custom Bastion');
            expect(result.payload.description).toContain('Rolled 1d8 for total 7');
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

        it('uses custom feature name when provided', async () => {
            const action = makeAction({ name: 'Custom Bastion' });
            const result = await handleClearWard(action, makePlayerStats(), campaignName);

            expect(result.payload.name).toBe('Custom Bastion');
            expect(result.payload.description).toContain('ward cleared');
        });

        it('uses default feature name when action.name is empty', async () => {
            const action = makeAction({ name: '' });
            const result = await handleClearWard(action, makePlayerStats(), campaignName);

            expect(result.payload.name).toBe('Bastion of Law');
        });
    });
});
