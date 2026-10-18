// @maintained-by-ai
// Resource/healing simpleModal lane for useCharActionsAutomation's modalMap
// (handleAutomationAction → setModalState). Owns the modalName → stateKey
// routing for resource/healing choosers (healingPool, handOfHealing,
// resourcePool, arcaneWardRestore, healingIllusion, divineSpark,
// elementalBurst) plus the one payload-dropping opener in the whole map
// (fontOfMagic → literal true, source line: modalMap.fontOfMagic).
// NOT covered here (owned by sibling lanes in this folder):
//   - class-feature/lineage/target/teleport routes + unregistered-name drop:
//     useCharActionsAutomation.test.class-feature-modals.js
//   - summoning/creature routes:                      useCharActionsAutomation.test.summon-modals.js
//   - enriched-payload handlers (elementalAffinity, fiendishResilience,
//     breathWeaponShape, celestialResilienceModal):
//     useCharActionsAutomation.test.condition-modals.js
//   - popup/roll/attack_roll/notify dispatch:        useCharActionsAutomation.test.result-types.js
//   - focus-point spend refusals (FP lane):          useCharActionsAutomation.test.js
//   - divineIntervention identity + cast half:       useCharActionsAutomation.test.class-feature-modals.js / test.divine-intervention.js
// Real modules load cleanly in jsdom (proven by test.telepathic-speech.js);
// no vi.mock needed — no test here invokes a modal callback.
import { describe, it, expect } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, setupBeforeEach } from './useCharActionsAutomation.test.setup.js';

describe('useCharActionsAutomation', () => {
    setupBeforeEach();

    describe('handleAutomationAction - resource/healing simpleModal routing', () => {
        // One row per simpleModal route owned by this lane (REC #545):
        // executeHandler dispatches {type:'modal', modalName} → setModalState
        // opens the exact stateKey with the payload passed through untouched.
        // Locks the table so an unregistered chooser silently dropping a
        // resource modal (CLA-384/MN-016 class of bug) fails loudly here.
        const ROUTES = [
            ['healingPool', 'healingPoolModal'],
            ['handOfHealing', 'handOfHealingModal'],
            ['resourcePool', 'resourcePoolModal'],
            ['arcaneWardRestore', 'arcaneWardRestoreModal'],
            ['healingIllusion', 'healingIllusionModal'],
            ['divineSpark', 'divineSparkModal'],
            ['elementalBurst', 'elementalBurstModal'],
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

        it('fontOfMagic discards its payload and opens with literal true', async () => {
            // The only opener in modalMap that hardcodes `true` instead of
            // forwarding the payload — a simpleModal refactor here would turn
            // this into { fontOfMagicModal: payload } and break the consumer.
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'fontOfMagic',
                payload: { probe: 'discarded' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            await handleAutomationAction({ name: 'TestAction', automation: {} });

            expect(hooks.setModalState).toHaveBeenCalledTimes(1);
            expect(hooks.setModalState).toHaveBeenCalledWith({ fontOfMagicModal: true });
        });
    });
});
