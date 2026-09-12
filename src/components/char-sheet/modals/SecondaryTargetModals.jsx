import { useEffect, useState } from 'react';
import SecondaryTargetModal from './shared/SecondaryTargetModal.jsx';

export default function SecondaryTargetModals({
    mergedModalState,
    setModalState,
    handleSweepingAttackConfirm,
    handleBaitAndSwitchChoiceConfirm,
    handleCommanderStrikeChoiceConfirm,
    handleRallyChoiceConfirm,
    handleTricksterBlessingConfirm,
    handleBardicInspirationConfirm,
    handleInspiringMovementConfirm,
    handleOceanicGiftConfirm,
    handleDestructiveStrideTargetConfirm,
    handleDestructiveStrideTargetSkip,
    handleStarryChaliceConfirm,
}) {
    const {
        oceanicGiftTargetModal,
    } = mergedModalState;

    const [oceanicDouble, setOceanicDouble] = useState(false);

    useEffect(() => {
        if (!oceanicGiftTargetModal) {
            setOceanicDouble(false);
        }
    }, [oceanicGiftTargetModal]);

    const oceanicIsDouble = oceanicDouble || !!oceanicGiftTargetModal?.doubleEmanation;

    const modalDefs = [
        {
            modalKey: 'sweepingAttackTargetModal',
            state: mergedModalState.sweepingAttackTargetModal,
            build: (state) => ({
                title: 'Sweeping Attack',
                targets: state.secondaryTargets,
                description: `Choose a creature within 5 feet of ${state.primaryTarget || state.targetName || 'the original target'} to take ${state.dieValue} damage:`,
                onTargetSelected: (targetName) => handleSweepingAttackConfirm(targetName, state),
                onSkip: () => setModalState({ sweepingAttackTargetModal: null }),
                confirmLabel: 'Apply Sweeping Attack',
                confirmIcon: 'fa-bolt',
                showSize: true,
            }),
        },
        {
            modalKey: 'baitAndSwitchChoiceModal',
            state: mergedModalState.baitAndSwitchChoiceModal,
            build: (state) => ({
                title: 'Bait and Switch — AC Bonus',
                targets: state.options,
                description: state.description,
                onTargetSelected: (targetName) => handleBaitAndSwitchChoiceConfirm(targetName, state),
                onSkip: () => setModalState({ baitAndSwitchChoiceModal: null }),
                confirmLabel: 'Apply AC Bonus',
                confirmIcon: 'fa-check',
            }),
        },
        {
            modalKey: 'commanderStrikeChoiceModal',
            state: mergedModalState.commanderStrikeChoiceModal,
            build: (state) => ({
                title: "Commander's Strike — Ally Attack",
                targets: state.options,
                description: state.description,
                onTargetSelected: (targetName) => handleCommanderStrikeChoiceConfirm(targetName, state),
                onSkip: () => setModalState({ commanderStrikeChoiceModal: null }),
                confirmLabel: 'Grant Attack',
                confirmIcon: 'fa-check',
            }),
        },
        {
            modalKey: 'rallyChoiceModal',
            state: mergedModalState.rallyChoiceModal,
            build: (state) => ({
                title: 'Rally',
                targets: state.allyOptions,
                description: state.description,
                onTargetSelected: (targetName) => handleRallyChoiceConfirm(targetName, state),
                onSkip: () => setModalState({ rallyChoiceModal: null }),
                confirmLabel: 'Grant Temp HP',
                confirmIcon: 'fa-heart',
            }),
        },
        {
            modalKey: 'tricksterBlessingModal',
            state: mergedModalState.tricksterBlessingModal,
            build: (state) => ({
                title: 'Blessing of the Trickster — Choose Target',
                targets: state.creatureTargets,
                confirmLabel: 'Grant Blessing',
                confirmIcon: 'fa-hands',
                showHp: false,
                onTargetSelected: handleTricksterBlessingConfirm,
                onSkip: () => handleTricksterBlessingConfirm(null),
            }),
        },
        {
            modalKey: 'bardicInspirationTargetModal',
            state: mergedModalState.bardicInspirationTargetModal,
            build: (state) => ({
                title: 'Bardic Inspiration — Choose Target',
                targets: state.creatureTargets,
                confirmLabel: 'Grant Inspiration',
                confirmIcon: 'fa-music',
                description: `Grant a Bardic Inspiration die (d${state.dieSize}) to the target. The creature can roll it on one ability check.`,
                showHp: false,
                onTargetSelected: handleBardicInspirationConfirm,
                onSkip: () => handleBardicInspirationConfirm(null),
            }),
        },
        {
            modalKey: 'inspiringMovementAllyModal',
            state: mergedModalState.inspiringMovementAllyModal,
            build: (state) => ({
                title: 'Inspiring Movement — Choose Ally',
                targets: state.creatureTargets,
                confirmLabel: 'Move',
                confirmIcon: 'fa-person-walking',
                featureDescription: 'Both you and the chosen ally move up to half your Speeds without provoking Opportunity Attacks.',
                onTargetSelected: handleInspiringMovementConfirm,
                onSkip: () => handleInspiringMovementConfirm(null),
            }),
        },
        {
            modalKey: 'oceanicGiftTargetModal',
            state: oceanicGiftTargetModal,
            build: (state) => ({
                title: oceanicIsDouble ? 'Oceanic Gift — Choose Ally (Self + Ally, 2 Wild Shape)' : 'Oceanic Gift — Choose Ally',
                targets: state.creatureTargets,
                confirmLabel: 'Grant Wrath of the Sea',
                confirmIcon: 'fa-water',
                featureDescription: oceanicIsDouble
                    ? 'Manifest the Emanation around both yourself and the chosen ally. Costs 2 Wild Shape uses.'
                    : 'Manifest the Emanation around one willing creature within 60 feet. Costs 1 Wild Shape.',
                variantLabel: !state.doubleEmanation ? 'Manifest around Self + Ally (costs 2 Wild Shape uses)' : undefined,
                variantChecked: oceanicDouble,
                onVariantChange: setOceanicDouble,
                variantDisabled: (state.availableUses ?? 0) < 2,
                onTargetSelected: (targetName) => handleOceanicGiftConfirm(targetName, oceanicIsDouble),
                onSkip: () => handleOceanicGiftConfirm(null),
            }),
        },
        {
            modalKey: 'destructiveStrideTargetModal',
            state: mergedModalState.destructiveStrideTargetModal,
            build: (state) => ({
                title: 'Destructive Stride — Choose Target',
                targets: state.targets || [],
                confirmLabel: 'Deal Damage',
                confirmIcon: 'fa-person-running',
                description: 'Choose a creature only if the monk comes within 5 ft. of them while striding.',
                showHp: true,
                onTargetSelected: handleDestructiveStrideTargetConfirm,
                onSkip: handleDestructiveStrideTargetSkip,
            }),
        },
        {
            modalKey: 'starryChaliceHealModal',
            state: mergedModalState.starryChaliceHealModal,
            build: (state) => ({
                title: 'Starry Form: Chalice',
                targets: state.targetNames.map(name => ({ name, type: 'creature' })),
                onTargetSelected: handleStarryChaliceConfirm,
                onSkip: () => setModalState({ starryChaliceHealModal: null }),
                description: 'Choose a creature within 30 feet to regain hit points from the Chalice constellation.',
                confirmLabel: 'Heal',
                confirmIcon: 'fa-heart',
                showHp: true,
            }),
        },
    ];

    return (
        <>
            {modalDefs.map(({ modalKey, state, build }) => {
                if (!state) return null;
                return <SecondaryTargetModal key={modalKey} {...build(state)} />;
            })}
        </>
    );
}
