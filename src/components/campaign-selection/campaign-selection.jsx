import { useEffect, useState } from 'react';
import { getCharacterFolders, getCharacterFiles, loadCharacters } from '../../services/campaignService';
import './campaign-selection.css';

function CampaignSelection({ onCampaignSelect }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        const folders = await getCharacterFolders();
        setCampaigns(folders);
        setLoading(false);
      } catch (err) {
        setError('Failed to load campaigns. Please ensure character folders exist under ./public/characters');
        setLoading(false);
       }
      };

    fetchCampaigns();
  }, []);

  const handleCampaignSelect = async (campaign) => {
        try {
                  setLoading(true);
                  const characterFiles = await getCharacterFiles(campaign);
                  const characters = await loadCharacters(campaign, characterFiles);
        
                   // Store campaign and characters in sessionStorage
                   // Even if empty, allow navigation to char sheet
                  sessionStorage.setItem('currentCampaign', campaign);
                  sessionStorage.setItem('characters', JSON.stringify(characters));
          
          // Notify parent to switch views
          if (onCampaignSelect) {
            onCampaignSelect(campaign, characters);
            }
          } catch (err) {
          setError(`Failed to load campaign ${campaign}: ${err.message}`);
        } finally {
          setLoading(false);
          }
        };

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      setError('Please enter a campaign name');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            },
        body: JSON.stringify({ campaignName: newCampaignName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create campaign');
      }

      // Show success message
      setShowSuccessMessage(true);
      
      // Close modal and clear input
      setShowNewCampaignModal(false);
      setNewCampaignName('');
      setError(null);
      
      // Reload the page to show the new campaign
      setTimeout(() => {
        window.location.reload();
       }, 2000);
      } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      }
    };

  const openNewCampaignModal = () => {
      setShowNewCampaignModal(true);
      setError(null);
  };

  const closeModal = () => {
    setShowNewCampaignModal(false);
    setError(null);
    setNewCampaignName('');
  };

  if (loading && campaigns.length === 0) {
    return (
        <div className="campaign-selection loading">
           <p>Loading campaigns...</p>
        </div>
       );
     }

  if (loading && campaigns.length > 0) {
    return (
        <div className="campaign-selection loading">
           <p>Creating campaign...</p>
        </div>
       );
     }

  if (error) {
    return (
        <div className="campaign-selection error">
           <p className="error-message">{error}</p>
           <button className="reload-button" onClick={() => window.location.reload()}>Reload Page</button>
        </div>
       );
     }

  return (
       <div className="campaign-selection">
         <h1>Select a Campaign</h1>
         {showSuccessMessage && (
           <div className="success-message">
             <p>✅ Campaign created successfully!</p>
             <p>Reloading...</p>
           </div>
         )}
         <button className="new-campaign-button" onClick={openNewCampaignModal}><i className="fas fa-plus"></i> Add</button>
         {campaigns.length === 0 ? (
           <p className="no-campaigns">
          No campaigns found. Please create folders under ./public/characters to get started.
           </p>
         ) : (
           <div className="campaign-list">
             {campaigns.map((campaign) => (
               <button
               key={campaign}
               className="campaign-button"
               onClick={() => handleCampaignSelect(campaign)}
               disabled={loading}
               >
                 {campaign}
               </button>
             ))}
           </div>
         )}
       
         {showNewCampaignModal && (
           <div className="modal-overlay">
             <div className="modal-content">
               <h2>Create New Campaign</h2>
               <input
               type="text"
               value={newCampaignName}
               onChange={(e) => setNewCampaignName(e.target.value)}
               placeholder="Enter campaign name"
               className="modal-input"
               autoFocus
               />
               <div className="modal-buttons">
                 <button className="modal-btn-primary" onClick={handleCreateCampaign} disabled={loading}>
                Create
                 </button>
                 <button className="modal-btn-secondary" onClick={closeModal}>
                Cancel
                 </button>
               </div>
             </div>
           </div>
         )}
       </div>
     );
}

export default CampaignSelection;

