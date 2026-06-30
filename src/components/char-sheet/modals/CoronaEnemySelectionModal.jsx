import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function CoronaEnemySelectionModal({
    creatureTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Corona of Light"
            icon="fa-sun"
            targets={creatureTargets}
            description="Select which creatures are enemies of the caster. Enemies in the bright light have Disadvantage on saving throws against Fire and Radiant damage:"
            confirmLabel="Activate Corona"
            confirmIcon="fa-sun"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
