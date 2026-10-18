// @maintained-by-ai
// Modal-open dispatch lane for useCharActionsAutomation's internal modalMap
// (handleAutomationAction → setModalState). Owns the modalName → stateKey
// routing table for condition/target routes plus the enriched-payload
// handlers (celestialResilienceModal, breathWeaponShape, fiendishResilience,
// elementalAffinity) that inject playerStats/campaignName and apply
// damageTypes defaults. Owns weaponKindMastery (cited by
// test.class-feature-modals.js).
// NOT covered here (owned by sibling lanes in this folder):
//   - class-feature/lineage/target passthrough + teleport routes: .class-feature-modals.js
//   - simpleModal resource/healing routes:                       .resource-modals.js
//   - summoning/creature routes:                                .summon-modals.js
//   - popup/roll/attack_roll/notify result dispatch:          .result-types.js
//   - telepathicSpeech confirm producer chain:                .telepathic-speech.js
//   - handleDivineInterventionCast half:                      .divine-intervention.js
import { describe, it, expect } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, setupBeforeEach } from './useCharActionsAutomation.test.setup.js';

// Real modules (divineInterventionHandler, spellCastService) load cleanly in
// jsdom — proven by test.class-feature-modals.js / test.telepathic-speech.js
// running unmocked. No test here invokes a modal confirm callback, so the
// former handler mocks were dropped.

describe('useCharActionsAutomation', () => {
    setupBeforeEach();

    describe('handleAutomationAction - condition/target modal routing (payload passthrough)', () => {
        // One row per distinct modalMap route owned by this lane: modalName
        // dispatched by executeHandler → exact stateKey opened. Locks the
        // table so an unregistered chooser silently drops its modal result
        // (CLA-384/MN-016 class of bug) and fails loudly here.
        const ROUTES = [
            ['setCondition', 'setConditionModal'],
            ['blindnessDeafness', 'blindnessDeafnessModal'],
            ['eyebiteEffect', 'eyebiteEffectModal'],
            ['attackRider', 'attackRiderModal'],
            ['openHandTechnique', 'openHandTechniqueModal'],
            ['shieldBash', 'shieldBashModal'],
            ['quiveringPalm', 'quiveringPalmModal'],
            ['aoeCondition', 'aoeConditionModal'],
            ['elementalAttunement', 'elementalAttunementModal'],
            ['hypnoticPatternShake', 'hypnoticPatternShakeModal'], // bespoke arrow fn, identical passthrough semantics
            ['moonlightStepResource', 'moonlightStepResourceModal'],
            ['moonlightStepFallback', 'moonlightStepFallbackModal'],
            ['arcaneCharge', 'arcaneChargeModal'],
            ['warMagicCantrip', 'warMagicCantripModal'],
            ['warMagicSpell', 'warMagicSpellModal'],
            ['stealthAttack', 'stealthAttackModal'],
            ['weaponKindMastery', 'weaponKindMasteryModal'], // owner of this route (cited by .class-feature-modals.js)
            ['celestialRevelation', 'celestialRevelationModal'],
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

    describe('handleAutomationAction - enriched-payload modals', () => {
        // Handlers that rebuild the modal payload: playerStats/campaignName are
        // injected from the hook's own deps (identity-checked, stronger than
        // expect.any) and payload-specific fields are pinned per row.
        const DEFAULT_FIENDISH_TYPES = [
            'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
            'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder',
        ];
        const DEFAULT_AFFINITY_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'];

        const ENRICHED_ROUTES = [
            {
                // Spread enrichment: arbitrary extra payload keys must survive.
                modalName: 'celestialResilienceModal',
                stateKey: 'celestialResilienceModal',
                payload: { resistance: 'fire', extra: 'kept' },
                expected: { resistance: 'fire', extra: 'kept' },
            },
            {
                // Rebuild: forwards only action/options — unregistered keys dropped.
                modalName: 'breathWeaponShape',
                stateKey: 'breathWeaponShapeModal',
                payload: { action: { name: 'Breath Weapon' }, options: ['cone', 'line'], unregistered: 'dropped' },
                expected: { action: { name: 'Breath Weapon' }, options: ['cone', 'line'] },
            },
            {
                modalName: 'fiendishResilience',
                stateKey: 'fiendishResilienceModal',
                payload: { action: { name: 'Fiendish Resilience' }, damageTypes: ['Fire'], existingType: 'Fire' },
                expected: { action: { name: 'Fiendish Resilience' }, damageTypes: ['Fire'], existingType: 'Fire' },
            },
            {
                // No payload damageTypes → source's 12-type default list.
                modalName: 'fiendishResilience',
                stateKey: 'fiendishResilienceModal',
                payload: { action: { name: 'Fiendish Resilience' } },
                expected: { action: { name: 'Fiendish Resilience' }, damageTypes: DEFAULT_FIENDISH_TYPES },
            },
            {
                modalName: 'elementalAffinity',
                stateKey: 'elementalAffinityModal',
                payload: { action: { name: 'Elemental Affinity' }, damageTypes: ['Fire', 'Cold'], existingType: 'Fire' },
                expected: { action: { name: 'Elemental Affinity' }, damageTypes: ['Fire', 'Cold'], existingType: 'Fire' },
            },
            {
                // No payload damageTypes → source's 5-type default list.
                modalName: 'elementalAffinity',
                stateKey: 'elementalAffinityModal',
                payload: { action: { name: 'Elemental Affinity' } },
                expected: { action: { name: 'Elemental Affinity' }, damageTypes: DEFAULT_AFFINITY_TYPES },
            },
        ];

        it.each(ENRICHED_ROUTES)(
            '%modalName enriches %stateKey with injected dependencies',
            async ({ modalName, stateKey, payload, expected }) => {
                const hooks = createHooks();
                hooks.executeHandler.mockResolvedValue({ type: 'modal', modalName, payload });
                const { handleAutomationAction } = useCharActionsAutomation(hooks);
                await handleAutomationAction({ name: 'TestAction', automation: {} });

                expect(hooks.setModalState).toHaveBeenCalledTimes(1);
                // Exact-match (not objectContaining): breathWeaponShape's
                // `unregistered` key failing to appear proves the rebuild whitelist.
                expect(hooks.setModalState).toHaveBeenCalledWith({
                    [stateKey]: {
                        ...expected,
                        playerStats: hooks.playerStats,
                        campaignName: hooks.campaignName,
                    },
                });
            }
        );
    });
});
