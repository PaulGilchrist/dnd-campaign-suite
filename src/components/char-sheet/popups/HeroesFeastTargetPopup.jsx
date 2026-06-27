import MultiTargetCountPopup from './MultiTargetCountPopup';

export default function HeroesFeastTargetPopup(props) {
  return (
    <MultiTargetCountPopup
      {...props}
      icon="fa-solid fa-utensils"
      title="Heroes' Feast"
      school="Conjuration"
      defaultLevel={6}
      description={
        <span>
          Choose up to <strong>{props.maxTargets}</strong> creatures within <strong>{props.range}</strong>.
          Each target gains <strong>11</strong> Hit Point maximum (and current HP),
          Resistance to Poison damage, and Immunity to the Frightened and Poisoned conditions for 24 hours.
        </span>
      }
      confirmLabel="Cast Heroes' Feast"
    />
  );
}
