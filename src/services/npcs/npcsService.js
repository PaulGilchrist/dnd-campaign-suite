export const saveNPC = async (campaignName, npc, oldName) => {
  try {
    const name = oldName || npc.name;
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/npcs/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(npc),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save NPC');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving NPC:', error);
    throw error;
  }
};

export const loadNPCs = async (campaignName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/npcs`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load NPCs');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading NPCs:', error);
    throw error;
  }
};

export const saveNPCs = async (campaignName, npcs) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/npcs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcs }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save NPCs');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving NPCs:', error);
    throw error;
  }
};

export const loadNPC = async (campaignName, npcName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedNpcName = encodeURIComponent(npcName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/npcs/${encodedNpcName}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load NPC');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading NPC:', error);
    throw error;
  }
};

export const deleteNPC = async (campaignName, npcName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedNpcName = encodeURIComponent(npcName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/npcs/${encodedNpcName}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to delete NPC');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting NPC:', error);
    throw error;
  }
};
