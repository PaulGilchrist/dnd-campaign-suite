import { useParams, useNavigate } from 'react-router';
import { useCampaign } from './campaign-context';
import CharSheet from '../components/char-sheet/CharSheet';
import useAppData from '../hooks/useAppData';

export default function CharacterSheet() {
  const { name: campaignName, charId } = useParams();
  const navigate = useNavigate();
  const { characters } = useCampaign();
  const {
    abilityScores,
    classes,
    classes2024,
    equipment,
    magicItems,
    magicItems2024,
    races,
    races2024,
    spells,
    spells2024,
  } = useAppData();

  const character = characters.find(
    (c) => c.name === charId
  );

  if (!character) {
    navigate(`/campaign/${campaignName}`);
    return null;
  }

  const onDeleteCharacter = () => {
    alert('Delete not yet implemented in route');
  };

  const onEditCharacter = () => {
    alert('Edit not yet implemented in route');
  };

  const onUploadClick = () => {
    alert('Upload not yet implemented in route');
  };

  const onSaveClick = () => {
    alert('Save not yet implemented in route');
  };

  return (
    <CharSheet
      playerSummary={character}
      abilityScores={abilityScores}
      classes={classes}
      classes2024={classes2024}
      equipment={equipment}
      magicItems={magicItems}
      magicItems2024={magicItems2024}
      races={races}
      races2024={races2024}
      spells={spells}
      spells2024={spells2024}
      onDeleteCharacter={onDeleteCharacter}
      onEditCharacter={onEditCharacter}
      onUploadClick={onUploadClick}
      onSaveClick={onSaveClick}
    />
  );
}
