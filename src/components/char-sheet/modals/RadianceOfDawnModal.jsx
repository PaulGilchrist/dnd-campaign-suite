import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

export default function RadianceOfDawnModal({
    creatureTargets,
    saveType,
    saveDc,
    damageExpression,
    damageType,
    rangeFeet,
    onConfirm,
    onSkip,
}) {
    return (
        <CreatureSelectionModal
            title="Radiance of the Dawn"
            icon="fa-sun"
            targets={creatureTargets}
            description={`Select creatures within ${rangeFeet} feet. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
            note={`On a failed save, target takes ${damageExpression} ${damageType} damage. On a successful save, target takes half damage.`}
            confirmLabel="Channel Divinity"
            confirmIcon="fa-sun"
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}
