/**
 * Quests service — CRUD operations for campaign quest data.
 * Data is stored in: public/campaigns/:campaign/data/quests.json
 */

/**
 * Load all quests for a campaign.
 * @param {string} campaignName
 * @returns {Promise<{ quests: Array }>}
 */
export async function loadQuests(campaignName) {
  const url = `/api/campaigns/${encodeURIComponent(campaignName)}/quests`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load quests');
    }
    const data = await response.json();
    return data.quests || [];
  } catch (error) {
    console.error('Error loading quests:', error);
    throw error;
  }
}

/**
 * Save all quests for a campaign (full array overwrite).
 * @param {string} campaignName
 * @param {Array} quests
 * @returns {Promise<void>}
 */
export async function saveQuests(campaignName, quests) {
  const url = `/api/campaigns/${encodeURIComponent(campaignName)}/quests`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quests })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save quests');
    }
  } catch (error) {
    console.error('Error saving quests:', error);
    throw error;
  }
}

/**
 * Load a single quest by ID.
 * @param {string} campaignName
 * @param {string} questId
 * @returns {Promise<Object>}
 */
export async function loadQuest(campaignName, questId) {
  const url = `/api/campaigns/${encodeURIComponent(campaignName)}/quests/${encodeURIComponent(questId)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load quest');
    }
    const data = await response.json();
    return data.quest;
  } catch (error) {
    console.error('Error loading quest:', error);
    throw error;
  }
}

/**
 * Delete a quest by ID.
 * @param {string} campaignName
 * @param {string} questId
 * @returns {Promise<void>}
 */
export async function deleteQuest(campaignName, questId) {
  const url = `/api/campaigns/${encodeURIComponent(campaignName)}/quests/${encodeURIComponent(questId)}`;
  try {
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete quest');
    }
  } catch (error) {
    console.error('Error deleting quest:', error);
    throw error;
  }
}
