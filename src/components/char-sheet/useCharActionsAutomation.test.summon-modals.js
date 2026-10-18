// @maintained-by-ai
// Summoning/creature simpleModal lane for useCharActionsAutomation's modalMap
// (handleAutomationAction → setModalState). Owns the modalName → stateKey
// routing for summon/creature choosers (animateDead, createUndead, summonSpirit,
// dragonCompanion, primalCompanion*, wildCompanion, feyReinforcements).
// NOT covered here (owned by sibling lanes in this folder):
//   - class-feature/lineage/target/teleport routes + unregistered-name drop:
//     useCharActionsAutomation.test.class-feature-modals.js
//   - resource/healing routes + fontOfMagic literal-true opener:
//     useCharActionsAutomation.test.resource-modals.js
//   - enriched-payload handlers (elementalAffinity, fiendishResilience,
//     breathWeaponShape, celestialResilienceModal):
//     useCharActionsAutomation.test.condition-modals.js
//   - popup/roll/attack_roll/notify result dispatch: useCharActionsAutomation.test.result-types.js
//   - divineIntervention identity + cast half:       useCharActionsAutomation.test.class-feature-modals.js / test.divine-intervention.js
// All eight summon routes are pure simpleModal passthroughs in the source
// (useCharActionsAutomation.js modalMap) — no enriched payloads, no confirm
// callbacks, no derived fields to pin beyond the routing table.
// Real modules load cleanly in jsdom (proven by test.telepathic-speech.js);
// vi.mock blocks for divineInterventionHandler/spellCastService deleted here
// per #546/#547/#549/#550 — no surviving test invokes a modal callback.
import { describe, it, expect } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, setupBeforeEach } from './useCharActionsAutomation.test.setup.js';

describe('useCharActionsAutomation', () => {
    setupBeforeEach();

    describe('handleAutomationAction - summoning/creature simpleModal routing', () => {
        // One row per simpleModal route owned by this lane (REC #545):
        // executeHandler dispatches {type:'modal', modalName} → setModalState
        // opens the exact stateKey with the payload passed through untouched.
        // Locks the table so an unregistered summon chooser silently dropping
        // its modal (CLA-384/MN-016 class of bug) fails loudly here.
        const ROUTES = [
            ['animateDead', 'animateDeadModal'],
            ['createUndead', 'createUndeadModal'],
            ['summonSpirit', 'summonSpiritModal'],
            ['dragonCompanion', 'dragonCompanionModal'],
            ['primalCompanionBonusActionCommand', 'primalCompanionBonusActionModal'], // stateKey drops the 'Command' suffix
            ['primalCompanionSummon', 'primalCompanionSummonModal'],
            ['wildCompanion', 'wildCompanionModal'],
            ['feyReinforcements', 'feyReinforcementsModal'],
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
    });
});
