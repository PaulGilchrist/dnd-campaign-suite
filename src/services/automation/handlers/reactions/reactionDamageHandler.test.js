// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDamageHandler.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((_auto, _playerStats) => 15),
    createSaveListener: vi.fn((_campaignName, _config) => ({ promptId: 'test-prompt-id' })),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2] })),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_characterKey, _propertyName, _campaignName) => undefined),
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
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => ({})),
    computeDamageAfterSave: vi.fn((_raw, saveSuccess, _dcSuccess) => saveSuccess ? 0 : _raw),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn((_abilities, ability) => ability === 'CON' ? 2 : 0),
}));

vi.mock('../../../combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { resolveTarget } = await import('../../common/targetResolver.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { findLastAttack } = await import('../../common/damageRollback.js');
const { createSaveListener } = await import('../../common/savePrompt.js');

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
    describe('polearm trigger validation', () => {
        it('returns popup when no polearm weapon is equipped or allEquipment is null/empty', async () => {
            const ps = makePlayerStats({ inventory: { equipped: ['Longsword'] } });
            const action = makeAction({ automation: { trigger: 'creature_enters_reach_while_holding_polearm' } });

            let result = await handle(action, ps, 'test-campaign', null, []);
            expect(result.payload.description).toContain('requires you to be holding');

            result = await handle(action, ps, 'test-campaign', null, null);
            expect(result.type).toBe('popup');

            const ps2 = makePlayerStats({ inventory: null });
            const allEquipment = [{ name: 'Quarterstaff', properties: [] }];
            result = await handle(action, ps2, 'test-campaign', null, allEquipment);
            expect(result.type).toBe('popup');
        });

        it('passes polearm check with Quarterstaff, Spear, or Heavy+Reach weapon', async () => {
            const action = makeAction({ automation: { trigger: 'creature_enters_reach_while_holding_polearm' } });

            // Quarterstaff
            const ps1 = makePlayerStats({
                inventory: { equipped: ['Quarterstaff'] },
                attacks: [{ name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' }],
            });
            const allEquipment1 = [{ name: 'Quarterstaff', properties: [] }];
            getCombatContext.mockResolvedValue({});
            findLastAttack.mockResolvedValue({ attackerName: 'Enemy' });
            let result = await handle(action, ps1, 'test-campaign', null, allEquipment1);
            expect(result.payload.attack.name).toBe('Shortsword');

            // Spear
            const ps2 = makePlayerStats({
                inventory: { equipped: ['Spear'] },
                attacks: [{ name: 'Spear', type: 'Action', range: 5, damage: '1d6+3' }],
            });
            const allEquipment2 = [{ name: 'Spear', properties: [] }];
            result = await handle(action, ps2, 'test-campaign', null, allEquipment2);
            expect(result.payload.attack.name).toBe('Spear');

            // Heavy+Reach
            const ps3 = makePlayerStats({
                inventory: { equipped: ['Greatclub'] },
                attacks: [{ name: 'Greatclub', type: 'Action', range: 5, damage: '1d8+3' }],
            });
            const allEquipment3 = [{ name: 'Greatclub', properties: ['Heavy', 'Reach'] }];
            result = await handle(action, ps3, 'test-campaign', null, allEquipment3);
            expect(result.payload.attack.name).toBe('Greatclub');
        });

        it('skips polearm check when trigger is not polearm-related or undefined', async () => {
            const ps = makePlayerStats({
                inventory: { equipped: ['Longsword'] },
                attacks: [{ name: 'Longsword', type: 'Action', range: 5, damage: '1d8+3' }],
            });

            let action = makeAction({ automation: { trigger: 'other_trigger' } });
            getCombatContext.mockResolvedValue({});
            findLastAttack.mockResolvedValue({ attackerName: 'Enemy' });
            let result = await handle(action, ps, 'test-campaign', null, []);
            expect(result.payload.attack.name).toBe('Longsword');

            action = makeAction();
            result = await handle(action, ps, 'test-campaign', null, []);
            expect(result.type).toBe('attack_roll');
        });
    });

    describe('damage_taken_of_chosen_resistance_type trigger', () => {
        it('returns popup when chosen types is empty, null, or non-array', async () => {
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });

            getRuntimeValue.mockReturnValue([]);
            let result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.payload.description).toContain('requires you to have chosen damage types');

            getRuntimeValue.mockReturnValue(null);
            result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');

            getRuntimeValue.mockReturnValue('Fire');
            result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
        });

        it('returns popup when no combat context', async () => {
            getRuntimeValue.mockReturnValue(['Fire']);
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });
            getCombatContext.mockResolvedValue(null);

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No combat context available.');
        });

        it('returns popup when no recent attack', async () => {
            getRuntimeValue.mockReturnValue(['Fire']);
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack found');
        });

        it('returns popup when player was not the target', async () => {
            getRuntimeValue.mockReturnValue(['Fire']);
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestHero', type: 'player', currentHp: 20 }],
                lastAttack: { targetName: 'OtherPC', damageTypes: ['Fire'] },
            });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('You were not the target');
        });

        it('returns popup when damage type does not match chosen types', async () => {
            getRuntimeValue.mockReturnValue(['Fire']);
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestHero', type: 'player', currentHp: 20 }],
                lastAttack: { targetName: 'TestHero', damageTypes: ['Psychic'] },
            });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not one of your chosen resistance types');
        });

        it('returns popup when no other creatures to redirect to', async () => {
            getRuntimeValue.mockReturnValue(['Fire']);
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestHero', type: 'player', currentHp: 20 }],
                lastAttack: { targetName: 'TestHero', damageTypes: ['Fire'] },
            });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No other creatures available');
        });

        it('returns modal with targets when all checks pass', async () => {
            getRuntimeValue
                .mockImplementation((_characterKey, propertyName, campaignName) => {
                    if (campaignName === 'test-campaign' && propertyName === '_Energy_Resistances_chosenTypes') return ['Fire'];
                    if (campaignName === 'test-campaign' && propertyName === 'characters') return [];
                    return undefined;
                });
            const action = makeAction({
                automation: {
                    trigger: 'damage_taken_of_chosen_resistance_type',
                    damageExpression: '2d12 + CON modifier',
                },
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestHero', type: 'player', currentHp: 20 },
                    { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10 },
                ],
                lastAttack: { targetName: 'TestHero', damageTypes: ['Fire'] },
            });

            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('energyRedirection');
            expect(result.payload.title).toContain('Redirect Energy');
            expect(result.payload.targets).toHaveLength(1);
            expect(result.payload.targets[0].name).toBe('Goblin');
            expect(result.payload.onTargetSelected).toBeInstanceOf(Function);
            expect(result.payload.onSkip).toBeInstanceOf(Function);
        });
    });

    describe('no saveType - attack_roll path', () => {
        it('returns attack_roll with melee attack when available, falls back to first attack', async () => {
            const ps = makePlayerStats({
                attacks: [
                    { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' },
                    { name: 'Longbow', type: 'Action', range: 150, damage: '1d8+3' },
                ],
            });
            const action = makeAction();

            findLastAttack.mockResolvedValue({ attackerName: 'Enemy' });

            let result = await handle(action, ps, 'test-campaign', null);
            expect(result.payload.attack.name).toBe('Shortsword');
            expect(result.payload.targetName).toBe('Enemy');
            expect(result.payload.sourceName).toBe('Reaction Strike');

            // Prefers melee over ranged
            const ps2 = makePlayerStats({
                attacks: [
                    { name: 'Longbow', type: 'Action', range: 150, damage: '1d8+3' },
                    { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' },
                ],
            });
            result = await handle(action, ps2, 'test-campaign', null);
            expect(result.payload.attack.name).toBe('Shortsword');

            // Falls back to first attack when no melee
            const ps3 = makePlayerStats({
                attacks: [{ name: 'Longbow', type: 'Action', range: 150, damage: '1d8+3' }],
            });
            result = await handle(action, ps3, 'test-campaign', null);
            expect(result.payload.attack.name).toBe('Longbow');
        });

        it('returns popup with no melee attack message when attacks is empty/null/undefined or missing combat context', async () => {
            const action = makeAction();

            let ps = makePlayerStats({ attacks: [] });
            getCombatContext.mockResolvedValue({});
            let result = await handle(action, ps, 'test-campaign', null);
            expect(result.payload.description).toBe('Reaction Strike: No melee attack available.');

            ps = makePlayerStats({ attacks: null });
            result = await handle(action, ps, 'test-campaign', null);
            expect(result.payload.description).toContain('No melee attack available');

            ps = makePlayerStats();
            result = await handle(action, ps, 'test-campaign', null);
            expect(result.type).toBe('popup');

            // Missing combat context
            ps = makePlayerStats({ attacks: [{ name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' }] });
            findLastAttack.mockResolvedValue({ attackerName: null });
            result = await handle(action, ps, 'test-campaign', null);
            expect(result.payload.targetName).toBeNull();

            findLastAttack.mockResolvedValue({ attackerName: 'Enemy' });
            result = await handle(action, ps, 'test-campaign', null);
            expect(result.type).toBe('attack_roll');
        });

        it('excludes non-Action type attacks from melee selection', async () => {
            const ps = makePlayerStats({
                attacks: [
                    { name: 'Bonus Attack', type: 'Bonus Action', range: 5, damage: '1d4+3' },
                    { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' },
                ],
            });
            const action = makeAction();

            findLastAttack.mockResolvedValue({ attackerName: 'Enemy' });

            const result = await handle(action, ps, 'test-campaign', null);
            expect(result.payload.attack.name).toBe('Shortsword');
        });
    });

    describe('saveType path', () => {
        it('returns popup requiring target when resolveTarget returns no target', async () => {
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue(null);

            let result = await handle(action, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('requires a target');

            resolveTarget.mockResolvedValue({});
            result = await handle(action, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('requires a target');
        });

        it('handles resource cost validation', async () => {
            const actionFocus = makeAction({ automation: { saveType: 'CON', resourceCost: 'focus_point' } });
            const actionUses = makeAction({ automation: { saveType: 'CON', uses_expression: '1d4' } });

            // No focus points
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'focusPoints') return 0;
                return undefined;
            });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            let result = await handle(actionFocus, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toBe('No Focus Points remaining.');

            // Undefined focus points defaults to 0
            getRuntimeValue.mockReturnValue(undefined);
            result = await handle(actionFocus, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toBe('No Focus Points remaining.');

            // Has focus points
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'focusPoints') return 3;
                return undefined;
            });
            result = await handle(actionFocus, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('CON saving throw');

            // Has uses
            getRuntimeValue.mockReturnValue(1);
            result = await handle(actionUses, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('CON saving throw');

            // Uses exhausted
            getRuntimeValue.mockReturnValue(0);
            result = await handle(actionUses, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('has no uses remaining');
        });

        it('skips focus point cost for Hand of Harm with Flurry of Healing and Harm', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'focusPoints') return 0;
                return undefined;
            });
            const ps = makePlayerStats({
                specialActions: [{ name: "Flurry of Healing and Harm" }],
            });
            const action = makeAction({
                name: 'Hand of Harm',
                automation: { saveType: 'CON', resourceCost: 'focus_point' },
            });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            let result = await handle(action, ps, 'test-campaign', null);
            expect(result.payload.description).toContain('CON saving throw');

            // Without Flurry
            const action2 = makeAction({
                name: 'Hand of Harm',
                automation: { saveType: 'CON', resourceCost: 'focus_point' },
            });
            result = await handle(action2, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toBe('No Focus Points remaining.');
        });

        it('does not consume resource when no cost is specified', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);
            expect(result.type).toBe('popup');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('creates save listener and returns popup with save info', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            let result = await handle(action, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.targetName).toBe('Enemy');
            expect(result.payload.description).toContain('CON saving throw');
            expect(result.payload.description).toContain('DC 15');
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Enemy', saveType: 'CON', saveDc: 15,
            }));

            // Different save types
            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue(1);
            const actionWIS = makeAction({ automation: { saveType: 'WIS' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            result = await handle(actionWIS, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('WIS saving throw');
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                saveType: 'WIS',
            }));
        });

        it('calls addEntry with promptId when saveType path is taken', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'DEX' } });
            resolveTarget.mockResolvedValue({ target: { name: 'TargetCreature' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                promptId: 'test-prompt-id',
            }));
        });
    });

    describe('save result handling', () => {
        it('applies damage on save failure, targetEffects on alsoInflicts, and poisoned condition with Physicians Touch', async () => {
            const action = makeAction({ automation: { saveType: 'CON', damageExpression: '2d6', damageType: 'Necrotic' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Enemy',
                damageType: 'Necrotic',
            }));
        });

        it('does not apply damage when save succeeds or damageExpression is missing', async () => {
            const action = makeAction({ automation: { saveType: 'CON', damageExpression: '2d6' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: true },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
            }));

            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue(1);
            const action2 = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            await handle(action2, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
            }));
        });

        it('applies targetEffects on save failure when alsoInflicts exists', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'targetEffects') return [];
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

        it('does not apply targetEffects when save succeeds', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'CON', alsoInflicts: 'frightened' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: true },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(setRuntimeValue).not.toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.any(Array), 'test-campaign');
        });

        it('applies poisoned condition when target has Physicians Touch and save fails, not when already poisoned or lacking feature', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName, campaign) => {
                if (campaign === 'test-campaign' && propertyName === 'targetEffects') return [];
                if (campaign && propertyName === 'activeConditions') return [];
                return 1;
            });
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            const statsWithPhysiciansTouch = makePlayerStats({
                specialActions: [{ name: "Physician's Touch" }],
            });

            await handle(action, statsWithPhysiciansTouch, 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(setRuntimeValue).toHaveBeenCalledWith('Enemy', 'activeConditions', ['poisoned'], 'test-campaign');

            // Already poisoned
            vi.clearAllMocks();
            getRuntimeValue.mockImplementation((_characterKey, propertyName, campaign) => {
                if (campaign === 'test-campaign' && propertyName === 'targetEffects') return [];
                if (campaign && propertyName === 'activeConditions') return ['poisoned'];
                return 1;
            });
            await handle(action, statsWithPhysiciansTouch, 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            const lastCall = setRuntimeValue.mock.calls[setRuntimeValue.mock.calls.length - 1];
            expect(lastCall[2]).toEqual(['poisoned']);

            // Lacking Physicians Touch
            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue(1);
            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Enemy', 'activeConditions', expect.any(Array), 'test-campaign');
        });
    });
});
