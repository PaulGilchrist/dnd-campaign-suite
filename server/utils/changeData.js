import fs from 'fs';
import path from 'path';
import http from 'http';

// Tracks the active map key per campaign
export const activeMaps = new Map();

// List of active SSE client connections
export let subscribers = [];

// In-memory store for debounced character changes keyed by campaign
export const characterChangeData = new Map();

// In-memory store for spell overlays keyed by campaign (array of overlay objects)
export const spellOverlayData = new Map();

// Debounce timer for saveFile()
let saveTimer = null;

const persistDataDebounceMilliseconds = 2000; // 2 seconds in milliseconds

/**
 * Keys that are campaign-level and should be at the top level,
 * not nested under the campaign name.
 */
const CAMPAIGN_DATA_KEYS = new Set([
    'targetEffects',
    'pendingSavePrompts',
    'coverRefresh',
    'warCasterReactions',
    'quivering_palm',
    'pendingSaveListenerPrompts',
]);

function isDynamicCampaignKey(key) {
    if (key.startsWith('_activeInvisibility_')) return true;
    if (key.startsWith('_activeFriends_')) return true;
    if (/^_.*_appliedTarget$/.test(key)) return true;
    return false;
}

function isCampaignDataKey(key) {
    return CAMPAIGN_DATA_KEYS.has(key) || isDynamicCampaignKey(key);
}

/**
 * Migrates: flattens campaign-named nested keys to the top level of data,
 * then removes the nested wrapper.
 */
function flattenNestedCampaignKeys(data, nestedKey) {
    const nested = data[nestedKey];
    if (!nested || typeof nested !== 'object') return;
    for (const [key, value] of Object.entries(nested)) {
        if (isCampaignDataKey(key) && !(key in data)) {
            data[key] = value;
        }
    }
    delete data[nestedKey];
}

/**
 * Loads all campaign change data from disk into characterChangeData Map at startup
 */
export const readFile = () => {
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    try {
        if (!fs.existsSync(campaignsDir)) return;
        const campaigns = fs.readdirSync(campaignsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name)
            .filter(name => {
                if (name === '[object Object]' || name === 'undefined' || name === 'null') {
                    console.error(`[changeData] Ignoring corrupted campaign directory "${name}" (object coerced to name by a client POST).`);
                    return false;
                }
                return true;
            });
        for (const campaign of campaigns) {
            const filePath = path.join(campaignsDir, campaign, 'data', 'character-change-data.json');
            try {
                if (fs.existsSync(filePath)) {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    // Migrate: flatten campaign-named keys to top level
                    flattenNestedCampaignKeys(data, campaign);
                    // Migrate: flatten deprecated "campaign" wrapper to top level
                    flattenNestedCampaignKeys(data, 'campaign');
                    characterChangeData.set(campaign, data);
                } else {
                    characterChangeData.set(campaign, {});
                }
            } catch (err) {
                console.error(`Failed to read character change data for campaign ${campaign}:`, err.message);
                characterChangeData.set(campaign, {});
            }
        }
    } catch (err) {
        console.error('Failed to read campaigns directory for character change data:', err.message);
    }
}

/**
 * Persist all in-memory change data to disk, only writing when content changed
 */
export const saveFile = () => {
    for (const [campaign, data] of characterChangeData) {
        const filePath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'character-change-data.json');
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            if (String(campaign) === '[object Object]' || campaign === undefined || campaign === null || campaign === '') {
                console.error(`[changeData] Skipping persist for invalid campaign key "${campaign}" (corrupted client payload). Removing from memory.`, { stack: new Error().stack });
                characterChangeData.delete(campaign);
                continue;
            }
            fs.mkdirSync(dir, { recursive: true });
        }
        try {
            const serialized = JSON.stringify(data, null, 2);
            let current = '';
            try { current = fs.readFileSync(filePath, 'utf-8'); } catch (_err) { /* file not found */ }
            if (current !== serialized) {
                fs.writeFileSync(filePath, serialized);
            }
        } catch (err) {
            console.error(`Failed to save character change data for campaign ${campaign}:`, err.message);
        }
    }
}

/**
 * Mark a campaign as having unsaved changes (debounced persist)
 */
export const markDirty = (_campaign) => {
    debouncedSave();
}

/**
 * Debounced wrapper around saveFile
 */
export const debouncedSave = () => {
    if (saveTimer) {
        clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
        saveFile();
        saveTimer = null;
    }, persistDataDebounceMilliseconds);
}

/**
 * Writes SSE event to all connected subscribers.
 *
 * @param {string} key - Event key
 * @param {object} data - Event data
 * @param {string} [campaignName] - Explicit target campaign. Preferred over
 *   parsing the key, which is ambiguous when the campaign name contains hyphens.
 */
export const publish = (key, data, campaignName) => {
    const unwrapped = data && typeof data === 'object' && 'value' in data && Object.keys(data).length === 1 ? data.value : data;
    let targetCampaign = campaignName || null;
    if (!targetCampaign) {
        const campaignPrefix = key.match(/^(?:change|spell-overlay|map-data|maps-list|map-activate|positioning|log)-(.+?)(?:-|$)/);
        targetCampaign = campaignPrefix ? campaignPrefix[1] : null;
    }
    subscribers.forEach(client => {
        if (targetCampaign && client.campaignName && client.campaignName !== targetCampaign) return;
        try {
            client.res.write(`data: ${JSON.stringify({ key, data: unwrapped })}\n\n`);
            } catch (_e) {
               // client disconnected
           }
       });
}

/**
 * Removes change-data entries for a character that was deleted or renamed.
 * Keeps reserved keys intact (combatSummary, activeCreatureId, log, positioning).
 */
export const removeChangeDataKey = (campaign, characterName) => {
    const firstName = characterName.split(/[^a-zA-Z0-9]/)[0] || characterName;
    if (!characterChangeData.has(campaign)) return;

    const data = characterChangeData.get(campaign);
    const reservedKeys = ['combatSummary', 'activeCreatureId', 'log', 'positioning'];
     /* Clean up any entry that matches the old name (case-insensitive) */
    Object.keys(data).forEach(key => {
        if (reservedKeys.includes(key)) return;
        if (key.toLowerCase() === firstName.toLowerCase()) {
            delete data[key];
          }
      });
    debouncedSave();
}

export const keepAlive = () => {
    setInterval(() => {
        http.get('http://localhost:' + (process.env.PORT || 80) + '/health', { headers: { 'X-Accel-Buffering': 'no' } }, (res) => {
            if (res.statusCode !== 200) {
                console.warn(`Keep-alive: server returned status ${res.statusCode}`);
             }
            // Drain the body so the keep-alive connection is reusable/closed cleanly
            res.resume();
         }).on('error', (err) => {
            console.error('Keep-alive health check failed:', err.message);
         });
     }, 60 * 1000);
}
