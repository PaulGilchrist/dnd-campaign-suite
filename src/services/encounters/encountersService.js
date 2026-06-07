export const loadEncounters = async (campaignName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/encounters`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load encounters');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading encounters:', error);
    throw error;
  }
};

export const saveEncounter = async (campaignName, encounterName, data) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/encounters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: encounterName, data }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save encounter');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving encounter:', error);
    throw error;
  }
};

export const loadEncounter = async (campaignName, encounterName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedEncounter = encodeURIComponent(encounterName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/encounters/${encodedEncounter}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load encounter');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading encounter:', error);
    throw error;
  }
};

export const updateEncounter = async (campaignName, encounterName, data) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedEncounter = encodeURIComponent(encounterName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/encounters/${encodedEncounter}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to update encounter');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating encounter:', error);
    throw error;
  }
};

export const deleteEncounter = async (campaignName, encounterName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedEncounter = encodeURIComponent(encounterName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/encounters/${encodedEncounter}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to delete encounter');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting encounter:', error);
    throw error;
  }
};

export const renameEncounter = async (campaignName, oldName, newName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedOldName = encodeURIComponent(oldName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/encounters/${encodedOldName}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to rename encounter');
    }
    return await response.json();
  } catch (error) {
    console.error('Error renaming encounter:', error);
    throw error;
  }
};

export function formatEncounterName(name) {
  if (!name) return '';
  return name
    .replace(/\.json$/i, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
