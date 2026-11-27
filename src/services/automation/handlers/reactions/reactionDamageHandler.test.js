// @maintained-by-ai 2026-11-27 — deterministic full-mock lane over the stable
// handle() trigger-dispatch table, the generic save / no-save paths, the generic
// damage-application envelope (save-prompt + save-result wiring), resource-cost
// validation (Focus Points + uses), Physicians' Touch poison fail-rider, Energy
// Redirection and CLA-297 Retaliation. Test-trim audit 2026-11-27: multi-call
// re-harness tests split into single-branch/it.each legs (full-shape popup/log
// toEqual, exact zero-spend mock.calls censuses, frozen Date.now, gate-order
// short-circuit pins, lane defaults re-installed in beforeEach); the Spear
// direct-match dispatch leg dropped (stronger-owned by reactiveStrike sibling);
// the two save-success skip tests merged; foreign-promptId + no-combat-context
// legs added. Listener strays swept in afterEach (shared mock promptId).
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
//   live HERE and stay: 'builds the DC, arms the save listener with exact
//   config, returns the popup, and logs the full ability_use row' and
//   'applies zero damage and zero targetEffects when the save succeeds' (the
//   former separate damage/targetEffects success tests merged, same branch). The standalone-Flurry FP test was
//   removed (held-Flurry specialActions mock inert — no flurry branch remains
//   in consumeResourceCost); the generic-path FP-write pin folded into
//   'charges 1 Focus Point before the prompt opens', handOfHarm keeps its own
//   'charges 1 Focus Point on commit'.
// - CLA-361 Thought Shield: canonical lane lives in
//   src/services/rules/combat/applyDamage.thoughtShield.test.js — SAME
//   handle(), 16 tests over every gate refusal, latch, and persist leg, with a
//   MUTATING applyDamageToTarget mock so persistence is actually verified.
//   The main-file CLA-361 block (4 tests) was removed as full duplication —
//   its cs-mutation guard was vacuous under the no-op {} mock. Amendment to
//   the trio-map comment lines in both sibling files: forward-flagged 2026-10-15.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle } from './reactionDamageHandler.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
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

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

// The REAL computeDamageAfterSave is a pure 3-branch function, but
// importOriginal on applyDamage.js pulls a 30+ module feature-service graph —
// so it is mirrored here. The mirror is exact for this lane's call contract
// (energy lane passes dcSuccess=null → fail pays raw, success pays 0).
vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    computeDamageAfterSave: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn(),
}));

vi.mock('../../../combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../common/polearmUtils.js', () => ({
    isPolearmWeapon: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(),
}));

const { buildSaveDc, createSaveListener } = await import('../../common/savePrompt.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { resolveTarget } = await import('../../common/targetResolver.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { findLastAttack } = await import('../../common/damageRollback.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationService.js');
const { applyDamageToTarget, computeDamageAfterSave } = await import('../../../rules/combat/applyDamage.js');
const { getAbilityModifier } = await import('../../../shared/abilityLookup.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { isWithinRange } = await import('../../../rules/combat/rangeCheck.js');
const { isPolearmWeapon } = await import('../../common/polearmUtils.js');

// FROZEN clock: every timestamped log row is pinned full-shape.
const FROZEN_NOW = 1735689600000;

// Lane defaults re-installed EVERY test (mockReset-style semantics, so no
// per-test impl residue survives).
beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    rollExpression.mockReturnValue({ total: 5, rolls: [3, 2] });
    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: true }),
    });
    computeDamageAfterSave.mockImplementation((raw, saveSuccess) => (saveSuccess ? 0 : raw));
    applyDamageToTarget.mockResolvedValue({});
    getRuntimeValue.mockReturnValue(undefined);
    setRuntimeValue.mockResolvedValue(undefined);
    addEntry.mockResolvedValue(undefined);
    resolveTarget.mockResolvedValue(null);
    getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
    findLastAttack.mockResolvedValue({ attackEvent: null, attackerName: null, targetName: null, totalDamage: 0, damageTypes: [] });
    evaluateAutoExpression.mockImplementation((expr) => expr);
    getAbilityModifier.mockImplementation((_abilities, ability) => (ability === 'CON' ? 2 : 0));
    isPolearmWeapon.mockResolvedValue(true);
    isWithinRange.mockResolvedValue(true);
});

// The save branch registers a window 'save-result' listener keyed on the
// shared mock promptId. Tests that never dispatch would otherwise leak a live
// listener into later tests; this sweep dispatch fires and self-removes any
// strays (success=true is a no-op for the fail legs).
afterEach(() => {
    window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: true },
    }));
});

// Flush the async save-result listener chain (CLA-158 async fail legs).
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

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

const SAVE_AUTO = { type: 'reaction_damage', saveType: 'CON' };
const saveAction = (extra = {}) => makeAction({ automation: { ...SAVE_AUTO, ...extra } });

describe('reactionDamageHandler', () => {
    // FT-103 dispatch legs ONLY — the full gate/latch/economy lane lives in
    // reactionDamageHandler.reactiveStrike.test.js (which stronger-covers the
    // direct equipped-row match and the melee-over-thrown preference; the old
    // third 'Spear direct match' leg here was dropped as its duplicate).
    // Weapon-classification truth lives in polearmUtils.test.js —
    // isPolearmWeapon is mocked here, so only CONSULTS + row-selection legs pin.
    describe('creature_enters_reach_while_holding_polearm dispatch legs (FT-103)', () => {
        function armedPolearmRig() {
            resolveTarget.mockResolvedValue({ target: { name: 'Bandit 1' } });
            getCombatContext.mockResolvedValue({ round: 1, creatures: [{ name: 'Bandit 1', currentHp: 11 }] });
        }
        const polearmAction = () => makeAction({
            automation: { trigger: 'creature_enters_reach_while_holding_polearm' },
        });

        it('falls back to the melee row when the equipped polearm has no own attack row', async () => {
            armedPolearmRig();
            const shortsword = { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' };
            const ps = makePlayerStats({
                inventory: { equipped: ['Quarterstaff'] },
                attacks: [shortsword],
            });
            isPolearmWeapon.mockResolvedValue(true);

            const result = await handle(polearmAction(), ps, 'test-campaign', null, []);

            // findEquippedPolearmAttack finds no polearm-named row, then
            // prefers the melee (range 5) row. This fallback leg is owned here
            // (the sibling rigs always carry a matching polearm row).
            expect(result).toEqual({
                type: 'attack_roll',
                payload: { attack: shortsword, targetName: 'Bandit 1', sourceName: 'Reaction Strike' },
            });
            expect(isPolearmWeapon.mock.calls).toEqual([['Quarterstaff']]);
        });

        it('consults the full name then strips the magic-plus suffix, still delivering the full-named row', async () => {
            armedPolearmRig();
            const glaiveRow = { name: 'Glaive +2', type: 'Action', range: 5, damage: '1d10+5', damageType: 'Slashing' };
            const ps = makePlayerStats({
                inventory: { equipped: ['Glaive +2'] },
                attacks: [glaiveRow],
            });
            isPolearmWeapon.mockImplementation(async (name) => name === 'Glaive');

            const result = await handle(polearmAction(), ps, 'test-campaign', null, []);

            // Full-name consult false → base-name consult true → the plus-number
            // strip seam, and the full-named row is still the delivered attack.
            expect(result).toEqual({
                type: 'attack_roll',
                payload: { attack: glaiveRow, targetName: 'Bandit 1', sourceName: 'Reaction Strike' },
            });
            expect(isPolearmWeapon.mock.calls).toEqual([['Glaive +2'], ['Glaive']]);
        });

        it('routes a non-polearm trigger through the generic path without consulting isPolearmWeapon', async () => {
            findLastAttack.mockResolvedValue({ attackerName: 'Enemy' });
            const longsword = { name: 'Longsword', type: 'Action', range: 5, damage: '1d8+3' };
            const ps = makePlayerStats({
                inventory: { equipped: ['Longsword'] },
                attacks: [longsword],
            });
            const action = makeAction({ automation: { trigger: 'other_trigger' } });

            const result = await handle(action, ps, 'test-campaign', null, []);

            // The FT-103 gate is trigger-keyed — any other trigger never reaches it.
            expect(result).toEqual({
                type: 'attack_roll',
                payload: { attack: longsword, targetName: 'Enemy', sourceName: 'Reaction Strike' },
            });
            expect(isPolearmWeapon.mock.calls).toEqual([]);
        });
    });

    describe('damage_taken_of_chosen_resistance_type trigger (Energy Redirection)', () => {
        const ENERGY_AUTO = { type: 'reaction_damage', trigger: 'damage_taken_of_chosen_resistance_type' };
        const FIRE_HIT_ON_HERO = { targetName: 'TestHero', damageTypes: ['Fire'] };

        // Arm the pass-chain inputs. Keyed by propertyName only — several reads
        // in the handler chain omit the campaign argument.
        function armEnergy({ chosenTypes = ['Fire'], lastAttack = FIRE_HIT_ON_HERO, playerHp } = {}) {
            getRuntimeValue.mockImplementation((characterKey, propertyName) => {
                if (propertyName === '_Energy_Resistances_chosenTypes') return chosenTypes;
                if (propertyName === 'lastAttack') return lastAttack;
                if (propertyName === 'characters') return [];
                if (playerHp && characterKey === 'OtherPC') return playerHp[propertyName];
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
            automation: { ...ENERGY_AUTO, ...extraAuto },
        });

        const REFUSE = (description, withAutomation) => ({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Reaction Strike',
                description,
                ...(withAutomation ? { automation: ENERGY_AUTO } : {}),
            },
        });

        // Gate census: ctx reads 0 before the combat-context gate, 1 after it;
        // the chosen-types popup carries `automation`, the mid-chain refusers
        // do not (source shape asymmetry, pinned).
        it.each([
            { label: 'chosen types is empty', chosen: [], csCalls: 0, description: 'Reaction Strike requires you to have chosen damage types for Energy Resistances.', withAutomation: true },
            { label: 'chosen types is null', chosen: null, csCalls: 0, description: 'Reaction Strike requires you to have chosen damage types for Energy Resistances.', withAutomation: true },
            { label: 'chosen types is a bare string', chosen: 'Fire', csCalls: 0, description: 'Reaction Strike requires you to have chosen damage types for Energy Resistances.', withAutomation: true },
            { label: 'no combat context exists', chosen: ['Fire'], cs: null, csCalls: 1, description: 'No combat context available.' },
            { label: 'no recent attack exists', chosen: ['Fire'], cs: {}, lastAttack: null, csCalls: 1, description: "No recent attack found. Energy Redirection requires you to have taken damage of a type you've chosen resistance against." },
            { label: 'the holder was not the target', chosen: ['Fire'], cs: {}, lastAttack: { targetName: 'OtherPC', damageTypes: ['Fire'] }, csCalls: 1, description: 'You were not the target of the last attack (OtherPC was). Energy Redirection only works when you take damage.' },
            { label: 'the damage type is not one of the chosen types', chosen: ['Fire'], cs: {}, lastAttack: { targetName: 'TestHero', damageTypes: ['Psychic'] }, csCalls: 1, description: 'The last attack dealt Psychic damage, not one of your chosen resistance types (Fire).' },
            { label: 'no other creature exists to redirect to', chosen: ['Fire'], cs: { creatures: [{ name: 'TestHero', type: 'player', currentHp: 20 }] }, csCalls: 1, description: 'Reaction Strike: No other creatures available to redirect to.', withAutomation: true },
        ])('refuses when $label — full popup shape, zero spend, zero log', async (c) => {
            armEnergy({ chosenTypes: c.chosen, lastAttack: c.lastAttack });
            getCombatContext.mockResolvedValue('cs' in c ? c.cs : heroAndGoblin());

            const result = await handle(energyAction(), makePlayerStats(), 'test-campaign');

            expect(result).toEqual(REFUSE(c.description, c.withAutomation));
            expect(getCombatContext.mock.calls.length).toBe(c.csCalls);
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('returns the full-shape redirect modal with runtime-HP-merged targets when all checks pass', async () => {
            // OtherPC's stale cs HP must lose to the runtime store read.
            armEnergy({ playerHp: { currentHitPoints: 14, hitPoints: 16 } });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestHero', type: 'player', currentHp: 20 },
                    { name: 'OtherPC', type: 'player', currentHp: 99 },
                    { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10 },
                ],
            });

            const result = await handle(
                energyAction({ damageExpression: '2d12 + CON modifier' }),
                makePlayerStats(),
                'test-campaign',
            );

            // saveDc = 8 + CON(mod 2) + prof(0) = 10; matched type threads through.
            expect(result).toEqual({
                type: 'modal',
                modalName: 'energyRedirection',
                payload: {
                    title: 'Reaction Strike — Redirect Energy',
                    targets: [
                        { name: 'OtherPC', type: 'player', currentHp: 14, maxHp: 16 },
                        { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10 },
                    ],
                    confirmLabel: 'Redirect',
                    confirmIcon: 'fa-bolt',
                    featureDescription: 'Target must make a DEX saving throw (DC 10) or take 2d12 + +2 Fire damage.',
                    description: 'You redirect damage of the Fire type toward another creature you can see within 60 feet.',
                    onTargetSelected: expect.any(Function),
                    onSkip: expect.any(Function),
                },
            });
            expect(getCombatContext.mock.calls).toEqual([['test-campaign']]);
            // Nothing is spent by opening the modal.
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('onTargetSelected commits on save failure: roll, DEX listener config, damage apply, full log row, response popup', async () => {
            armEnergy();
            const cs = heroAndGoblin();
            getCombatContext.mockResolvedValue(cs);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: false }),
            });

            const result = await handle(
                energyAction({ damageExpression: '2d12 + CON modifier' }),
                makePlayerStats(),
                'test-campaign',
            );
            const response = await result.payload.onTargetSelected('Goblin');

            expect(rollExpression.mock.calls).toEqual([['2d12 + CON modifier']]);
            expect(createSaveListener.mock.calls).toEqual([[
                'test-campaign', { targetName: 'Goblin', saveType: 'DEX', saveDc: 10 },
            ]]);
            // Generic damage envelope: matched type, resistance respected.
            expect(applyDamageToTarget.mock.calls).toEqual([[
                cs, 'Goblin', 5, ['Fire'],
                { campaignName: 'test-campaign', characters: [], ignoreResistance: false, attackerName: 'TestHero' },
            ]]);
            expect(addEntry.mock.calls).toEqual([[
                'test-campaign', {
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Reaction Strike',
                    description: 'TestHero redirects Fire energy to Goblin. Goblin failed their DEX save (DC 10) and took 5 Fire damage.',
                    targetName: 'Goblin',
                    timestamp: FROZEN_NOW,
                },
            ]]);
            expect(response).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Reaction Strike',
                    targetName: 'Goblin',
                    description: 'Goblin failed their DEX save (DC 10) and took 5 Fire damage.',
                },
            });
        });

        it('onTargetSelected applies zero damage on save success but still logs the outcome', async () => {
            armEnergy();
            getCombatContext.mockResolvedValue(heroAndGoblin());

            const result = await handle(
                energyAction({ damageExpression: '2d12 + CON modifier' }),
                makePlayerStats(),
                'test-campaign',
            );
            const response = await result.payload.onTargetSelected('Goblin');

            expect(applyDamageToTarget.mock.calls).toEqual([]);
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: 'TestHero redirects Fire energy to Goblin. Goblin succeeded their DEX save (DC 10) and took 0 Fire damage.',
            }));
            expect(response).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Reaction Strike',
                    targetName: 'Goblin',
                    description: 'Goblin succeeded their DEX save (DC 10) and took 0 Fire damage.',
                },
            });
        });

        it('onSkip logs the declination only — no roll, no listener, no damage', async () => {
            armEnergy();
            getCombatContext.mockResolvedValue(heroAndGoblin());

            const result = await handle(
                energyAction({ damageExpression: '2d12 + CON modifier' }),
                makePlayerStats(),
                'test-campaign',
            );
            await result.payload.onSkip();

            expect(addEntry.mock.calls).toEqual([[
                'test-campaign', {
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Reaction Strike',
                    description: 'TestHero chose not to redirect energy.',
                },
            ]]);
            expect(applyDamageToTarget.mock.calls).toEqual([]);
            expect(rollExpression.mock.calls).toEqual([]);
            expect(createSaveListener).not.toHaveBeenCalled();
        });
    });

    describe('no saveType - generic melee reaction path', () => {
        const genericAction = () => makeAction();

        it('delivers the melee attack row (preferred over ranged) with lastAttack.attackerName as target', async () => {
            findLastAttack.mockResolvedValue({ attackerName: 'Enemy' });
            const shortsword = { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' };
            const longbow = { name: 'Longbow', type: 'Action', range: 150, damage: '1d8+3' };
            const ps = makePlayerStats({ attacks: [longbow, shortsword] });

            const result = await handle(genericAction(), ps, 'test-campaign', null);

            expect(result).toEqual({
                type: 'attack_roll',
                payload: { attack: shortsword, targetName: 'Enemy', sourceName: 'Reaction Strike' },
            });
            expect(findLastAttack.mock.calls).toEqual([['test-campaign']]);
            // Generic OA lane spends and logs nothing at offer time.
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });

        it('falls back to the first attack when no melee (range 5) row exists', async () => {
            findLastAttack.mockResolvedValue({ attackerName: 'Enemy' });
            const longbow = { name: 'Longbow', type: 'Action', range: 150, damage: '1d8+3' };
            const ps = makePlayerStats({ attacks: [longbow] });

            const result = await handle(genericAction(), ps, 'test-campaign', null);

            expect(result).toEqual({
                type: 'attack_roll',
                payload: { attack: longbow, targetName: 'Enemy', sourceName: 'Reaction Strike' },
            });
        });

        it.each([
            { label: 'empty', attacks: [] },
            { label: 'null', attacks: null },
            { label: 'undefined', attacks: undefined },
        ])('refuses with the no-melee-attack popup when attacks is $label', async ({ attacks }) => {
            const ps = makePlayerStats({ attacks });

            const result = await handle(genericAction(), ps, 'test-campaign', null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Reaction Strike',
                    description: 'Reaction Strike: No melee attack available.',
                    automation: { type: 'reaction_damage' },
                },
            });
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
            expect(getCombatContext.mock.calls).toEqual([]);
        });
    });

    describe('CLA-297 damage_from_adjacent_creature gates (Retaliation)', () => {
        const RETALIATION_USED_ROUND_KEY = '_Retaliation_usedRound';
        const RETALIATION_AUTO = {
            type: 'reaction_damage',
            trigger: 'damage_from_adjacent_creature',
            range: '5 ft',
            effect: 'melee_attack_reaction',
            casting_time: '1 reaction',
        };
        const WARHAMMER = { name: 'Warhammer', type: 'Action', range: 5, damage: '1d8+7' };

        const makeRetaliation = () => makeAction({ name: 'Retaliation', automation: RETALIATION_AUTO });
        const makeHero = () => makePlayerStats({ attacks: [WARHAMMER] });

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

        const retaliationRefusal = (description) => ({
            type: 'popup',
            payload: { type: 'automation_info', name: 'Retaliation', description, automation: RETALIATION_AUTO },
        });

        it('offers attack_roll against the attacker, stamps the round latch once, and logs the full ability_use row', async () => {
            armTrigger();

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);

            expect(result).toEqual({
                type: 'attack_roll',
                payload: { attack: WARHAMMER, targetName: 'Thug 1', sourceName: 'Retaliation' },
            });
            expect(isWithinRange.mock.calls).toEqual([['TestHero', 'Thug 1', 5]]);
            // Gate reads cs, then the commit leg re-reads it for a FRESH round.
            expect(getCombatContext.mock.calls).toEqual([['test-campaign'], ['test-campaign']]);
            expect(setRuntimeValue.mock.calls).toEqual([
                ['TestHero', RETALIATION_USED_ROUND_KEY, 1, 'test-campaign'],
            ]);
            expect(addEntry.mock.calls).toEqual([[
                'test-campaign', {
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Retaliation',
                    description: 'TestHero used Retaliation (Reaction) — melee attack against Thug 1 in response to the 3 damage taken from them.',
                    targetName: 'Thug 1',
                    timestamp: FROZEN_NOW,
                },
            ]]);
        });

        it('refuses a second use in the same round (round-keyed latch) with a zero-spend census', async () => {
            armTrigger();
            getRuntimeValue.mockImplementation((_name, key) =>
                key === RETALIATION_USED_ROUND_KEY ? 1 : undefined);

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);

            expect(result).toEqual(retaliationRefusal(
                'You have already used Retaliation this round — your Reaction is spent until your next turn.',
            ));
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });

        it('re-arms on the next round and re-stamps the latch at the fresh round', async () => {
            armTrigger();
            getCombatContext.mockResolvedValue({ round: 2, creatures: [] });
            getRuntimeValue.mockImplementation((_name, key) =>
                key === RETALIATION_USED_ROUND_KEY ? 1 : undefined);

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);

            expect(result.type).toBe('attack_roll');
            expect(setRuntimeValue.mock.calls).toEqual([
                ['TestHero', RETALIATION_USED_ROUND_KEY, 2, 'test-campaign'],
            ]);
        });

        // Gate-order census: every identity/damage check short-circuits BEFORE
        // isWithinRange and getCombatContext, and spends/logs nothing. The
        // 'no recent attack' case rides the beforeEach empty lastAttack default.
        it.each([
            {
                label: 'the holder was not the target',
                arm: { attackEvent: { targetName: 'HexWarlock' }, result: { targetName: 'HexWarlock' } },
                description: 'You were not the target of the last attack (HexWarlock was). Retaliation only triggers when you take damage.',
            },
            {
                label: 'the attack came from the holder (stale lastAttack)',
                arm: { attackEvent: { attackerName: 'TestHero', targetName: 'Thug 1' }, result: { attackerName: 'TestHero', targetName: 'Thug 1' } },
                description: 'Retaliation: you cannot attack yourself — the triggering attack must come from another creature.',
            },
            {
                label: 'the attack dealt no damage',
                arm: { totalDamage: 0, attackEvent: { hit: false, actualDamage: null } },
                description: 'The last attack dealt you no damage. Retaliation triggers only when you take damage.',
            },
            {
                label: 'the attack was ranged',
                arm: { attackEvent: { weaponType: 'ranged' } },
                description: 'The last attack was a Ranged attack. Retaliation only triggers when a creature within 5 feet of you deals damage to you.',
            },
            {
                label: 'no recent attack exists',
                arm: null,
                description: 'Retaliation: No recent attack found. Retaliation triggers when a creature within 5 feet of you deals damage to you.',
            },
        ])('refuses when $label — full popup, zero spend, gated before range/context', async ({ arm, description }) => {
            if (arm) armTrigger(arm);

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);

            expect(result).toEqual(retaliationRefusal(description));
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
            expect(isWithinRange.mock.calls).toEqual([]);
            expect(getCombatContext.mock.calls).toEqual([]);
        });

        it('refuses when the attacker is beyond 5 feet — range consulted, context never read', async () => {
            armTrigger();
            isWithinRange.mockResolvedValue(false);

            const result = await handle(makeRetaliation(), makeHero(), 'test-campaign', null, []);

            expect(result).toEqual(retaliationRefusal(
                'Thug 1 is not within 5 feet of you. Retaliation requires the attacker to be adjacent.',
            ));
            expect(isWithinRange.mock.calls).toEqual([['TestHero', 'Thug 1', 5]]);
            expect(getCombatContext.mock.calls).toEqual([]);
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });
    });

    describe('saveType path - target and resource validation', () => {
        it.each([
            { label: 'resolveTarget returns null', armed: null },
            { label: 'resolveTarget returns no target row', armed: {} },
        ])('refuses requiring a target when $label — no prompt, zero spend', async ({ armed }) => {
            resolveTarget.mockResolvedValue(armed);

            const result = await handle(saveAction(), makePlayerStats(), 'test-campaign', null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Reaction Strike',
                    description: 'Reaction Strike requires a target. Select a creature in combat and try again.',
                    automation: SAVE_AUTO,
                },
            });
            expect(buildSaveDc).not.toHaveBeenCalled();
            expect(createSaveListener).not.toHaveBeenCalled();
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });

        // FP read is `stored ?? maxFocus` — an unset row defaults to the class
        // level's focus_points (no class row here → 0 → refuse).
        it.each([
            { label: 'the stored count is 0', stored: 0 },
            { label: 'the stored count is unset (defaults to max, which is 0)', stored: undefined },
        ])('refuses a focus-point reaction when $label — zero spend', async ({ stored }) => {
            const action = saveAction({ resourceCost: 'focus_point' });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            getRuntimeValue.mockImplementation((_name, key) =>
                key === 'focusPoints' ? stored : undefined);

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Reaction Strike',
                    description: 'No Focus Points remaining.',
                    automation: { ...SAVE_AUTO, resourceCost: 'focus_point' },
                },
            });
            expect(createSaveListener).not.toHaveBeenCalled();
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });

        it('charges 1 Focus Point before the prompt opens (CLA-113 pre-modal spend)', async () => {
            const action = saveAction({ resourceCost: 'focus_point' });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            getRuntimeValue.mockImplementation((_name, key) =>
                key === 'focusPoints' ? 3 : undefined);

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue.mock.calls).toEqual([
                ['TestHero', 'focusPoints', 2, 'test-campaign'],
            ]);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Reaction Strike',
                    targetName: 'Enemy',
                    description: 'Enemy must make a CON saving throw (DC 15).',
                    automation: { ...SAVE_AUTO, resourceCost: 'focus_point' },
                },
            });
        });

        it('debits the uses counter, defaulting an unset store to the evaluated max', async () => {
            const action = saveAction({ uses_expression: '1d4' });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            evaluateAutoExpression.mockReturnValue(2);

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            // getRuntimeUsesKey('Reaction Strike') → 'reactionStrikeUses'
            // (real pure helper, unmocked); unset store defaults to max 2 → 1.
            expect(setRuntimeValue.mock.calls).toEqual([
                ['TestHero', 'reactionStrikeUses', 1, 'test-campaign'],
            ]);
            expect(result.payload.description).toContain('CON saving throw');
        });

        it('refuses an exhausted uses counter — zero spend', async () => {
            const action = saveAction({ uses_expression: '1d4' });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            getRuntimeValue.mockImplementation((_name, key) =>
                key === 'reactionStrikeUses' ? 0 : undefined);

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Reaction Strike',
                    description: 'Reaction Strike has no uses remaining.',
                    automation: { ...SAVE_AUTO, uses_expression: '1d4' },
                },
            });
            expect(createSaveListener).not.toHaveBeenCalled();
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });
    });

    describe('saveType path - save prompt commit', () => {
        // CANONICAL home (shed from handOfHarm.test.js — do not trim).
        it('builds the DC, arms the save listener with exact config, returns the popup, and logs the full ability_use row', async () => {
            const action = saveAction();
            const ps = makePlayerStats();
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });

            const result = await handle(action, ps, 'test-campaign', null);

            // CLA-144: non-Monk defaults the DC ability to CON.
            expect(buildSaveDc).toHaveBeenCalledWith(
                expect.objectContaining({ saveType: 'CON', saveAbility: 'CON' }), ps);
            expect(createSaveListener.mock.calls).toEqual([[
                'test-campaign', { targetName: 'Enemy', attackerName: 'TestHero', saveType: 'CON', saveDc: 15 },
            ]]);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Reaction Strike',
                    targetName: 'Enemy',
                    description: 'Enemy must make a CON saving throw (DC 15).',
                    automation: SAVE_AUTO,
                },
            });
            expect(addEntry.mock.calls).toEqual([[
                'test-campaign', {
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Reaction Strike',
                    description: 'Reaction Strike triggered — Enemy must make CON save (DC 15)',
                    promptId: 'test-prompt-id',
                },
            ]]);
        });
    });

    describe('save result handling', () => {
        // Generic damage-application envelope for the trigger-agnostic save lane.
        it('ignores foreign promptIds, then commits roll + full log row + damage apply on save failure', async () => {
            const action = saveAction({ damageExpression: '2d6', damageType: 'Necrotic' });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            const cs = { creatures: [{ name: 'Enemy', type: 'monster', currentHp: 27, maxHp: 27 }] };
            getCombatContext.mockResolvedValue(cs);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'someone-elses-prompt', success: false },
            }));
            await flush();
            expect(rollExpression.mock.calls).toEqual([]);
            expect(applyDamageToTarget.mock.calls).toEqual([]);
            expect(addEntry.mock.calls.length).toBe(1); // commit row only

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));
            await flush();

            expect(rollExpression.mock.calls).toEqual([['2d6']]);
            expect(addEntry.mock.calls).toEqual([
                ['test-campaign', expect.objectContaining({ type: 'ability_use' })],
                ['test-campaign', {
                    type: 'roll',
                    characterName: 'TestHero',
                    rollType: 'damage',
                    name: 'Reaction Strike Damage',
                    targetName: 'Enemy',
                    damageType: 'Necrotic',
                    total: 5,
                    formula: '2d6',
                    rolls: [3, 2],
                    description: 'Reaction Strike dealt 5 Necrotic damage to Enemy.',
                }],
            ]);
            expect(applyDamageToTarget.mock.calls).toEqual([[
                cs, 'Enemy', 5, ['Necrotic'],
                { campaignName: 'test-campaign', characters: [], ignoreResistance: false, attackerName: 'TestHero' },
            ]]);
            expect(setRuntimeValue.mock.calls).toEqual([]);
        });

        it('skips the damage apply when no combat context exists (roll still logged, error surfaced)', async () => {
            const action = saveAction({ damageExpression: '2d6' });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await handle(action, makePlayerStats(), 'test-campaign', null);
            getCombatContext.mockResolvedValue(null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));
            await flush();

            expect(rollExpression.mock.calls).toEqual([['2d6']]);
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ rollType: 'damage' }));
            expect(applyDamageToTarget.mock.calls).toEqual([]);
            expect(errSpy).toHaveBeenCalledWith(
                '[reactionDamage] No combat context — damage not applied:',
                { actionName: 'Reaction Strike', targetName: 'Enemy' });
            errSpy.mockRestore();
        });

        // CANONICAL (shed from handOfHarm.test.js — do not trim). Merged the
        // former 'does not apply damage' + 'does not apply targetEffects'
        // success tests: one branch, union of pins.
        it('applies zero damage and zero targetEffects when the save succeeds', async () => {
            const action = saveAction({ damageExpression: '2d6', alsoInflicts: 'frightened' });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            getCombatContext.mockResolvedValue({ creatures: [] });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: true },
            }));
            await flush();

            expect(rollExpression.mock.calls).toEqual([]);
            expect(applyDamageToTarget.mock.calls).toEqual([]);
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls.length).toBe(1); // commit row only
        });

        it('applies nothing on save failure when damageExpression is missing', async () => {
            const action = saveAction();
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            getCombatContext.mockResolvedValue({ creatures: [] });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));
            await flush();

            expect(rollExpression.mock.calls).toEqual([]);
            expect(applyDamageToTarget.mock.calls).toEqual([]);
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls.length).toBe(1); // commit row only
        });

        it('appends the full targetEffect row and a condition log on save failure when alsoInflicts exists', async () => {
            const action = saveAction({ alsoInflicts: 'frightened' });
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            getRuntimeValue.mockImplementation((_key, propertyName) =>
                propertyName === 'targetEffects' ? [] : undefined);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));
            await flush();

            expect(setRuntimeValue.mock.calls).toEqual([[
                'campaign', 'targetEffects', [{
                    target: 'Enemy',
                    source: 'Reaction Strike',
                    option: 'frightened',
                    effect: 'frightened',
                    duration: 'until_used',
                }], 'test-campaign',
            ]]);
            expect(addEntry.mock.calls).toEqual([
                ['test-campaign', expect.objectContaining({ type: 'ability_use' })],
                ['test-campaign', {
                    type: 'condition',
                    characterName: 'Enemy',
                    action: 'applied',
                    condition: 'Disadvantage on next attack roll',
                    reason: "TestHero's Reaction Strike (failed saving throw)",
                    timestamp: FROZEN_NOW,
                }],
            ]);
        });

        // applyFailPhysiciansTouch reads activeConditions WITHOUT a campaign arg —
        // mock keyed by propertyName so the branch is exercised honestly.
        it('inflicts poisoned on the holder\'s Physicians\' Touch rider when the save fails', async () => {
            const action = saveAction();
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            getRuntimeValue.mockImplementation((_key, propertyName) =>
                propertyName === 'activeConditions' ? [] : undefined);
            const ps = makePlayerStats({ specialActions: [{ name: "Physician's Touch" }] });

            await handle(action, ps, 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));
            await flush();

            expect(setRuntimeValue.mock.calls).toEqual([[
                'Enemy', 'activeConditions', ['poisoned'], 'test-campaign',
            ]]);
            expect(applyDamageToTarget.mock.calls).toEqual([]);
        });

        it('writes nothing when the target is already poisoned (dedup guard)', async () => {
            const action = saveAction();
            resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
            getRuntimeValue.mockImplementation((_key, propertyName) =>
                propertyName === 'activeConditions' ? ['poisoned'] : undefined);
            const ps = makePlayerStats({ specialActions: [{ name: "Physician's Touch" }] });

            await handle(action, ps, 'test-campaign', null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));
            await flush();

            expect(setRuntimeValue.mock.calls).toEqual([]);
        });
    });
});
