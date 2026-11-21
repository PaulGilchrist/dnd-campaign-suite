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
      const body = await response.json();
      const err = new Error(body.error || 'Failed to save session');
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
      console.warn('Concurrent-edit conflict saving session:', error.message);
    } else {
      console.error('Error saving session:', error);
    }
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
      const body = await response.json();
      const err = new Error(body.error || 'Failed to save sessions');
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
      console.warn('Concurrent-edit conflict saving sessions:', error.message);
    } else {
      console.error('Error saving sessions:', error);
    }
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

/**
 * Roadmap Step 8 — ask the server to write this session's AI recap (GM-only
 * lane; the server posts the `session_recap` log row itself). Resolves with
 * the posted row; rejects with the server's plain-English refusal copy so
 * the planner banner shows an honest reason — never a silent spinner.
 */
export const requestSessionRecap = async (campaignName, sessionName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/recap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: sessionName }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      throw new Error(body.error || `Recap request failed (HTTP ${response.status})`);
    }
    return body.entry;
  } catch (error) {
    console.error('Error writing session recap:', error);
    throw error;
  }
};
