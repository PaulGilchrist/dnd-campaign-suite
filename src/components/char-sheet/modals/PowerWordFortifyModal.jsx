import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function PowerWordFortifyModal({
    creatureTargets,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Power Word Fortify"
            icon="fa-shield"
            targets={creatureTargets}
            maxTargets={maxTargets}
            description="Choose up to 6 allies within 60 feet to grant temporary hit points."
            confirmLabel="Fortify"
            confirmIcon="fa-shield"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
