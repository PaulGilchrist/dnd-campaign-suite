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
      const body = await response.json();
      const err = new Error(body.error || 'Failed to save Factions');
      // Server 409 concurrent-edit conflicts carry { conflict: true } — the
      // editor banner keys its one-click "Reload list" recovery off this flag.
      err.conflict = body.conflict === true;
      throw err;
    }
    return await response.json();
  } catch (error) {
    // A handled 409 concurrent-edit conflict (error.conflict — the server's
    // sanctioned discriminator) is a benign rejected edit: the editor banner +
    // "Reload list" affordance already tell the user, so keep it off the red
    // ERROR channel. Genuine failures (network, 4xx/5xx) still log at error.
    if (error.conflict) {
      console.warn('Concurrent-edit conflict saving Factions:', error.message);
    } else {
      console.error('Error saving Factions:', error);
    }
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
