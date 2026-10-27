export const saveNPC = async (campaignName, npc, oldName) => {
  try {
    const name = oldName || npc.name;
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/npcs/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(npc),
    });
    if (!response.ok) {
      const body = await response.json();
      const err = new Error(body.error || 'Failed to save NPC');
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
      console.warn('Concurrent-edit conflict saving NPC:', error.message);
    } else {
      console.error('Error saving NPC:', error);
    }
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
      const body = await response.json();
      const err = new Error(body.error || 'Failed to save NPCs');
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
      console.warn('Concurrent-edit conflict saving NPCs:', error.message);
    } else {
      console.error('Error saving NPCs:', error);
    }
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
