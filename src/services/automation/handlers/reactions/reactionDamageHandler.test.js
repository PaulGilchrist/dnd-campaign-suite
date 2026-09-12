// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDamageHandler.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((_auto, _playerStats) => 15),
    createSaveListener: vi.fn((_campaignName, _config) => ({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: true }),
    })),
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

vi.mock('../../common/polearmUtils.js', () => ({
    isPolearmWeapon: vi.fn(async () => true),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { resolveTarget } = await import('../../common/targetResolver.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { findLastAttack } = await import('../../common/damageRollback.js');
const { createSaveListener } = await import('../../common/savePrompt.js');
const { applyDamageToTarget } = await import('../../../rules/combat/applyDamage.js');
const { isWithinRange } = await import('../../../rules/combat/rangeCheck.js');

beforeEach(() => {
    vi.resetAllMocks();
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
        it('returns popup when isPolearmWeapon returns false', async () => {
            const action = makeAction({ automation: { trigger: 'creature_enters_reach_while_holding_polearm' } });

            findLastAttack.mockResolvedValue({ attackEvent: { attackName: 'Longsword' } });
            const { isPolearmWeapon } = await import('../../common/polearmUtils.js');
            isPolearmWeapon.mockResolvedValue(false);

            const result = await handle(action, makePlayerStats(), 'test-campaign', null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires you to be holding');
        });

        it('passes polearm check with Quarterstaff, Spear, or Heavy+Reach weapon', async () => {
            const action = makeAction({ automation: { trigger: 'creature_enters_reach_while_holding_polearm' } });
            const { isPolearmWeapon } = await import('../../common/polearmUtils.js');

            // Quarterstaff
            const ps1 = makePlayerStats({
                inventory: { equipped: ['Quarterstaff'] },
                attacks: [{ name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' }],
            });
            findLastAttack.mockResolvedValue({ attackEvent: { damageName: 'Quarterstaff' } });
            isPolearmWeapon.mockResolvedValue(true);
            let result = await handle(action, ps1, 'test-campaign', null, []);
            expect(result.payload.attack.name).toBe('Shortsword');

            // Spear
            const ps2 = makePlayerStats({
                inventory: { equipped: ['Spear'] },
                attacks: [{ name: 'Spear', type: 'Action', range: 5, damage: '1d6+3' }],
            });
            findLastAttack.mockResolvedValue({ attackEvent: { damageName: 'Spear' } });
            result = await handle(action, ps2, 'test-campaign', null, []);
            expect(result.payload.attack.name).toBe('Spear');

            // Heavy+Reach
            const ps3 = makePlayerStats({
                inventory: { equipped: ['Greatclub'] },
                attacks: [{ name: 'Greatclub', type: 'Action', range: 5, damage: '1d8+3' }],
            });
            findLastAttack.mockResolvedValue({ attackEvent: { damageName: 'Greatclub' } });
            result = await handle(action, ps3, 'test-campaign', null, []);
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

        it('returns popup when no combat context available', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName, campaignName) => {
                if (campaignName === 'test-campaign' && propertyName === '_Energy_Resistances_chosenTypes') return ['Fire'];
                return undefined;
            });
            getCombatContext.mockResolvedValue(null);
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No combat context available.');
        });

        it('returns popup when no recent attack', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName, campaignName) => {
                if (campaignName === 'test-campaign' && propertyName === '_Energy_Resistances_chosenTypes') return ['Fire'];
                if (campaignName === 'test-campaign' && propertyName === 'lastAttack') return null;
                return undefined;
            });
            getCombatContext.mockResolvedValue({});
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack found');
        });

        it('returns popup when player was not the target', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName, campaignName) => {
                if (campaignName === 'test-campaign' && propertyName === '_Energy_Resistances_chosenTypes') return ['Fire'];
                if (campaignName === 'test-campaign' && propertyName === 'lastAttack') return { targetName: 'OtherPC', damageTypes: ['Fire'] };
                return undefined;
            });
            getCombatContext.mockResolvedValue({});
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('You were not the target');
        });

        it('returns popup when damage type does not match chosen types', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName, campaignName) => {
                if (campaignName === 'test-campaign' && propertyName === '_Energy_Resistances_chosenTypes') return ['Fire'];
                if (campaignName === 'test-campaign' && propertyName === 'lastAttack') return { targetName: 'TestHero', damageTypes: ['Psychic'] };
                return undefined;
            });
            getCombatContext.mockResolvedValue({});
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not one of your chosen resistance types');
        });

        it('returns popup when no other creatures to redirect to', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName, campaignName) => {
                if (campaignName === 'test-campaign' && propertyName === '_Energy_Resistances_chosenTypes') return ['Fire'];
                if (campaignName === 'test-campaign' && propertyName === 'lastAttack') return { targetName: 'TestHero', damageTypes: ['Fire'] };
                return undefined;
            });
            const action = makeAction({ automation: { trigger: 'damage_taken_of_chosen_resistance_type' } });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestHero', type: 'player', currentHp: 20 }],
            });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No other creatures available');
        });

        it('returns modal with targets when all checks pass', async () => {
            getRuntimeValue
                .mockImplementation((_characterKey, propertyName, campaignName) => {
                    if (campaignName === 'test-campaign' && propertyName === '_Energy_Resistances_chosenTypes') return ['Fire'];
                    if (campaignName === 'test-campaign' && propertyName === 'lastAttack') return { targetName: 'TestHero', damageTypes: ['Fire'] };
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

        it('onTargetSelected applies damage and logs on save failure', async () => {
            getRuntimeValue
                .mockImplementation((_characterKey, propertyName, campaignName) => {
                    if (campaignName === 'test-campaign' && propertyName === '_Energy_Resistances_chosenTypes') return ['Fire'];
                    if (campaignName === 'test-campaign' && propertyName === 'lastAttack') return { targetName: 'TestHero', damageTypes: ['Fire'] };
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
            });
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: false }),
            });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            const modalPayload = result.payload;

            const response = await modalPayload.onTargetSelected('Goblin');

            expect(response.type).toBe('popup');
            expect(response.payload.description).toContain('failed their DEX save');
            expect(response.payload.description).toContain('took 5 Fire damage');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Reaction Strike',
            }));
        });

        it('onTargetSelected applies no damage on save success', async () => {
            getRuntimeValue
                .mockImplementation((_characterKey, propertyName, campaignName) => {
                    if (campaignName === 'test-campaign' && propertyName === '_Energy_Resistances_chosenTypes') return ['Fire'];
                    if (campaignName === 'test-campaign' && propertyName === 'lastAttack') return { targetName: 'TestHero', damageTypes: ['Fire'] };
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
            });
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            const modalPayload = result.payload;

            const response = await modalPayload.onTargetSelected('Goblin');

            expect(response.type).toBe('popup');
            expect(response.payload.description).toContain('succeeded their DEX save');
            expect(response.payload.description).toContain('took 0 Fire damage');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('onSkip logs when user declines redirection', async () => {
            getRuntimeValue
                .mockImplementation((_characterKey, propertyName, campaignName) => {
                    if (campaignName === 'test-campaign' && propertyName === '_Energy_Resistances_chosenTypes') return ['Fire'];
                    if (campaignName === 'test-campaign' && propertyName === 'lastAttack') return { targetName: 'TestHero', damageTypes: ['Fire'] };
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
            });

            const result = await handle(action, makePlayerStats(), 'test-campaign');
            const modalPayload = result.payload;

            await modalPayload.onSkip();

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Reaction Strike',
                description: expect.stringContaining('chose not to redirect energy'),
            }));
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

        it('returns popup with no melee attack message when attacks is empty, null, or undefined', async () => {
            const action = makeAction();
            findLastAttack.mockResolvedValue({ attackerName: 'Enemy' });

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
        });

        it('includes targetName from lastAttack when available', async () => {
            const ps = makePlayerStats({ attacks: [{ name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' }] });
            const action = makeAction();

            findLastAttack.mockResolvedValue({ attackerName: 'Goblin' });
            const result = await handle(action, ps, 'test-campaign', null);
            expect(result.payload.targetName).toBe('Goblin');
        });
    });

    describe('CLA-297 damage_from_adjacent_creature gates (Retaliation)', () => {
        const RETALIATION_USED_ROUND_KEY = '_Retaliation_usedRound';

        function makeRetaliation() {
            return makeAction({
                name: 'Retaliation',
                automation: {
                    type: 'reaction_damage',
                    trigger: 'damage_from_adjacent_creature',
                    range: '5 ft',
                    effect: 'melee_attack_reaction',
                    casting_time: '1 reaction',
                },
            });
        }

        function makeHero() {
            return makePlayerStats({
                attacks: [{ name: 'Warhammer', type: 'Action', range: 5, damage: '1d8+7' }],
            });
        }

        function armTrigger(overrides = {}) {
            findLastAttack.mockResolvedValue({
                attackEvent: {
                    attackerName: 'Thug 1',
                    targetName: 'TestHero',
                    weaponType: 'melee',
                    hit: true,
                    actualDamage: 3,
                    timestamp: 5000,
                    ...overrides.attackEvent,
                },
                attackerName: 'Thug 1',
                targetName: 'TestHero',
                totalDamage: overrides.totalDamage != null ? overrides.totalDamage : 3,
                damageTypes: ['Bludgeoning'],
                ...overrides.result,
            });
        }

        beforeEach(() => {
            isWithinRange.mockResolvedValue(true);
            getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
            getRuntimeValue.mockImplementation(() => undefined);
        });

        it('offers attack_roll, stamps the round latch, and logs ability_use on a valid adjacent melee hit', async () => {
            armTrigger();
            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);

            expect(result.type).toBe('attack_roll');
            expect(result.payload.targetName).toBe('Thug 1');
            expect(result.payload.attack.name).toBe('Warhammer');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', RETALIATION_USED_ROUND_KEY, 1, 'test-campaign');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Retaliation',
                targetName: 'Thug 1',
                description: expect.stringContaining('used Retaliation (Reaction)'),
            }));
        });

        it('refuses a second use in the same round (round-keyed latch) without rolling', async () => {
            armTrigger();
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === RETALIATION_USED_ROUND_KEY) return 1;
                return undefined;
            });

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already used Retaliation this round');
            expect(result.payload.description).toContain('Reaction is spent');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('re-arms on the next round', async () => {
            armTrigger();
            getCombatContext.mockResolvedValue({ round: 2, creatures: [] });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === RETALIATION_USED_ROUND_KEY) return 1;
                return undefined;
            });

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);
            expect(result.type).toBe('attack_roll');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', RETALIATION_USED_ROUND_KEY, 2, 'test-campaign');
        });

        it('refuses when the holder was not the target of the last attack', async () => {
            armTrigger({
                attackEvent: { targetName: 'HexWarlock' },
                result: { targetName: 'HexWarlock' },
            });

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('You were not the target of the last attack');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses when the last attack was made by the holder (self-target / stale lastAttack)', async () => {
            armTrigger({
                attackEvent: { attackerName: 'TestHero', targetName: 'Thug 1' },
                result: { attackerName: 'TestHero', targetName: 'Thug 1' },
            });

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('cannot attack yourself');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses when the last attack dealt no damage', async () => {
            armTrigger({ totalDamage: 0, attackEvent: { hit: false, actualDamage: null } });

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('dealt you no damage');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses ranged damage (weaponType ranged) even when it damaged the holder', async () => {
            armTrigger({ attackEvent: { weaponType: 'ranged' } });

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Ranged attack');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses when the attacker is beyond 5 feet on an active map', async () => {
            armTrigger();
            isWithinRange.mockResolvedValue(false);

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not within 5 feet');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses when there is no recent attack at all', async () => {
            findLastAttack.mockResolvedValue({ attackEvent: null, attackerName: null, targetName: null, totalDamage: 0, damageTypes: [] });

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack found');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('saveType path - resource validation', () => {
        it('returns popup requiring target when resolveTarget returns no target', async () => {
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue(null);

            let result = await handle(action, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('requires a target');

            resolveTarget.mockResolvedValue({});
            result = await handle(action, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('requires a target');
        });

        it('handles resource cost validation (focus points and uses)', async () => {
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
    });

    describe('saveType path - save popup', () => {
        it('creates save listener, returns popup, and logs ability_use', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.targetName).toBe('Enemy');
            expect(result.payload.description).toContain('CON saving throw');
            expect(result.payload.description).toContain('DC 15');
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Enemy', saveType: 'CON', saveDc: 15,
            }));
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                promptId: 'test-prompt-id',
            }));
        });
    });

    describe('save result handling', () => {
        it('applies damage on save failure', async () => {
            const action = makeAction({ automation: { saveType: 'CON', damageExpression: '2d6', damageType: 'Necrotic' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            const cs = { creatures: [{ name: 'Enemy', type: 'monster', currentHp: 27, maxHp: 27 }] };
            getCombatContext.mockResolvedValue(cs);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await Promise.resolve();
            await Promise.resolve();

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Enemy',
                damageType: 'Necrotic',
            }));
            expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Enemy', 5, ['Necrotic'], 'test-campaign', [], { ignoreResistance: false, attackerName: 'TestHero' });
        });

        it('logs hp_change via applyDamageToTarget after the damage roll (Hand of Harm CLA-158)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'campaign' && key === 'targetEffects') return [];
                if (key === 'focusPoints') return 1;
                return null;
            });
            const action = makeAction({
                name: 'Hand of Harm',
                automation: { saveType: 'CON', damageExpression: '1d6', damageType: 'Necrotic', alsoInflicts: 'disadvantage_next_attack' },
            });
            resolveTarget.mockResolvedValue({ target: { name: 'Animated Rug of Smothering 1' } });
            const cs = { creatures: [{ name: 'Animated Rug of Smothering 1', type: 'monster', currentHp: 27, maxHp: 27 }] };
            getCombatContext.mockResolvedValue(cs);

            await handle(action, makePlayerStats(), 'test-campaign', null, []);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await Promise.resolve();
            await Promise.resolve();

            expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Animated Rug of Smothering 1', 5, ['Necrotic'], 'test-campaign', [], { ignoreResistance: false, attackerName: 'TestHero' });
        });

        it('does not apply damage when save succeeds', async () => {
            const action = makeAction({ automation: { saveType: 'CON', damageExpression: '2d6' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            getCombatContext.mockResolvedValue({ creatures: [] });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: true },
            }));

            await Promise.resolve();
            await Promise.resolve();

            expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
            }));
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('does not apply damage when damageExpression is missing', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'CON' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await Promise.resolve();

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

            await Promise.resolve();

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'test-campaign');
        });

        it('does not apply targetEffects when save succeeds', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'CON', alsoInflicts: 'frightened' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: true },
            }));

            await Promise.resolve();

            expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'test-campaign');
        });

        it('applies poisoned condition when target has Physicians Touch and save fails', async () => {
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

            await Promise.resolve();

            expect(setRuntimeValue).toHaveBeenCalledWith('Enemy', 'activeConditions', ['poisoned'], 'test-campaign');
        });

        it('does not add duplicate poisoned condition when target is already poisoned', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName, campaign) => {
                if (campaign === 'test-campaign' && propertyName === 'targetEffects') return [];
                if (campaign && propertyName === 'activeConditions') return ['poisoned'];
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

            await Promise.resolve();

            const lastCall = setRuntimeValue.mock.calls[setRuntimeValue.mock.calls.length - 1];
            expect(lastCall[2]).toEqual(['poisoned']);
        });
    });

    // CLA-361: Thought Shield reflect must PERSIST (applyDamageToTarget, not a
    // mutation of the fetched combatSummary copy) and latch once per round.
    describe('CLA-361 Thought Shield persistence + once-per-hit latch', () => {
        const tsAction = makeAction({
            name: 'Thought Shield',
            automation: {
                type: 'reaction_damage',
                trigger: 'psychic_damage_received',
                damageExpression: 'RAW damage',
                damageType: 'Psychic',
                range: '5_ft',
            },
        });

        const tsStats = () => makePlayerStats({
            characterAdvancement: [{ name: 'Thought Shield' }],
        });

        const psychicLastAttack = {
            targetName: 'TestHero',
            damageTypes: ['Psychic'],
            actualDamage: 14,
            rawDamage: 28,
            attackerName: 'Githzerai Psion 1',
        };

        function tsRig() {
            const cs = {
                round: 3,
                creatures: [
                    { name: 'Githzerai Psion 1', type: 'monster', currentHp: 169, maxHp: 169 },
                    { name: 'TestHero', type: 'player', currentHp: 59 },
                ],
            };
            getCombatContext.mockResolvedValue(cs);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return psychicLastAttack;
                return undefined;
            });
            return cs;
        }

        it('persists the reflect through applyDamageToTarget (ignoreResistance, warlock attributed)', async () => {
            tsRig();

            const result = await handle(tsAction, tsStats(), 'test-campaign', null, []);

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.objectContaining({ round: 3 }), 'Githzerai Psion 1', 14, ['Psychic'], 'test-campaign', expect.any(Array), { ignoreResistance: true, attackerName: 'TestHero' });
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('reflects 14 psychic damage back to Githzerai Psion 1');
        });

        it('never hand-rolls an hp_change row or cs mutation — persistence is applyDamageToTarget\'s', async () => {
            const cs = tsRig();

            await handle(tsAction, tsStats(), 'test-campaign', null, []);

            expect(cs.creatures.find(c => c.name === 'Githzerai Psion 1').currentHp).toBe(169);
            expect(addEntry.mock.calls.some(([, e]) => e.type === 'hp_change')).toBe(false);
        });

        it('stamps _Thought_Shield_usedRound and refuses a same-round refire spending nothing', async () => {
            tsRig();

            await handle(tsAction, tsStats(), 'test-campaign', null, []);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_Thought_Shield_usedRound', 3, 'test-campaign');

            applyDamageToTarget.mockClear();
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return psychicLastAttack;
                if (key === 'TestHero' && prop === '_Thought_Shield_usedRound') return 3;
                return undefined;
            });

            const result = await handle(tsAction, tsStats(), 'test-campaign', null, []);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already used Thought Shield this round');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'thought_shield_refused',
                characterName: 'TestHero',
            }));
        });

        it('logs thought_shield_refused on the non-psychic (bludgeoning) refusal leg', async () => {
            tsRig();
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') {
                    return { targetName: 'TestHero', damageTypes: ['Bludgeoning'], actualDamage: 5, attackerName: 'Thug 1' };
                }
                return undefined;
            });

            const result = await handle(tsAction, tsStats(), 'test-campaign', null, []);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not psychic damage');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'thought_shield_refused',
            }));
        });
    });
});
