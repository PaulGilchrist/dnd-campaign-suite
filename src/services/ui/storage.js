import utils from './utils.js'
const storage = {
    get: async (key, campaignName) => {
        if (campaignName) {
            try {
                const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.value != null) {
                        localStorage.setItem(key, JSON.stringify(data.value));
                        return data.value;
                    }
                }
            } catch { /* fall through to localStorage */ }
        }
        const json = localStorage.getItem(key);
        if (json) {
            const parsed = JSON.parse(json);
            return parsed;
        }
        return null;
    },
    set: (key, value, campaignName) => {
        const json = JSON.stringify(value);
        localStorage.setItem(key, json);
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
        let obj = await storage.get(firstName);
        if(!obj) {
            obj = {};
          }
        obj[propertyName] = value;
        await storage.set(firstName, obj, campaignName);
      }
}

export default storage
