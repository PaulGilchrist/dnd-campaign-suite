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
      const body = await response.json();
      const err = new Error(body.error || 'Failed to save notes');
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
      console.warn('Concurrent-edit conflict saving notes:', error.message);
    } else {
      console.error('Error saving notes:', error);
    }
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
