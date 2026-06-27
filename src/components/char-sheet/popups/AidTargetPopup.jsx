import MultiTargetCountPopup from './MultiTargetCountPopup';

export default function AidTargetPopup(props) {
  const slotLevel = props.spell?.level || 2;
  const hpIncrease = 5 + ((slotLevel - 2) * 5);

  return (
    <MultiTargetCountPopup
      {...props}
      icon="fa-solid fa-shield-halved"
      title="Aid"
      school="Abjuration"
      defaultLevel={2}
      description={
        <span>
          Choose up to <strong>{props.maxTargets}</strong> creatures within <strong>{props.range}</strong>.
          Each target's Hit Point maximum and current Hit Points increase by <strong>{hpIncrease}</strong> for the duration.
        </span>
      }
      confirmLabel="Cast Aid"
    />
  );
}
