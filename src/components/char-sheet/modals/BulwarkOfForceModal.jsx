import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function BulwarkOfForceModal({
    targets,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Bulwark of Force"
            icon="fa-shield-halved"
            targets={targets}
            maxTargets={maxTargets}
            description="Choose allies to grant Half Cover"
            confirmLabel="Grant Half Cover"
            confirmIcon="fa-shield-halved"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
