import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function AllySelectionModal({
    creatureTargets,
    defaultSelected,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Select Allies"
            icon="fa-shield-halved"
            targets={creatureTargets}
            description="Select which creatures are allies. Allies receive aura benefits."
            confirmLabel="Confirm Allies"
            confirmIcon="fa-shield-halved"
            defaultSelected={defaultSelected}
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
