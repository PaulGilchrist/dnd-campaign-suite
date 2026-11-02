/**
 * Starter-seed document service — client lane for data/starter-seed.json
 * (server route: server/routes/campaigns-starter-seed.js).
 *
 * The seed records the rolling generator seed plus every generated entity name
 * for a starter campaign. Its existence is what the first-session checklist
 * keys visibility off; regenerateAdventure rewrites it after re-rolling the
 * dungeon/monsters/treasure layer.
 */

export const loadStarterSeed = async (campaignName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/starter-seed`);
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load starter seed');
    }
    const data = await response.json();
    return data.seed ?? null;
  } catch (error) {
    console.error('Error loading starter seed:', error);
    throw error;
  }
};

export const saveStarterSeed = async (campaignName, seed) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/starter-seed`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save starter seed');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving starter seed:', error);
    throw error;
  }
};
