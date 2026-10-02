import { describe, it, expect, vi } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, setupBeforeEach } from './useCharActionsAutomation.test.setup.js';

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    handle: vi.fn(),
    onSpellSelected: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
    executeSpellCast: vi.fn(),
}));

// CLA-053: telepathicSpeech onTargetSelected now chains the real confirm producer;
// this file pins modal-map plumbing only — stub the confirm service (§45).
vi.mock('../../services/automation/handlers/buffs/buffHandler.js', () => ({
    confirmTelepathicSpeech: vi.fn(() => Promise.resolve({ type: 'popup', payload: { type: 'automation_info', name: 'Stub', description: '' } })),
    handle: vi.fn(),
}));

describe('useCharActionsAutomation', () => {
    setupBeforeEach();

    describe('handleAutomationAction - class feature modals', () => {
        it('should handle combatStance modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'combatStance',
                payload: { stance: 'berserker' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ combatStanceModal: { stance: 'berserker' } });
        });

        it('should handle invokeDuplicity modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'invokeDuplicity',
                payload: { count: 2 },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ invokeDuplicityModal: { count: 2 } });
        });

        it('should handle saveAttackHeal modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'saveAttackHeal',
                payload: { healAmount: 5 },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ saveAttackHealModal: { healAmount: 5 } });
        });

        it('should handle saveAttackAoe modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'saveAttackAoe',
                payload: { radius: 15 },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ saveAttackAoeModal: { radius: 15 } });
        });

        it('should handle wildMagicSurge modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'wildMagicSurge',
                payload: { surge: 'teleport' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ wildMagicSurgeModal: { surge: 'teleport' } });
        });

        it('should handle weaponMasteryChoice modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'weaponMasteryChoice',
                payload: { choice: 'push' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ weaponMasteryChoiceModal: { choice: 'push' } });
        });

        it('should handle bendFateChoice modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'bendFateChoice',
                payload: { option: 'reroll' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ bendFateModal: { option: 'reroll' } });
        });

        it('should handle thirdEye modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'thirdEye',
                payload: { vision: 'truesight' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ thirdEyeModal: { vision: 'truesight' } });
        });

        it('should handle soulstitchSpells modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'soulstitchSpells',
                payload: { spell: 'magicMissile' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ soulstitchSpellsModal: { spell: 'magicMissile' } });
        });

        it('should handle illusoryReality modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'illusoryReality',
                payload: { effect: 'healing' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ illusoryRealityModal: { effect: 'healing' } });
        });

        it('should handle sacredWeaponDamageType modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'sacredWeaponDamageType',
                payload: { type: 'radiant' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ sacredWeaponModal: { type: 'radiant' } });
        });

        it('should handle flurryOfBlows modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'flurryOfBlows',
                payload: { strikes: 3 },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: { strikes: 3 } });
        });

        it('should handle elementalEpitome modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'elementalEpitome',
                payload: { element: 'fire' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ epitomeModal: { element: 'fire' } });
        });

        it('should handle destructiveStride modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'destructiveStride',
                payload: { effect: 'knockdown' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ destructiveStrideModal: { effect: 'knockdown' } });
        });

        it('should handle destructiveStrideTarget modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'destructiveStrideTarget',
                payload: { target: 'enemy5' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ destructiveStrideTargetModal: { target: 'enemy5' } });
        });

        it('should handle combatSuperiority modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'combatSuperiority',
                payload: { maneuver: 'precisionAttack' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ combatSuperiorityModal: { maneuver: 'precisionAttack' } });
        });

        it('should handle revelationInFlesh modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'revelationInFlesh',
                payload: { form: 'dragon' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ revelationInFleshModal: { form: 'dragon' } });
        });

        it('should handle bastionOfLaw modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'bastionOfLaw',
                payload: { effect: 'lawful' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ bastionOfLawModal: { effect: 'lawful' } });
        });

        it('should handle twinklingConstellation modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'twinklingConstellation',
                payload: { effect: 'shield' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ twinklingConstellationModal: { effect: 'shield' } });
        });

        it('should handle mistyWanderer modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'mistyWanderer',
                payload: { location: 'shadow' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ mistyWandererModal: { location: 'shadow' } });
        });

        it('should handle bonusActionChoice modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'bonusActionChoice',
                payload: { choices: ['attack', 'dash'] },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ bonusActionChoiceModal: { choices: ['attack', 'dash'] } });
        });

        it('should handle divineIntervention modal with action reference', async () => {
            const hooks = createHooks();
            const action = { name: 'Divine Intervention' };
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'divineIntervention',
                payload: { options: ['smite', 'teleport'] },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({
                divineInterventionAction: action,
                divineInterventionModal: { options: ['smite', 'teleport'] },
            });
        });
    });

    describe('handleAutomationAction - lineage modals', () => {
        it('should handle elfishLineage modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'elfishLineage',
                payload: { trait: 'feyIntuition' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ elfishLineageModal: { trait: 'feyIntuition' } });
        });

        it('should handle gnomishLineage modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'gnomishLineage',
                payload: { trait: 'magicSensitive' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ gnomishLineageModal: { trait: 'magicSensitive' } });
        });

        it('should handle fiendishLegacy modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'fiendishLegacy',
                payload: { trait: 'hellishResistance' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ fiendishLegacyModal: { trait: 'hellishResistance' } });
        });

        it('should handle giantAncestry modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'giantAncestry',
                payload: { giantType: 'fire' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ giantAncestryModal: { giantType: 'fire' } });
        });
    });

    describe('handleAutomationAction - target selection modals', () => {
        it('should handle sweepingAttackTarget modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'sweepingAttackTarget',
                payload: { target: 'enemy2' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ sweepingAttackTargetModal: { target: 'enemy2' } });
        });

        it('should handle baitAndSwitchChoice modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'baitAndSwitchChoice',
                payload: { choice: 'switch' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ baitAndSwitchChoiceModal: { choice: 'switch' } });
        });

        it('should handle rallyChoice modal (MN-016)', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'rallyChoice',
                payload: { dieValue: 7, totalHp: 16, allyOptions: [{ label: 'HexWarlock', value: 'HexWarlock' }] },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Rally', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ rallyChoiceModal: { dieValue: 7, totalHp: 16, allyOptions: [{ label: 'HexWarlock', value: 'HexWarlock' }] } });
        });

        it('should handle bulwarkOfForce modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'bulwarkOfForceTarget',
                payload: { target: 'ally1' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ bulwarkOfForceModal: { target: 'ally1' } });
        });

        it('should handle zealousPresenceTarget modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'zealousPresenceTarget',
                payload: { target: 'ally2' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ zealousPresenceModal: { target: 'ally2' } });
        });

        it('should handle naturesSanctuaryCreatures modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'naturesSanctuaryCreatures',
                payload: { creature: 'goblin1' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ naturesSanctuaryCreaturesModal: { creature: 'goblin1' } });
        });

        it('should handle coronaEnemySelection modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'coronaEnemySelection',
                payload: { enemy: 'darkLord' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ coronaEnemySelectionModal: { enemy: 'darkLord' } });
        });

        it('should handle radianceOfDawn modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'radianceOfDawn',
                payload: { radius: 15 },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ radianceOfDawnModal: { radius: 15 } });
        });

        it('should handle mantleOfInspirationTarget modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'mantleOfInspirationTarget',
                payload: { target: 'ally3' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ mantleOfInspirationTarget: { target: 'ally3' } });
        });

        it('should handle vitalityOfTheTreeTarget modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'vitalityOfTheTreeTarget',
                payload: { target: 'ally4' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ vitalityOfTheTreeTarget: { target: 'ally4' } });
        });

        it('should handle tricksterBlessing modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'tricksterBlessing',
                payload: { blessing: 'speed' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ tricksterBlessingModal: { blessing: 'speed' } });
        });

        it('should handle bardicInspirationTarget modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'bardicInspirationTarget',
                payload: { target: 'ally5' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ bardicInspirationTargetModal: { target: 'ally5' } });
        });

        it('should handle inspiringMovementAlly modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'inspiringMovementAlly',
                payload: { ally: 'paladin' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ inspiringMovementAllyModal: { ally: 'paladin' } });
        });

        it('should handle oceanicGiftTarget modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'oceanicGiftTarget',
                payload: { target: 'ally6' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ oceanicGiftTargetModal: { target: 'ally6' } });
        });

        it('should handle stepsOfTheFeyTaunt modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'stepsOfTheFeyTaunt',
                payload: { target: 'goblin3' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ stepsOfTheFeyTauntModal: { target: 'goblin3' } });
        });
    });

    describe('handleAutomationAction - teleport and special modals', () => {
        it('should handle teleport modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'teleport',
                payload: { destination: 'room2' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ teleportModal: { destination: 'room2' } });
        });

        it('should handle starryFormConstellation modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'starryFormConstellation',
                payload: { shape: 'arrow' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ starryFormConstellationModal: { shape: 'arrow' } });
        });

        it('should handle clockworkCavalcade modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'clockworkCavalcade',
                payload: { effect: 'dispel' },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({ clockworkCavalcadeModal: { effect: 'dispel' } });
        });
    });

    describe('handleAutomationAction - telepathicSpeech', () => {
        it('should set secondaryTargetModal with correct structure', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'telepathicSpeech',
                payload: {
                    action: { name: 'Telepathic Speech' },
                    creatureTargets: ['goblin1', 'goblin2'],
                },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith(expect.objectContaining({
                secondaryTargetModal: expect.objectContaining({
                    title: 'Telepathic Speech',
                    icon: 'fa-brain',
                    targets: ['goblin1', 'goblin2'],
                    confirmLabel: 'Establish Link',
                    confirmIcon: 'fa-brain',
                    description: 'Choose one creature within 30 feet to communicate with telepathically.',
                }),
            }));
            const callArgs = hooks.setModalState.mock.calls[0][0];
            expect(typeof callArgs.secondaryTargetModal.onTargetSelected).toBe('function');
            expect(typeof callArgs.secondaryTargetModal.onSkip).toBe('function');
        });

        it('should use action name from payload when setting secondaryTargetModal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'telepathicSpeech',
                payload: {
                    action: { name: 'Custom Action Name' },
                    creatureTargets: ['goblin1'],
                },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            const callArgs = hooks.setModalState.mock.calls[0][0];
            expect(callArgs.secondaryTargetModal.title).toBe('Custom Action Name');
        });

        it('should call onTargetSelected callback to clear modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'telepathicSpeech',
                payload: {
                    action: { name: 'Telepathic Speech' },
                    creatureTargets: ['goblin1'],
                },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            const callArgs = hooks.setModalState.mock.calls[0][0];
            await callArgs.secondaryTargetModal.onTargetSelected('goblin1');

            expect(hooks.setModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
        });

        it('should call onSkip callback to clear modal', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'telepathicSpeech',
                payload: {
                    action: { name: 'Telepathic Speech' },
                    creatureTargets: ['goblin1'],
                },
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: {} };
            await handleAutomationAction(action);

            const callArgs = hooks.setModalState.mock.calls[0][0];
            callArgs.secondaryTargetModal.onSkip();

            expect(hooks.setModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
        });
    });
});
