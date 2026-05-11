export const getCharacterFolders = async () => {
  try {
    const response = await fetch('/api/campaigns');
    if (!response.ok) {
      throw new Error('Failed to fetch character folders');
    }
    
    const data = await response.json();
    return data.folders || [];
  } catch (error) {
    console.error('Error fetching character folders:', error);
    return [];
  }
};

export const getCharacterFiles = async (campaign) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaign)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch character files');
    }
    
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error fetching character files:', error);
    return [];
  }
};

export const loadCharacters = async (campaign, characterFiles) => {
  const encodedCampaign = encodeURIComponent(campaign);
  const urls = characterFiles.map(file => `/api/campaigns/${encodedCampaign}/${encodeURIComponent(file)}`);
  const promises = urls.map(url => fetch(url).then(response => {
    if (!response.ok) {
      throw new Error(`Failed to load character: ${response.statusText}`);
    }
    return response.json();
  }));
  
  try {
    const data = await Promise.all(promises);
    return data;
  } catch (error) {
    console.error('Error loading characters:', error);
    return [];
  }
};

export const deleteCharacter = async (campaignName, fileName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedFileName = encodeURIComponent(fileName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/${encodedFileName}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`Failed to delete character: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting character:', error);
    throw error;
  }
};

export const createCharacter = async (campaignName, characterData) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignName, character: characterData }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create character: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error creating character:', error);
    throw error;
  }
};

export const updateCharacter = async (campaignName, fileName, characterData, originalFileName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedFileName = encodeURIComponent(fileName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/${encodedFileName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...characterData, originalFileName }),
    });
    if (!response.ok) {
      throw new Error(`Failed to update character: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error updating character:', error);
    throw error;
  }
};
