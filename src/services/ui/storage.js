import utils from './utils.js'
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
        let obj = await storage.get(firstName, campaignName);
        if(!obj) {
            obj = {};
          }
        obj[propertyName] = value;
        await storage.set(firstName, obj, campaignName);
      }
}

export default storage
