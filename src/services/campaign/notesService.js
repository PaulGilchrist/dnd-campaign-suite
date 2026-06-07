export const loadNotes = async (campaignName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/notes`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load notes');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading notes:', error);
    throw error;
  }
};

export const saveNotes = async (campaignName, notes) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save notes');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving notes:', error);
    throw error;
  }
};

export const loadNote = async (campaignName, noteId) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedNoteId = encodeURIComponent(noteId);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/notes/${encodedNoteId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load note');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading note:', error);
    throw error;
  }
};

export const deleteNote = async (campaignName, noteId) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedNoteId = encodeURIComponent(noteId);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/notes/${encodedNoteId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to delete note');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};
