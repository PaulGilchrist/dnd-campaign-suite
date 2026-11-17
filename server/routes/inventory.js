import express from 'express';
import fs from 'fs';
import path from 'path';
import guid from 'guid';
import { campaignDataFile, ensureDataDir, campaignDir } from '../utils/campaignPaths.js';
import { publish } from '../utils/changeData.js';
import { addEntry as addLogEntry } from './log.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

// Authority (mirrors campaigns-character.js refuseUnlessGm / maps.js / quests.js /
// campaigns-admin.js): party inventory is the durable campaign treasury — minting
// currency (+/− chip adjusts, loot awards) and disbursing it (party→player transfers,
// item add/edit/delete) are GM-only writes; network clients get a read-only view
// (AGENTS.md). The client hides the chip/button affordances on PartyInventory; this
// route guard is the server seam (bug-player-clients-can-write-party-inventory).
//
// Currency is NEVER written from a client snapshot: every coin movement is an
// additive delta the server applies to ITS current ledger (/inventory/adjust for
// chip grants/removals and loot awards, /inventory/transfer for moves in/out of a
// character purse). Item writes are never full-list snapshots either — POST
// /inventory/item applies ONE add/update/setQty/delete intent keyed by row id onto
// the freshly re-read ledger, so a second GM window can neither clobber a concurrent
// add/edit/step (the residual item face of the cross-tab full-doc clobber) nor
// silently resurrect a row another window deleted (loud 409 + merged doc).
// Audited exception: player→party transfers stay open — a player may contribute from
// their OWN resources; the server debits the character file atomically (409 when short),
// so that lane can never mint treasury wealth. Every ACCEPTED transfer (either direction,
// currency or items) appends exactly ONE campaign-log `inventory_transfer` audit row
// server-side, so a direct-API drain can never pass untraceable. The optional
// `contributedBy` body field is a CLIENT ASSERTION, never identity (the app has no auth):
// it is sanitized + length-capped and recorded alongside a character-name fallback.
const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

function refuseUnlessGm(req, res) {
    if (isLocalhost(req)) return true;
    console.log(`[inventory] BLOCKED non-localhost ${req.method} ${req.originalUrl} — GM-only`);
    res.status(403).json({ error: 'Access denied: GM-only feature' });
    return false;
}

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

// Signed counterpart of sanitizeCurrency for the /adjust delta lane: each coin is a
// whole-number increment/decrement (negative allowed); the ledger clamps at zero when
// the delta is applied, mirroring the client chip's Math.max(0, …) floor.
function sanitizeCurrencyDelta(input) {
    const delta = { pp: 0, gp: 0, sp: 0, cp: 0 };
    if (!input || typeof input !== 'object') return delta;
    for (const key of CURRENCY_KEYS) {
        const raw = Number(input[key]);
        delta[key] = Number.isFinite(raw) ? Math.trunc(raw) : 0;
    }
    return delta;
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

// POST /api/campaigns/:campaign/inventory/item — atomic single-item intent on the party
// ITEM ledger (GM-only). Body (one intent per request):
//   { action: 'add',    item: { id?, name, quantity, description } } — append a new row;
//       a client-supplied id is KEPT (the writer's optimistic row keeps the same key and a
//       retried POST rewrites that row instead of double-adding).
//   { action: 'update', item: { id, name, quantity, description } } — rewrite one row's fields.
//   { action: 'setQty', id, quantity, name? } — absolute quantity for one row.
//   { action: 'delete', id, name? }           — remove one row.
// The server re-reads ITS ledger and applies only the intent, so concurrent GM windows
// merge additively — a stale writer can no longer replace the whole item list and silently
// erase another window's add/edit/step/delete (the residual item face of the cross-tab
// full-doc clobber class the /adjust lane closed for coins). 'update'/'setQty'/'delete'
// on a row a concurrent window already removed 409 with the Notes-family conflict copy
// labelled by display name (the optional `name` rides for exactly that) and the current
// merged doc, never a silent resurrection. Currency is untouched by every intent.
// Merges publish `inventory-<campaign>` like /adjust and /transfer.
const VALID_ITEM_ACTIONS = ['add', 'update', 'setQty', 'delete'];

function sanitizeItemFields(raw) {
    if (!raw || typeof raw !== 'object') return { error: 'item is required' };
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) return { error: 'item.name is required' };
    const quantity = Number(raw.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) return { error: 'quantity must be a positive integer' };
    return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : null,
        name,
        quantity: Math.floor(quantity),
        description: typeof raw.description === 'string' ? raw.description : '',
    };
}

// add/update: rewrite the row keyed by item.id ('add' appends when the id is unknown —
// a retried POST rewrites instead of double-adding; 'update' 409s on a vanished row
// instead of resurrecting it). setQty/delete target the top-level id. Mutates the
// freshly loaded ledger; returns { error } (400), { conflict } (409) or { ok }.
function applyItemUpsert(inventory, body) {
    const clean = sanitizeItemFields(body.item);
    if (clean.error) return clean;
    if (body.action === 'update' && !clean.id) return { error: 'item.id is required to update an item' };
    const index = clean.id ? inventory.items.findIndex(i => i.id === clean.id) : -1;
    if (index >= 0) {
        Object.assign(inventory.items[index], { name: clean.name, quantity: clean.quantity, description: clean.description });
    } else if (body.action === 'update') {
        return { conflict: true, name: clean.name, id: clean.id };
    } else {
        inventory.items.push({ id: clean.id || guid.create().value, name: clean.name, quantity: clean.quantity, description: clean.description });
    }
    return { ok: true };
}

function applyItemRowAction(inventory, body) {
    const id = typeof body.id === 'string' && body.id ? body.id : null;
    if (!id) return { error: 'id is required' };
    if (body.action === 'setQty') {
        const quantity = Number(body.quantity);
        if (!Number.isFinite(quantity) || quantity < 1) return { error: 'quantity must be a positive integer' };
        const target = inventory.items.find(i => i.id === id);
        if (!target) return { conflict: true, name: body.name, id };
        target.quantity = Math.floor(quantity);
        return { ok: true };
    }
    const index = inventory.items.findIndex(i => i.id === id);
    if (index === -1) return { conflict: true, name: body.name, id };
    inventory.items.splice(index, 1);
    return { ok: true };
}

function applyItemAction(inventory, body) {
    if (body.action === 'add' || body.action === 'update') return applyItemUpsert(inventory, body);
    return applyItemRowAction(inventory, body);
}

function itemConflict(res, inventory, name, id) {
    const label = typeof name === 'string' && name.trim() ? name.trim() : id;
    res.status(409).json({
        error: `Party item "${label}" was deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`,
        inventory,
    });
}

router.post('/api/campaigns/:campaign/inventory/item', asyncHandler((req, res) => {
    if (!refuseUnlessGm(req, res)) return;
    const { campaign } = req.params;
    const body = req.body || {};
    if (!VALID_ITEM_ACTIONS.includes(body.action)) {
        return res.status(400).json({ error: 'action must be "add", "update", "setQty" or "delete"' });
    }

    const inventory = loadInventory(campaign);
    const result = applyItemAction(inventory, body);
    if (result.error) {
        return res.status(400).json({ error: result.error });
    }
    if (result.conflict) {
        return itemConflict(res, inventory, result.name, result.id);
    }

    inventory.items = sortItems(inventory.items);
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

// Currency half of a transfer payload: an object with at least one positive
// whole-number coin (sanitizeCurrency truncates + clamps; an all-zero/negative body
// moves nothing, so it is refused like the /adjust lane's zero-delta 400).
function resolveTransferCurrency(currency) {
    if (!currency || typeof currency !== 'object') return null;
    const amount = sanitizeCurrency(currency);
    if (!CURRENCY_KEYS.some(key => amount[key] > 0)) {
        return { error: 'currency must contain a positive whole-number amount' };
    }
    return amount;
}

function validateTransferRequest(body) {
    const itemName = typeof body?.itemName === 'string' ? body.itemName.trim() : '';
    const currencyAmount = resolveTransferCurrency(body?.currency);
    if (currencyAmount?.error) return currencyAmount;
    const quantity = Math.floor(Number(body?.quantity));

    if (!itemName && !currencyAmount) {
        return { error: 'itemName or currency is required' };
    }
    if (itemName && currencyAmount) {
        return { error: 'Transfer one item or one currency set per request' };
    }
    if (itemName && (!Number.isFinite(quantity) || quantity < 1)) {
        return { error: 'quantity must be a positive integer' };
    }

    return { ok: true, quantity, cleanName: itemName, currencyAmount };
}

// Attribution for the transfer audit row. `contributedBy` is a client-supplied actor
// string (a contribution claim on the open player→party lane) — whitespace-collapsed,
// length-capped, NEVER trusted as identity; absent/garbage falls back to the character
// name the server actually debited or credited.
const MAX_CONTRIBUTOR_LENGTH = 80;

function sanitizeContributor(raw) {
    if (typeof raw !== 'string') return null;
    const collapsed = raw.replace(/\s+/g, ' ').trim();
    return collapsed ? collapsed.slice(0, MAX_CONTRIBUTOR_LENGTH) : null;
}

function describeTransferMove(currencyAmount, cleanName, quantity) {
    if (currencyAmount) {
        return CURRENCY_KEYS
            .filter(key => currencyAmount[key] > 0)
            .map(key => `${currencyAmount[key]} ${key}`)
            .join(', ');
    }
    return `${quantity} × ${cleanName}`;
}

// One audit row per ACCEPTED transfer, mirroring the copy the UI used to write
// client-side (the /transfer lane's addEntry calls were removed with this server
// stamp, so a UI transfer and a direct-API drain each land exactly one row).
function logTransferAudit(campaign, { direction, characterName, currencyAmount, cleanName, quantity, contributedBy }) {
    const movement = describeTransferMove(currencyAmount, cleanName, quantity);
    const message = direction === 'party-to-player'
        ? `${movement} moved from party inventory to ${characterName}`
        : `${movement} moved from ${characterName} to party inventory`;
    addLogEntry(campaign, {
        type: 'inventory_transfer',
        message,
        contributedBy: sanitizeContributor(contributedBy) || characterName,
    });
}

// POST /api/campaigns/:campaign/inventory/transfer — atomic party<->player move
// body: { playerName, itemName, quantity } or { playerName, currency: {pp,gp,sp,cp} },
// plus the optional client-asserted `contributedBy` actor string (see header note).
// GM-only for party→player (disbursement); player→party contributions stay open to
// every client (server-verified debit — see header audit note). Every accepted move
// appends exactly ONE server-side campaign-log audit row after the writes land.
router.post('/api/campaigns/:campaign/inventory/transfer', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const { playerName, direction } = req.body || {};
    if (direction !== 'player-to-party' && !refuseUnlessGm(req, res)) return;

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
    logTransferAudit(campaign, {
        direction,
        characterName: character.name || playerName,
        currencyAmount,
        cleanName,
        quantity,
        contributedBy: req.body?.contributedBy,
    });

    res.json({ success: true, inventory, character: { name: character.name, inventory: character.inventory } });
}));

// POST /api/campaigns/:campaign/inventory/adjust — atomic per-coin delta on the party
// currency ledger (the +/− chip flush and the loot Award panel). Body:
// { currency: {pp,gp,sp,cp} } with SIGNED whole-number amounts; each coin is added to
// the SERVER's current ledger and clamped at zero. The ledger is re-read server-side,
// so concurrent writers merge additively — a stale client snapshot can neither clobber
// items nor another session's presses (this lane replaced the /deposit credit-only
// route and the chip's full-document snapshot POST after the cross-tab clobber bug).
// GM-only: chips and the loot Award panel are already localhost-gated in the client.
router.post('/api/campaigns/:campaign/inventory/adjust', asyncHandler((req, res) => {
    if (!refuseUnlessGm(req, res)) return;
    const { campaign } = req.params;
    const amount = sanitizeCurrencyDelta(req.body?.currency);
    if (!CURRENCY_KEYS.some(key => amount[key] !== 0)) {
        return res.status(400).json({ error: 'currency with a non-zero whole-number amount is required' });
    }

    const inventory = loadInventory(campaign);
    for (const key of CURRENCY_KEYS) {
        inventory.currency[key] = Math.max(0, inventory.currency[key] + amount[key]);
    }
    saveInventory(campaign, inventory);
    publish(`inventory-${campaign}`, inventory, campaign);

    res.json({ success: true, inventory });
}));

export default router;
