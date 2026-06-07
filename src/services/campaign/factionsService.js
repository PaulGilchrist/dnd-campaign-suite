export const loadFactions = async (campaignName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/factions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load Factions');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading Factions:', error);
    throw error;
  }
};

export const saveFactions = async (campaignName, factions) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/factions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factions }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save Factions');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving Factions:', error);
    throw error;
  }
};

export const loadFaction = async (campaignName, factionId) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedFactionId = encodeURIComponent(factionId);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/factions/${encodedFactionId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load Faction');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading Faction:', error);
    throw error;
  }
};

export const deleteFaction = async (campaignName, factionId) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedFactionId = encodeURIComponent(factionId);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/factions/${encodedFactionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to delete Faction');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting Faction:', error);
    throw error;
  }
};
