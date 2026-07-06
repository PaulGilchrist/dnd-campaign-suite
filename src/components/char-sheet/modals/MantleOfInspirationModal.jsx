import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function MantleOfInspirationModal({
    creatureTargets,
    tempHp,
    dieRoll,
    bardicDieSize,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Mantle of Inspiration"
            icon="fa-feather"
            targets={creatureTargets}
            maxTargets={maxTargets}
            description={maxTargets ? `Choose up to ${maxTargets} allies to grant temporary hit points` : 'Choose allies to grant temporary hit points'}
            note={`Rolled ${dieRoll} on 1d${bardicDieSize}: Each target gains ${tempHp} temp HP and can use their Reaction to move up to their Speed without provoking Opportunity Attacks.`}
            confirmLabel="Inspire"
            confirmIcon="fa-feather"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
