export const saveSettlement = async (campaignName, settlement, oldName) => {
  try {
    const name = oldName || settlement.name;
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/settlements/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settlement),
    });
    if (!response.ok) {
      const body = await response.json();
      const err = new Error(body.error || 'Failed to save settlement');
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
      console.warn('Concurrent-edit conflict saving settlement:', error.message);
    } else {
      console.error('Error saving settlement:', error);
    }
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
      const body = await response.json();
      const err = new Error(body.error || 'Failed to save settlements');
      // Server 409 concurrent-edit conflicts carry { conflict: true } — the
      // editor banner keys its one-click "Reload list" recovery off this flag.
      err.conflict = body.conflict === true;
      throw err;
    }
    return await response.json();
  } catch (error) {
    // Flagged 409 conflicts are benign rejected edits (banner handles them) —
    // warn, never red ERROR; genuine failures still log at error.
    if (error.conflict) {
      console.warn('Concurrent-edit conflict saving settlements:', error.message);
    } else {
      console.error('Error saving settlements:', error);
    }
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
