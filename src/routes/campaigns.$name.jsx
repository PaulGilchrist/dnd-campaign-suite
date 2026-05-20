import { Outlet, useParams } from 'react-router';
import { CampaignProvider } from './campaign-context';

export default function CampaignLayout() {
  const { name } = useParams();
  return (
    <CampaignProvider campaignName={name}>
      <Outlet />
    </CampaignProvider>
  );
}
