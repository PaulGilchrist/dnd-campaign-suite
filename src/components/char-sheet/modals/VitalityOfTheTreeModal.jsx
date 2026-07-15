import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function VitalityOfTheTreeModal({
    creatureTargets,
    tempHp,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Vitality of the Tree"
            icon="fa-tree"
            targets={creatureTargets}
            maxTargets={maxTargets}
            description={`Choose up to ${maxTargets} creatures to grant temporary hit points`}
            note={`Each target gains ${tempHp} temp HP from the World Tree's life force.`}
            confirmLabel="Grant Vitality"
            confirmIcon="fa-tree"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
