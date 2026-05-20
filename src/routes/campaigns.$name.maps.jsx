import { useParams, useNavigate } from 'react-router';
import MapsManager from '../components/maps-manager/MapsManager';

export default function MapsRoute() {
  const { name: campaignName } = useParams();
  const navigate = useNavigate();

  const handleOpenMap = (mapName) => {
    navigate(`/campaign/${campaignName}/maps/${mapName}`);
  };

  const handleBack = () => {
    navigate(`/campaign/${campaignName}`);
  };

  return (
    <MapsManager campaignName={campaignName} onOpenMap={handleOpenMap} onBack={handleBack} />
  );
}
