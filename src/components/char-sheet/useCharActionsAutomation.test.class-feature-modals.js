// @maintained-by-ai
// Modal-open dispatch lane for useCharActionsAutomation's internal modalMap
// (handleAutomationAction → setModalState). Owns the modalName → stateKey
// routing table for class-feature / lineage / target / teleport routes.
// NOT covered here (owned by sibling lanes in this folder):
//   - simpleModal routes for resource/healing modals: useCharActionsAutomation.test.resource-modals.js
//   - summoning/creature routes:                      useCharActionsAutomation.test.summon-modals.js
//   - condition/target routes + enriched-payload handlers (elementalAffinity,
//     fiendishResilience, breathWeaponShape, celestialResilienceModal):
//     useCharActionsAutomation.test.condition-modals.js
//   - popup/roll/attack_roll/notify result dispatch: useCharActionsAutomation.test.result-types.js
//   - CLA-053 telepathicSpeech confirm producer chain (onTargetSelected/onSkip
//     modal clear incl.): useCharActionsAutomation.test.telepathic-speech.js
//   - handleDivineInterventionCast half:              useCharActionsAutomation.test.divine-intervention.js
//   - trigger/stunning-strike/fleet gates: cla143-gate, stunning-strike, fleetStep tests
import { describe, it, expect } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, setupBeforeEach } from './useCharActionsAutomation.test.setup.js';

// Real modules load cleanly in jsdom (proven by test.telepathic-speech.js);
// no handler mocks needed — no test in this file invokes a modal callback
// except the divineIntervention routing, which only opens the modal.

describe('useCharActionsAutomation', () => {
    setupBeforeEach();

    describe('handleAutomationAction - simpleModal routing (payload passthrough)', () => {
        // One row per distinct modalMap routing decision owned by this lane:
        // modalName dispatched by executeHandler → exact stateKey opened.
        // Locks the table so an unregistered chooser (CLA-384/CLA-379/MN-016
        // class of bug: modal result silently dropped) fails loudly here.
        const ROUTES = [
            // class features
            ['combatStance', 'combatStanceModal'],
            ['invokeDuplicity', 'invokeDuplicityModal'],
            ['saveAttackHeal', 'saveAttackHealModal'],
            ['saveAttackAoe', 'saveAttackAoeModal'],
            ['warpingImplosion', 'warpingImplosionModal'], // CLA-384
            ['wildMagicSurge', 'wildMagicSurgeModal'],
            ['weaponMasteryChoice', 'weaponMasteryChoiceModal'],
            ['bendFateChoice', 'bendFateModal'],
            ['thirdEye', 'thirdEyeModal'],
            ['soulstitchSpells', 'soulstitchSpellsModal'],
            ['illusoryReality', 'illusoryRealityModal'],
            ['sacredWeaponDamageType', 'sacredWeaponModal'],
            ['flurryOfBlows', 'flurryOfBlowsModal'],
            ['elementalEpitome', 'epitomeModal'],
            ['destructiveStride', 'destructiveStrideModal'],
            ['destructiveStrideTarget', 'destructiveStrideTargetModal'],
            ['combatSuperiority', 'combatSuperiorityModal'],
            ['revelationInFlesh', 'revelationInFleshModal'],
            ['bastionOfLaw', 'bastionOfLawModal'],
            ['twinklingConstellation', 'twinklingConstellationModal'],
            ['mistyWanderer', 'mistyWandererModal'],
            ['warBondSummon', 'warBondSummonModal'], // CLA-379
            ['telekineticMovement', 'telekineticMovementModal'],
            ['bonusActionChoice', 'bonusActionChoiceModal'],
            // lineage
            ['elfishLineage', 'elfishLineageModal'],
            ['gnomishLineage', 'gnomishLineageModal'],
            ['fiendishLegacy', 'fiendishLegacyModal'],
            ['giantAncestry', 'giantAncestryModal'],
            // target selection
            ['sweepingAttackTarget', 'sweepingAttackTargetModal'],
            ['baitAndSwitchChoice', 'baitAndSwitchChoiceModal'],
            ['rallyChoice', 'rallyChoiceModal'], // MN-016
            ['bulwarkOfForceTarget', 'bulwarkOfForceModal'],
            ['zealousPresenceTarget', 'zealousPresenceModal'],
            ['naturesSanctuaryCreatures', 'naturesSanctuaryCreaturesModal'],
            ['coronaEnemySelection', 'coronaEnemySelectionModal'],
            ['radianceOfDawn', 'radianceOfDawnModal'],
            ['mantleOfInspirationTarget', 'mantleOfInspirationTarget'],
            ['vitalityOfTheTreeTarget', 'vitalityOfTheTreeTarget'],
            ['tricksterBlessing', 'tricksterBlessingModal'],
            ['bardicInspirationTarget', 'bardicInspirationTargetModal'],
            ['inspiringMovementAlly', 'inspiringMovementAllyModal'],
            ['oceanicGiftTarget', 'oceanicGiftTargetModal'],
            ['stepsOfTheFeyTaunt', 'stepsOfTheFeyTauntModal'],
            ['psychicWhispersTarget', 'psychicWhispersModal'],
            // teleport & special
            ['teleport', 'teleportModal'],
            ['starryFormConstellation', 'starryFormConstellationModal'],
            ['clockworkCavalcade', 'clockworkCavalcadeModal'],
        ];

        it.each(ROUTES)('%s opens %s with payload passthrough', async (modalName, stateKey) => {
            const hooks = createHooks();
            const payload = { probe: modalName };
            hooks.executeHandler.mockResolvedValue({ type: 'modal', modalName, payload });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            await handleAutomationAction({ name: 'TestAction', automation: {} });

            expect(hooks.setModalState).toHaveBeenCalledTimes(1);
            expect(hooks.setModalState).toHaveBeenCalledWith({ [stateKey]: payload });
        });

        it('drops a modal result whose modalName has no registered route', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'totallyUnregisteredModal',
                payload: { probe: 1 },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            await handleAutomationAction({ name: 'TestAction', automation: {} });

            expect(hooks.setModalState).not.toHaveBeenCalled();
        });
    });

    describe('handleAutomationAction - divineIntervention routing', () => {
        it('stashes the clicked action by identity alongside the modal payload', async () => {
            const hooks = createHooks();
            const action = { name: 'Divine Intervention' };
            const payload = { options: ['smite', 'teleport'] };
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'divineIntervention',
                payload,
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledTimes(1);
            const state = hooks.setModalState.mock.calls[0][0];
            expect(state.divineInterventionModal).toBe(payload);
            // Identity (not deep-equal): the stashed action must be the exact
            // object the row was clicked with — handleDivineInterventionCast
            // later reads it back (test.divine-intervention.js owns that half).
            expect(state.divineInterventionAction).toBe(action);
        });
    });

    describe('handleAutomationAction - telepathicSpeech modal telemetry', () => {
        // CLA-053 confirm producer chain + onSkip inertness are pinned by
        // test.telepathic-speech.js; this lane pins the picker telemetry only.
        it('builds secondaryTargetModal telemetry from the payload', async () => {
            const hooks = createHooks(); // base stats: level 5, Charisma bonus 0
            const targets = ['goblin1', 'goblin2'];
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'telepathicSpeech',
                payload: { action: { name: 'Awakened Mind' }, creatureTargets: targets },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            await handleAutomationAction({ name: 'TestAction', automation: {} });

            expect(hooks.setModalState).toHaveBeenCalledTimes(1);
            const picker = hooks.setModalState.mock.calls[0][0].secondaryTargetModal;
            expect(picker).toEqual(expect.objectContaining({
                title: 'Awakened Mind',
                icon: 'fa-brain',
                targets,
                confirmLabel: 'Establish Link',
                confirmIcon: 'fa-brain',
                description: 'Choose one creature within 30 feet to communicate with telepathically.',
                // Derived from playerStats: max(1, Cha bonus)=1 mile, level 5 → 5 min
                featureDescription: 'Range: 1 mile(s) | Duration: 5 minute(s)',
            }));
            expect(typeof picker.onTargetSelected).toBe('function');
            expect(typeof picker.onSkip).toBe('function');
        });

        it('falls back to default title when payload action has no name', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'telepathicSpeech',
                payload: { action: { name: '' }, creatureTargets: ['goblin1'] },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            await handleAutomationAction({ name: 'TestAction', automation: {} });

            const picker = hooks.setModalState.mock.calls[0][0].secondaryTargetModal;
            expect(picker.title).toBe('Telepathic Speech');
        });
    });
});
