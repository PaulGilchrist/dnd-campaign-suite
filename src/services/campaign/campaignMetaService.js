/**
 * Campaign-type metadata lane — client side of server/routes/campaigns-meta.js.
 *
 * The type ('standard' | 'arena' | 'starter') is recorded once by the
 * seeded-campaign orchestrator so list/sidebar surfaces can badge a campaign
 * BEFORE it is opened. Reads are defensive (mirror campaignService): the lane
 * answers a default rather than bricking a view over a failed fetch.
 */

// Shared badge vocabulary for every surface that shows a campaign type
// (campaign-selection list, sidebar header). Standard gets no badge by design.
export const CAMPAIGN_TYPE_BADGES = {
  arena: { label: 'Arena Battle', icon: 'fa-solid fa-shield-halved', cls: 'arena' },
  starter: { label: 'Starter Adventure', icon: 'fa-solid fa-seedling', cls: 'starter' },
};

/** name → type map from the campaign list endpoint ({} on any failure). */
export const getCampaignTypes = async () => {
  try {
    const response = await fetch('/api/campaigns');
    if (!response.ok) {
      throw new Error('Failed to fetch campaign types');
    }
    const data = await response.json();
    return data.types || {};
  } catch (error) {
    console.error('Error fetching campaign types:', error);
    return {};
  }
};

/** Single-campaign type for in-app surfaces (Sidebar); 'standard' on failure. */
export const loadCampaignType = async (campaignName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/meta`);
    if (!response.ok) {
      throw new Error('Failed to fetch campaign meta');
    }
    const data = await response.json();
    return data.type || 'standard';
  } catch (error) {
    console.error('Error fetching campaign meta:', error);
    return 'standard';
  }
};

/** GM-only write used by the seeded-campaign orchestrator at create time. */
export const saveCampaignType = async (campaignName, type) => {
  const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/meta`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  if (!response.ok) {
    let serverError;
    try {
      const body = await response.json();
      serverError = body?.error;
    } catch {
      // No JSON error body — fall back to statusText.
    }
    throw new Error(serverError || `Failed to save campaign meta: ${response.statusText}`);
  }
  return response.json();
};
