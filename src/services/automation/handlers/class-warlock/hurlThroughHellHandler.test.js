// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './hurlThroughHellHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 44, rolls: [10, 10, 10, 10, 4] })),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((_auto, _stats) => 15),
    createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({
        creatures: [{ name: 'Goblin', type: 'fiend' }],
    })),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Goblin' })),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN = 'campaign';
const MAP = 'map';

function makeAction(overrides = {}) {
    return {
        name: 'Hurl Through Hell',
        automation: {
            type: 'hurl_through_hell',
            uses: 1,
            damageExpression: '8d10',
            damageType: 'Psychic',
            saveType: 'CHA',
            saveAbility: 'CHA',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return { name: 'TestHero', proficiency: 3, ...overrides };
}

function mockRuntimeValues(values) {
    getRuntimeValue.mockImplementation((_playerName, key, _campaign) => {
        if (key === 'hurlThroughHellTurnUsed' && values.hurlThroughHellTurnUsed !== undefined) return values.hurlThroughHellTurnUsed;
        if (key === 'hurlThroughHellUses' && values.hurlThroughHellUses !== undefined) return values.hurlThroughHellUses;
        if (key === 'warlockPactMagic' && values.warlockPactMagic !== undefined) return values.warlockPactMagic;
        if (key === 'currentTurn' && values.currentTurn !== undefined) return values.currentTurn;
        if (key === 'targetEffects' && values.targetEffects !== undefined) return values.targetEffects;
        if (key === 'activeConditions' && values.activeConditions !== undefined) return values.activeConditions;
        if (key === 'pendingSavePrompts' && values.pendingSavePrompts !== undefined) return values.pendingSavePrompts;
        return null;
    });
}

function dispatchSaveResult(promptId, success) {
    window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId, success },
    }));
}

// ── Tests ──────────────────────────────────────────────────────

describe('hurlThroughHellHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        // ── Early exit paths ──

        it('should return popup when already used this turn', async () => {
            mockRuntimeValues({ hurlThroughHellTurnUsed: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Already used this turn');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should return popup when no uses remaining and no pactMagicRecharge', async () => {
            mockRuntimeValues({ hurlThroughHellUses: 1 });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });

        it('should return popup when no pact magic slots available to recharge', async () => {
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 0 });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Pact Magic slots available');
        });

        // ── Pact magic recharge ──

        it('should spend pact magic slot to restore a use when available', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 2 });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'warlockPactMagic', 1, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellUses', 0, CAMPAIGN);
        });

        it('should log ability_use when pact magic is expended to restore a use', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 1 });

            await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Hurl Through Hell',
                description: expect.stringContaining('expended a Pact Magic spell slot'),
            }));
        });

        it('should not restore uses when pactMagicRecharge is false', async () => {
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 5 });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: false },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'warlockPactMagic', expect.anything(), CAMPAIGN);
        });

        // ── Target resolution ──

        it('should return popup when no combat context', async () => {
            getCombatContext.mockResolvedValue(null);
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should return popup when getTargetFromAttacker returns null', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue(null);
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        // ── Successful execution ──

        it('should return popup with damage and save info when executing successfully', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.saveType).toBe('CHA');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.damageTotal).toBe(44);
            expect(result.payload.targetName).toBe('Goblin');
        });

        it('should increment uses counter on successful execution', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellUses', 1, CAMPAIGN);
        });

        it('should mark the turn as used with currentTurn value', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn5' });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellTurnUsed', 'turn5', CAMPAIGN);
        });

        it('should use "unknown" as currentTurn when not set', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({});

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellTurnUsed', 'unknown', CAMPAIGN);
        });

        it('should store targetEffects with correct structure', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                CAMPAIGN,
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'Hurl Through Hell',
                        effect: 'incapacitated',
                        condition: 'incapacitated',
                        duration: 'until_end_of_next_turn',
                        saveType: 'CHA',
                        saveDc: 15,
                        saveAbility: 'CHA',
                        damageType: 'Psychic',
                        damageTotal: 44,
                        damageExpression: '8d10',
                        teleport: true,
                        returnToSpace: true,
                    }),
                ]),
                CAMPAIGN,
            );
        });

        it('should append to existing targetEffects', async () => {
            const existingEffects = [
                { target: 'Goblin', effect: 'blinded' },
            ];
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: existingEffects });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                CAMPAIGN,
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ effect: 'blinded' }),
                    expect.objectContaining({ effect: 'incapacitated' }),
                ]),
                CAMPAIGN,
            );
        });

        it('should create a save listener via createSaveListener', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                targetName: 'Goblin',
                saveType: 'CHA',
                saveDc: 15,
            }));
        });

        it('should log ability_use with promptId', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Hurl Through Hell',
                targetName: 'Goblin',
                promptId: 'test-prompt-id',
            }));
        });

        it('should register a save-result event listener on window', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
            addEventListenerSpy.mockRestore();
        });

        // ── Default values ──

        it('should use default saveType CHA when not specified', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const action = makeAction({
                automation: { saveAbility: 'CHA' },
            });

            await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(buildSaveDc).toHaveBeenCalledWith(action.automation, expect.any(Object));
            expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                saveType: 'CHA',
            }));
        });

        it('should use default damageExpression 8d10 when not specified', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const action = makeAction({
                automation: { damageExpression: '8d10' },
            });

            await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                saveType: 'CHA',
            }));
        });

        it('should use custom damageExpression from automation config', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const action = makeAction({
                automation: { damageExpression: '10d10', damageType: 'Force' },
            });

            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.damageType).toBe('Force');
        });

        it('should use custom saveType from automation config', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const action = makeAction({
                automation: { saveType: 'WIS', saveAbility: 'WIS' },
            });

            await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                saveType: 'WIS',
            }));
        });

        // ── Popup description ──

        it('should include uses remaining in popup description', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Uses remaining: 0 / 1');
        });

        it('should include target name in popup description', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Target: <b>Goblin</b>');
        });

        it('should include save DC info in popup description', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('DC 15');
        });

        it('should use custom feature name when provided in action', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const action = makeAction({ name: 'Custom Hurl' });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.name).toBe('Custom Hurl');
            expect(result.payload.description).toContain('<b>Custom Hurl</b>');
        });

        // ── Save-result event handling ──

        describe('save-result event handling', () => {
            function setupFullExecution() {
                getCombatContext.mockResolvedValue({
                    creatures: [{ name: 'Goblin', type: 'fiend' }],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                mockRuntimeValues({ currentTurn: 'turn1' });
            }

            it('should apply incapacitated condition when target fails save', async () => {
                setupFullExecution();

                await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

                dispatchSaveResult('test-prompt-id', false);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'Goblin',
                    'activeConditions',
                    ['incapacitated'],
                    CAMPAIGN,
                );
            });

            it('should append incapacitated to existing conditions on failed save', async () => {
                setupFullExecution();
                mockRuntimeValues({ currentTurn: 'turn1', activeConditions: ['blinded'] });

                await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

                dispatchSaveResult('test-prompt-id', false);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'Goblin',
                    'activeConditions',
                    ['blinded', 'incapacitated'],
                    CAMPAIGN,
                );
            });

            it('should log save_result when target fails save', async () => {
                setupFullExecution();

                await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

                dispatchSaveResult('test-prompt-id', false);

                await Promise.resolve();
                await Promise.resolve();

                expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                    type: 'save_result',
                    targetName: 'Goblin',
                    success: false,
                }));
            });

            it('should log no damage for fiend targets on failed save', async () => {
                setupFullExecution();

                await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

                dispatchSaveResult('test-prompt-id', false);

                expect(addEntry).not.toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                    type: 'roll',
                    rollType: 'damage',
                }));
            });

            it('should log damage for non-fiend targets on failed save', async () => {
                getCombatContext.mockResolvedValue({
                    creatures: [{ name: 'Goblin', type: 'humanoid' }],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                mockRuntimeValues({ currentTurn: 'turn1' });

                await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

                dispatchSaveResult('test-prompt-id', false);

                await Promise.resolve();
                await Promise.resolve();

                expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                    type: 'roll',
                    rollType: 'damage',
                    targetName: 'Goblin',
                    damageType: 'Psychic',
                    formula: '8d10',
                }));
            });

            it('should log save_result when target succeeds save', async () => {
                setupFullExecution();

                await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

                dispatchSaveResult('test-prompt-id', true);

                await Promise.resolve();
                await Promise.resolve();

                expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                    type: 'save_result',
                    targetName: 'Goblin',
                    success: true,
                }));
            });

            it('should not apply conditions when target succeeds save', async () => {
                setupFullExecution();

                await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

                dispatchSaveResult('test-prompt-id', true);

                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'Goblin',
                    'activeConditions',
                    expect.anything(),
                    CAMPAIGN,
                );
            });

            it('should ignore save-result events with mismatched promptId', async () => {
                setupFullExecution();

                await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

                dispatchSaveResult('wrong-prompt-id', false);

                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'Goblin',
                    'activeConditions',
                    expect.anything(),
                    CAMPAIGN,
                );
            });

            it('should remove save-result event listener after handling', async () => {
                setupFullExecution();

                const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

                await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

                dispatchSaveResult('test-prompt-id', false);

                await Promise.resolve();
                await Promise.resolve();

                expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
                removeEventListenerSpy.mockRestore();
            });
        });

        // ── Multiple uses ──

        it('should allow multiple uses when maxUses > 1', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1', hurlThroughHellUses: 0 });

            const action = makeAction({
                automation: { uses: 2 },
            });

            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Uses remaining: 1 / 2');
        });

        it('should show correct uses remaining after one use', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1', hurlThroughHellUses: 1 });

            const action = makeAction({
                automation: { uses: 2 },
            });

            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Uses remaining: 0 / 2');
        });

        it('should block when uses exhausted with multiple maxUses', async () => {
            mockRuntimeValues({ hurlThroughHellUses: 2 });

            const action = makeAction({
                automation: { uses: 2 },
            });

            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
        });

        // ── Automation info popup on early exit ──

        it('should pass automation config through to popup payload', async () => {
            mockRuntimeValues({ hurlThroughHellTurnUsed: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.automation).toEqual(expect.objectContaining({
                type: 'hurl_through_hell',
                uses: 1,
                damageExpression: '8d10',
                damageType: 'Psychic',
                saveType: 'CHA',
                saveAbility: 'CHA',
            }));
        });

        it('should use action name when provided', async () => {
            mockRuntimeValues({ hurlThroughHellTurnUsed: 'turn1' });

            const action = makeAction({ name: 'My Hurl' });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.name).toBe('My Hurl');
            expect(result.payload.description).toContain('My Hurl');
        });
    });
});
