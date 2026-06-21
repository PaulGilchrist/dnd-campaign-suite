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

function makeFreshTimestamp() {
    return Date.now() - 1000;
}

function staleTimestamp() {
    return Date.now() - 120000;
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
    addEntry.mockReturnValue({ catch: () => {} });
    getCombatContext.mockResolvedValue(null);
    applyDamageToTarget.mockReturnValue(null);
}

function mockCombatContextEvent(creatureName, eventType, eventData, contextData) {
    const eventKey = eventType === 'attack' ? 'lastAttackRoll'
        : eventType === 'ability' ? 'lastAbilityCheck'
        : 'lastSaveRoll';

    getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'portentDice') return '[15, 8]';
        if (key === 'portentUsedThisTurn') return false;
        if (name === creatureName && key === eventKey) return eventData;
        if (name === creatureName && key === '_lastRollContext') return contextData || null;
        return null;
    });

    getCombatContext.mockResolvedValue({
        creatures: [{ name: creatureName }],
    });
}

describe('Portent Handler', () => {
    beforeEach(setupMocks);

    describe('getPortentDice', () => {
        it('returns empty array when no stored value', () => {
            getRuntimeValue.mockReturnValue(null);
            const dice = getPortentDice('TestWizard', 'test-campaign');
            expect(dice).toEqual([]);
        });

        it('returns parsed array from JSON string', () => {
            getRuntimeValue.mockReturnValue('[15, 8]');
            const dice = getPortentDice('TestWizard', 'test-campaign');
            expect(dice).toEqual([15, 8]);
        });

        it('returns array directly if already parsed', () => {
            getRuntimeValue.mockReturnValue([12, 5, 18]);
            const dice = getPortentDice('TestWizard', 'test-campaign');
            expect(dice).toEqual([12, 5, 18]);
        });
    });

    describe('setPortentDice', () => {
        it('stores dice as JSON string', () => {
            setPortentDice('TestWizard', [10, 15], 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[10,15]', 'test-campaign');
        });
    });

    describe('refreshPortentDice', () => {
        it('rolls 2 dice at level 3', async () => {
            rollD20.mockReturnValueOnce(12).mockReturnValueOnce(7);
            const dice = await refreshPortentDice('TestWizard', 'test-campaign', mockPlayerStats);
            expect(dice).toHaveLength(2);
            expect(dice).toContain(12);
            expect(dice).toContain(7);
        });

        it('rolls 3 dice at level 14+', async () => {
            const highLevelStats = { ...mockPlayerStats, level: 14 };
            rollD20.mockReturnValueOnce(1).mockReturnValueOnce(20).mockReturnValueOnce(13);
            const dice = await refreshPortentDice('TestWizard', 'test-campaign', highLevelStats);
            expect(dice).toHaveLength(3);
            expect(dice).toContain(1);
            expect(dice).toContain(20);
            expect(dice).toContain(13);
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

        it('returns popup when combat context has no creatures', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return false;
                return null;
            });
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
        });
    });

    describe('handle - finds most recent event', () => {
        it('returns modal with most recent attack event', async () => {
            const eventData = {
                d20: 2, bonus: 6, targetName: 'Goblin', targetAc: 17, hit: false,
                timestamp: makeFreshTimestamp(),
            };
            const contextData = {
                type: 'attack', attackName: 'Longsword', damageFormula: '1d8+3',
                damageType: 'Slashing', targetName: 'Goblin',
                oldTotal: 8, oldHit: false, timestamp: makeFreshTimestamp(),
            };

            mockCombatContextEvent('TestWizard', 'attack', eventData, contextData);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('portentDiceChoice');
            expect(result.payload.targetName).toBe('TestWizard');
            expect(result.payload.eventType).toBe('attack');
            expect(result.payload.context).toEqual(contextData);
            expect(result.payload.diceOptions).toEqual([15, 8]);
        });

        it('picks the most recent event across multiple creatures', async () => {
            const staleEvent = {
                d20: 10, bonus: 2, saveType: 'dex',
                timestamp: staleTimestamp(),
            };
            const freshEvent = {
                d20: 4, bonus: 5, checkName: 'Stealth',
                timestamp: makeFreshTimestamp(),
            };

            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return false;
                if (name === 'Goblin' && key === 'lastSaveRoll') return staleEvent;
                if (name === 'RogueGal' && key === 'lastAbilityCheck') return freshEvent;
                if (name === 'RogueGal' && key === '_lastRollContext') return {
                    type: 'check', checkName: 'Stealth', oldTotal: 9, timestamp: makeFreshTimestamp(),
                };
                return null;
            });

            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }, { name: 'RogueGal' }, { name: 'TestWizard' }],
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('RogueGal');
            expect(result.payload.eventType).toBe('ability');
            expect(result.payload.eventData.checkName).toBe('Stealth');
        });

        it('finds save event when it is most recent', async () => {
            const eventData = {
                d20: 10, bonus: 2, saveType: 'wisdom',
                timestamp: makeFreshTimestamp(),
            };
            const contextData = {
                type: 'save', saveType: 'WIS', saveDc: 14,
                actionName: 'Hold Person', targetName: 'TestWizard',
                oldTotal: 12, oldSuccess: false, timestamp: makeFreshTimestamp(),
            };

            mockCombatContextEvent('TestWizard', 'save', eventData, contextData);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('TestWizard');
            expect(result.payload.eventType).toBe('save');
            expect(result.payload.eventData.saveType).toBe('wisdom');
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
                timestamp: makeFreshTimestamp(),
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

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8]', 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard', 'lastAttackRoll',
                expect.objectContaining({ d20: 15, hit: true, portentOriginalD20: 2 }),
                'test-campaign'
            );
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
                timestamp: makeFreshTimestamp(),
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
                timestamp: makeFreshTimestamp(),
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
    });

    describe('applyPortentChoice - save roll', () => {
        it('updates save roll and reports outcome change', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 3, bonus: 4, saveType: 'wisdom',
                timestamp: makeFreshTimestamp(),
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

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard', 'lastSaveRoll',
                expect.objectContaining({ d20: 15, portentOriginalD20: 3 }),
                'test-campaign'
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
                timestamp: makeFreshTimestamp(),
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
                timestamp: makeFreshTimestamp(),
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
    });

    describe('applyPortentChoice - ability check', () => {
        it('updates ability check roll', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 4, bonus: 5, checkName: 'Stealth check',
                timestamp: makeFreshTimestamp(),
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'ability', eventData, null, 15
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard', 'lastAbilityCheck',
                expect.objectContaining({ d20: 15, portentOriginalD20: 4 }),
                'test-campaign'
            );

            expect(result.payload.description).toContain('Stealth check');
            expect(result.payload.description).toContain('Portent d20(15)');
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
                timestamp: makeFreshTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, null, 15
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8,8]', 'test-campaign');
        });

        it('sets portentUsedThisTurn flag', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 4, bonus: 5, checkName: 'Stealth check',
                timestamp: makeFreshTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'ability', eventData, null, 15
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentUsedThisTurn', true, 'test-campaign');
        });

        it('logs the usage', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 4, bonus: 5, checkName: 'Stealth check',
                timestamp: makeFreshTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'ability', eventData, null, 15
            );

            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWizard',
                    portentDie: 15,
                })
            );
        });
    });
});
