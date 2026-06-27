import TargetWithTypePopup from './TargetWithTypePopup';

export default function ResistanceTargetPopup(props) {
  return (
    <TargetWithTypePopup
      {...props}
      icon="fa-solid fa-shield-halved"
      title="Resistance"
      school="Abjuration"
      defaultLevel={0}
      description={
        <span>
          Choose a willing creature within <strong>{props.range}</strong> and a damage type.
          When the target takes damage of the chosen type, it reduces the damage by 1d4.
          This can only happen once per turn.
        </span>
      }
      confirmLabel="Cast Resistance"
    />
  );
}
