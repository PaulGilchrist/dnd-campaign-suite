import { useState, useRef } from 'react';

function useCampaignManagement() {
  const [showCampaignSelection, setShowCampaignSelection] = useState(true);
  const [campaignName, setCampaignName] = useState(() =>
    sessionStorage.getItem('currentCampaign')
  );
  const onCampaignSelectRef = useRef(null);
  const onDeleteCampaignRef = useRef(null);

  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';



  const handleCampaignSelect = (campaign, characters) => {
    sessionStorage.setItem('currentCampaign', campaign);
    setCampaignName(campaign);
    setShowCampaignSelection(false);
    if (onCampaignSelectRef.current) {
      onCampaignSelectRef.current(campaign, characters);
    }
  };

  const handleRenameCampaign = async () => {
    const currentCampaign = sessionStorage.getItem('currentCampaign');
    const newName = prompt('Enter new campaign name:', currentCampaign);
    if (!newName || newName.trim() === '') return;

    const response = await fetch(
      `/api/campaigns/${encodeURIComponent(currentCampaign)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: newName.trim() }),
      }
    );

    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to rename campaign');
    }

    sessionStorage.setItem('currentCampaign', newName.trim());
    setCampaignName(newName.trim());
    window.location.reload();
  };

  const handleDeleteCampaign = async () => {
    const currentCampaign = sessionStorage.getItem('currentCampaign');
    if (!currentCampaign || !window.confirm(`Are you sure you want to delete the campaign '${currentCampaign}'? This will delete all characters in the campaign and cannot be undone.`))
      return;

    const response = await fetch(
      `/api/campaigns/${encodeURIComponent(currentCampaign)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to delete campaign');
    }

    if (onDeleteCampaignRef.current) {
      onDeleteCampaignRef.current();
    }
  };

  const handleBackToCampaigns = () => {
    setShowCampaignSelection(true);
  };

  const setCampaignSelectCallback = (callback) => {
    onCampaignSelectRef.current = callback;
  };

  const setDeleteCampaignCallback = (callback) => {
    onDeleteCampaignRef.current = callback;
  };

  return {
    showCampaignSelection,
    isLocalhost,
    campaignName,
    handleCampaignSelect,
    handleRenameCampaign,
    handleDeleteCampaign,
    handleBackToCampaigns,
    setCampaignSelectCallback,
    setDeleteCampaignCallback,
  };
}

export default useCampaignManagement;
