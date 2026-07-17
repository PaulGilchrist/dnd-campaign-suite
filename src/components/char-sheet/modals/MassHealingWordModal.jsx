import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function MassHealingWordModal({
    creatureTargets,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Mass Healing Word"
            icon="fa-feather"
            targets={creatureTargets}
            maxTargets={maxTargets}
            description="Choose up to 6 allies within 60 feet to heal."
            confirmLabel="Heal"
            confirmIcon="fa-feather"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
