// @maintained-by-ai
// Portent (Divination Wizard) automation handler. Deterministic pure-behaviour suite:
// dice-pool persistence format, popup/log composition, hit/save outcome math, and the
// portentDiceChoice modal payload contract consumed by CharSpecialActions.jsx.
// NOTE (report): exports getPortentDice/setPortentDice/refreshPortentDice are orphan
// exports — no production caller imports them; long-rest refresh is duplicated by a
// local refreshPortentDice in restRules-longRest.js (which also resets
// portentUsedThisTurn, the orphan copy does not).
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

function mockLastAttack(eventData) {
    findMostRecentRollAcrossCreatures.mockResolvedValue(eventData ? {
        creatureName: eventData.attackerName || eventData.targetName || null,
        eventType: eventData.rollType === 'check' || eventData.rollType === 'skill' ? 'ability' : eventData.rollType === 'save' ? 'save' : 'attack',
        eventData,
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
        it.each([null, undefined])('returns empty array for falsy stored value: %p', (value) => {
            getRuntimeValue.mockReturnValue(value);
            expect(getPortentDice('TestWizard', mockCampaignName)).toEqual([]);
        });

        it.each([true, { value: 10 }, '42'])('returns empty array for truthy non-array value: %p', (value) => {
            getRuntimeValue.mockReturnValue(value);
            expect(getPortentDice('TestWizard', mockCampaignName)).toEqual([]);
        });

        it('returns parsed array from JSON string', () => {
            getRuntimeValue.mockReturnValue('[15, 8]');
            expect(getPortentDice('TestWizard', mockCampaignName)).toEqual([15, 8]);
        });

        it('returns array directly if already parsed', () => {
            getRuntimeValue.mockReturnValue([12, 5, 18]);
            expect(getPortentDice('TestWizard', mockCampaignName)).toEqual([12, 5, 18]);
        });

        it('returns empty array for invalid JSON string', () => {
            getRuntimeValue.mockReturnValue('not valid json');
            expect(getPortentDice('TestWizard', mockCampaignName)).toEqual([]);
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
        it('rolls 2 dice at level 13 (boundary) and stores them', async () => {
            const boundaryStats = { ...mockPlayerStats, level: 13 };
            rollD20.mockReturnValueOnce(5).mockReturnValueOnce(11);
            const dice = await refreshPortentDice('TestWizard', mockCampaignName, boundaryStats);
            expect(dice).toEqual([5, 11]);
            expect(rollD20).toHaveBeenCalledTimes(2);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'portentDice',
                '[5,11]',
                mockCampaignName
            );
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
            mockLastAttack({
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
            });

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
            mockLastAttack({
                rollType: 'check',
                attackerName: 'RogueGal',
                d20: 4,
                bonus: 5,
                checkName: 'Stealth',
                timestamp: makeTimestamp(),
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('RogueGal');
            expect(result.payload.eventType).toBe('ability');
            expect(result.payload.diceOptions).toEqual([15, 8]);
        });

        it('returns modal with most recent save event', async () => {
            mockPortentDice('[15, 8]');
            mockLastAttack({
                rollType: 'save',
                attackerName: 'Wizard',
                d20: 10,
                bonus: 2,
                saveType: 'wisdom',
                saveResult: 'failure',
                saveDc: 14,
                timestamp: makeTimestamp(),
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('Wizard');
            expect(result.payload.eventType).toBe('save');
            expect(result.payload.context.saveDc).toBe(14);
            expect(result.payload.context.oldSuccess).toBe(false);
        });

        it('sorts dice options in descending order', async () => {
            mockPortentDice('[8, 15, 3]');
            mockLastAttack({
                rollType: 'attack',
                attackerName: 'TestWizard',
                d20: 1,
                bonus: 0,
                targetAc: 15,
                hit: false,
                timestamp: makeTimestamp(),
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.payload.diceOptions).toEqual([15, 8, 3]);
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

        function missToHitArgs(eventData, context) {
            return {
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 15,
            };
        }

        function hitToMissArgs(eventData, context) {
            return {
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData,
                context,
                chosenDie: 8,
            };
        }

        it('triggers damage when miss becomes a hit', async () => {
            mockPortentDice('[15, 8]');
            rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ applied: true });

            await applyPortentChoice(missToHitArgs(baseAttackEvent(), baseContext()));

            expect(rollExpression).toHaveBeenCalledWith('1d8+3');
            expect(applyDamageToTarget).toHaveBeenCalled();
        });

        it('does not trigger damage when rollExpression returns null or zero', async () => {
            mockPortentDice('[15, 8]');
            rollExpression.mockReturnValue(null);

            await applyPortentChoice(missToHitArgs(baseAttackEvent(), baseContext()));

            expect(rollExpression).toHaveBeenCalledWith('1d8+3');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('handles applyDamageToTarget throwing without crashing', async () => {
            mockPortentDice('[15, 8]');
            rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
            applyDamageToTarget.mockImplementation(() => { throw new Error('damage failed'); });

            await expect(applyPortentChoice(missToHitArgs(baseAttackEvent(), baseContext())))
                .resolves.toBeDefined();

            expect(rollExpression).toHaveBeenCalledWith('1d8+3');
        });

        it('reports hit becomes miss and rolls back damage capped at maxHitPoints', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'currentHitPoints') return 18;
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

            const result = await applyPortentChoice(hitToMissArgs(eventData, {
                ...baseContext(),
                oldTotal: 22,
                oldHit: true,
            }));

            expect(result.payload.description).toBe(
                'Target: TestWizard<br/>Attack vs Goblin: Original d20(16) + 6 = 22 → Portent d20(8) + 6 = <strong>14</strong><br/><i>The attack now misses! Undid 5 damage.</i>'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'currentHitPoints',
                20,
                mockCampaignName
            );
        });

        it('heals uncapped when maxHitPoints is null', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'currentHitPoints') return 18;
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

            await applyPortentChoice(hitToMissArgs(eventData, {
                ...baseContext(),
                oldTotal: 22,
                oldHit: true,
            }));

            // 18 + 5 = 23 (99999 sentinel cap not binding)
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'currentHitPoints',
                23,
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

            const result = await applyPortentChoice(missToHitArgs(eventData, context));

            expect(result.payload.description).toBe(
                'Target: TestWizard<br/>Attack vs Goblin: Original d20(2) + 6 = 8 → Portent d20(15) + 6 = <strong>21</strong>'
            );
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

            await applyPortentChoice(missToHitArgs(baseAttackEvent(), baseContext()));

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

            await applyPortentChoice(missToHitArgs(baseAttackEvent(), baseContext()));

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

        function applySave(eventData, context, chosenDie) {
            return applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'save',
                eventData,
                context,
                chosenDie,
            });
        }

        it('reports save outcome change from failure to success', async () => {
            mockPortentDice('[15, 8]');

            const result = await applySave(baseSaveEvent(), baseSaveContext(), 15);

            expect(result.payload.description).toBe(
                'Target: TestWizard<br/>WISDOM: Original d20(3) + 4 = 7 → Portent d20(15) + 4 = <strong>19</strong><br/><i>The save now succeeds!</i>'
            );
        });

        it('reports save outcome change from success to failure', async () => {
            mockPortentDice('[15, 8]');

            const result = await applySave(
                { ...baseSaveEvent(), d20: 18 },
                { ...baseSaveContext(), oldSuccess: true },
                8
            );

            expect(result.payload.description).toContain('The save now fails!');
        });

        it('reports no outcome note when outcome is unchanged', async () => {
            mockPortentDice('[15, 8]');

            // still fails: 8 + 4 = 12 < 14
            let result = await applySave({ ...baseSaveEvent(), d20: 5 }, baseSaveContext(), 8);
            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');

            // still succeeds: 15 + 4 = 19 >= 14
            result = await applySave(
                { ...baseSaveEvent(), d20: 18 },
                { ...baseSaveContext(), oldSuccess: true },
                15
            );
            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');
        });

        it('reports no outcome note when saveDc, context, or oldSuccess is null', async () => {
            mockPortentDice('[15, 8]');

            let result = await applySave(baseSaveEvent(), { ...baseSaveContext(), saveDc: null }, 15);
            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');

            result = await applySave(baseSaveEvent(), null, 15);
            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');

            result = await applySave(baseSaveEvent(), { ...baseSaveContext(), oldSuccess: null }, 15);
            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');
        });
    });

    describe('applyPortentChoice - ability check', () => {
        function applyAbility(eventData) {
            return applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'ability',
                eventData,
                context: null,
                chosenDie: 15,
            });
        }

        it('labels check by checkName, falling back to Ability check', async () => {
            mockPortentDice('[15, 8]');

            const result = await applyAbility({
                d20: 4,
                bonus: 5,
                checkName: 'Stealth check',
                timestamp: makeTimestamp(),
            });
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Target: TestWizard<br/>Stealth check: Original d20(4) + 5 = 9 → Portent d20(15) + 5 = <strong>20</strong>'
            );

            const unlabeled = await applyAbility({
                d20: 4,
                bonus: 5,
                timestamp: makeTimestamp(),
            });
            expect(unlabeled.payload.description).toContain('Ability check');
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

        function applyToAttack(chosenDie, context = null) {
            return applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData: baseAttackEvent(),
                context,
                chosenDie,
            });
        }

        it('removes chosen die at its index from the pool', async () => {
            mockPortentDice('[8, 15, 8]');
            await applyToAttack(15);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8,8]', mockCampaignName);
        });

        it('removes first matching die when duplicates exist', async () => {
            mockPortentDice('[15, 15, 8]');
            await applyToAttack(15);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[15,8]', mockCampaignName);
        });

        it('falls back to sorted slice when chosen die not in pool', async () => {
            mockPortentDice('[10, 5]');
            await applyToAttack(99);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[5]', mockCampaignName);
        });

        it('marks portentUsedThisTurn as true', async () => {
            mockPortentDice('[15, 8]');
            await applyToAttack(15);
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
                    abilityName: 'Portent',
                    description: 'TestWizard used Portent on TestWizard: replaced d20 with 15. Dice remaining: 1.',
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

            await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData: baseAttackEvent(),
                context: {
                    type: 'attack',
                    attackName: 'Longsword',
                    damageFormula: '1d8+3',
                    damageType: 'Slashing',
                    targetName: 'Goblin',
                    oldTotal: 8,
                    oldHit: false,
                },
                chosenDie: 15,
            });

            const logEntry = addEntry.mock.calls[0][1];
            expect(logEntry.description).toBe(
                'TestWizard used Portent on TestWizard: replaced d20 with 15. Dice remaining: 1. Damage rolled: 7.'
            );
        });

        it('returns popup with full description and action automation', async () => {
            mockPortentDice('[15, 8]');

            const result = await applyPortentChoice({
                action: mockAction,
                playerStats: mockPlayerStats,
                campaignName: mockCampaignName,
                targetName: 'TestWizard',
                eventType: 'attack',
                eventData: baseAttackEvent(),
                context: {
                    type: 'attack',
                    attackName: 'Longsword',
                    damageFormula: '1d8+3',
                    damageType: 'Slashing',
                    targetName: 'Goblin',
                    oldTotal: 8,
                    oldHit: false,
                },
                chosenDie: 15,
            });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Target: TestWizard<br/>Attack vs Goblin: Original d20(2) + 6 = 8 → Portent d20(15) + 6 = <strong>21</strong><br/><i>The attack now hits!</i>'
            );
            expect(result.payload.automation).toEqual(mockAction.automation);
        });
    });
});
