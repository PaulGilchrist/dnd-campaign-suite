export const getCharacterFolders = async () => {
  try {
    const response = await fetch('/api/characters');
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
    const response = await fetch(`/api/characters/${encodeURIComponent(campaign)}`);
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
  const urls = characterFiles.map(file => `/api/characters/${encodedCampaign}/${encodeURIComponent(file)}`);
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
