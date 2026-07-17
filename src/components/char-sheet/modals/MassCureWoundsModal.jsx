import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function MassCureWoundsModal({
    creatureTargets,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Mass Cure Wounds"
            icon="fa-heart"
            targets={creatureTargets}
            maxTargets={maxTargets}
            description="Choose up to 6 allies within 30 feet to heal."
            confirmLabel="Cure"
            confirmIcon="fa-heart"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
