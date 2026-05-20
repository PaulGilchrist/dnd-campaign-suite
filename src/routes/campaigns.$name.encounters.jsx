import { useParams } from 'react-router';
import { useCampaign } from './campaign-context';
import EncounterBuilder from '../components/encounter/EncounterBuilder';

export default function EncountersRoute() {
  const { campaignName } = useParams();
  const { characters } = useCampaign();
  return <EncounterBuilder characters={characters} campaignName={campaignName} />;
}
