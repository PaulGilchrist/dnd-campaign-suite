// @maintained-by-ai: 2026-10-15 — deterministic full-mock lane over the stable
// handle() trigger-dispatch table, the generic save / no-save paths, the generic
// damage-application envelope (save-prompt + save-result wiring), resource-cost
// validation (Focus Points + uses), Physicians' Touch poison fail-rider, Energy
// Redirection and CLA-297 Retaliation. No churn expected as the app moves.
//
// TRIO MAP on reactionDamageHandler.js (test-trim audit 2026-10-15):
// - THIS file owns the generic save-type/no-save paths, Energy Redirection
//   (damage_taken_of_chosen_resistance_type — sole handler home, verified) and
//   CLA-297 Retaliation (damage_from_adjacent_creature — sole handler home).
// - reactionDamageHandler.reactiveStrike.test.js owns FT-103
//   creature_enters_reach_while_holding_polearm: full gate lane there, incl.
//   the honest empty-equipped holding refusal ('refuses with no polearm
//   equipped...') — the old main-lane 'returns popup when isPolearmWeapon
//   returns false' never reached isPolearmWeapon (rig had no inventory) and
//   was REMOVED here; its full-pin home is that merged sibling test.
// - reactionDamageHandler.handOfHarm.test.js owns the CLA-158 holder-hit save
//   trigger creature_within_5ft_hits_on_attack_roll. Its canonical shed pins
//   live HERE and stay: 'creates save listener, returns popup, and logs
//   ability_use', 'does not apply damage when save succeeds', 'does not apply
//   targetEffects when save succeeds'. The standalone-Flurry FP test was
//   removed (held-Flurry specialActions mock inert — no flurry branch remains
//   in consumeResourceCost); the generic-path FP-write pin folded into
//   'handles resource cost validation', handOfHarm keeps its own
//   'charges 1 Focus Point on commit'.
// - CLA-361 Thought Shield: canonical lane lives in
//   src/services/rules/combat/applyDamage.thoughtShield.test.js — SAME
//   handle(), 16 tests over every gate refusal, latch, and persist leg, with a
//   MUTATING applyDamageToTarget mock so persistence is actually verified.
//   The main-file CLA-361 block (4 tests) was removed as full duplication —
//   its cs-mutation guard was vacuous under the no-op {} mock. Amendment to
//   the trio-map comment lines in both sibling files: forward-flagged 2026-10-15.
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
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { isWithinRange } = await import('../../../rules/combat/rangeCheck.js');
const { isPolearmWeapon } = await import('../../common/polearmUtils.js');

beforeEach(() => {
    vi.resetAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        ...overrides,
    };
}

// MERGE-override helper — automation overrides ride INTO the base automation
// row (never replace it wholesale).
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
    // FT-103 dispatch legs only — the full gate/latch/refusal lane lives in
    // reactionDamageHandler.reactiveStrike.test.js. Weapon-classification truth
    // (which names ARE polearms) lives in polearmUtils.test.js — isPolearmWeapon
    // is mocked here, so only the CONSULTS and row-selection legs are pinned.
    describe('creature_enters_reach_while_holding_polearm dispatch legs (FT-103)', () => {
        it('delivers the equipped weapon attack row — fallback and magic-plus legs', async () => {
            const action = makeAction({ automation: { trigger: 'creature_enters_reach_while_holding_polearm' } });
            resolveTarget.mockResolvedValue({ target: { name: 'Bandit 1' } });
            getCombatContext.mockResolvedValue({ round: 1, creatures: [{ name: 'Bandit 1', currentHp: 11 }] });

            // Quarterstaff equipped but NO polearm attack row — findEquippedPolearmAttack
            // falls back to the melee (range 5) row. This fallback leg is owned here
            // (the sibling rigs always carry a matching polearm row).
            const ps1 = makePlayerStats({
                inventory: { equipped: ['Quarterstaff'] },
                attacks: [{ name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' }],
            });
            isPolearmWeapon.mockImplementation(async () => true);
            let result = await handle(action, ps1, 'test-campaign', null, []);
            expect(result.type).toBe('attack_roll');
            expect(result.payload.attack.name).toBe('Shortsword');
            expect(isPolearmWeapon).toHaveBeenCalledWith('Quarterstaff');

            // Direct match — the attack row of the equipped weapon is the dice source.
            const ps2 = makePlayerStats({
                inventory: { equipped: ['Spear'] },
                attacks: [{ name: 'Spear', type: 'Action', range: 5, damage: '1d6+3' }],
            });
            result = await handle(action, ps2, 'test-campaign', null, []);
            expect(result.payload.attack.name).toBe('Spear');
            expect(isPolearmWeapon).toHaveBeenCalledWith('Spear');

            // Magic-plus: full name consults false, base-name ('Glaive +2' → 'Glaive')
            // consults true — the plus-number strip seam inside findEquippedPolearmAttack,
            // and the full-named row is still the delivered attack.
            const ps3 = makePlayerStats({
                inventory: { equipped: ['Glaive +2'] },
                attacks: [{ name: 'Glaive +2', type: 'Action', range: 5, damage: '1d10+5', damageType: 'Slashing' }],
            });
            isPolearmWeapon.mockImplementation(async (name) => name === 'Glaive');
            result = await handle(action, ps3, 'test-campaign', null, []);
            expect(result.payload.attack.name).toBe('Glaive +2');
            expect(isPolearmWeapon).toHaveBeenCalledWith('Glaive +2');
            expect(isPolearmWeapon).toHaveBeenCalledWith('Glaive');
        });

        it('routes non-polearm triggers through the generic path without consulting isPolearmWeapon', async () => {
            const ps = makePlayerStats({
                inventory: { equipped: ['Longsword'] },
                attacks: [{ name: 'Longsword', type: 'Action', range: 5, damage: '1d8+3' }],
            });
            const action = makeAction({ automation: { trigger: 'other_trigger' } });
            findLastAttack.mockResolvedValue({ attackerName: 'Enemy' });

            const result = await handle(action, ps, 'test-campaign', null, []);
            expect(result.type).toBe('attack_roll');
            expect(result.payload.attack.name).toBe('Longsword');
            expect(result.payload.targetName).toBe('Enemy');
            // The FT-103 gate is trigger-keyed — any other trigger never reaches it.
            expect(isPolearmWeapon).not.toHaveBeenCalled();
        });
    });

    describe('damage_taken_of_chosen_resistance_type trigger (Energy Redirection)', () => {
        const fireHitOnHero = { targetName: 'TestHero', damageTypes: ['Fire'] };

        // Arm the pass-chain inputs. Keyed by propertyName only — several reads in
        // the handler chain omit the campaign argument (applyFailPhysiciansTouch).
        function armEnergy({ chosenTypes = ['Fire'], lastAttack = fireHitOnHero } = {}) {
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === '_Energy_Resistances_chosenTypes') return chosenTypes;
                if (propertyName === 'lastAttack') return lastAttack;
                if (propertyName === 'characters') return [];
                return undefined;
            });
        }

        function heroAndGoblin() {
            return {
                creatures: [
                    { name: 'TestHero', type: 'player', currentHp: 20 },
                    { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10 },
                ],
            };
        }

        const energyAction = (extraAuto = {}) => makeAction({
            automation: { trigger: 'damage_taken_of_chosen_resistance_type', ...extraAuto },
        });

        it('returns popup when chosen types is empty, null, or non-array', async () => {
            const action = energyAction();

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
            armEnergy();
            getCombatContext.mockResolvedValue(null);

            const result = await handle(energyAction(), makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No combat context available.');
        });

        it('returns popup when no recent attack', async () => {
            armEnergy({ lastAttack: null });
            getCombatContext.mockResolvedValue({});

            const result = await handle(energyAction(), makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack found');
        });

        it('returns popup when player was not the target', async () => {
            armEnergy({ lastAttack: { targetName: 'OtherPC', damageTypes: ['Fire'] } });
            getCombatContext.mockResolvedValue({});

            const result = await handle(energyAction(), makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('You were not the target');
        });

        it('returns popup when damage type does not match chosen types', async () => {
            armEnergy({ lastAttack: { targetName: 'TestHero', damageTypes: ['Psychic'] } });
            getCombatContext.mockResolvedValue({});

            const result = await handle(energyAction(), makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not one of your chosen resistance types');
        });

        it('returns popup when no other creatures to redirect to', async () => {
            armEnergy();
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestHero', type: 'player', currentHp: 20 }],
            });

            const result = await handle(energyAction(), makePlayerStats(), 'test-campaign');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No other creatures available');
        });

        it('returns modal with targets when all checks pass', async () => {
            armEnergy();
            getCombatContext.mockResolvedValue(heroAndGoblin());

            const result = await handle(energyAction({ damageExpression: '2d12 + CON modifier' }), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('energyRedirection');
            expect(result.payload.title).toContain('Redirect Energy');
            expect(result.payload.targets).toHaveLength(1);
            expect(result.payload.targets[0].name).toBe('Goblin');
            expect(result.payload.onTargetSelected).toBeInstanceOf(Function);
            expect(result.payload.onSkip).toBeInstanceOf(Function);
            // CharReactions.jsx consumes these fields (fallbacks exist — pin the real ones).
            expect(result.payload.confirmLabel).toBe('Redirect');
            expect(result.payload.confirmIcon).toBe('fa-bolt');
            // saveDc = 8 + CON(mod 2) + prof(0) = 10; matched type threads through.
            expect(result.payload.featureDescription).toContain('DC 10');
            expect(result.payload.featureDescription).toContain('2d12 + +2 Fire damage');
            expect(result.payload.description).toContain('Fire');
        });

        it('onTargetSelected applies damage and logs on save failure', async () => {
            armEnergy();
            const cs = heroAndGoblin();
            getCombatContext.mockResolvedValue(cs);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: false }),
            });

            const result = await handle(energyAction({ damageExpression: '2d12 + CON modifier' }), makePlayerStats(), 'test-campaign');
            const response = await result.payload.onTargetSelected('Goblin');

            expect(response.type).toBe('popup');
            expect(response.payload.description).toContain('failed their DEX save');
            expect(response.payload.description).toContain('took 5 Fire damage');
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin', saveType: 'DEX', saveDc: 10,
            }));
            // Generic damage envelope for this lane: matched type, resistance respected.
            expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Goblin', 5, ['Fire'], { campaignName: 'test-campaign', characters: [], ignoreResistance: false, attackerName: 'TestHero' });
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Reaction Strike',
            }));
        });

        it('onTargetSelected applies no damage on save success', async () => {
            armEnergy();
            getCombatContext.mockResolvedValue(heroAndGoblin());
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });

            const result = await handle(energyAction({ damageExpression: '2d12 + CON modifier' }), makePlayerStats(), 'test-campaign');
            const response = await result.payload.onTargetSelected('Goblin');

            expect(response.type).toBe('popup');
            expect(response.payload.description).toContain('succeeded their DEX save');
            expect(response.payload.description).toContain('took 0 Fire damage');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('onSkip logs when user declines redirection', async () => {
            armEnergy();
            getCombatContext.mockResolvedValue(heroAndGoblin());

            const result = await handle(energyAction({ damageExpression: '2d12 + CON modifier' }), makePlayerStats(), 'test-campaign');
            await result.payload.onSkip();

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Reaction Strike',
                description: expect.stringContaining('chose not to redirect energy'),
            }));
            expect(applyDamageToTarget).not.toHaveBeenCalled();
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
            // targetName rides lastAttack.attackerName (owned pin for this path).
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
            expect(setRuntimeValue).not.toHaveBeenCalled();

            // Undefined focus points defaults to 0 (no class row → maxFocus 0)
            getRuntimeValue.mockReturnValue(undefined);
            result = await handle(actionFocus, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toBe('No Focus Points remaining.');

            // Has focus points — prompt runs AND the generic path charges 1 FP on
            // commit. CLA-158: pin folded here from the removed standalone-Flurry
            // test (its specialActions mock was inert — no flurry branch remains in
            // consumeResourceCost); the Hand of Harm canonical lane keeps its own
            // 'charges 1 Focus Point on commit' in handOfHarm.test.js.
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'focusPoints') return 3;
                return undefined;
            });
            result = await handle(actionFocus, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('CON saving throw');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'focusPoints', 2, 'test-campaign');

            // Has uses — prompt runs and the uses-key debit lands.
            getRuntimeValue.mockReturnValue(1);
            result = await handle(actionUses, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('CON saving throw');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'reactionstrikeUses', 0, 'test-campaign');

            // Uses exhausted
            getRuntimeValue.mockReturnValue(0);
            result = await handle(actionUses, makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('has no uses remaining');
        });
    });

    describe('saveType path - save popup', () => {
        // CANONICAL home (shed from handOfHarm.test.js — do not trim).
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
        // Generic damage-application envelope for the trigger-agnostic save lane
        // (the same handleSaveResult skip legs below are the canonical homes
        // shed from handOfHarm.test.js — do not trim them).
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

            expect(rollExpression).toHaveBeenCalledWith('2d6');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Enemy',
                damageType: 'Necrotic',
            }));
            expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Enemy', 5, ['Necrotic'], { campaignName: 'test-campaign', characters: [], ignoreResistance: false, attackerName: 'TestHero' });
        });

        // CANONICAL (shed from handOfHarm.test.js — do not trim).
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

        // CANONICAL (shed from handOfHarm.test.js — do not trim).
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

        // applyFailPhysiciansTouch reads activeConditions WITHOUT a campaign arg —
        // mock keyed by propertyName so the branch is exercised honestly.
        it('applies poisoned condition when target has Physicians Touch and save fails', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'targetEffects') return [];
                if (propertyName === 'activeConditions') return [];
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

            // CLA-158: applyFailInfliction became async (awaited te write +
            // condition log) — flush the full continuation chain, not one tick.
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).toHaveBeenCalledWith('Enemy', 'activeConditions', ['poisoned'], 'test-campaign');
        });

        it('does not add duplicate poisoned condition when target is already poisoned', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'targetEffects') return [];
                if (propertyName === 'activeConditions') return ['poisoned'];
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

            // CLA-158: async fail-lane — flush the full continuation chain.
            await new Promise(r => setTimeout(r, 0));

            // Already poisoned → dedup guard writes NOTHING (this flow has no other
            // runtime write, so the zero-write assertion is the honest guard).
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
