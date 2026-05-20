import { useParams } from 'react-router';
import { useNavigate } from 'react-router';
import { useCampaign } from './campaign-context';
import Notes from '../components/notes/Notes';

export default function NotesRoute() {
  const { campaignName } = useParams();
  const { characters } = useCampaign();
  const navigate = useNavigate();
  const isLocalhost = window.location.hostname === 'localhost';
  const handleBack = () => navigate(`/campaign/${campaignName}`);
  return <Notes campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} onBack={handleBack} />;
}
