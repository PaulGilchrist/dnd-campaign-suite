// Helper to sanitize map names to filenames (mirrors server route)
export const toKebabCase = (name) => name.toLowerCase().replace(/\.json$/i, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const sanitizeMapName = (name) => toKebabCase(name) + '.json';

// fileName minus its .json extension (mirrors server slugFromFileName). The
// server list route already carries `slug` (= slugFromFileName(fileName));
// this only back-fills the field on legacy envelopes so every row that
// carries a fileName exposes a clean slug, derived from fileName so the two
// can never drift.
const slugFromFileName = (fileName) => fileName.replace(/\.json$/i, '');

// URL segment for every map lane (delete/rename/activate/GET/PUT/description).
// NEVER emit an empty one: `/maps/` collapses onto the runtime-store wildcard
// DELETE/GET `/:campaign/:key` — a false 200 "Data deleted successfully" that
// lies about an untouched file, or a `{value:null}` phantom-blank open
// (bug-map-name-empty-kebab). Kebab first (display names reach their file via
// the server's resolveMapFileName fallback); when the name has no kebab bytes,
// carry the raw name through — the list row's fileName (e.g. a legacy '.json'
// dotfile) resolves exactly on the server lanes, so such rows stay deletable/
// renamable; a fully empty name fails loudly with the server create gate's
// message instead of mis-routing.
const mapSegment = (name) => {
  const raw = String(name ?? '');
  const segment = toKebabCase(raw) || raw.replace(/^\/+/, '');
  if (segment === '') {
    throw new Error('Map name must contain letters or numbers');
  }
  return encodeURIComponent(segment);
};

export const loadMaps = async (campaignName) => {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/maps`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load maps');
    }
    const data = await response.json();
    return {
      ...data,
      maps: (data.maps || []).map(m =>
        typeof m.slug === 'string' || !m.fileName ? m : { ...m, slug: slugFromFileName(m.fileName) }
      ),
    };
  } catch (error) {
    console.error('Error loading maps:', error);
    throw error;
  }
};

export const createMap = async (campaignName, mapName, options = {}) => {
   const url = `/api/campaigns/${encodeURIComponent(campaignName)}/maps`;
   const response = await fetch(url, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ name: mapName, type: 'indoor', ...options }),
    });
   if (!response.ok) {
      // If map already exists, resolve the existing map instead of throwing
      let data;
      try {
        data = await response.json();
      } catch {
        data = {};
      }
      if (data.error && /map.*already exists/i.test(data.error)) {
        // The encounter-spawn lane wants resolve-not-throw on a collision, but
        // UI lanes must still be able to surface it — carry the server message
        // so a kebab-collision the display-name dup-check missed is never a
        // silent fake success (bug-map-name-empty-kebab).
        return { name: mapName, fileName: sanitizeMapName(mapName), alreadyExists: true, error: data.error };
      }
      const error = new Error(data.error || 'Failed to create map');
     throw error;
     }
   const result = await response.json();
   return result;
 };	

export const deleteMap = async (campaignName, mapName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = mapSegment(mapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to delete map');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting map:', error);
    throw error;
  }
};

export const renameMap = async (campaignName, oldMapName, newName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = mapSegment(oldMapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to rename map');
    }
    return await response.json();
  } catch (error) {
    console.error('Error renaming map:', error);
    throw error;
  }
};

export const activateMap = async (campaignName, mapName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = mapSegment(mapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}/activate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to activate map');
    }
    return await response.json();
  } catch (error) {
    console.error('Error activating map:', error);
    throw error;
  }
};

export const saveMapData = async (campaignName, mapName, data) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = mapSegment(mapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to save map data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving map data:', error);
    throw error;
  }
};

export const loadMapData = async (campaignName, mapName) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = mapSegment(mapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to load map data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading map data:', error);
    throw error;
  }
};

export const updateMapDescription = async (campaignName, mapName, description) => {
  try {
    const encodedCampaign = encodeURIComponent(campaignName);
    const encodedMapName = mapSegment(mapName);
    const response = await fetch(`/api/campaigns/${encodedCampaign}/maps/${encodedMapName}/description`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to update map description');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating map description:', error);
    throw error;
  }
};

export function formatMapName(name) {
    if (!name) return '';
    return name
        .replace(/\.json$/i, '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
