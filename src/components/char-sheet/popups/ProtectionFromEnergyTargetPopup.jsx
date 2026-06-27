import TargetWithTypePopup from './TargetWithTypePopup';

export default function ProtectionFromEnergyTargetPopup(props) {
  return (
    <TargetWithTypePopup
      {...props}
      icon="fa-solid fa-shield-halved"
      title="Protection from Energy"
      school="Abjuration"
      defaultLevel={3}
      description={
        <span>
          Choose a willing creature within <strong>{props.range}</strong> and a damage type.
          The target has Resistance to the chosen damage type for the duration.
        </span>
      }
      confirmLabel="Cast Protection from Energy"
    />
  );
}
