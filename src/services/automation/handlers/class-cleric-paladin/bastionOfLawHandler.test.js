// @maintained-by-ai: 2026-10-15
// Unit lane for the Bastion of Law handler (sorcery-point-funded ward cast on an ally).
// Pins the runtime-key write contract (exact keys: bastionOfLawActive/WardDice/WardSource/
// WardUsed/LastAttackDamage/WardTarget), modal/popup shapes, SP clamp/deduct semantics,
// spend-dice guards, dice-pool clamping, pre-roll pass-through, heal clamping (remaining
// unwarded damage and max HP), ward-used accumulation, and full deactivation cleanup.
// Long-rest cleanup of these keys is covered by restRules-longRest.test.js; modal UI
// wiring lives in CharActionModals/CharReactions suites (handler mocked there).
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

function makeLastAttack(overrides = {}) {
    return { targetName: playerName, primaryDamage: 10, secondaryDamage: 0, actualDamage: 50, ...overrides };
}

// getRuntimeValue router for handleSpendDice scenarios: campaign.lastAttack plus the
// player's ward keys (anything unlisted resolves to null; target-side keys to null too).
function mockRuntime({ lastAttack = makeLastAttack(), ...playerValues } = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'lastAttack') return lastAttack;
        if (name === playerName) return playerValues[key] ?? null;
        return null;
    });
}

function setupDefaultMocks() {
    getAllyList.mockReturnValue([playerName, targetName]);
    getCombatContext.mockResolvedValue({
        creatures: [
            { name: playerName, type: 'player', currentHp: 45, maxHp: 45 },
            { name: targetName, type: 'npc', currentHp: 30, maxHp: 30 },
        ],
    });
    getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') {
            return { targetName: playerName, primaryDamage: 10, secondaryDamage: 0, actualDamage: 10 };
        }
        if (name === playerName && key === 'bastionOfLawActive') {
            return true;
        }
        if (name === playerName && key === 'bastionOfLawWardDice') {
            return [1, 1, 1];
        }
        if (name === playerName && key === 'bastionOfLawLastAttackDamage') {
            return 10;
        }
        if (name === playerName && key === 'bastionOfLawWardUsed') {
            return 0;
        }
        return 5;
    });
    rollExpression.mockReturnValue({ total: 5 });
}

describe('bastionOfLawHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    describe('handle', () => {
        it('returns modal with ally list when allies are available', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bastionOfLaw');
            expect(result.payload.creatureTargets).toHaveLength(2);
            expect(result.payload.creatureTargets[0].name).toBe(playerName);
            expect(result.payload.creatureTargets[1].name).toBe(targetName);
            expect(result.payload.playerName).toBe(playerName);
            expect(result.payload.maxSP).toBe(5);
            expect(result.payload.minSP).toBe(1);
            expect(result.payload.campaignName).toBe(campaignName);
            expect(result.payload.auto).toEqual(makeAction().automation);
        });

        it('filters ally names that are not present in the combat context', async () => {
            getAllyList.mockReturnValue([playerName, 'GhostAlly']);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
            expect(result.payload.creatureTargets).toHaveLength(1);
            expect(result.payload.creatureTargets[0].name).toBe(playerName);
        });

        it('returns popup when no allies available', async () => {
            getAllyList.mockReturnValue([]);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No creatures available');
        });
    });

    describe('handleApply', () => {
        it('does NOT modify state when not enough sorcery points', async () => {
            getRuntimeValue.mockReturnValue(2);

            const result = await handleApply(makeAction(), makePlayerStats(), campaignName, 4, targetName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Not enough Sorcery Points');
            expect(result.payload.description).toContain('Need 4, have 2');
            expect(setRuntimeValue).not.toHaveBeenCalled();
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
                targetName,
                'bastionOfLawWardUsed',
                0,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                targetName,
                'bastionOfLawLastAttackDamage',
                0,
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
            expect(result.payload.automation).toEqual(makeAction().automation);
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
        it('returns popup when lastAttack is null', async () => {
            mockRuntime({ lastAttack: null });

            const result = await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('did not target you');
        });

        it('returns popup when lastAttack targeted another creature', async () => {
            mockRuntime({ lastAttack: makeLastAttack({ targetName: targetName }) });

            const result = await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('did not target you');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns popup when no ward active', async () => {
            mockRuntime({ bastionOfLawActive: false, bastionOfLawWardDice: [] });

            const result = await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No ward active');
        });

        it('returns popup when ward is active but dice pool is empty', async () => {
            mockRuntime({ bastionOfLawActive: true, bastionOfLawWardDice: [] });

            const result = await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No ward active');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns modal when no dice count specified and initializes tracking', async () => {
            mockRuntime({
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8', '1d8', '1d8'],
            });

            const result = await handleSpendDice(makeAction(), makePlayerStats(), campaignName, undefined);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bastionOfLawSpend');
            expect(result.payload.featureName).toBe('Bastion of Law');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawLastAttackDamage',
                50,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardUsed',
                0,
                campaignName
            );
        });

        it('rolls dice and returns reduction with remaining count', async () => {
            mockRuntime({
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8', '1d8', '1d8'],
                bastionOfLawLastAttackDamage: 50,
                bastionOfLawWardUsed: 0,
            });
            rollExpression.mockReturnValue({ total: 12 });

            const result = await handleSpendDice(makeAction({ numDice: 2 }), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.damageReduction).toBe(12);
            expect(result.remainingDice).toBe(1);
            expect(result.actualHeal).toBe(12);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'bastionOfLawWardDice',
                ['1d8'],
                campaignName
            );
        });

        it('tracks ward usage across multiple spends', async () => {
            mockRuntime({
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8', '1d8', '1d8'],
                bastionOfLawLastAttackDamage: 50,
                bastionOfLawWardUsed: 0,
            });
            rollExpression.mockReturnValue({ total: 10 });

            await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawWardUsed', 10, campaignName);

            vi.clearAllMocks();
            mockRuntime({
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8', '1d8'],
                bastionOfLawLastAttackDamage: 50,
                bastionOfLawWardUsed: 10,
            });
            rollExpression.mockReturnValue({ total: 8 });

            await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawWardUsed', 18, campaignName);
        });

        it('clamps healing to remaining unwarded damage', async () => {
            mockRuntime({
                lastAttack: makeLastAttack({ actualDamage: 15 }),
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8', '1d8', '1d8'],
                bastionOfLawLastAttackDamage: 15,
                bastionOfLawWardUsed: 10,
            });
            rollExpression.mockReturnValue({ total: 10 });

            const result = await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(result.damageReduction).toBe(10);
            expect(result.actualHeal).toBe(5);
        });

        it('updates HP when healing is applied', async () => {
            mockRuntime({
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8'],
                bastionOfLawLastAttackDamage: 50,
                bastionOfLawWardUsed: 0,
                currentHitPoints: 30,
                hitPoints: 50,
            });
            rollExpression.mockReturnValue({ total: 10 });

            await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'currentHitPoints', 40, campaignName);
        });

        it('caps healing so HP never exceeds max HP', async () => {
            mockRuntime({
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8'],
                bastionOfLawLastAttackDamage: 50,
                bastionOfLawWardUsed: 0,
                currentHitPoints: 45,
                hitPoints: 50,
            });
            rollExpression.mockReturnValue({ total: 10 });

            const result = await handleSpendDice(makeAction({ numDice: 1 }), makePlayerStats(), campaignName);

            expect(result.damageReduction).toBe(10);
            expect(result.actualHeal).toBe(5);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'currentHitPoints', 50, campaignName);
        });

        it('deactivates ward when no dice remain after spending', async () => {
            mockRuntime({
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8', '1d8'],
                bastionOfLawLastAttackDamage: 50,
                bastionOfLawWardUsed: 0,
                bastionOfLawWardTarget: targetName,
            });
            rollExpression.mockReturnValue({ total: 9 });

            await handleSpendDice(makeAction({ numDice: 2 }), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawActive', false, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawWardSource', null, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawWardUsed', null, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawLastAttackDamage', null, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'bastionOfLawWardTarget', null, campaignName);
        });

        it('handles pre-rolled result', async () => {
            mockRuntime({
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8', '1d8', '1d8'],
                bastionOfLawLastAttackDamage: 50,
                bastionOfLawWardUsed: 0,
            });

            const preRoll = { total: 99 };
            const action = { ...makeAction({ numDice: 2 }), preRollResult: preRoll };

            const result = await handleSpendDice(action, makePlayerStats(), campaignName);

            expect(result.damageReduction).toBe(99);
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('clamps numDice to available dice count', async () => {
            mockRuntime({
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8', '1d8'],
                bastionOfLawLastAttackDamage: 50,
                bastionOfLawWardUsed: 0,
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
        });

        it('logs ability use on spend', async () => {
            mockRuntime({
                bastionOfLawActive: true,
                bastionOfLawWardDice: ['1d8', '1d8'],
                bastionOfLawLastAttackDamage: 50,
                bastionOfLawWardUsed: 0,
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
        it('clears ward tracking from sorcerer and returns popup', async () => {
            const result = await handleClearWard(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'bastionOfLawWardTarget', null, campaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Bastion of Law');
            expect(result.payload.description).toContain('ward tracking cleared');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });
    });
});
