import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function MassHealModal({
    creatureTargets,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Mass Heal"
            icon="fa-tree"
            targets={creatureTargets}
            maxTargets={maxTargets}
            description="Choose up to 10 allies to heal and remove conditions (blinded, deafened, poisoned)."
            confirmLabel="Heal"
            confirmIcon="fa-tree"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
