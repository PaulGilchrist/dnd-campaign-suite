// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { handle, applyPortentChoice, getPortentDice, setPortentDice, refreshPortentDice } from './portentHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollD20, rollExpression } from '../../../../services/dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { findMostRecentRollAcrossCreatures } from '../../common/damageRollback.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findMostRecentRollAcrossCreatures: vi.fn(),
}));

vi.mock('../../common/infoPopup.js', () => ({
    infoPopup: vi.fn().mockImplementation((name, description, automation) => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description,
            automation,
        },
    })),
}));

const mockPlayerStats = {
    name: 'TestWizard',
    level: 3,
    class: { class_levels: [{ level: 3 }] },
};

const mockAction = {
    name: 'Portent',
    automation: { type: 'portent', effect: 'portent', casting_time: 'passive' },
};

const mockCampaignName = 'test-campaign';

function makeTimestamp() {
    return Date.now() - 1000;
}

function setupMocks() {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => undefined);
    setRuntimeValue.mockReturnValue(undefined);
    rollD20.mockReturnValue(10);
    rollExpression.mockReturnValue(null);
    addEntry.mockResolvedValue(undefined);
    getCombatContext.mockResolvedValue(null);
    applyDamageToTarget.mockReturnValue(null);
    findMostRecentRollAcrossCreatures.mockResolvedValue(null);
}

function mockLastAttack(lastAttack) {
    findMostRecentRollAcrossCreatures.mockResolvedValue(lastAttack ? {
        creatureName: lastAttack.attackerName || lastAttack.targetName || 'Unknown',
        eventType: lastAttack.rollType === 'check' || lastAttack.rollType === 'skill' ? 'ability' : lastAttack.rollType === 'save' ? 'save' : 'attack',
        eventData: lastAttack,
        isStale: false,
    } : null);
}

function mockPortentDice(dice) {
    getRuntimeValue.mockImplementation((_name, key, _campaign) => {
        if (key === 'portentDice') return dice;
        if (key === 'portentUsedThisTurn') return false;
        return undefined;
    });
}

describe('Portent Handler', () => {
    beforeEach(setupMocks);

    describe('getPortentDice', () => {
        it.each([null, undefined, 0, false])('returns empty array for falsy value: %p', (value) => {
            getRuntimeValue.mockReturnValue(value);
            const dice = getPortentDice('TestWizard', mockCampaignName);
            expect(dice).toEqual([]);
        });

        it.each([true, { value: 10 }, '42'])('returns empty array for truthy non-array value: %p', (value) => {
            getRuntimeValue.mockReturnValue(value);
            const dice = getPortentDice('TestWizard', mockCampaignName);
            expect(dice).toEqual([]);
        });

        it('returns parsed array from JSON string', () => {
            getRuntimeValue.mockReturnValue('[15, 8]');
            const dice = getPortentDice('TestWizard', mockCampaignName);
            expect(dice).toEqual([15, 8]);
        });

        it('returns array directly if already parsed', () => {
            getRuntimeValue.mockReturnValue([12, 5, 18]);
            const dice = getPortentDice('TestWizard', mockCampaignName);
            expect(dice).toEqual([12, 5, 18]);
        });

        it('returns empty array for invalid JSON string', () => {
            getRuntimeValue.mockReturnValue('not valid json');
            const dice = getPortentDice('TestWizard', mockCampaignName);
            expect(dice).toEqual([]);
        });

        it('returns empty array for empty JSON array string', () => {
            getRuntimeValue.mockReturnValue('[]');
            const dice = getPortentDice('TestWizard', mockCampaignName);
            expect(dice).toEqual([]);
        });
    });

    describe('setPortentDice', () => {
        it('stores dice as JSON string via setRuntimeValue', () => {
            setPortentDice('TestWizard', [10, 15], mockCampaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'portentDice',
                '[10,15]',
                mockCampaignName
            );
        });
    });

    describe('refreshPortentDice', () => {
        it('rolls 2 dice at level 3', async () => {
            rollD20.mockReturnValueOnce(12).mockReturnValueOnce(7);
            const dice = await refreshPortentDice('TestWizard', mockCampaignName, mockPlayerStats);
            expect(dice).toEqual([12, 7]);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'portentDice',
                '[12,7]',
                mockCampaignName
            );
        });

        it('rolls 2 dice at level 13 (boundary)', async () => {
            const boundaryStats = { ...mockPlayerStats, level: 13 };
            rollD20.mockReturnValueOnce(5).mockReturnValueOnce(11);
            const dice = await refreshPortentDice('TestWizard', mockCampaignName, boundaryStats);
            expect(dice).toEqual([5, 11]);
            expect(rollD20).toHaveBeenCalledTimes(2);
        });

        it('rolls 3 dice at level 14', async () => {
            const highLevelStats = { ...mockPlayerStats, level: 14 };
            rollD20.mockReturnValueOnce(1).mockReturnValueOnce(20).mockReturnValueOnce(13);
            const dice = await refreshPortentDice('TestWizard', mockCampaignName, highLevelStats);
            expect(dice).toEqual([1, 20, 13]);
            expect(rollD20).toHaveBeenCalledTimes(3);
        });
    });

    describe('handle - guard clauses', () => {
        it('returns popup when no portent dice', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No foretelling rolls remaining');
        });

        it('returns popup when already used this turn', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return true;
                return undefined;
            });
            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('once per turn');
        });

        it('returns popup when no recent roll event', async () => {
            mockPortentDice('[15, 8]');
            findMostRecentRollAcrossCreatures.mockResolvedValue(null);
            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
        });
    });

    describe('handle - modal with event data', () => {
        it('returns modal with most recent attack event', async () => {
            mockPortentDice('[15, 8]');
            const lastAttack = {
                rollType: 'attack',
                attackerName: 'TestWizard',
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                targetAc: 17,
                hit: false,
                damageFormula: '1d8+3',
                damageType: 'Slashing',
                primaryDamage: 0,
                rawDamage: 0,
                timestamp: makeTimestamp(),
            };
            mockLastAttack(lastAttack);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('portentDiceChoice');
            expect(result.payload.targetName).toBe('TestWizard');
            expect(result.payload.eventType).toBe('attack');
            expect(result.payload.context.damageFormula).toBe('1d8+3');
            expect(result.payload.context.damageType).toBe('Slashing');
            expect(result.payload.context.oldHit).toBe(false);
            expect(result.payload.diceOptions).toEqual([15, 8]);
        });

        it('returns modal with most recent ability check event', async () => {
            mockPortentDice('[15, 8]');
            const lastAttack = {
                rollType: 'check',
                attackerName: 'RogueGal',
                d20: 4,
                bonus: 5,
                checkName: 'Stealth',
                timestamp: makeTimestamp(),
            };
            mockLastAttack(lastAttack);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('RogueGal');
            expect(result.payload.eventType).toBe('ability');
            expect(result.payload.diceOptions).toEqual([15, 8]);
        });

        it('returns modal with most recent save event', async () => {
            mockPortentDice('[15, 8]');
            const lastAttack = {
                rollType: 'save',
                attackerName: 'Wizard',
                d20: 10,
                bonus: 2,
                saveType: 'wisdom',
                saveResult: 'failure',
                saveDc: 14,
                timestamp: makeTimestamp(),
            };
            mockLastAttack(lastAttack);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('Wizard');
            expect(result.payload.eventType).toBe('save');
            expect(result.payload.context.saveDc).toBe(14);
            expect(result.payload.context.oldSuccess).toBe(false);
        });

        it('sorts dice options in descending order', async () => {
            const lastAttack = {
                rollType: 'attack',
                attackerName: 'TestWizard',
                d20: 1,
                bonus: 0,
                targetAc: 15,
                hit: false,
                timestamp: makeTimestamp(),
            };
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'portentDice') return '[8, 15, 3]';
                if (key === 'portentUsedThisTurn') return false;
                return undefined;
            });
            mockLastAttack(lastAttack);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.payload.diceOptions).toEqual([15, 8, 3]);
        });

        it('uses attackerName as targetName when lastAttack has no targetName', async () => {
            mockPortentDice('[15, 8]');
            const lastAttack = {
                rollType: 'attack',
                attackerName: 'Ally',
                d20: 5,
                bonus: 3,
                hit: true,
                timestamp: makeTimestamp(),
            };
            mockLastAttack(lastAttack);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.payload.targetName).toBe('Ally');
        });

        it('handles lastAttack with no attackerName or targetName', async () => {
            mockPortentDice('[15, 8]');
            const lastAttack = {
                rollType: 'attack',
                d20: 5,
                bonus: 3,
                hit: true,
                timestamp: makeTimestamp(),
            };
            mockLastAttack(lastAttack);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('Unknown');
        });
    });

    describe('applyPortentChoice - attack roll', () => {
        function baseAttackEvent() {
            return {
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                targetAc: 17,
                hit: false,
                timestamp: makeTimestamp(),
            };
        }

        function baseContext() {
            return {
                type: 'attack',
                attackName: 'Longsword',
                damageFormula: '1d8+3',
                damageType: 'Slashing',
                targetName: 'Goblin',
                oldTotal: 8,
                oldHit: false,
            };
        }

        it('removes chosen die and applies it to attack', async () => {
            mockPortentDice('[15, 8]');
            const eventData = baseAttackEvent();
            const context = baseContext();

            const result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8]', mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Portent d20(15)');
            expect(result.payload.description).toContain('The attack now hits!');
        });

        it('triggers damage when miss becomes a hit', async () => {
            mockPortentDice('[15, 8]');
            rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ applied: true });

            const eventData = baseAttackEvent();
            const context = baseContext();

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            });

            expect(rollExpression).toHaveBeenCalledWith('1d8+3');
            expect(applyDamageToTarget).toHaveBeenCalled();
        });

        it('does not trigger damage when rollExpression returns null or zero', async () => {
            mockPortentDice('[15, 8]');
            rollExpression.mockReturnValue(null);

            const eventData = baseAttackEvent();
            const context = baseContext();

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            });

            expect(rollExpression).toHaveBeenCalledWith('1d8+3');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('handles applyDamageToTarget throwing without crashing', async () => {
            mockPortentDice('[15, 8]');
            rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
            applyDamageToTarget.mockImplementation(() => { throw new Error('damage failed'); });

            const eventData = baseAttackEvent();
            const context = baseContext();

            await expect(applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            })).resolves.toBeDefined();

            expect(rollExpression).toHaveBeenCalledWith('1d8+3');
        });

        it('reports when hit becomes a miss and rolls back damage', async () => {
            mockPortentDice('[15, 8]');
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'currentHitPoints') return 10;
                if (key === 'maxHitPoints') return 20;
                return undefined;
            });

            const eventData = {
                ...baseAttackEvent(),
                d20: 16,
                hit: true,
                attackerName: 'TestWizard',
                primaryDamage: 5,
                rawDamage: 5,
            };
            const context = {
                ...baseContext(),
                oldTotal: 22,
                oldHit: true,
            };

            const result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 8,
            });

            expect(result.payload.description).toContain('The attack now misses!');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'currentHitPoints',
                15,
                mockCampaignName
            );
        });

        it('does not rollback damage when maxHitPoints is null', async () => {
            mockPortentDice('[15, 8]');
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'currentHitPoints') return 10;
                if (key === 'maxHitPoints') return null;
                return undefined;
            });

            const eventData = {
                ...baseAttackEvent(),
                d20: 16,
                hit: true,
                attackerName: 'TestWizard',
                primaryDamage: 5,
                rawDamage: 5,
            };
            const context = {
                ...baseContext(),
                oldTotal: 22,
                oldHit: true,
            };

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 8,
            });

            // Should still heal (capped at 99999)
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'currentHitPoints',
                15,
                mockCampaignName
            );
        });

        it('handles attack with no targetAc (keeps original hit state)', async () => {
            mockPortentDice('[15, 8]');

            const eventData = {
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                hit: false,
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'attack',
                attackName: 'Longsword',
                damageFormula: null,
                damageType: null,
                targetName: 'Goblin',
                oldTotal: 8,
                oldHit: false,
            };

            const result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            });

            expect(result.payload.description).not.toContain('now hits');
            expect(result.payload.description).not.toContain('now misses');
        });

        it('updates lastAttack with portent fields', async () => {
            mockPortentDice('[15, 8]');
            const existingLastAttack = {
                rollType: 'attack',
                attackerName: 'TestWizard',
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                targetAc: 17,
                hit: false,
                timestamp: makeTimestamp(),
            };
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'lastAttack') return existingLastAttack;
                return undefined;
            });

            const eventData = {
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                targetAc: 17,
                hit: false,
                timestamp: makeTimestamp(),
            };
            const context = baseContext();

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'lastAttack',
                expect.objectContaining({
                    d20: 15,
                    hit: true,
                    portentUsed: true,
                    portentOriginalD20: 2,
                }),
                mockCampaignName
            );
        });

        it('does not update lastAttack when existing is null', async () => {
            mockPortentDice('[15, 8]');
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'lastAttack') return null;
                return undefined;
            });

            const eventData = baseAttackEvent();
            const context = baseContext();

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            });

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'campaign',
                'lastAttack',
                expect.any(Object),
                mockCampaignName
            );
        });
    });

    describe('applyPortentChoice - save roll', () => {
        function baseSaveEvent() {
            return {
                d20: 3,
                bonus: 4,
                saveType: 'wisdom',
                timestamp: makeTimestamp(),
            };
        }

        function baseSaveContext() {
            return {
                type: 'save',
                saveType: 'WIS',
                saveDc: 14,
                actionName: 'Hold Person',
                targetName: 'TestWizard',
                oldTotal: 7,
                oldSuccess: false,
            };
        }

        it('reports save outcome change from failure to success', async () => {
            mockPortentDice('[15, 8]');

            const result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'save',
                eventData: baseSaveEvent(),
                context: baseSaveContext(),
                chosenDie: 15,
            });

            expect(result.payload.description).toContain('The save now succeeds!');
        });

        it('reports save outcome change from success to failure', async () => {
            mockPortentDice('[15, 8]');

            const context = {
                ...baseSaveContext(),
                oldSuccess: true,
            };

            const result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'save',
                eventData: { ...baseSaveEvent(), d20: 18 },
                context,
                chosenDie: 8,
            });

            expect(result.payload.description).toContain('The save now fails!');
        });

        it('reports no outcome change when both were same outcome', async () => {
            mockPortentDice('[15, 8]');

            let result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'save',
                eventData: { ...baseSaveEvent(), d20: 5 },
                context: baseSaveContext(),
                chosenDie: 8,
            });

            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');

            const context = {
                ...baseSaveContext(),
                oldSuccess: true,
            };

            result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'save',
                eventData: { ...baseSaveEvent(), d20: 18 },
                context,
                chosenDie: 15,
            });

            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');
        });

        it('handles save with null saveDc, null context, or null oldSuccess', async () => {
            mockPortentDice('[15, 8]');

            let result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'save',
                eventData: baseSaveEvent(),
                context: { ...baseSaveContext(), saveDc: null },
                chosenDie: 15,
            });
            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');

            result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'save',
                eventData: baseSaveEvent(),
                context: null,
                chosenDie: 15,
            });
            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');

            result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'save',
                eventData: baseSaveEvent(),
                context: { ...baseSaveContext(), oldSuccess: null },
                chosenDie: 15,
            });
            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');
        });
    });

    describe('applyPortentChoice - ability check', () => {
        it('handles ability check with or without checkName and null context', async () => {
            mockPortentDice('[15, 8]');

            let result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'ability',
                eventData: {
                      d20: 4,
                      bonus: 5,
                      checkName: 'Stealth check',
                      timestamp: makeTimestamp(),
                  },
                context: null,
                chosenDie: 15,
            });
            expect(result.payload.description).toContain('Stealth check');
            expect(result.payload.description).toContain('Portent d20(15)');

            result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'ability',
                eventData: {
                      d20: 4,
                      bonus: 5,
                      timestamp: makeTimestamp(),
                  },
                context: null,
                chosenDie: 15,
            });
            expect(result.payload.description).toContain('Ability check');

            result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'ability',
                eventData: {
                      d20: 4,
                      bonus: 5,
                      checkName: 'Athletics',
                      timestamp: makeTimestamp(),
                  },
                context: null,
                chosenDie: 15,
            });
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Portent d20(15)');
        });
    });

    describe('applyPortentChoice - shared behavior', () => {
        function baseAttackEvent() {
            return {
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                targetAc: 17,
                hit: false,
                timestamp: makeTimestamp(),
            };
        }

        it('removes exact chosen die from pool', async () => {
            mockPortentDice('[8, 15, 8]');

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData: baseAttackEvent(),
                context: null,
                chosenDie: 15,
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8,8]', mockCampaignName);
        });

        it('removes first matching die when duplicates exist', async () => {
            mockPortentDice('[15, 15, 8]');

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData: baseAttackEvent(),
                context: null,
                chosenDie: 15,
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[15,8]', mockCampaignName);
        });

        it('falls back to sorted slice when chosen die not in pool', async () => {
            mockPortentDice('[10, 5]');

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData: baseAttackEvent(),
                context: null,
                chosenDie: 99,
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[5]', mockCampaignName);
        });

        it('leaves empty array when chosen die is the only die', async () => {
            mockPortentDice('[7]');

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData: baseAttackEvent(),
                context: null,
                chosenDie: 7,
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[]', mockCampaignName);
        });

        it('marks portentUsedThisTurn as true', async () => {
            mockPortentDice('[15, 8]');

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData: baseAttackEvent(),
                context: null,
                chosenDie: 15,
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'portentUsedThisTurn',
                true,
                mockCampaignName
            );
        });

        it('logs the usage entry', async () => {
            mockPortentDice('[15, 8]');

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'ability',
                eventData: {
                      d20: 4,
                      bonus: 5,
                      checkName: 'Stealth check',
                      timestamp: makeTimestamp(),
                  },
                context: null,
                chosenDie: 15,
            });

            expect(addEntry).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWizard',
                    portentDie: 15,
                    targetName: 'TestWizard',
                    diceRemaining: 1,
                    timestamp: expect.any(Number),
                })
            );
        });

        it('includes damage rolled in log when damage was applied', async () => {
            mockPortentDice('[15, 8]');
            rollExpression.mockReturnValue({ total: 7, rolls: [4, 3], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ applied: true });

            const eventData = baseAttackEvent();
            const context = {
                type: 'attack',
                attackName: 'Longsword',
                damageFormula: '1d8+3',
                damageType: 'Slashing',
                targetName: 'Goblin',
                oldTotal: 8,
                oldHit: false,
            };

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            });

            const logEntry = addEntry.mock.calls[0][1];
            expect(logEntry.description).toContain('Damage rolled: 7');
        });

        it('returns popup with full description including outcome', async () => {
            mockPortentDice('[15, 8]');

            const eventData = baseAttackEvent();
            const context = {
                type: 'attack',
                attackName: 'Longsword',
                damageFormula: '1d8+3',
                damageType: 'Slashing',
                targetName: 'Goblin',
                oldTotal: 8,
                oldHit: false,
            };

            const result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Target: TestWizard');
            expect(result.payload.description).toContain('Original d20(2)');
            expect(result.payload.description).toContain('Portent d20(15)');
            expect(result.payload.description).toContain('<strong>21</strong>');
        });

        it('uses action.automation in infoPopup result', async () => {
            mockPortentDice('[15, 8]');

            const eventData = baseAttackEvent();
            const context = {
                type: 'attack',
                attackName: 'Longsword',
                damageFormula: '1d8+3',
                damageType: 'Slashing',
                targetName: 'Goblin',
                oldTotal: 8,
                oldHit: false,
            };

            const result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            });

            expect(result.payload.automation).toEqual(mockAction.automation);
        });
    });
});
