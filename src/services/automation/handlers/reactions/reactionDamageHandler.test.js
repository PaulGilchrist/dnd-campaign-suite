import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDamageHandler.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2] })),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 1),
}));

vi.mock('../../../combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { resolveTarget } = await import('../../common/targetResolver.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../../rules/combat/damageUtils.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Reaction Strike',
        automation: {
            type: 'reaction_damage',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('reactionDamageHandler', () => {
    describe('polearm trigger', () => {
        it('returns popup when no polearm weapon equipped', async () => {
            const ps = makePlayerStats({ inventory: { equipped: ['Longsword'] } });
            const action = makeAction({ automation: { trigger: 'creature_enters_reach_while_holding_polearm' } });

            const result = await handle(action, ps, 'test-campaign', null, []);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires you to be holding');
        });

        it('returns popup when allEquipment is empty', async () => {
            const ps = makePlayerStats({ inventory: { equipped: ['Quarterstaff'] } });
            const action = makeAction({ automation: { trigger: 'creature_enters_reach_while_holding_polearm' } });

            const result = await handle(action, ps, 'test-campaign', null, []);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires you to be holding');
        });

        it('passes polearm check with Quarterstaff and falls through to attack_roll path', async () => {
            const ps = makePlayerStats({
                inventory: { equipped: ['Quarterstaff'] },
                attacks: [{ name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' }],
            });
            const action = makeAction({ automation: { trigger: 'creature_enters_reach_while_holding_polearm' } });
            const allEquipment = [{ name: 'Quarterstaff', properties: [] }];

            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });

            const result = await handle(action, ps, 'test-campaign', null, allEquipment);

            expect(result.type).toBe('attack_roll');
            expect(result.payload.attack.name).toBe('Shortsword');
        });

        it('passes polearm check with Spear and falls through to attack_roll path', async () => {
            const ps = makePlayerStats({
                inventory: { equipped: ['Spear'] },
                attacks: [{ name: 'Spear', type: 'Action', range: 5, damage: '1d6+3' }],
            });
            const action = makeAction({ automation: { trigger: 'creature_enters_reach_while_holding_polearm' } });
            const allEquipment = [{ name: 'Spear', properties: [] }];

            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });

            const result = await handle(action, ps, 'test-campaign', null, allEquipment);

            expect(result.type).toBe('attack_roll');
            expect(result.payload.attack.name).toBe('Spear');
        });

        it('passes polearm check with Heavy + Reach weapon and falls through to attack_roll path', async () => {
            const ps = makePlayerStats({
                inventory: { equipped: ['Greatclub'] },
                attacks: [{ name: 'Greatclub', type: 'Action', range: 5, damage: '1d8+3' }],
            });
            const action = makeAction({ automation: { trigger: 'creature_enters_reach_while_holding_polearm' } });
            const allEquipment = [{ name: 'Greatclub', properties: ['Heavy', 'Reach'] }];

            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });

            const result = await handle(action, ps, 'test-campaign', null, allEquipment);

            expect(result.type).toBe('attack_roll');
            expect(result.payload.attack.name).toBe('Greatclub');
        });

        it('skips polearm check when trigger is different and falls through to attack_roll path', async () => {
            const ps = makePlayerStats({
                inventory: { equipped: ['Longsword'] },
                attacks: [{ name: 'Longsword', type: 'Action', range: 5, damage: '1d8+3' }],
            });
            const action = makeAction({ automation: { trigger: 'other_trigger' } });

            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });

            const result = await handle(action, ps, 'test-campaign', null, []);

            expect(result.type).toBe('attack_roll');
            expect(result.payload.attack.name).toBe('Longsword');
        });
    });

    describe('damage_taken_of_chosen_resistance_type trigger', () => {
        it('returns popup when no chosen types', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires you to have chosen damage types');
        });

        it('returns popup when chosen types is null', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
        });

        it('proceeds when chosen types exist', async () => {
            getRuntimeValue.mockReturnValue(['Fire']);
            const action = makeAction({
                automation: {
                    trigger: 'damage_taken_of_chosen_resistance_type',
                    saveType: 'CON',
                },
            });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('saving throw');
        });
    });

    describe('no saveType - attack_roll path', () => {
        it('returns attack_roll when melee attack exists', async () => {
            const ps = makePlayerStats({
                attacks: [{ name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' }],
            });
            const action = makeAction();

            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });

            const result = await handle(action, ps, 'test-campaign', null);

            expect(result.type).toBe('attack_roll');
            expect(result.payload.attack.name).toBe('Shortsword');
            expect(result.payload.targetName).toBe('Enemy');
            expect(result.payload.sourceName).toBe('Reaction Strike');
        });

        it('returns popup with no melee attack message when no attacks', async () => {
            const ps = makePlayerStats({ attacks: [] });
            const action = makeAction();

            getCombatContext.mockResolvedValue({});

            const result = await handle(action, ps, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Reaction Strike: No melee attack available.');
        });

        it('falls back to first attack when no melee attacks', async () => {
            const ps = makePlayerStats({
                attacks: [{ name: 'Longbow', type: 'Action', range: 150, damage: '1d8+3' }],
            });
            const action = makeAction();

            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });

            const result = await handle(action, ps, 'test-campaign', null);

            expect(result.type).toBe('attack_roll');
            expect(result.payload.attack.name).toBe('Longbow');
        });

        it('handles null attacks gracefully', async () => {
            const ps = makePlayerStats({ attacks: null });
            const action = makeAction();

            getCombatContext.mockResolvedValue({});

            const result = await handle(action, ps, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No melee attack available');
        });
    });

    describe('saveType path', () => {
        it('returns popup requiring target when resolveTarget returns no target', async () => {
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue(null);

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns popup when resource cost not met (focus points)', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'focusPoints') return 0;
                return undefined;
            });
            const action = makeAction({
                automation: { saveType: 'CON', resourceCost: 'focus_point' },
            });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No Focus Points remaining.');
        });

        it('passes resource check when uses are available', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'CON', uses_expression: '1d4' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('CON saving throw');
        });

        it('creates save listener and returns popup with save info', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.targetName).toBe('Enemy');
            expect(result.payload.description).toContain('CON saving throw');
            expect(result.payload.description).toContain('DC 15');
        });

        it('calls addEntry with promptId when saveType path', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'DEX' } });
            resolveTarget.mockResolvedValue({ target: { name: 'TargetCreature' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                promptId: 'test-prompt-id',
            }));
        });

        it('uses auto.saveType when provided', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'WIS' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('WIS saving throw');
        });

        it('uses CON as default saveType when not provided', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'CON', uses_expression: '1d4' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('CON saving throw');
        });
    });

    describe('save result handling', () => {
        it('applies damage on save failure when damageExpression exists', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'CON', damageExpression: '2d6', damageType: 'Necrotic' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'damage_roll',
                targetName: 'Enemy',
                damageType: 'Necrotic',
            }));
        });

        it('applies targetEffects on save failure when alsoInflicts exists', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaign) => {
                if (key === 'targetEffects') return [];
                return 1;
            });
            const action = makeAction({ automation: { saveType: 'CON', alsoInflicts: 'frightened' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.any(Array), 'test-campaign');
        });

        it('applies poisoned condition when target has Physicians Touch', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, campaign) => {
                if (campaign === 'test-campaign' && key === 'targetEffects') return [];
                if (campaign && key === 'activeConditions') return [];
                return 1;
            });
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            const statsWithPhysiciansTouch = makePlayerStats({
                characterAdvancement: [{ name: "Physician's Touch" }],
            });

            await handle(action, statsWithPhysiciansTouch, 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(setRuntimeValue).toHaveBeenCalledWith('Enemy', 'activeConditions', ['poisoned'], 'test-campaign');
        });

        it('does not apply poisoned condition when target already has it', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, campaign) => {
                if (campaign === 'test-campaign' && key === 'targetEffects') return [];
                if (campaign && key === 'activeConditions') return ['poisoned'];
                return 1;
            });
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            const statsWithPhysiciansTouch = makePlayerStats({
                characterAdvancement: [{ name: "Physician's Touch" }],
            });

            await handle(action, statsWithPhysiciansTouch, 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            // The handler checks if 'poisoned' is already in the array and skips adding it
            // so the last setRuntimeValue call should not include 'poisoned'
            const lastCall = setRuntimeValue.mock.calls[setRuntimeValue.mock.calls.length - 1];
            expect(lastCall[2]).toEqual(['poisoned']);
        });

        it('ignores save result events with different promptId', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, campaign) => {
                if (campaign === 'test-campaign' && key === 'targetEffects') return [];
                return 1;
            });
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'wrong-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'damage_roll',
            }));
        });

        it('ignores save result events with different promptId', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'wrong-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'damage_roll',
            }));
        });
    });
});
