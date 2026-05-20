import { useParams, useNavigate } from 'react-router';
import { useCampaign } from './campaign-context';
import Map from '../components/map/Map';

export default function MapRoute() {
  const { name: campaignName, mapName } = useParams();
  const navigate = useNavigate();
  const { characters, npcs } = useCampaign();
  const isLocalhost = window.location.hostname === 'localhost';

  const handleBack = () => {
    navigate(`/campaign/${campaignName}/maps`);
  };

  return (
    <Map
      campaignName={campaignName}
      characters={characters}
      npcs={npcs}
      isLocalhost={isLocalhost}
      mapName={mapName}
      onBack={handleBack}
    />
  );
}
