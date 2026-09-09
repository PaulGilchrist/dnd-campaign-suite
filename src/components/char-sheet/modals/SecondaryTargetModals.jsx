import React, { useEffect, useState } from 'react';
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
        sweepingAttackTargetModal,
        baitAndSwitchChoiceModal,
        commanderStrikeChoiceModal,
        rallyChoiceModal,
        tricksterBlessingModal,
        bardicInspirationTargetModal,
        inspiringMovementAllyModal,
        oceanicGiftTargetModal,
        destructiveStrideTargetModal,
        starryChaliceHealModal,
    } = mergedModalState;

    const [oceanicDouble, setOceanicDouble] = useState(false);

    useEffect(() => {
        if (!oceanicGiftTargetModal) {
            setOceanicDouble(false);
        }
    }, [oceanicGiftTargetModal]);

    const oceanicIsDouble = oceanicDouble || !!oceanicGiftTargetModal?.doubleEmanation;

    if (!sweepingAttackTargetModal && !baitAndSwitchChoiceModal && !commanderStrikeChoiceModal && !rallyChoiceModal && !tricksterBlessingModal && !bardicInspirationTargetModal && !inspiringMovementAllyModal && !oceanicGiftTargetModal && !destructiveStrideTargetModal && !starryChaliceHealModal) {
        return null;
    }

    return (
        <>
            {sweepingAttackTargetModal && (
                <SecondaryTargetModal
                    title="Sweeping Attack"
                    targets={sweepingAttackTargetModal.secondaryTargets}
                    description={`Choose a creature within 5 feet of ${sweepingAttackTargetModal.primaryTarget || sweepingAttackTargetModal.targetName || 'the original target'} to take ${sweepingAttackTargetModal.dieValue} damage:`}
                    onTargetSelected={(targetName) => handleSweepingAttackConfirm(targetName, sweepingAttackTargetModal)}
                    onSkip={() => setModalState({ sweepingAttackTargetModal: null })}
                    confirmLabel="Apply Sweeping Attack"
                    confirmIcon="fa-bolt"
                    showSize={true}
                />
            )}
            {baitAndSwitchChoiceModal && (
                <SecondaryTargetModal
                    title="Bait and Switch — AC Bonus"
                    targets={baitAndSwitchChoiceModal.options}
                    description={baitAndSwitchChoiceModal.description}
                    onTargetSelected={(targetName) => handleBaitAndSwitchChoiceConfirm(targetName, baitAndSwitchChoiceModal)}
                    onSkip={() => setModalState({ baitAndSwitchChoiceModal: null })}
                    confirmLabel="Apply AC Bonus"
                    confirmIcon="fa-check"
                />
            )}
            {commanderStrikeChoiceModal && (
                <SecondaryTargetModal
                    title="Commander's Strike — Ally Attack"
                    targets={commanderStrikeChoiceModal.options}
                    description={commanderStrikeChoiceModal.description}
                    onTargetSelected={(targetName) => handleCommanderStrikeChoiceConfirm(targetName, commanderStrikeChoiceModal)}
                    onSkip={() => setModalState({ commanderStrikeChoiceModal: null })}
                    confirmLabel="Grant Attack"
                    confirmIcon="fa-check"
                />
            )}
            {rallyChoiceModal && (
                <SecondaryTargetModal
                    title="Rally"
                    targets={rallyChoiceModal.allyOptions}
                    description={rallyChoiceModal.description}
                    onTargetSelected={(targetName) => handleRallyChoiceConfirm(targetName, rallyChoiceModal)}
                    onSkip={() => setModalState({ rallyChoiceModal: null })}
                    confirmLabel="Grant Temp HP"
                    confirmIcon="fa-heart"
                />
            )}
            {tricksterBlessingModal && (
                <SecondaryTargetModal
                    title="Blessing of the Trickster — Choose Target"
                    targets={tricksterBlessingModal.creatureTargets}
                    confirmLabel="Grant Blessing"
                    confirmIcon="fa-hands"
                    showHp={false}
                    onTargetSelected={handleTricksterBlessingConfirm}
                    onSkip={() => handleTricksterBlessingConfirm(null)}
                />
            )}
            {bardicInspirationTargetModal && (
                <SecondaryTargetModal
                    title="Bardic Inspiration — Choose Target"
                    targets={bardicInspirationTargetModal.creatureTargets}
                    confirmLabel="Grant Inspiration"
                    confirmIcon="fa-music"
                    description={`Grant a Bardic Inspiration die (d${bardicInspirationTargetModal.dieSize}) to the target. The creature can roll it on one ability check.`}
                    showHp={false}
                    onTargetSelected={handleBardicInspirationConfirm}
                    onSkip={() => handleBardicInspirationConfirm(null)}
                />
            )}
            {inspiringMovementAllyModal && (
                <SecondaryTargetModal
                    title="Inspiring Movement — Choose Ally"
                    targets={inspiringMovementAllyModal.creatureTargets}
                    confirmLabel="Move"
                    confirmIcon="fa-person-walking"
                    featureDescription="Both you and the chosen ally move up to half your Speeds without provoking Opportunity Attacks."
                    onTargetSelected={handleInspiringMovementConfirm}
                    onSkip={() => handleInspiringMovementConfirm(null)}
                />
            )}
            {oceanicGiftTargetModal && (
                <SecondaryTargetModal
                    title={oceanicIsDouble ? "Oceanic Gift — Choose Ally (Self + Ally, 2 Wild Shape)" : "Oceanic Gift — Choose Ally"}
                    targets={oceanicGiftTargetModal.creatureTargets}
                    confirmLabel="Grant Wrath of the Sea"
                    confirmIcon="fa-water"
                    featureDescription={oceanicIsDouble
                        ? "Manifest the Emanation around both yourself and the chosen ally. Costs 2 Wild Shape uses."
                        : "Manifest the Emanation around one willing creature within 60 feet. Costs 1 Wild Shape."
                    }
                    variantLabel={!oceanicGiftTargetModal.doubleEmanation ? "Manifest around Self + Ally (costs 2 Wild Shape uses)" : undefined}
                    variantChecked={oceanicDouble}
                    onVariantChange={setOceanicDouble}
                    variantDisabled={(oceanicGiftTargetModal.availableUses ?? 0) < 2}
                    onTargetSelected={(targetName) => handleOceanicGiftConfirm(targetName, oceanicIsDouble)}
                    onSkip={() => handleOceanicGiftConfirm(null)}
                />
            )}
            {destructiveStrideTargetModal && (
                <SecondaryTargetModal
                    title="Destructive Stride — Choose Target"
                    targets={destructiveStrideTargetModal.targets || []}
                    confirmLabel="Deal Damage"
                    confirmIcon="fa-person-running"
                    description="Choose a creature only if the monk comes within 5 ft. of them while striding."
                    showHp={true}
                    onTargetSelected={handleDestructiveStrideTargetConfirm}
                    onSkip={handleDestructiveStrideTargetSkip}
                />
            )}
            {starryChaliceHealModal && (
                <SecondaryTargetModal
                    title="Starry Form: Chalice"
                    targets={starryChaliceHealModal.targetNames.map(name => ({ name, type: 'creature' }))}
                    onTargetSelected={handleStarryChaliceConfirm}
                    onSkip={() => setModalState({ starryChaliceHealModal: null })}
                    description="Choose a creature within 30 feet to regain hit points from the Chalice constellation."
                    confirmLabel="Heal"
                    confirmIcon="fa-heart"
                    showHp={true}
                />
            )}
        </>
    );
}
