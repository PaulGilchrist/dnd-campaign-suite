export const loadMaps = async (campaignName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/maps`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load maps');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading maps:', error);
    throw error;
  }
};

export const createMap = async (campaignName, mapName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/maps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: mapName }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to create map');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating map:', error);
    throw error;
  }
};

export const deleteMap = async (campaignName, mapName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = encodeURIComponent(mapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to delete map');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting map:', error);
    throw error;
  }
};

export const renameMap = async (campaignName, oldMapName, newName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = encodeURIComponent(oldMapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to rename map');
    }
    return await response.json();
  } catch (error) {
    console.error('Error renaming map:', error);
    throw error;
  }
};

export const activateMap = async (campaignName, mapName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = encodeURIComponent(mapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}/activate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to activate map');
    }
    return await response.json();
  } catch (error) {
    console.error('Error activating map:', error);
    throw error;
  }
};

export const saveMapData = async (campaignName, mapName, data) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = encodeURIComponent(mapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save map data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving map data:', error);
    throw error;
  }
};

export const loadMapData = async (campaignName, mapName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = encodeURIComponent(mapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load map data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading map data:', error);
    throw error;
  }
};
