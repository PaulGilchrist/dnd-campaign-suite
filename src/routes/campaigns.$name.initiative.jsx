import { useState } from 'react';
import Initiative from '../components/initiative/initiative';
import { useCampaign } from './campaign-context';

export default function InitiativeRoute() {
  const { characters } = useCampaign();
  const [npcs, setNpcs] = useState([]);

  return <Initiative characters={characters} onNpcsChange={setNpcs} />;
}
