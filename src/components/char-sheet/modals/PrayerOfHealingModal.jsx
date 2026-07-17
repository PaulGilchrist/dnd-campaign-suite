import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function PrayerOfHealingModal({
    creatureTargets,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Prayer of Healing"
            icon="fa-hands-praying"
            targets={creatureTargets}
            maxTargets={maxTargets}
            description="Choose up to 5 allies within 30 feet to heal."
            note="Each creature can only be healed by Prayer of Healing once per long rest."
            confirmLabel="Heal"
            confirmIcon="fa-hands-praying"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
