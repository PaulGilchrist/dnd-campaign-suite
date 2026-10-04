/**
 * Party inventory service — CRUD for shared (unclaimed) party items and currency.
 * Data is stored in: public/campaigns/:campaign/data/inventory.json
 */

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
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
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
 * Save the entire party inventory (full overwrite; server re-sorts items).
 * @param {string} campaignName
 * @param {Object} inventory
 */
export async function saveInventory(campaignName, inventory) {
  const response = await fetch(apiUrl(campaignName), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inventory),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to save party inventory');
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
