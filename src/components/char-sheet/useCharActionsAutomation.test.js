// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';

// OWNERSHIP (trimmed 2026-10-17): this file owns the Focus Point cost lane
// (spend / depletion refusal / skip-list / FP resolution fallbacks), the
// after_casting_action_spell refusal lane (CLA-399), the damage_bonus +
// defensive_tactics feature-choice gates, handleAutomationAction robustness,
// and the handleDivineInterventionCast executeSpellCast deps seam.
// Owned elsewhere — deleted here, verified stronger at owner:
//   after_attack_action read gate → useCharActionsAutomation.cla143-gate.test.js
//   Fleet Step grant → useCharActionsAutomation.fleetStep.test.js
//   Stunning Strike gate/mark → useCharActionsAutomation.stunning-strike.test.js
//   result-type dispatch shapes (popup/roll/attack_roll/logEntries/falsy) → useCharActionsAutomation.test.result-types.js
//   modal routing → .test.resource-modals.js / .test.condition-modals.js / .test.class-feature-modals.js
//   telepathicSpeech producer → .test.telepathic-speech.js (CLA-053)
//   handleDivineInterventionCast flows → .test.divine-intervention.js
//   cannotAct / early returns → .test.early-returns.js (flagged whole-file delete by #330;
//   its versions of the FP-lane tests below are weaker — this file is the FP-lane owner).

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    onSpellSelected: vi.fn(),
    // CLA-053: the lane loads buffHandler (confirmTelepathicSpeech), whose
    // transitive chain pulls automation/index — extend the partial mock (§45).
    handle: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
    executeSpellCast: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

import { onSpellSelected as mockOnDivineInterventionSpellSelected } from '../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js';
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getClassFeatures } from '../../services/character/classFeatures.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'TestFighter',
    level: 5,
    class: { class_levels: [{ level: 5, focus_points: 2 }] },
    abilities: [
        { name: 'Strength', bonus: 4 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Wisdom', bonus: 1 },
        { name: 'Constitution', bonus: 3 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Charisma', bonus: 0 },
    ],
    skills: [],
    feats: [],
    automation: { passives: [] },
};

function makeBaseGRV(activeBuffs, focusPoints) {
    return vi.fn((charKey, key, _cn) => {
        if (key === 'activeBuffs') return activeBuffs;
        if (key === 'focusPoints') return focusPoints;
        if (key === 'lastActionSpellCast') return null;
        return undefined;
    });
}

function pick(value, fallback) {
    return value || fallback;
}

function createDeps(overrides = {}) {
    const {
        cannotAct = false,
        playerStats = basePlayerStats,
        getRuntimeValue: customGRV,
        setRuntimeValue: customSRV,
        campaignName: cn = campaignName,
        activeBuffs = [],
        focusPoints = 3,
        rollDamage: customRollDamage,
        rollAttack: customRollAttack,
        executeHandler: customExecuteHandler,
        addEntry: customAddEntry,
        setPopupHtml: customSetPopupHtml,
        setModalState: customSetModalState,
        onBuffsChange: customOnBuffsChange,
        modalState: customModalState,
        mapName: customMapName,
        characters: customCharacters,
    } = overrides;

    return {
        cannotAct,
        getRuntimeValue: pick(customGRV, makeBaseGRV(activeBuffs, focusPoints)),
        setRuntimeValue: pick(customSRV, vi.fn()),
        rollDamage: pick(customRollDamage, vi.fn()),
        rollAttack: pick(customRollAttack, vi.fn()),
        executeHandler: pick(customExecuteHandler, vi.fn().mockResolvedValue(undefined)),
        addEntry: pick(customAddEntry, vi.fn().mockResolvedValue(undefined)),
        setPopupHtml: pick(customSetPopupHtml, vi.fn()),
        setModalState: pick(customSetModalState, vi.fn()),
        modalState: pick(customModalState, {}),
        playerStats,
        campaignName: cn,
        mapName: pick(customMapName, 'test-map'),
        characters: pick(customCharacters, []),
        onBuffsChange: pick(customOnBuffsChange, vi.fn()),
    };
}

function getHandlers(deps) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCharActionsAutomation(deps);
}

describe('useCharActionsAutomation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleAutomationAction', () => {
        it('returns early without any side effects when cannotAct is true', async () => {
            const deps = createDeps({ cannotAct: true });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction({ name: 'Test Feature', automation: { type: 'test' } });

            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.executeHandler).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns the two handler functions', () => {
            const handlers = getHandlers(createDeps());

            expect(typeof handlers.handleAutomationAction).toBe('function');
            expect(typeof handlers.handleDivineInterventionCast).toBe('function');
        });
    });

    describe('feature-choice gates (damage_bonus / defensive_tactics)', () => {
        const choiceGates = [
            {
                label: 'damage_bonus',
                automation: { type: 'damage_bonus', options: ['Option A', 'Option B'] },
                options: ['Option A', 'Option B'],
                optionKey: '_Test_Feature_option',
            },
            {
                label: 'defensive_tactics',
                automation: { type: 'defensive_tactics' },
                options: ['Escape the Horde', 'Multiattack Defense'],
                optionKey: '_Test_Feature_choice',
            },
        ];

        it.each(choiceGates)('opens the featureChoice modal for $label while no choice is stored', async ({ automation, options, optionKey }) => {
            const action = { name: 'Test Feature', automation };
            const deps = createDeps();
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction(action);

            expect(deps.setModalState).toHaveBeenCalledWith({
                featureChoice: { action, options, optionKey },
            });
            expect(deps.executeHandler).not.toHaveBeenCalled();
        });

        it.each(choiceGates)('dispatches directly for $label once the choice is stored', async ({ automation, optionKey }) => {
            const action = { name: 'Test Feature', automation };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 3;
                if (key === 'lastActionSpellCast') return null;
                if (key === optionKey) return 'Option A';
                return undefined;
            });
            const deps = createDeps({ getRuntimeValue: grv });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction(action);

            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.executeHandler).toHaveBeenCalledWith(
                action, basePlayerStats, campaignName, 'test-map', []
            );
        });
    });

    describe('Focus Point cost lane (owner)', () => {
        // Mirrors MONK_KI_FEATURES in the source. 'Stunning Strike' here carries no
        // automation.trigger, so the CLA-342 gate stays inert — the armed/blocked
        // branches live in useCharActionsAutomation.stunning-strike.test.js.
        const monkActions = [
            'Flurry of Blows', 'Patient Defense', 'Step of the Wind',
            'Heightened Flurry of Blows', 'Heightened Patient Defense',
            'Heightened Step of the Wind', 'Hand of Healing', 'Stunning Strike',
        ];

        it.each(monkActions)('spends exactly 1 focus point for %s when FP is available', async (actionName) => {
            const deps = createDeps({ focusPoints: 2 });
            const action = { name: actionName, automation: {} };
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction(action);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'focusPoints', 1, campaignName
            );
        });

        // Refusal convention (§5): popup + <feature>_refused log with no_focus_points,
        // zero spend, no dispatch — ruleset wording byte-exact per lane map.
        it.each([
            { rules: '5e', wording: 'No ki points remaining.' },
            { rules: '2024', wording: 'No Focus Points remaining.' },
        ])('refuses a depleted Ki feature at FP=0 with byte-exact popup and refusal log ($rules)', async ({ rules, wording }) => {
            const playerStats = { ...basePlayerStats, rules };
            const action = { name: 'Flurry of Blows', automation: {} };
            const deps = createDeps({ getRuntimeValue: makeBaseGRV([], 0), playerStats });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction(action);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(`<b>Flurry of Blows</b><br/>${wording}`);
            expect(deps.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'automation',
                characterName: 'TestFighter',
                automationType: 'flurry_of_blows_refused',
                name: 'Flurry of Blows',
                description: `Flurry of Blows refused — no_focus_points: ${wording}`,
                timestamp: expect.any(Number),
            });
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.executeHandler).not.toHaveBeenCalled();
        });

        // CLA-159 skip list: flurry rows only, via either exemption source, at FP=0
        // (a skip must dispatch, not refuse).
        it.each([
            { name: 'Flurry of Blows', source: 'fhh' },
            { name: 'Heightened Flurry of Blows', source: 'fhh' },
            { name: 'Flurry of Blows', source: 'cloak' },
            { name: 'Heightened Flurry of Blows', source: 'cloak' },
        ])('skips FP cost for $name at FP=0 when $source exemption applies', async ({ name, source }) => {
            const playerStats = source === 'fhh'
                ? { ...basePlayerStats, specialActions: [{ name: 'Flurry of Healing and Harm' }] }
                : basePlayerStats;
            const activeBuffs = source === 'cloak' ? [{ effect: 'cloak_of_shadows' }] : [];
            const action = { name, automation: {} };
            const deps = createDeps({ getRuntimeValue: makeBaseGRV(activeBuffs, 0), playerStats });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction(action);

            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.executeHandler).toHaveBeenCalledWith(
                action, playerStats, campaignName, 'test-map', []
            );
        });

        it('does NOT skip FP cost for Patient Defense when Cloak of Shadows is active', async () => {
            const action = { name: 'Patient Defense', automation: {} };
            const deps = createDeps({ getRuntimeValue: makeBaseGRV([{ effect: 'cloak_of_shadows' }], 0) });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction(action);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                '<b>Patient Defense</b><br/>No ki points remaining.'
            );
            expect(deps.executeHandler).not.toHaveBeenCalled();
        });

        // CLA-247 / CLA-333: patientDefenseHandler and stepOfTheWindHandler are the
        // sole FP writers — the row lane never pre-spends and never blocks the
        // plain-Disengage fallback, even at FP=0. Heightened names share the type
        // guard (identical path), so one row per automation type suffices.
        it.each([
            { name: 'Patient Defense', type: 'patient_defense', focusPoints: 17 },
            { name: 'Heightened Patient Defense', type: 'patient_defense', focusPoints: 0 },
            { name: 'Step of the Wind', type: 'step_of_the_wind', focusPoints: 17 },
            { name: 'Heightened Step of the Wind', type: 'step_of_the_wind', focusPoints: 0 },
        ])('never pre-spends or blocks for $name ($type) at FP=$focusPoints', async ({ name, type, focusPoints }) => {
            const action = {
                name,
                automation: { type, cost: { resource: 'focus_points', amount: 1 } },
            };
            const deps = createDeps({ getRuntimeValue: makeBaseGRV([], focusPoints) });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction(action);

            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.executeHandler).toHaveBeenCalledWith(
                action, basePlayerStats, campaignName, 'test-map', []
            );
        });

        // CLA-159 INVERTED: the old pin "standalone Hand of Healing is free when
        // holding Flurry of Healing and Harm" was the bug — the FP-free exemption is
        // only for HoH used AS PART of Flurry, which lives in bonusAttacksHandler
        // (CLA-144/CLA-158). The standalone sheet lane always charges 1 Focus Point.
        it('spends FP for standalone Hand of Healing even when Flurry of Healing and Harm is active (CLA-159)', async () => {
            const playerStats = {
                ...basePlayerStats,
                specialActions: [{ name: 'Flurry of Healing and Harm' }],
            };
            const deps = createDeps({ getRuntimeValue: makeBaseGRV([], 2), playerStats });
            const action = { name: 'Hand of Healing', automation: {} };
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction(action);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'focusPoints', 1, campaignName
            );
            expect(deps.executeHandler).toHaveBeenCalled();
        });

        it('refuses Hand of Healing at 0 FP with refusal log and zero spend (CLA-159)', async () => {
            const playerStats = {
                ...basePlayerStats,
                rules: '2024',
                specialActions: [{ name: 'Flurry of Healing and Harm' }],
            };
            const deps = createDeps({ getRuntimeValue: makeBaseGRV([], 0), playerStats });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction({ name: 'Hand of Healing', automation: {} });

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                '<b>Hand of Healing</b><br/>No Focus Points remaining.'
            );
            expect(deps.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'automation',
                characterName: 'TestFighter',
                automationType: 'hand_of_healing_refused',
                name: 'Hand of Healing',
                description: 'Hand of Healing refused — no_focus_points: No Focus Points remaining.',
                timestamp: expect.any(Number),
            });
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.executeHandler).not.toHaveBeenCalled();
        });

        it('falls back to _trackedResources.focusPoints when stored FP is null', async () => {
            const playerStats = {
                ...basePlayerStats,
                _trackedResources: { focusPoints: { current: 1 } },
            };
            const deps = createDeps({ getRuntimeValue: makeBaseGRV([], null), playerStats });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction({ name: 'Flurry of Blows', automation: {} });

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'focusPoints', 0, campaignName
            );
        });

        it('falls back to getClassFeatures maxFocusPoints when class levels lack focus_points', async () => {
            const playerStats = { ...basePlayerStats, class: undefined, _trackedResources: undefined };
            getClassFeatures.mockReturnValueOnce({ maxFocusPoints: 2 });
            const deps = createDeps({ getRuntimeValue: makeBaseGRV([], null), playerStats });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction({ name: 'Flurry of Blows', automation: {} });

            expect(getClassFeatures).toHaveBeenCalledWith(playerStats);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'focusPoints', 1, campaignName
            );
        });

        it('dispatches exactly one focus-points-updated CustomEvent after spending', async () => {
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
            const deps = createDeps({ focusPoints: 2 });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction({ name: 'Flurry of Blows', automation: {} });

            expect(dispatchSpy).toHaveBeenCalledTimes(1);
            const event = dispatchSpy.mock.calls[0][0];
            expect(event).toBeInstanceOf(CustomEvent);
            expect(event.type).toBe('focus-points-updated');
            dispatchSpy.mockRestore();
        });
    });

    describe('after_casting_action_spell trigger lane (CLA-399 owner)', () => {
        it('proceeds and zeroes lastActionSpellCast when an action spell was cast', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 3;
                if (key === 'lastActionSpellCast') return 'Firebolt';
                return undefined;
            });
            const action = {
                name: 'War Caster',
                automation: { trigger: 'after_casting_action_spell' },
            };
            const deps = createDeps({ getRuntimeValue: grv });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction(action);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'lastActionSpellCast', 0, campaignName
            );
            expect(deps.executeHandler).toHaveBeenCalledWith(
                action, basePlayerStats, campaignName, 'test-map', []
            );
            // Positive leg dispatched, so the absence of the refusal is real gating.
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.addEntry).not.toHaveBeenCalled();
        });

        it('refuses with byte-exact popup and battle_magic_refused log when the gate fails (CLA-399)', async () => {
            const action = {
                name: 'Battle Magic',
                automation: {
                    type: 'bonus_action_attack',
                    trigger: 'after_casting_action_spell',
                    action: 'bonus_action',
                    weaponAttack: true,
                },
            };
            const deps = createDeps();
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction(action);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                '<b>Battle Magic</b><br/>You must cast a spell with a casting time of an action first.'
            );
            expect(deps.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'automation',
                characterName: 'TestFighter',
                automationType: 'battle_magic_refused',
                name: 'Battle Magic',
                description: 'Battle Magic refused — no_action_spell_cast: You must cast a spell with a casting time of an action first.',
                timestamp: expect.any(Number),
            });
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.executeHandler).not.toHaveBeenCalled();
        });

        it('skips the trigger check for an empty-string or absent trigger', async () => {
            const deps = createDeps();
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction({ name: 'Test Feature A', automation: { trigger: '' } });
            await handleAutomationAction({ name: 'Test Feature B', automation: {} });

            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.executeHandler).toHaveBeenCalledTimes(2);
        });
    });

    describe('robustness', () => {
        it('swallows addEntry rejections without failing the action', async () => {
            const executeHandler = vi.fn().mockResolvedValue({
                type: 'popup',
                payload: '<p>Done</p>',
                logEntries: [{ type: 'test' }],
            });
            const addEntry = vi.fn().mockRejectedValue(new Error('log failed'));
            const deps = createDeps({ executeHandler, addEntry });
            const { handleAutomationAction } = getHandlers(deps);

            await expect(handleAutomationAction({ name: 'Test Feature', automation: {} })).resolves.toBeUndefined();
            expect(addEntry).toHaveBeenCalled();
        });

        it.each([null, undefined])('dispatches nothing when executeHandler returns %s', async (falsyResult) => {
            const executeHandler = vi.fn().mockResolvedValue(falsyResult);
            const deps = createDeps({ executeHandler });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction({ name: 'Test Feature', automation: {} });

            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.rollDamage).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(deps.addEntry).not.toHaveBeenCalled();
        });

        it('threads campaignName as third argument when reading activeBuffs', async () => {
            const grv = vi.fn((charKey, key, cn) => {
                if (charKey === 'TestFighter' && key === 'activeBuffs' && cn === 'test-campaign') return [];
                if (key === 'focusPoints') return 3;
                if (key === 'lastActionSpellCast') return null;
                return undefined;
            });
            const deps = createDeps({ getRuntimeValue: grv });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction({ name: 'Test Feature', automation: {} });

            expect(grv).toHaveBeenCalledWith('TestFighter', 'activeBuffs', 'test-campaign');
            expect(deps.executeHandler).toHaveBeenCalled();
        });

        it('treats a non-array activeBuffs as empty and still dispatches', async () => {
            const deps = createDeps({ getRuntimeValue: makeBaseGRV(null, 3) });
            const { handleAutomationAction } = getHandlers(deps);

            await handleAutomationAction({ name: 'Test Feature', automation: {} });

            expect(deps.executeHandler).toHaveBeenCalledWith(
                { name: 'Test Feature', automation: {} }, basePlayerStats, campaignName, 'test-map', []
            );
        });
    });

    describe('handleDivineInterventionCast deps seam (flows owned by .test.divine-intervention.js)', () => {
        it('hands executeSpellCast the full deps payload, including a working getTargetInfo', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => (key === 'divineInterventionAction' ? action : undefined));
            mockOnDivineInterventionSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Fireball' },
                name: 'Divine Intervention',
                rechargeMessage: 'after a long rest',
            });
            getCombatContext.mockResolvedValue({ creatures: [] });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            executeSpellCast.mockResolvedValue({});

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(executeSpellCast).toHaveBeenCalledWith(
                { name: 'Fireball' },
                {},
                {
                    rollAttack: deps.rollAttack,
                    rollDamage: deps.rollDamage,
                    playerStats: basePlayerStats,
                    campaignName,
                    mapName: 'test-map',
                    characters: [],
                    getTargetInfo: expect.any(Function),
                }
            );

            const { getTargetInfo } = executeSpellCast.mock.calls[0][2];
            await expect(getTargetInfo()).resolves.toEqual({ name: 'Goblin' });
            expect(getCombatContext).toHaveBeenCalledWith(campaignName);
            expect(getTargetFromAttacker).toHaveBeenCalledWith({ creatures: [] }, 'TestFighter');
        });

        it('falls back to modalState.divineInterventionAction when runtime returns null', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => (key === 'divineInterventionAction' ? null : undefined));

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(mockOnDivineInterventionSpellSelected).toHaveBeenCalledWith(
                action, basePlayerStats, campaignName, { name: 'Fireball' }
            );
        });
    });
});
