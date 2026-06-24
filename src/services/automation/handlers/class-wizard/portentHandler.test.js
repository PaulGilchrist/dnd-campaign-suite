// @improved-by-ai
import { handle, applyPortentChoice, getPortentDice, setPortentDice, refreshPortentDice } from './portentHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollD20, rollExpression } from '../../../../services/dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    default: {
        set: vi.fn().mockReturnValue(Promise.resolve()),
    },
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
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'portentDice') return null;
        if (key === 'portentUsedThisTurn') return false;
        return null;
    });
    setRuntimeValue.mockReturnValue(undefined);
    rollD20.mockReturnValue(10);
    rollExpression.mockReturnValue(null);
    addEntry.mockReturnValue(Promise.resolve());
    getCombatContext.mockResolvedValue(null);
    applyDamageToTarget.mockReturnValue(null);
}

function mockCombatContext(creatureName, rollType, eventData, extraContext) {
    let rollTypeStr = 'attack';
    if (rollType === 'ability') rollTypeStr = 'check';
    if (rollType === 'save') rollTypeStr = 'save';

    const lastAttack = {
        attackerName: creatureName,
        targetName: eventData.targetName || null,
        d20: eventData.d20,
        bonus: eventData.bonus || 0,
        rollType: rollTypeStr,
        timestamp: eventData.timestamp || makeTimestamp(),
    };

    if (rollType === 'attack') {
        Object.assign(lastAttack, {
            targetAc: eventData.targetAc,
            hit: eventData.hit,
            damageFormula: extraContext?.damageFormula || null,
            damageType: extraContext?.damageType || null,
            primaryDamage: extraContext?.primaryDamage || 0,
            rawDamage: extraContext?.rawDamage || 0,
        });
    } else if (rollType === 'ability') {
        Object.assign(lastAttack, {
            checkName: eventData.checkName,
        });
    } else if (rollType === 'save') {
        Object.assign(lastAttack, {
            saveType: eventData.saveType,
            saveDc: extraContext?.saveDc || null,
            saveResult: extraContext?.oldSuccess ? 'success' : 'failure',
        });
    }

    getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'portentDice') return '[15, 8]';
        if (key === 'portentUsedThisTurn') return false;
        if (key === 'currentHitPoints') return 10;
        if (key === 'maxHitPoints') return 20;
        return null;
    });

    getCombatContext.mockResolvedValue({
        lastAttack,
        creatures: [{ name: creatureName }],
    });
}

describe('Portent Handler', () => {
    beforeEach(setupMocks);

    describe('getPortentDice', () => {
        it('returns empty array when no stored value', () => {
            getRuntimeValue.mockReturnValue(null);
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

        it('returns empty array for non-array value', () => {
            getRuntimeValue.mockReturnValue('42');
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

        it('handles single die', () => {
            setPortentDice('TestWizard', [7], mockCampaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'portentDice',
                '[7]',
                mockCampaignName
            );
        });

        it('handles empty array', () => {
            setPortentDice('TestWizard', [], mockCampaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'portentDice',
                '[]',
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

        it('rolls 3 dice at level 14+', async () => {
            const highLevelStats = { ...mockPlayerStats, level: 14 };
            rollD20.mockReturnValueOnce(1).mockReturnValueOnce(20).mockReturnValueOnce(13);
            const dice = await refreshPortentDice('TestWizard', mockCampaignName, highLevelStats);
            expect(dice).toEqual([1, 20, 13]);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'portentDice',
                '[1,20,13]',
                mockCampaignName
            );
        });

        it('rolls 2 dice at level 13', async () => {
            const midLevelStats = { ...mockPlayerStats, level: 13 };
            rollD20.mockReturnValueOnce(15).mockReturnValueOnce(3);
            const dice = await refreshPortentDice('TestWizard', mockCampaignName, midLevelStats);
            expect(dice).toEqual([15, 3]);
        });
    });

    describe('handle - guard clauses', () => {
        it('returns popup when no portent dice', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return null;
                if (key === 'portentUsedThisTurn') return false;
                return null;
            });
            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No foretelling rolls remaining');
        });

        it('returns popup when already used this turn', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return true;
                return null;
            });
            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('once per turn');
        });

        it('returns popup when no combat context', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return false;
                return null;
            });
            getCombatContext.mockResolvedValue(null);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
        });

        it('returns popup when combat context has no lastAttack', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return false;
                return null;
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
        });
    });

    describe('handle - finds most recent event', () => {
        it('returns modal with most recent attack event', async () => {
            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: false,
                timestamp: makeTimestamp(),
            };
            const contextData = {
                type: 'attack', attackName: 'Longsword', damageFormula: '1d8+3',
                damageType: 'Slashing', targetName: 'Goblin',
                oldTotal: 8, oldHit: false, timestamp: makeTimestamp(),
            };

            mockCombatContext('TestWizard', 'attack', eventData, contextData);

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

        it('picks the most recent event for any creature in combat', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return false;
                return null;
            });

            getCombatContext.mockResolvedValue({
                lastAttack: {
                    rollType: 'check',
                    attackerName: 'RogueGal',
                    d20: 4,
                    bonus: 5,
                    checkName: 'Stealth',
                    timestamp: makeTimestamp(),
                },
                creatures: [{ name: 'Goblin' }, { name: 'RogueGal' }, { name: 'TestWizard' }],
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('RogueGal');
            expect(result.payload.eventType).toBe('ability');
            expect(result.payload.diceOptions).toEqual([15, 8]);
        });

        it('finds save event when it is most recent', async () => {
            const eventData = {
                d20: 10, bonus: 2, saveType: 'wisdom',
                timestamp: makeTimestamp(),
            };
            const contextData = {
                type: 'save', saveType: 'WIS', saveDc: 14,
                actionName: 'Hold Person', targetName: 'TestWizard',
                oldTotal: 12, oldSuccess: false, timestamp: makeTimestamp(),
            };

            mockCombatContext('TestWizard', 'save', eventData, contextData);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('TestWizard');
            expect(result.payload.eventType).toBe('save');
            expect(result.payload.context.saveDc).toBe(14);
            expect(result.payload.context.oldSuccess).toBe(false);
        });

        it('sorts dice options in descending order', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[8, 15, 3]';
                if (key === 'portentUsedThisTurn') return false;
                return null;
            });

            getCombatContext.mockResolvedValue({
                lastAttack: {
                    rollType: 'attack',
                    attackerName: 'TestWizard',
                    d20: 1,
                    bonus: 0,
                    targetAc: 15,
                    hit: false,
                    timestamp: makeTimestamp(),
                },
                creatures: [{ name: 'TestWizard' }],
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.payload.diceOptions).toEqual([15, 8, 3]);
        });
    });

    describe('applyPortentChoice - attack roll', () => {
        it('removes chosen die and applies it to attack', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: false,
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'attack', attackName: 'Longsword', damageFormula: '1d8+3',
                damageType: 'Slashing', targetName: 'Goblin',
                oldTotal: 8, oldHit: false,
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, context, 15
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8]', mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Portent d20(15)');
            expect(result.payload.description).toContain('The attack now hits!');
        });

        it('triggers damage when miss becomes a hit', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });
            rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ applied: true });

            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: false,
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'attack', attackName: 'Longsword', damageFormula: '1d8+3',
                damageType: 'Slashing', targetName: 'Goblin',
                oldTotal: 8, oldHit: false,
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, context, 15
            );

            expect(rollExpression).toHaveBeenCalledWith('1d8+3');
            expect(applyDamageToTarget).toHaveBeenCalled();
        });

        it('skips damage trigger when no damage formula available', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: false,
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'attack', attackName: 'Longsword', damageFormula: null,
                damageType: 'Slashing',
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, context, 15
            );

            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('does not trigger damage when hit stays a hit', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 16, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: true,
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'attack', attackName: 'Longsword', damageFormula: '1d8+3',
                damageType: 'Slashing', targetName: 'Goblin',
                oldTotal: 22, oldHit: true,
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, context, 15
            );

            expect(rollExpression).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('reports when hit becomes a miss', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'currentHitPoints') return 10;
                if (key === 'maxHitPoints') return 20;
                return null;
            });

            const eventData = {
                d20: 16, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: true,
                timestamp: makeTimestamp(),
                attackerName: 'TestWizard',
                primaryDamage: 5,
                rawDamage: 5,
            };
            const context = {
                type: 'attack', attackName: 'Longsword', damageFormula: '1d8+3',
                damageType: 'Slashing', targetName: 'Goblin',
                oldTotal: 22, oldHit: true,
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, context, 8
            );

            expect(result.payload.description).toContain('The attack now misses!');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'currentHitPoints',
                15,
                mockCampaignName
            );
        });

        it('does not rollback damage when attacker does not match target', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'currentHitPoints') return 10;
                if (key === 'maxHitPoints') return 20;
                return null;
            });

            const eventData = {
                d20: 16, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: true,
                timestamp: makeTimestamp(),
                attackerName: 'OtherCreature',
                primaryDamage: 5,
                rawDamage: 5,
            };
            const context = {
                type: 'attack', attackName: 'Longsword', damageFormula: '1d8+3',
                damageType: 'Slashing', targetName: 'Goblin',
                oldTotal: 22, oldHit: true,
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, context, 8
            );

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'currentHitPoints',
                expect.any(Number),
                mockCampaignName
            );
        });

        it('handles attack with no targetAc (keeps original hit state)', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', hit: false,
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'attack', attackName: 'Longsword', damageFormula: null,
                damageType: null, targetName: 'Goblin',
                oldTotal: 8, oldHit: false,
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, context, 15
            );

            expect(result.payload.description).not.toContain('now hits');
            expect(result.payload.description).not.toContain('now misses');
        });
    });

    describe('applyPortentChoice - save roll', () => {
        it('updates save roll and reports outcome change from failure to success', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 3, bonus: 4, saveType: 'wisdom',
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'save', saveType: 'WIS', saveDc: 14,
                actionName: 'Hold Person', targetName: 'TestWizard',
                oldTotal: 7, oldSuccess: false,
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'save', eventData, context, 15
            );

            expect(result.payload.description).toContain('The save now succeeds!');
        });

        it('reports when successful save becomes a failure', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 18, bonus: 4, saveType: 'wisdom',
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'save', saveType: 'WIS', saveDc: 14,
                actionName: 'Hold Person', targetName: 'TestWizard',
                oldTotal: 22, oldSuccess: true,
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'save', eventData, context, 8
            );

            expect(result.payload.description).toContain('The save now fails!');
        });

        it('shows no outcome note when save DC is missing', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 3, bonus: 4, saveType: 'wisdom',
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'save', saveType: 'WIS', saveDc: null,
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'save', eventData, context, 15
            );

            expect(result.payload.description).not.toContain('The save now');
        });

        it('shows no outcome note when oldSuccess is missing', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 3, bonus: 4, saveType: 'wisdom',
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'save', saveType: 'WIS', saveDc: 14,
                oldSuccess: null,
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'save', eventData, context, 15
            );

            expect(result.payload.description).not.toContain('The save now');
        });

        it('reports save that stays successful', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 18, bonus: 4, saveType: 'wisdom',
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'save', saveType: 'WIS', saveDc: 14,
                actionName: 'Hold Person', targetName: 'TestWizard',
                oldTotal: 22, oldSuccess: true,
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'save', eventData, context, 15
            );

            expect(result.payload.description).not.toContain('now succeeds');
            expect(result.payload.description).not.toContain('now fails');
        });
    });

    describe('applyPortentChoice - ability check', () => {
        it('updates ability check roll', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 4, bonus: 5, checkName: 'Stealth check',
                timestamp: makeTimestamp(),
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'ability', eventData, null, 15
            );

            expect(result.payload.description).toContain('Stealth check');
            expect(result.payload.description).toContain('Portent d20(15)');
        });

        it('uses default label when checkName is missing', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 4, bonus: 5,
                timestamp: makeTimestamp(),
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'ability', eventData, null, 15
            );

            expect(result.payload.description).toContain('Ability check');
        });
    });

    describe('applyPortentChoice - shared behavior', () => {
        it('removes exact chosen die from pool', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[8, 15, 8]';
                return null;
            });

            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: false,
                timestamp: makeTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, null, 15
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8,8]', mockCampaignName);
        });

        it('removes first matching die when duplicates exist', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 15, 8]';
                return null;
            });

            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: false,
                timestamp: makeTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, null, 15
            );

            // Should remove one 15, leaving [15, 8]
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[15,8]', mockCampaignName);
        });

        it('falls back to sorted slice when chosen die not in pool', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[10, 5]';
                return null;
            });

            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: false,
                timestamp: makeTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, null, 99
            );

            // 99 not in pool, so falls back to sorted descending [10,5].slice(1) = [5]
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[5]', mockCampaignName);
        });

        it('sets portentUsedThisTurn flag', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 4, bonus: 5, checkName: 'Stealth check',
                timestamp: makeTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'ability', eventData, null, 15
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentUsedThisTurn', true, mockCampaignName);
        });

        it('logs the usage', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 4, bonus: 5, checkName: 'Stealth check',
                timestamp: makeTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'ability', eventData, null, 15
            );

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
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });
            rollExpression.mockReturnValue({ total: 7, rolls: [4, 3], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ applied: true });

            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: false,
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'attack', attackName: 'Longsword', damageFormula: '1d8+3',
                damageType: 'Slashing', targetName: 'Goblin',
                oldTotal: 8, oldHit: false,
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, context, 15
            );

            const logEntry = addEntry.mock.calls[0][1];
            expect(logEntry.description).toContain('Damage rolled: 7');
        });

        it('returns popup with full description including outcome', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: false,
                timestamp: makeTimestamp(),
            };
            const context = {
                type: 'attack', attackName: 'Longsword', damageFormula: '1d8+3',
                damageType: 'Slashing', targetName: 'Goblin',
                oldTotal: 8, oldHit: false,
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, context, 15
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Target: TestWizard');
            expect(result.payload.description).toContain('Original d20(2)');
            expect(result.payload.description).toContain('Portent d20(15)');
            expect(result.payload.description).toContain('<strong>21</strong>');
        });
    });
});
