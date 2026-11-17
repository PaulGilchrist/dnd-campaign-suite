/**
 * Party inventory service — CRUD for shared (unclaimed) party items and currency.
 * Data is stored in: public/campaigns/:campaign/data/inventory.json
 */

import utils from '../ui/utils.js';

const apiUrl = (campaignName) => `/api/campaigns/${encodeURIComponent(campaignName)}/inventory`;

/**
 * Guarantee the { currency, items } shape before it reaches React state.
 * Guards against stale servers (the change-data wildcard answers
 * `{ value: null }` with status 200 for unknown keys) and malformed SSE
 * echoes — an undefined/empty payload must never crash the UI.
 */
export function normalizeInventory(raw) {
  if (!raw || typeof raw !== 'object' || (!raw.currency && !raw.items)) {
    console.error('[inventoryService] Invalid party inventory payload:', raw);
    return { currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] };
  }
  const currency = { pp: 0, gp: 0, sp: 0, cp: 0 };
  for (const key of Object.keys(currency)) {
    const value = Number(raw.currency?.[key]);
    currency[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .filter(item => item && typeof item.name === 'string' && item.name.trim())
    .map(item => ({
      id: typeof item.id === 'string' && item.id ? item.id : utils.safeUuid(),
      name: item.name.trim(),
      quantity: Math.max(1, Math.floor(Number(item.quantity)) || 1),
      description: typeof item.description === 'string' ? item.description : '',
    }));
  items.sort((a, b) => a.name.localeCompare(b.name));
  return { currency, items };
}

/**
 * Load the party inventory.
 * @param {string} campaignName
 * @returns {Promise<{ currency: {pp:number,gp:number,sp:number,cp:number}, items: Array }>}
 */
export async function loadInventory(campaignName) {
  const response = await fetch(apiUrl(campaignName));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to load party inventory');
  }
  const data = await response.json();
  return normalizeInventory(data.inventory);
}

/**
 * Atomically apply ONE party-item intent (server re-reads its item ledger and writes only
 * that row — the item mirror of the adjustCurrency coin lane, so concurrent GM windows
 * merge additively and a stale full-list snapshot can never clobber another window's
 * add/edit/step/delete). Intents:
 *   { action: 'add',    item: { id, name, quantity, description } }
 *   { action: 'update', item: { id, name, quantity, description } }
 *   { action: 'setQty', id, quantity, name }
 *   { action: 'delete', id, name }
 * `name` rides on setQty/delete so a concurrent-deletion 409 can be labelled by display
 * name rather than raw id.
 * @param {string} campaignName
 * @param {Object} intent - one item intent, shapes above
 * @returns {Promise<Object>} the merged normalized inventory (currency included)
 * @throws {Error} carries `.status` (409 = the target row vanished) and `.inventory`
 *   (the server's current merged doc attached to a conflict, for the view to adopt)
 */
export async function applyItemIntent(campaignName, intent) {
  const response = await fetch(`${apiUrl(campaignName)}/item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(intent),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const failure = new Error(error.error || 'Failed to update party inventory');
    failure.status = response.status;
    failure.inventory = error.inventory ? normalizeInventory(error.inventory) : undefined;
    throw failure;
  }
  const data = await response.json();
  return normalizeInventory(data.inventory);
}

/**
 * Atomically transfer an item or currency between the party and a player.
 * @param {string} campaignName
 * @param {Object} transfer
 * @param {string} transfer.playerName
 * @param {'party-to-player'|'player-to-party'} transfer.direction
 * @param {string} [transfer.itemName]
 * @param {number} [transfer.quantity]
 * @param {Object} [transfer.currency] - { pp, gp, sp, cp } amounts to move
 * @returns {Promise<{ inventory: Object, character: Object }>}
 */
export async function transferInventory(campaignName, transfer) {
  const response = await fetch(`${apiUrl(campaignName)}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transfer),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to transfer inventory');
  }
  const data = await response.json();
  return { ...data, inventory: normalizeInventory(data.inventory) };
}

/**
 * Atomically apply a signed per-coin delta to the party currency ledger
 * (server-side increment/decrement, each coin clamped at zero — items and
 * existing balances are merged on the server, never from a client snapshot, so
 * two sessions pressing within the same window both land additively). Used by
 * the burst-merged +/- currency chips and the loot Award flow.
 * @param {string} campaignName
 * @param {Object} currency - { pp, gp, sp, cp } signed whole-number deltas
 * @returns {Promise<Object>} the updated normalized inventory
 */
export async function adjustCurrency(campaignName, currency) {
  const response = await fetch(`${apiUrl(campaignName)}/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currency }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to adjust party currency');
  }
  const data = await response.json();
  return normalizeInventory(data.inventory);
}
