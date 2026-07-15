import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function ZealousPresenceModal({
    targets,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Zealous Presence"
            icon="fa-bullseye"
            targets={targets}
            maxTargets={maxTargets}
            description="Choose creatures to grant Advantage on attack rolls and saving throws until the start of your next turn."
            confirmLabel="Grant Advantage"
            confirmIcon="fa-bullseye"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
