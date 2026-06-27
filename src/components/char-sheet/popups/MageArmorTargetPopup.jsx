import SingleTargetPopup from './SingleTargetPopup';

export default function MageArmorTargetPopup(props) {
  return (
    <SingleTargetPopup
      {...props}
      icon="fa-solid fa-shield-halved"
      title="Mage Armor"
      school="Abjuration"
      description={
        <span>
          Choose a willing creature within <strong>{props.range}</strong> who is not wearing armor.
          Their base AC becomes 13 + Dexterity modifier for the duration.
        </span>
      }
      confirmLabel="Cast Mage Armor"
    />
  );
}
