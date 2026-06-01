import utils from './utils.js'
const storage = {
    get: (key) => {
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
        const fullUrl = `/api/campaigns/${campaignName}/${key}`;
          // console.log(fullUrl)
        return fetch(fullUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
          }).catch(() => {
              // Silently ignore — server sync failure doesn't block UI
          });
      },
    getProperty: (name, propertyName, campaignName) => {
        void campaignName;
        const firstName = utils.getName(name);
        const obj = storage.get(firstName);
        if(obj && obj[propertyName] != null) {
            return obj[propertyName];
          }
        return null;
      },
    setProperty: async (name, propertyName, value, campaignName) => {
        const firstName = utils.getName(name);
        let obj = storage.get(firstName);
        if(!obj) {
            obj = {};
          }
        obj[propertyName] = value;
        await storage.set(firstName, obj, campaignName);
      }
}

export default storage
