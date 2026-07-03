import fs from 'fs';
import path from 'path';
import http from 'http';

// Tracks the active map key per campaign
export const activeMaps = new Map();

// List of active SSE client connections
export let subscribers = [];

// In-memory store for debounced character changes (HP, spell slots, etc.) keyed by campaign
export const characterChangeData = new Map();

// In-memory store for spell overlays keyed by campaign (array of overlay objects)
export const spellOverlayData = new Map();

// Debounce timer for saveFile()
let saveTimer = null;

const persistDataDebounceMilliseconds = 1 * 60 * 1000; // 1 minute in milliseconds

/**
 * Loads all campaign change data from disk into characterChangeData Map at startup
 */
export const readFile = () => {
    const campaignsDir = path.join(process.cwd(), 'public', 'campaigns');
    try {
        if (!fs.existsSync(campaignsDir)) return;
        const campaigns = fs.readdirSync(campaignsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
        for (const campaign of campaigns) {
            const filePath = path.join(campaignsDir, campaign, 'data', 'character-change-data.json');
            try {
                if (fs.existsSync(filePath)) {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
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
 * Debounced persist: writes all in-memory change data to disk
 */
export const saveFile = () => {
    for (const [campaign, data] of characterChangeData) {
        const filePath = path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'character-change-data.json');
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        try {
            fs.writeFileSync(filePath, JSON.stringify(data));
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
 */
export const publish = (key, data) => {
    const unwrapped = data && typeof data === 'object' && 'value' in data && Object.keys(data).length === 1 ? data.value : data;
    const campaignPrefix = key.match(/^(?:change|spell-overlay|map-data|maps-list|map-activate|positioning|log)-(.+?)(?:-|$)/);
    const targetCampaign = campaignPrefix ? campaignPrefix[1] : null;
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
         }).on('error', (err) => {
            console.error('Keep-alive health check failed:', err.message);
         });
     }, 60 * 1000);
}
