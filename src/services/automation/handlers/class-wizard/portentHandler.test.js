import { handle, applyPortentChoice, getPortentDice, setPortentDice, refreshPortentDice } from './portentHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollD20 } from '../../../../services/dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
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
    addEntry.mockReturnValue({ catch: () => {} });
    resolveTarget.mockResolvedValue(null);
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
            expect(result.payload.type).toBe('automation_info');
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

        it('returns popup when no recent d20 test', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return false;
                if (key === 'lastAttackRoll') return null;
                if (key === 'lastAbilityCheck') return null;
                if (key === 'lastSaveRoll') return null;
                return null;
            });
            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
        });
    });

    describe('handle - returns modal with dice options', () => {
        it('returns modal with dice sorted descending for ability check', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return false;
                if (key === 'lastAttackRoll') return null;
                if (key === 'lastAbilityCheck') return {
                    d20: 4,
                    bonus: 5,
                    checkName: 'Stealth check',
                    timestamp: makeFreshTimestamp(),
                };
                if (key === 'lastSaveRoll') return null;
                return null;
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('portentDiceChoice');

            const { targetName, eventType, eventData, diceOptions } = result.payload;
            expect(targetName).toBe('TestWizard');
            expect(eventType).toBe('ability');
            expect(eventData.checkName).toBe('Stealth check');
            expect(diceOptions).toEqual([15, 8]);
            expect(result.payload.action).toBeDefined();
            expect(result.payload.playerStats).toBe(mockPlayerStats);
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('returns modal with attack event info', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[10, 3]';
                if (key === 'portentUsedThisTurn') return false;
                if (key === 'lastAttackRoll') return {
                    d20: 2,
                    bonus: 6,
                    targetName: 'Goblin',
                    targetAc: 17,
                    hit: false,
                    timestamp: makeFreshTimestamp(),
                };
                if (key === 'lastAbilityCheck') return null;
                if (key === 'lastSaveRoll') return null;
                return null;
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.eventType).toBe('attack');
            expect(result.payload.eventData.targetAc).toBe(17);
            expect(result.payload.eventData.hit).toBe(false);
            expect(result.payload.diceOptions).toEqual([10, 3]);
        });

        it('returns modal with save event info', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[12, 6]';
                if (key === 'portentUsedThisTurn') return false;
                if (key === 'lastAttackRoll') return null;
                if (key === 'lastAbilityCheck') return null;
                if (key === 'lastSaveRoll') return {
                    d20: 3,
                    bonus: 4,
                    saveType: 'wisdom',
                    timestamp: makeFreshTimestamp(),
                };
                return null;
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.eventType).toBe('save');
            expect(result.payload.eventData.saveType).toBe('wisdom');
            expect(result.payload.diceOptions).toEqual([12, 6]);
        });

        it('handles stale events', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return false;
                if (key === 'lastAttackRoll') return null;
                if (key === 'lastAbilityCheck') return {
                    d20: 4,
                    bonus: 5,
                    checkName: 'Athletics check',
                    timestamp: staleTimestamp(),
                };
                if (key === 'lastSaveRoll') return null;
                return null;
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
        });
    });

    describe('handle - target resolution', () => {
        it('uses combat target when resolveTarget returns a target', async () => {
            resolveTarget.mockResolvedValue({
                target: { name: 'Goblin' },
                cs: {},
            });

            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'TestWizard' && key === 'portentDice') return '[15, 8]';
                if (name === 'TestWizard' && key === 'portentUsedThisTurn') return false;
                if (name === 'Goblin' && key === 'lastSaveRoll') return {
                    d20: 10,
                    bonus: 2,
                    saveType: 'dex',
                    timestamp: makeFreshTimestamp(),
                };
                if (name === 'TestWizard' && key === 'lastAttackRoll') return null;
                if (name === 'TestWizard' && key === 'lastAbilityCheck') return null;
                if (name === 'TestWizard' && key === 'lastSaveRoll') return null;
                if (name === 'Goblin' && key === 'lastAttackRoll') return null;
                if (name === 'Goblin' && key === 'lastAbilityCheck') return null;
                return null;
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName, 'test-map');
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.eventType).toBe('save');
            expect(result.payload.eventData.saveType).toBe('dex');
        });

        it('falls back to self when target has no recent rolls', async () => {
            resolveTarget.mockResolvedValue({
                target: { name: 'Goblin' },
                cs: {},
            });

            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'TestWizard' && key === 'portentDice') return '[15, 8]';
                if (name === 'TestWizard' && key === 'portentUsedThisTurn') return false;
                if (name === 'Goblin' && key === 'lastAttackRoll') return null;
                if (name === 'Goblin' && key === 'lastAbilityCheck') return null;
                if (name === 'Goblin' && key === 'lastSaveRoll') return null;
                if (name === 'TestWizard' && key === 'lastAttackRoll') return {
                    d20: 5,
                    bonus: 5,
                    targetName: 'Goblin',
                    targetAc: 15,
                    hit: false,
                    timestamp: makeFreshTimestamp(),
                };
                if (name === 'TestWizard' && key === 'lastAbilityCheck') return null;
                if (name === 'TestWizard' && key === 'lastSaveRoll') return null;
                return null;
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName, 'test-map');
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('TestWizard');
            expect(result.payload.eventType).toBe('attack');
        });

        it('finds incoming attack against self when no personal events exist', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Goblin' },
                    { name: 'TestWizard' },
                ],
            });

            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'TestWizard' && key === 'portentDice') return '[15, 8]';
                if (name === 'TestWizard' && key === 'portentUsedThisTurn') return false;
                if (name === 'TestWizard' && key === 'lastAttackRoll') return null;
                if (name === 'TestWizard' && key === 'lastAbilityCheck') return null;
                if (name === 'TestWizard' && key === 'lastSaveRoll') return null;
                if (name === 'Goblin' && key === 'lastAttackRoll') return {
                    d20: 18,
                    bonus: 4,
                    targetName: 'TestWizard',
                    targetAc: 15,
                    hit: true,
                    timestamp: makeFreshTimestamp(),
                };
                return null;
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.eventType).toBe('attack');
        });

        it('prefers own outgoing rolls over incoming attacks', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Goblin' },
                    { name: 'TestWizard' },
                ],
            });

            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'TestWizard' && key === 'portentDice') return '[15, 8]';
                if (name === 'TestWizard' && key === 'portentUsedThisTurn') return false;
                if (name === 'TestWizard' && key === 'lastAttackRoll') return {
                    d20: 5,
                    bonus: 5,
                    targetName: 'Goblin',
                    targetAc: 15,
                    hit: false,
                    timestamp: makeFreshTimestamp(),
                };
                if (name === 'Goblin' && key === 'lastAttackRoll') return {
                    d20: 18,
                    bonus: 4,
                    targetName: 'TestWizard',
                    targetAc: 15,
                    hit: true,
                    timestamp: makeFreshTimestamp(),
                };
                return null;
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('TestWizard');
        });

        it('no fallback when target has no rolls and self has none either', async () => {
            resolveTarget.mockResolvedValue({
                target: { name: 'Goblin' },
                cs: {},
            });

            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                if (key === 'portentUsedThisTurn') return false;
                return null;
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName, 'test-map');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
        });
    });

    describe('applyPortentChoice', () => {
        it('removes chosen die from pool and applies it to attack roll', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                targetAc: 17,
                hit: false,
                timestamp: makeFreshTimestamp(),
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, 15
            );

            // Dice pool: removed 15, kept 8
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8]', 'test-campaign');

            // Attack roll updated with portent die
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'lastAttackRoll',
                expect.objectContaining({
                    d20: 15,
                    portentUsed: true,
                    portentOriginalD20: 2,
                }),
                'test-campaign'
            );

            // Result popup
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Portent d20(15)');
            expect(result.payload.description).toContain('Original d20(2)');
        });

        it('removes exact chosen die by value (not just position)', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[8, 15, 8]';
                return null;
            });

            const eventData = {
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                targetAc: 17,
                hit: false,
                timestamp: makeFreshTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, 15
            );

            // Should have removed the 15, kept both 8s
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8,8]', 'test-campaign');
        });

        it('falls back to sorted removal when chosen die not found by indexOf', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[8, 8]';
                return null;
            });

            const eventData = {
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                targetAc: 17,
                hit: false,
                timestamp: makeFreshTimestamp(),
            };

            // Request removal of 15 which isn't in the array
            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, 15
            );

            // Fallback: removes the highest (8), keeps the other 8
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8]', 'test-campaign');
        });

        it('correctly determines hit outcome', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            // Original attack: 18 + 4 = 22 vs AC 15 → hit
            const eventData = {
                d20: 18,
                bonus: 4,
                targetName: 'TestWizard',
                targetAc: 15,
                hit: true,
                timestamp: makeFreshTimestamp(),
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'Goblin', 'attack', eventData, 8
            );

            // 8 + 4 = 12 vs AC 15 → miss
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'lastAttackRoll',
                expect.objectContaining({
                    d20: 8,
                    hit: false,
                }),
                'test-campaign'
            );

            expect(result.payload.description).toContain('The attack now misses!');
        });

        it('reports when a miss becomes a hit', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                targetAc: 17,
                hit: false,
                timestamp: makeFreshTimestamp(),
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, 15
            );

            // 15 + 6 = 21 vs AC 17 → hit
            expect(result.payload.description).toContain('The attack now hits!');
        });

        it('reports when attack still hits', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 18,
                bonus: 4,
                targetName: 'Goblin',
                targetAc: 15,
                hit: true,
                timestamp: makeFreshTimestamp(),
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, 15
            );

            // 15 + 4 = 19 vs AC 15 → still hits
            expect(result.payload.description).toContain('The attack still hits.');
        });

        it('reports when attack still misses', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 6,
                bonus: 2,
                targetName: 'Goblin',
                targetAc: 20,
                hit: false,
                timestamp: makeFreshTimestamp(),
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'attack', eventData, 8
            );

            // 8 + 2 = 10 vs AC 20 → still misses
            expect(result.payload.description).toContain('The attack still misses.');
        });

        it('updates ability check roll', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 4,
                bonus: 5,
                checkName: 'Stealth check',
                timestamp: makeFreshTimestamp(),
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'ability', eventData, 15
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'lastAbilityCheck',
                expect.objectContaining({ d20: 15, portentOriginalD20: 4 }),
                'test-campaign'
            );

            expect(result.payload.description).toContain('Stealth check');
            expect(result.payload.description).toContain('Portent d20(15)');
        });

        it('updates save roll', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[12, 6]';
                return null;
            });

            const eventData = {
                d20: 3,
                bonus: 4,
                saveType: 'wisdom',
                timestamp: makeFreshTimestamp(),
            };

            const result = await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'save', eventData, 12
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'lastSaveRoll',
                expect.objectContaining({ d20: 12, portentOriginalD20: 3 }),
                'test-campaign'
            );

            expect(result.payload.description).toContain('WISDOM');
            expect(result.payload.description).toContain('Portent d20(12)');
        });

        it('sets portentUsedThisTurn flag', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 4,
                bonus: 5,
                checkName: 'Stealth check',
                timestamp: makeFreshTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'ability', eventData, 15
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentUsedThisTurn', true, 'test-campaign');
        });

        it('logs the usage', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'portentDice') return '[15, 8]';
                return null;
            });

            const eventData = {
                d20: 4,
                bonus: 5,
                checkName: 'Stealth check',
                timestamp: makeFreshTimestamp(),
            };

            await applyPortentChoice(
                mockAction, mockPlayerStats, mockCampaignName,
                'TestWizard', 'ability', eventData, 15
            );

            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWizard',
                    abilityName: 'Portent',
                    portentDie: 15,
                })
            );
        });
    });
});
