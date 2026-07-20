import utils from './utils.js'
import { getCombatContext } from '../rules/combat/damageUtils.js'

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
            const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`);
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
                }).catch(() => {});
            });
            return queue.pending;
        }
        if (key === 'combatsumm' && value && value.lastAttack) {
            console.log(`[storage] ★ storage.set combatsumm - value keys:`, Object.keys(value).join(', '));
        }
        const fullUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`;
        return fetch(fullUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
          }).catch(() => {});
      },
    getProperty: async (name, propertyName, campaignName) => {
        const firstName = utils.getName(name);
        const obj = await storage.get(firstName, campaignName);
        if(obj && obj[propertyName] != null) {
            return obj[propertyName];
          }
        return null;
      },
    setProperty: async (name, propertyName, value, campaignName) => {
        const firstName = utils.getName(name);
        // For combatSummary.lastAttack, merge with the full combatSummary from server
        if (name === 'combatSummary' && propertyName === 'lastAttack') {
            const cs = await getCombatContext(campaignName);
            const merged = { ...(cs || {}), lastAttack: { ...(cs?.lastAttack || {}), ...value } };
            await storage.set(name, merged, campaignName);
            if (name === 'combatSummary' && propertyName === 'lastAttack') {
                console.log(`[storage] ★ setProperty combatSummary.lastAttack - merged keys:`, Object.keys(merged.lastAttack || {}).join(', '));
            }
            return;
        }
        let obj = await storage.get(firstName, campaignName);
        if(!obj) {
            obj = {};
          }
        obj[propertyName] = value;
        if (name === 'combatSummary' && propertyName === 'lastAttack') {
            console.log(`[storage] ★ setProperty combatSummary.lastAttack - obj keys before write:`, Object.keys(obj).join(', '));
        }
        await storage.set(firstName, obj, campaignName);
        if (name === 'combatSummary' && propertyName === 'lastAttack') {
            console.log(`[storage] ★ setProperty combatSummary.lastAttack - write complete for key: ${firstName}`);
        }
      }
}

export default storage
