export const loadSessions = async (campaignName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/sessions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load sessions');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading sessions:', error);
    throw error;
  }
};

export const saveSession = async (campaignName, session, oldName) => {
  const name = oldName || session.name;
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/sessions/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save session');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving session:', error);
    throw error;
  }
};

export const saveSessions = async (campaignName, sessions) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save sessions');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving sessions:', error);
    throw error;
  }
};

export const deleteSession = async (campaignName, sessionName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/sessions/${encodeURIComponent(sessionName)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to delete session');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
};
