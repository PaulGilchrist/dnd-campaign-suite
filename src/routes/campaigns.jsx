import { useNavigate } from 'react-router';
import CampaignSelection from '../components/campaign-selection/CampaignSelection';

export default function Campaigns() {
  const navigate = useNavigate();

  const handleCampaignSelect = (campaignName) => {
    navigate(`/campaign/${campaignName}`, { replace: true });
  };

  return <CampaignSelection onCampaignSelect={handleCampaignSelect} />;
}
