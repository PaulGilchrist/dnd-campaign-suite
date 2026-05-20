import { Navigate, useParams } from 'react-router';

export default function CampaignIndex() {
  const { name } = useParams();
  // Will redirect to first character or wizard — placeholder for now
  return <Navigate to={`/campaign/${name}/characters/placeholder`} replace />;
}
