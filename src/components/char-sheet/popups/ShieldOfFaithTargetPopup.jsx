import SingleTargetPopup from './SingleTargetPopup';

export default function ShieldOfFaithTargetPopup(props) {
  return (
    <SingleTargetPopup
      {...props}
      icon="fa-solid fa-shield-halved"
      title="Shield of Faith"
      school="Abjuration"
      description={
        <span>
          Choose a creature within <strong>{props.range}</strong>. A shimmering field surrounds the target, granting it a +2 bonus to AC for the duration.
        </span>
      }
      confirmLabel="Cast Shield of Faith"
    />
  );
}
