import utils from './utils.js'
const storage = {
    get: (key) => {
        const json = localStorage.getItem(key);
        if (json) {
            return JSON.parse(json);
        }
        return null;
    },
    set: (key, value) => {
        const json = JSON.stringify(value);
        localStorage.setItem(key, json);
        const fullUrl = `/api/${key}`;
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
    getProperty: (name, propertyName) => {
        const firstName = utils.getFirstName(name);
        const obj = storage.get(firstName);
        if(obj && obj[propertyName] != null) {
            return obj[propertyName];
        }
        return null;
    },
    setProperty: (name, propertyName, value) => {
        const firstName = utils.getFirstName(name);
        let obj = storage.get(firstName);
        if(!obj) {
            obj = {};
        }
        obj[propertyName] = value;
        storage.set(firstName, obj);
    }
}

export default storage
