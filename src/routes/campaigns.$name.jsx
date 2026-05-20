import { Outlet, useParams } from 'react-router';

export default function CampaignLayout() {
  const { name } = useParams();
  return (
    <div className="campaign-layout">
      <Outlet />
    </div>
  );
}
