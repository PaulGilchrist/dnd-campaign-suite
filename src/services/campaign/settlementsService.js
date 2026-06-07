export const saveSettlement = async (campaignName, settlement, oldName) => {
  try {
    const name = oldName || settlement.name;
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/settlements/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settlement),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save settlement');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving settlement:', error);
    throw error;
  }
};

export const loadSettlements = async (campaignName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/settlements`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load settlements');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading settlements:', error);
    throw error;
  }
};

export const saveSettlements = async (campaignName, settlements) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlements }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save settlements');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving settlements:', error);
    throw error;
  }
};

export const loadSettlement = async (campaignName, settlementName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedName = encodeURIComponent(settlementName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/settlements/${encodedName}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load settlement');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading settlement:', error);
    throw error;
  }
};

export const deleteSettlement = async (campaignName, settlementName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedName = encodeURIComponent(settlementName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/settlements/${encodedName}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to delete settlement');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting settlement:', error);
    throw error;
  }
};
