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
        fetch(fullUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        }).catch(() => {
            // Silently ignore — fire-and-forget sync
        });
    },
    getProperty: (name, propertyName, campaignName) => {
        const firstName = utils.getFirstName(name);
        const obj = storage.get(firstName);
        if(obj && obj[propertyName] != null) {
            return obj[propertyName];
        }
        return null;
    },
    setProperty: (name, propertyName, value, campaignName) => {
        const firstName = utils.getFirstName(name);
        let obj = storage.get(firstName);
        if(!obj) {
            obj = {};
        }
        obj[propertyName] = value;
        storage.set(firstName, obj, campaignName);
    }
}

export default storage
