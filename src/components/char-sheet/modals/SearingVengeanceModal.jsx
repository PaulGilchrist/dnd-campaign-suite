import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function SearingVengeanceModal({
    creatureTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Searing Vengeance"
            icon="fa-fire"
            targets={creatureTargets}
            description="Select creatures within 30 feet to unleash radiant energy upon."
            note="Each selected creature takes 2d8 + Charisma modifier Radiant damage and is Blinded until end of your turn."
            confirmLabel="Unleash Vengeance"
            confirmIcon="fa-fire"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
