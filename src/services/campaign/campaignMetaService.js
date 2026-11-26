/**
 * Campaign meta lane — client side of server/routes/campaigns-meta.js.
 *
 * The meta document carries two fields: the preset type
 * ('standard' | 'arena' | 'starter', recorded once at seed time so list and
 * sidebar surfaces can badge a campaign) and the sidebar TOOLBELT
 * (`{ hiddenViews: [...] }` — the per-campaign set of hidden views,
 * learnability backlog Item 1). Absent toolbelt = all views visible.
 *
 * READ POLICY: a failed read THROWS here; the defaulting policy lives in the
 * single consumer (useCampaignMeta) — all-visible on first load, last-known
 * value kept on a later refresh — so no caller can silently render defaults
 * over live data mid-session.
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

/**
 * Full meta for one campaign: `{ type, hiddenViews }`. The server always
 * answers a resolved type and a normalized toolbelt (absent stored field →
 * `{ hiddenViews: [] }`), so this is a plain read; it throws on a failed
 * fetch/network error and the hook decides the fallback.
 */
export const loadCampaignMeta = async (campaignName) => {
  const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/meta`);
  if (!response.ok) {
    throw new Error(`Failed to fetch campaign meta (${response.status})`);
  }
  const data = await response.json();
  // Defensive SHAPE read (the lane's carried law: a meta answer never bricks
  // a view): the server always resolves { type, toolbelt }, but malformed
  // payloads normalize to the documented defaults instead of crashing a
  // caller. A failed REQUEST still throws — the hook owns that fallback.
  return {
    type: data.type || 'standard',
    hiddenViews: data.toolbelt?.hiddenViews ?? [],
  };
};

/**
 * GM-only toolbelt write (PUT /meta is a partial upsert — the stored type is
 * left untouched). Rejects with the server's plain-English error so the
 * settings dialog can name the failure honestly.
 */
export const saveCampaignToolbelt = async (campaignName, hiddenViews) => {
  const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/meta`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolbelt: { hiddenViews } }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to save the sidebar toolbelt (${response.status})`);
  }
  return response.json();
};
