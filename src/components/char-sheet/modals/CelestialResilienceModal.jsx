import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function CelestialResilienceModal({
    creatureTargets,
    allyTempHp,
    selfTempHp,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Celestial Resilience"
            icon="fa-shield-hart"
            targets={creatureTargets}
            maxTargets={maxTargets}
            description="Choose up to 5 allies to gain temporary hit points from your Celestial Resilience."
            note={`You gain ${selfTempHp} temporary hit points. Each selected ally gains ${allyTempHp} temporary hit points.`}
            confirmLabel="Grant Resilience"
            confirmIcon="fa-shield-hart"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
