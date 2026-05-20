import CharSheet from '../components/char-sheet/CharSheet';

export default function CharacterSheet() {
  const { charId } = useParams();
  return <CharSheet characterId={charId} />;
}
