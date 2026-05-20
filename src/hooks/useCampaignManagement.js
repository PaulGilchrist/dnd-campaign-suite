import { useState } from 'react';

function useCampaignManagement() {
  const [campaignName, setCampaignName] = useState(null);

  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1' ||
    /^127\./.test(window.location.hostname);

  const handleCampaignSelect = (campaign) => {
    setCampaignName(campaign);
  };

  const handleRenameCampaign = async () => {
    const newName = prompt('Enter new campaign name:', campaignName);
    if (!newName || newName.trim() === '') return;

    const response = await fetch(
      `/api/campaigns/${encodeURIComponent(campaignName)}`,
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

    setCampaignName(newName.trim());
    window.location.reload();
  };

  const handleDeleteCampaign = async () => {
    if (!campaignName || !window.confirm(`Are you sure you want to delete the campaign '${campaignName}'? This will delete all characters in the campaign and cannot be undone.`))
      return;

    const response = await fetch(
      `/api/campaigns/${encodeURIComponent(campaignName)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to delete campaign');
    }
  };

  return {
    isLocalhost,
    campaignName,
    handleCampaignSelect,
    handleRenameCampaign,
    handleDeleteCampaign,
  };
}

export default useCampaignManagement;
