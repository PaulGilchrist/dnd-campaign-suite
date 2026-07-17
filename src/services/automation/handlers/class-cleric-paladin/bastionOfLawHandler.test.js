// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, handleApply, handleSpendDice, handleClearWard } from './bastionOfLawHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getAllyList } = await import('../../../../hooks/useAllySelection.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { addEntry } = await import('../../../ui/logService.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');

const campaignName = 'test-campaign';
const playerName = 'PaladinRogue';
const targetName = 'AllyWarrior';

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
    getAllyList.mockReturnValue([playerName, targetName]);
    getCombatContext.mockResolvedValue({
        creatures: [
            { name: playerName, type: 'player', currentHp: 45, maxHp: 45 },
            { name: targetName, type: 'npc', currentHp: 30, maxHp: 30 },
        ],
    });
    getRuntimeValue.mockReturnValue(5);
    rollExpression.mockReturnValue({ total: 5 });
}

describe('bastionOfLawHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    describe('handle', () => {
        it('returns modal with ally list when allies are available', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bastionOfLaw');
            expect(result.payload.creatureTargets).toHaveLength(2);
            expect(result.payload.creatureTargets[0].name).toBe(playerName);
            expect(result.payload.creatureTargets[1].name).toBe(targetName);
            expect(result.payload.playerName).toBe(playerName);
            expect(result.payload.maxSP).toBe(5);
            expect(result.payload.minSP).toBe(1);
        });

        it('returns popup when no allies available', async () => {
            getAllyList.mockReturnValue([]);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No creatures available');
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

        it('deducts sorcery points and creates ward on target', async () => {
            await handleApply(makeAction(), makePlayerStats(), campaignName, 3, targetName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'sorceryPoints', 2, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'bastionOfLawActive', true, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                targetName,
                'bastionOfLawWardDice',
                ['1d8', '1d8', '1d8'],
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                targetName,
                'bastionOfLawWardSource',
                playerName,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardTarget',
                targetName,
                campaignName
            );
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
                targetName,
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
                targetName,
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
        it('returns popup when not target of last attack', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: 'OtherCreature' },
            });

            const result = await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('did not target you');
        });

        it('returns popup when no ward active', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: playerName },
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawActive') return false;
                return [];
            });

            const result = await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No ward active');
        });

        it('returns modal when no dice count specified', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: playerName },
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawActive') return true;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
                return null;
            });

            const result = await handleSpendDice(makeAction(), makePlayerStats(), campaignName, undefined);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bastionOfLawSpend');
            expect(result.payload.featureName).toBe('Bastion of Law');
        });

        it('rolls dice and returns reduction with remaining count', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: playerName, actualDamage: 50 },
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawActive') return true;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
                if (key === 'bastionOfLawLastAttackDamage') return 50;
                if (key === 'bastionOfLawWardUsed') return 0;
                return null;
            });
            rollExpression.mockReturnValue({ total: 12 });

            const result = await handleSpendDice(makeAction({ numDice: 2 }), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.damageReduction).toBe(12);
            expect(result.remainingDice).toBe(1);
        });

        it('updates remaining dice after spending', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: playerName },
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawActive') return true;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
                if (key === 'bastionOfLawLastAttackDamage') return 50;
                if (key === 'bastionOfLawWardUsed') return 0;
                return null;
            });
            rollExpression.mockReturnValue({ total: 10 });

            await handleSpendDice(makeAction({ numDice: 2 }), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8'],
                campaignName
            );
        });

        it('deactivates ward when no dice remain after spending', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: playerName },
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawActive') return true;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                if (key === 'bastionOfLawLastAttackDamage') return 50;
                if (key === 'bastionOfLawWardUsed') return 0;
                return null;
            });
            rollExpression.mockReturnValue({ total: 9 });

            await handleSpendDice(makeAction({ numDice: 2 }), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawActive', false, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawWardSource', null, campaignName);
        });

        it('handles pre-rolled result', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: playerName },
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawActive') return true;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
                if (key === 'bastionOfLawLastAttackDamage') return 50;
                if (key === 'bastionOfLawWardUsed') return 0;
                return null;
            });

            const preRoll = { total: 99 };
            const action = { ...makeAction({ numDice: 2 }), preRollResult: preRoll };

            const result = await handleSpendDice(action, makePlayerStats(), campaignName);

            expect(result.damageReduction).toBe(99);
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('handles numDice edge cases: defaults to 1 and clamps to available', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: playerName },
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawActive') return true;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                if (key === 'bastionOfLawLastAttackDamage') return 50;
                if (key === 'bastionOfLawWardUsed') return 0;
                return null;
            });
            rollExpression.mockReturnValue({ total: 5 });

            // When numDice is undefined, returns modal for user to choose
            const result1 = await handleSpendDice(makeAction(), makePlayerStats(), campaignName, undefined);
            expect(result1.type).toBe('modal');
            expect(result1.modalName).toBe('bastionOfLawSpend');

            // When numDice is provided, processes spend
            const result2 = await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);
            expect(result2.damageReduction).toBe(5);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8'],
                campaignName
            );

            vi.clearAllMocks();

            // clamps when numDice exceeds available dice
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: playerName },
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawActive') return true;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                if (key === 'bastionOfLawLastAttackDamage') return 50;
                if (key === 'bastionOfLawWardUsed') return 0;
                return null;
            });
            rollExpression.mockReturnValue({ total: 10 });

            await handleSpendDice(makeAction({ numDice: 5 }), makePlayerStats(), campaignName);

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
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: playerName },
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawActive') return true;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                if (key === 'bastionOfLawLastAttackDamage') return 50;
                if (key === 'bastionOfLawWardUsed') return 0;
                return null;
            });
            rollExpression.mockReturnValue({ total: 8 });

            const result = await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Rolled 1d8 for total 8');
            expect(result.payload.description).toContain('1 dice remaining');
        });

        it('logs ability use on spend', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { targetName: playerName },
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'bastionOfLawActive') return true;
                if (key === 'bastionOfLawWardDice') return ['1d8', '1d8'];
                if (key === 'bastionOfLawLastAttackDamage') return 50;
                if (key === 'bastionOfLawWardUsed') return 0;
                return null;
            });
            rollExpression.mockReturnValue({ total: 6 });

            await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Bastion of Law',
                description: expect.stringContaining('spent 1d8'),
            }));
        });
    });

    describe('handleClearWard', () => {
        it('clears ward tracking from sorcerer', async () => {
            await handleClearWard(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawWardTarget', null, campaignName);
        });

        it('returns popup with cleared message', async () => {
            const result = await handleClearWard(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Bastion of Law');
            expect(result.payload.description).toContain('ward tracking cleared');
        });

        it('uses feature name from action or defaults to Bastion of Law', async () => {
            const result = await handleClearWard(makeAction(), makePlayerStats(), campaignName);
            expect(result.payload.name).toBe('Bastion of Law');

            const customAction = makeAction({ name: 'Custom Bastion' });
            const customResult = await handleClearWard(customAction, makePlayerStats(), campaignName);
            expect(customResult.payload.name).toBe('Custom Bastion');
            expect(customResult.payload.description).toContain('ward tracking cleared');
        });
    });
});
