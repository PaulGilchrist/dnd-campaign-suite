import utils from './utils.js'

// Sequential write queue for combatSummary to prevent race conditions
// when multiple applyDamageToTarget calls fire storage.set in quick succession.
// Each campaign gets its own queue so writes for different campaigns can run in parallel.
const combatSummaryQueues = new Map();

function getCombatSummaryQueue(campaignName) {
    if (!combatSummaryQueues.has(campaignName)) {
        combatSummaryQueues.set(campaignName, {
            pending: Promise.resolve(),
        });
    }
    return combatSummaryQueues.get(campaignName);
}

const storage = {
    get: async (key, campaignName) => {
        if (!campaignName) {
            return null;
        }
        try {
            const fullUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`;
            const response = await fetch(fullUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.value != null) {
                    return data.value;
                }
            }
        } catch (err) {
            console.error(`storage.get failed for key "${key}" in campaign "${campaignName}"`, err);
        }
        return null;
    },
    set: (key, value, campaignName) => {
        if (!campaignName) {
            console.error('storage.set called with undefined campaignName', { key, value, stack: new Error().stack });
            return Promise.resolve();
        }
        if (key === 'combatSummary') {
            const queue = getCombatSummaryQueue(campaignName);
            const current = queue.pending;
            queue.pending = current.then(() => {
                const fullUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`;
                return fetch(fullUrl, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value })
                }).catch((e) => { console.error("[storage:error]", e); });
            });
            return queue.pending;
        }
        const fullUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`;
        return fetch(fullUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
          }).catch((e) => { console.error("[storage:error]", e); });
      },
    getProperty: async (name, propertyName, campaignName) => {
        // Campaign-level keys are stored at the top level, not under a "campaign" wrapper.
        if (name === 'campaign') {
            return await storage.get(propertyName, campaignName);
        }
        const firstName = utils.getName(name);
        const obj = await storage.get(firstName, campaignName);
        if(obj && obj[propertyName] != null) {
            return obj[propertyName];
          }
        return null;
      },
    setProperty: async (name, propertyName, value, campaignName) => {
        // Campaign-level keys are stored at the top level, not under a "campaign" wrapper.
        if (name === 'campaign') {
            await storage.set(propertyName, value, campaignName);
            return;
        }
        if (name === 'combatSummary' && propertyName === 'lastAttack') {
            console.error(
                "[storage] Deprecated: storage.setProperty('combatSummary', 'lastAttack', ...) is no longer supported. " +
                `Campaign: "${campaignName}". Use storage.set('lastAttack', value, campaignName) instead. ` +
                "lastAttack is now a root-level key."
            );
            await storage.set('lastAttack', value, campaignName);
            return;
        }
        const firstName = utils.getName(name);
        let obj = await storage.get(firstName, campaignName);
        if(!obj) {
            obj = {};
          }
        obj[propertyName] = value;
        await storage.set(firstName, obj, campaignName);
      }
}

export default storage
