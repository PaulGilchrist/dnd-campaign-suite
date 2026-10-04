import express from 'express';
import fs from 'fs';
import path from 'path';
import guid from 'guid';
import { campaignDataFile, ensureDataDir, campaignDir } from '../utils/campaignPaths.js';
import { publish } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

const CURRENCY_KEYS = ['pp', 'gp', 'sp', 'cp'];

const emptyInventory = () => ({
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    items: [],
});

function sanitizeCurrency(input) {
    const currency = { pp: 0, gp: 0, sp: 0, cp: 0 };
    if (!input || typeof input !== 'object') return currency;
    for (const key of CURRENCY_KEYS) {
        const raw = Number(input[key]);
        currency[key] = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    }
    return currency;
}

function sortItems(items) {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function sanitizeItems(input) {
    if (!Array.isArray(input)) return null;
    const items = [];
    for (const raw of input) {
        if (!raw || typeof raw !== 'object') continue;
        const name = typeof raw.name === 'string' ? raw.name.trim() : '';
        if (!name) continue;
        const quantity = Number(raw.quantity);
        if (!Number.isFinite(quantity) || quantity < 1) continue;
        const description = typeof raw.description === 'string' ? raw.description : '';
        const id = typeof raw.id === 'string' && raw.id ? raw.id : guid.create().value;
        items.push({ id, name, quantity: Math.floor(quantity), description });
    }
    return sortItems(items);
}

function loadInventory(campaign) {
    const filePath = campaignDataFile(campaign, 'inventory.json');
    if (!fs.existsSync(filePath)) {
        return emptyInventory();
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return {
        currency: sanitizeCurrency(data.currency),
        items: sanitizeItems(Array.isArray(data.items) ? data.items : []) || [],
    };
}

function saveInventory(campaign, inventory) {
    ensureDataDir(campaign);
    const filePath = campaignDataFile(campaign, 'inventory.json');
    fs.writeFileSync(filePath, JSON.stringify(inventory, null, 2));
}

function characterFileName(playerName) {
    return `${playerName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
}

function itemNameOf(item) {
    return typeof item === 'string' ? item.trim() : ((item && typeof item.name === 'string') ? item.name.trim() : '');
}

function normalizeBackpack(backpack) {
    if (!Array.isArray(backpack)) return [];
    return backpack.map(itemNameOf).filter(name => name.length > 0);
}

function findItemMeta(inventory, name) {
    const meta = inventory.itemMeta || {};
    const exact = meta[name];
    if (exact) return exact;
    const lower = name.toLowerCase();
    const key = Object.keys(meta).find(k => k.toLowerCase() === lower);
    return key ? meta[key] : null;
}

function getItemQuantity(character, name) {
    const backpack = normalizeBackpack(character.inventory?.backpack);
    const present = backpack.filter(n => n.toLowerCase() === name.toLowerCase());
    if (present.length === 0) return 0;
    const meta = findItemMeta(character.inventory, name);
    const metaQty = meta && Number.isFinite(Number(meta.quantity)) ? Math.floor(Number(meta.quantity)) : 1;
    return Math.max(present.length, metaQty);
}

function addItemToCharacterBackpack(character, name, quantity, description) {
    const backpack = normalizeBackpack(character.inventory.backpack);
    const itemMeta = { ...(character.inventory.itemMeta || {}) };
    const existingKey = Object.keys(itemMeta).find(k => k.toLowerCase() === name.toLowerCase());
    const metaKey = existingKey || name;
    const existingMeta = itemMeta[metaKey] || {};

    const alreadyCarried = backpack.some(n => n.toLowerCase() === name.toLowerCase());
    if (!alreadyCarried) {
        backpack.push(name);
        itemMeta[metaKey] = { quantity, ...(description ? { description } : {}) };
    } else {
        const carriedQty = getItemQuantity(character, name);
        itemMeta[metaKey] = {
            quantity: carriedQty + quantity,
            description: existingMeta.description || description || '',
        };
    }

    character.inventory.backpack = backpack;
    character.inventory.itemMeta = itemMeta;
}

function removeItemFromCharacterBackpack(character, name, quantity) {
    const available = getItemQuantity(character, name);
    if (available < quantity) {
        return { error: `${character.name} carries only ${available} of "${name}"` };
    }
    const backpack = normalizeBackpack(character.inventory.backpack);
    const itemMeta = { ...(character.inventory.itemMeta || {}) };
    const metaKey = Object.keys(itemMeta).find(k => k.toLowerCase() === name.toLowerCase());
    const newQuantity = available - quantity;

    if (newQuantity <= 0) {
        character.inventory.backpack = backpack.filter(n => n.toLowerCase() !== name.toLowerCase());
        if (metaKey) delete itemMeta[metaKey];
    } else {
        itemMeta[metaKey] = { ...(metaKey && itemMeta[metaKey] || {}), quantity: newQuantity };
        character.inventory.itemMeta = itemMeta;
        if (!backpack.some(n => n.toLowerCase() === name.toLowerCase())) {
            backpack.push(name);
            character.inventory.backpack = backpack;
        }
    }
    if (Object.keys(itemMeta).length > 0) {
        character.inventory.itemMeta = itemMeta;
    } else {
        delete character.inventory.itemMeta;
    }
    return { ok: true };
}

function characterCurrency(character) {
    if (character.inventory.currency) return sanitizeCurrency(character.inventory.currency);
    const currency = sanitizeCurrency(null);
    const gold = Number(character.inventory.gold);
    if (Number.isFinite(gold) && gold > 0) currency.gp = Math.floor(gold);
    return currency;
}

function addCurrencyToCharacter(character, amount) {
    const currency = characterCurrency(character);
    for (const key of CURRENCY_KEYS) {
        currency[key] += amount[key];
    }
    character.inventory.currency = currency;
    character.inventory.gold = currency.gp;
}

function removeCurrencyFromCharacter(character, amount) {
    if (character.inventory.currency) {
        const currency = sanitizeCurrency(character.inventory.currency);
        const shortKey = CURRENCY_KEYS.find(key => currency[key] < amount[key]);
        if (shortKey) {
            return { error: `${character.name} has only ${currency[shortKey]} ${shortKey}` };
        }
        for (const key of CURRENCY_KEYS) {
            currency[key] -= amount[key];
        }
        character.inventory.currency = currency;
        character.inventory.gold = currency.gp;
        return { ok: true };
    }
    const gold = Number(character.inventory.gold) || 0;
    if (gold < amount.gp) {
        return { error: `${character.name} has only ${gold} gp` };
    }
    character.inventory.gold = gold - amount.gp;
    return { ok: true };
}

function applyPartyToPlayer(inventory, character, cleanName, quantity, currencyAmount) {
    if (currencyAmount) {
        const shortKey = CURRENCY_KEYS.find(key => inventory.currency[key] < currencyAmount[key]);
        if (shortKey) {
            return { error: `Party has only ${inventory.currency[shortKey]} ${shortKey}` };
        }
        for (const key of CURRENCY_KEYS) {
            inventory.currency[key] -= currencyAmount[key];
        }
        addCurrencyToCharacter(character, currencyAmount);
        return { ok: true };
    }
    const partyItem = inventory.items.find(i => i.name.toLowerCase() === cleanName.toLowerCase());
    const available = partyItem ? partyItem.quantity : 0;
    if (available < quantity) {
        return { error: `Party has only ${available} of "${cleanName}"` };
    }
    partyItem.quantity -= quantity;
    if (partyItem.quantity <= 0) {
        inventory.items = inventory.items.filter(i => i !== partyItem);
    }
    addItemToCharacterBackpack(character, partyItem.name, quantity, partyItem.description);
    return { ok: true };
}

function applyPlayerToParty(inventory, character, cleanName, quantity, currencyAmount) {
    if (currencyAmount) {
        const removal = removeCurrencyFromCharacter(character, currencyAmount);
        if (removal.error) return removal;
        for (const key of CURRENCY_KEYS) {
            inventory.currency[key] += currencyAmount[key];
        }
        return { ok: true };
    }
    const removal = removeItemFromCharacterBackpack(character, cleanName, quantity);
    if (removal.error) return removal;
    const canonical = normalizeBackpack(character.inventory.backpack).find(n => n.toLowerCase() === cleanName.toLowerCase()) || cleanName;
    transferItemsToParty(inventory, character, canonical, quantity);
    return { ok: true };
}

function transferItemsToParty(inventory, character, name, quantity) {
    const existingIndex = inventory.items.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
    if (existingIndex === -1) {
        const meta = findItemMeta(character.inventory, name);
        const description = meta && typeof meta.description === 'string' ? meta.description : '';
        inventory.items.push({ id: guid.create().value, name, quantity, description });
    } else {
        inventory.items[existingIndex].quantity += quantity;
    }
    inventory.items = sortItems(inventory.items);
}

// GET /api/campaigns/:campaign/inventory
router.get('/api/campaigns/:campaign/inventory', asyncHandler((req, res) => {
    const { campaign } = req.params;
    res.json({ inventory: loadInventory(campaign) });
}));

// POST /api/campaigns/:campaign/inventory — full overwrite
router.post('/api/campaigns/:campaign/inventory', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const body = req.body || {};
    const items = sanitizeItems(body.items);
    if (items === null) {
        return res.status(400).json({ error: 'inventory.items must be an array' });
    }
    const inventory = { currency: sanitizeCurrency(body.currency), items };
    saveInventory(campaign, inventory);
    publish(`inventory-${campaign}`, inventory, campaign);
    res.json({ success: true, inventory });
}));

const VALID_DIRECTIONS = ['party-to-player', 'player-to-party'];

function validateTransferTarget(body) {
    const { playerName, direction } = body || {};
    if (!playerName || typeof playerName !== 'string') {
        return { error: 'playerName is required' };
    }
    if (!VALID_DIRECTIONS.includes(direction)) {
        return { error: 'direction must be "party-to-player" or "player-to-party"' };
    }
    return { ok: true };
}

function validateTransferRequest(body) {
    const itemName = typeof body?.itemName === 'string' ? body.itemName.trim() : '';
    const currency = body?.currency && typeof body.currency === 'object' ? body.currency : null;
    const quantity = Math.floor(Number(body?.quantity));

    if (!itemName && !currency) {
        return { error: 'itemName or currency is required' };
    }
    if (itemName && currency) {
        return { error: 'Transfer one item or one currency set per request' };
    }
    if (itemName && (!Number.isFinite(quantity) || quantity < 1)) {
        return { error: 'quantity must be a positive integer' };
    }

    return {
        ok: true,
        quantity,
        cleanName: itemName,
        currencyAmount: currency ? sanitizeCurrency(currency) : null,
    };
}

// POST /api/campaigns/:campaign/inventory/transfer — atomic party<->player move
// body: { playerName, itemName, quantity } or { playerName, currency: {pp,gp,sp,cp} }
router.post('/api/campaigns/:campaign/inventory/transfer', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const { playerName, direction } = req.body || {};

    const validation = validateTransferTarget(req.body);
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const payload = validateTransferRequest(req.body);
    if (payload.error) {
        return res.status(400).json({ error: payload.error });
    }
    const { quantity, cleanName, currencyAmount } = payload;

    const charFileName = characterFileName(playerName);
    const charFilePath = path.join(campaignDir(campaign), charFileName);
    if (!fs.existsSync(charFilePath)) {
        return res.status(404).json({ error: `Character ${playerName} not found` });
    }

    const inventory = loadInventory(campaign);
    const character = JSON.parse(fs.readFileSync(charFilePath, 'utf-8'));
    if (!character.inventory || typeof character.inventory !== 'object') {
        character.inventory = { backpack: [], equipped: [], gold: 0, magicItems: [] };
    }

    const result = direction === 'party-to-player'
        ? applyPartyToPlayer(inventory, character, cleanName, quantity, currencyAmount)
        : applyPlayerToParty(inventory, character, cleanName, quantity, currencyAmount);

    if (result.error) {
        return res.status(409).json({ error: result.error });
    }

    fs.writeFileSync(charFilePath, JSON.stringify(character, null, 2));
    saveInventory(campaign, inventory);
    publish(`character-${campaign}-${charFileName}`, character, campaign);
    publish(`inventory-${campaign}`, inventory, campaign);

    res.json({ success: true, inventory, character: { name: character.name, inventory: character.inventory } });
}));

export default router;
