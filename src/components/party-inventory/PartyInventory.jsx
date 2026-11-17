import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import utils from '../../services/ui/utils.js';
import { addEntry } from '../../services/ui/logService.js';
import { loadEquipment } from '../../services/ui/dataLoader.js';
import { loadInventory, applyItemIntent, adjustCurrency, transferInventory, normalizeInventory } from '../../services/campaign/inventoryService.js';
import { characterCurrency } from '../../services/campaign/characterCurrency.js';
import Popup from '../common/Popup.jsx';
import { useModalDismiss } from '../../hooks/ui/useModalDismiss.js';
import './PartyInventory.css';

const CURRENCIES = [
  { key: 'pp', label: 'Platinum', icon: 'fa-solid fa-coins' },
  { key: 'gp', label: 'Gold', icon: 'fa-solid fa-circle-dollar-to-slot' },
  { key: 'sp', label: 'Silver', icon: 'fa-solid fa-medal' },
  { key: 'cp', label: 'Copper', icon: 'fa-solid fa-penny' },
];

const AMOUNT_CHIPS = [1, 10, 100];

const CURRENCY_KEYS = CURRENCIES.map(({ key }) => key);

// Trailing debounce for currency chip writes (backlog 2026-10-24): a click-burst
// collapses to ONE flush ~400 ms after the last click. Each click still updates the
// optimistic local balance instantly; the burst flushes as the summed signed per-coin
// DELTA posted to the atomic server adjust lane — never a document snapshot, so a
// second GM window pressing within the same window lands additively instead of being
// clobbered (cross-tab full-doc clobber fix). Benign network/save debounce
// (no-timers guard).
const CURRENCY_PERSIST_DEBOUNCE_MS = 400;

const EMPTY_FORM = { id: '', name: '', quantity: 1, description: '' };

// Row label for the 409 conflict alert — mirrors the server's itemConflict fallback
// (trimmed name, row id when no name is known). setQty/delete intents carry `name`;
// modal update intents carry the row under `item`.
function conflictItemLabel(intent) {
  const name = intent.name || intent.item?.name;
  const label = typeof name === 'string' && name.trim() ? name.trim() : (intent.id || intent.item?.id);
  return `"${label}"`;
}

const sortByName = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name));

// Equipment-name matching normalization (backlog 2026-10-24): lowercase, trim, collapse
// whitespace, and PHB sort-order inversion — "Rope, Hempen" ≡ "Hempen Rope" via a single
// comma split, but only when the comma sits outside parentheses so thousands separators
// ("Agate (1,000 gp)") stay verbatim. Deliberately conservative: no substring or
// edit-distance fuzzy matching — "Rope" alone must NOT match "Hempen Rope". When several
// entries normalize to the same key, Array#find resolves to the first in data order
// (deterministic; pinned by tests).
function normalizeEquipmentName(name) {
  const text = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const comma = text.indexOf(',');
  if (comma === -1 || text.slice(0, comma).includes('(')) return text;
  const head = text.slice(0, comma).trim();
  const tail = text.slice(comma + 1).trim();
  return head && tail ? `${tail} ${head}` : text;
}

function findEquipmentByName(equipmentData, name) {
  const query = normalizeEquipmentName(name);
  return equipmentData.find(eq => normalizeEquipmentName(eq.name) === query) || null;
}

function normalizeBackpack(backpack) {
  if (!Array.isArray(backpack)) return [];
  return backpack
    .map(item => (typeof item === 'string' ? item.trim() : (item && typeof item.name === 'string' ? item.name.trim() : '')))
    .filter(name => name.length > 0);
}

function playerItemQuantity(character, name) {
  const backpack = normalizeBackpack(character.inventory?.backpack);
  const present = backpack.filter(n => n.toLowerCase() === name.toLowerCase()).length;
  const meta = (character.inventory?.itemMeta || {})[name]
    || Object.entries(character.inventory?.itemMeta || {}).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
  const metaQty = meta && Number.isFinite(Number(meta.quantity)) ? Math.floor(Number(meta.quantity)) : 1;
  return Math.max(present, metaQty);
}

function playerItemDescription(character, name) {
  const meta = (character.inventory?.itemMeta || {})[name]
    || Object.entries(character.inventory?.itemMeta || {}).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
  return (meta && meta.description) || '';
}

function EquipmentNameInput({ value, onChange, equipmentData, id }) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];
    return equipmentData
      .filter(eq => eq.name.toLowerCase().includes(query) && eq.name.toLowerCase() !== query)
      .slice(0, 8);
  }, [value, equipmentData]);

  return (
    <div className="pi-name-input-wrap">
      <input
        id={id}
        type="text"
        className="ct-input"
        value={value}
        placeholder="Item name (free text allowed)…"
        autoComplete="off"
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="pi-suggestions">
          {suggestions.map(eq => (
            <li key={eq.index || eq.name}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(eq.name);
                  setShowSuggestions(false);
                }}
              >
                {eq.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Row-scoped step labels (backlog 2026-11-17 CD): the generic "Increase quantity" pair
// was indistinguishable between rows and shared its class with the currency chips, so
// an accessible-name locator could not resolve one row's stepper. The label names the
// item — same title+aria-label idiom as the Edit/Move/Delete action buttons.
function QuantityStepper({ quantity, itemLabel, onStep, onSet }) {
  const decreaseLabel = `Decrease quantity of ${itemLabel}`;
  const increaseLabel = `Increase quantity of ${itemLabel}`;
  return (
    <span className="pi-qty-stepper">
      <button
        type="button"
        className="pi-step-btn"
        title={decreaseLabel}
        aria-label={decreaseLabel}
        onClick={() => onStep(-1)}
        disabled={quantity <= 1}
      >
        <i className="fa-solid fa-minus" />
      </button>
      <input
        type="number"
        className="pi-qty-input"
        min="1"
        value={quantity}
        aria-label="Quantity"
        onChange={(e) => onSet(parseInt(e.target.value, 10) || 1)}
      />
      <button
        type="button"
        className="pi-step-btn"
        title={increaseLabel}
        aria-label={increaseLabel}
        onClick={() => onStep(1)}
      >
        <i className="fa-solid fa-plus" />
      </button>
    </span>
  );
}

// The hint line (improve 2026-11-16) states the two mental models explicitly: stepper
// changes save to the party pool automatically (debounced), while Give opens a transfer
// modal. Background sections go `inert` (see PartyInventory) while any .pi-modal-overlay
// is open, so a dwelling user sees the view is parked rather than having clicks eaten.
function CurrencyCard({ currency, onAdjust, onGiveOpen, disabled, isLocalhost, inert }) {
  return (
    <div className="pi-currency-card" inert={inert}>
      <h3><i className="fa-solid fa-sack-dollar" /> Party Currency</h3>
      <p className="pi-move-note">
        <i className="fa-solid fa-circle-info" /> Amount buttons save to the party pool
        automatically; Give opens a transfer to a player.
      </p>
      {CURRENCIES.map(({ key, label, icon }) => (
        <div key={key} className="pi-currency-row">
          <span className="pi-currency-label"><i className={icon} /> {label}</span>
          <span className="pi-currency-amount">{currency[key]}</span>
          {/* Adjust/Give chips are GM-only writes to the durable treasury — hidden on
              network (player) views; the server refuses them too (inventory.js refuseUnlessGm). */}
          {isLocalhost && (
          <span className="pi-currency-chips">
            {AMOUNT_CHIPS.map(amount => (
              <span key={amount} className="pi-chip-pair">
                {/* aria-label mirrors the title so the chip's accessible name is the
                    intent ("Add 1 cp"), never the bare "+1" glyph (backlog 2026-11-17 CD:
                    name queries must not have to guess between chips and steppers). */}
                <button
                  type="button"
                  className="pi-step-btn ct-btn"
                  title={`Add ${amount} ${key}`}
                  aria-label={`Add ${amount} ${key}`}
                  disabled={disabled}
                  onClick={() => onAdjust(key, amount)}
                >
                  +{amount}
                </button>
                <button
                  type="button"
                  className="pi-step-btn ct-btn"
                  title={`Remove ${amount} ${key}`}
                  aria-label={`Remove ${amount} ${key}`}
                  disabled={disabled || currency[key] < amount}
                  onClick={() => onAdjust(key, -amount)}
                >
                  −{amount}
                </button>
              </span>
            ))}
            {/* Same title→aria mirror as the amount chips above (backlog 2026-11-17 CE):
                without it the accessible name is the bare "Give" ×4 — identical across
                the coin rows, the exact ambiguity dc1bf7b29 set out to kill. */}
            <button
              type="button"
              className="ct-btn pi-give-btn"
              title={`Give ${label} to a player`}
              aria-label={`Give ${label} to a player`}
              disabled={disabled || currency[key] <= 0}
              onClick={onGiveOpen}
            >
              <i className="fa-solid fa-hand-holding-heart" /> Give
            </button>
          </span>
          )}
        </div>
      ))}
    </div>
  );
}

// The Give transfer modal. Positive whole-number amounts entered here, in CURRENCIES
// order (all 0 → submit disabled, no accidental transfer on Enter); the native confirm
// names the player + exact sums BEFORE the /inventory/transfer POST. Escape and a pure
// backdrop click route to the same close lane as Cancel (useModalDismiss family law);
// the player select autoFocuses so those lanes answer before the first click too.
function GiveCurrencyModal({ currency, characters, giveState, onChange, onClose, onTransfer }) {
  const giveEntries = CURRENCIES
    .map(({ key }) => [key, Math.floor(Number(giveState.amounts[key]))])
    .filter(([, n]) => Number.isFinite(n) && n > 0);

  const { handleKeyDown, handleOverlayMouseDown, handleOverlayClick } =
    useModalDismiss(onClose, { panelSelector: '.pi-modal' });

  const applyGive = () => {
    if (giveEntries.length === 0) return;
    const parts = giveEntries.map(([k, v]) => `${v} ${k}`).join(', ');
    if (!window.confirm(`Give ${parts} to ${giveState.playerName}?`)) return;
    onTransfer(giveState.playerName, Object.fromEntries(giveEntries));
    onClose();
  };

  return (
    <div
      className="pi-modal-overlay"
      role="presentation"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div className="ct-modal pi-modal" role="dialog" aria-modal="true" aria-labelledby="pi-give-title">
        <div className="ct-modal-header">
          <h3 id="pi-give-title">Give Currency to Player</h3>
          <button className="ct-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="ct-modal-body">
          <label className="ct-label" htmlFor="pi-give-player">Player</label>
          <select
            id="pi-give-player"
            className="ct-select"
            value={giveState.playerName}
            autoFocus
            onChange={(e) => onChange(prev => ({ ...prev, playerName: e.target.value }))}
          >
            {characters.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          {CURRENCIES.map(({ key, label }) => (
            <div key={key} className="pi-currency-give-row">
              <span className="pi-currency-label">{label} (party has {currency[key]})</span>
              <input
                type="number"
                className="ct-input pi-qty-input"
                min="0"
                max={currency[key]}
                value={giveState.amounts[key] ?? 0}
                onChange={(e) => onChange(prev => ({
                  ...prev,
                  amounts: { ...prev.amounts, [key]: Math.max(0, Math.min(currency[key], parseInt(e.target.value, 10) || 0)) },
                }))}
              />
            </div>
          ))}
        </div>
        <div className="ct-modal-footer">
          <div className="ct-modal-buttons">
            <button className="ct-btn" onClick={onClose}>Cancel</button>
            <button
              className="ct-btn ct-btn-primary"
              onClick={applyGive}
              disabled={!giveState.playerName || giveEntries.length === 0}
            >
              <i className="fa-solid fa-hand-holding-heart" /> Give
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemEditModal({ form, equipmentData, isNew, saving, onChange, onClose, onSave }) {
  const { handleKeyDown, handleOverlayMouseDown, handleOverlayClick } =
    useModalDismiss(onClose, { disabled: saving, panelSelector: '.pi-modal' });
  return (
    <div
      className="pi-modal-overlay"
      role="presentation"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div className="ct-modal pi-modal" role="dialog" aria-modal="true" aria-labelledby="pi-item-title">
        <div className="ct-modal-header">
          <h3 id="pi-item-title">{isNew ? 'Add Item' : `Edit ${form.name}`}</h3>
          <button className="ct-modal-close" onClick={onClose} disabled={saving} aria-label="Close">&times;</button>
        </div>
        <div className="ct-modal-body">
          <label className="ct-label" htmlFor="pi-item-name">Name <span className="ct-required">*</span></label>
          <EquipmentNameInput
            id="pi-item-name"
            value={form.name}
            onChange={(name) => onChange({ ...form, name })}
            equipmentData={equipmentData}
          />
          <label className="ct-label" htmlFor="pi-item-qty">Quantity</label>
          <input
            id="pi-item-qty"
            type="number"
            className="ct-input"
            min="1"
            value={form.quantity}
            onChange={(e) => onChange({ ...form, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
          />
          <label className="ct-label" htmlFor="pi-item-desc">Description</label>
          <textarea
            id="pi-item-desc"
            className="ct-input pi-desc-textarea"
            rows={4}
            value={form.description}
            placeholder="Description… picked from equipment.json when the name matches, editable here"
            onChange={(e) => onChange({ ...form, description: e.target.value })}
          />
        </div>
        <div className="ct-modal-footer">
          <div className="ct-modal-buttons">
            <button className="ct-btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button
              className="ct-btn ct-btn-primary"
              onClick={onSave}
              disabled={saving || !form.name.trim()}
            >
              <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoveToPlayerModal({ item, characters, quantity, onQuantityChange, player, onPlayerChange, saving, onClose, onConfirm }) {
  const { handleKeyDown, handleOverlayMouseDown, handleOverlayClick } =
    useModalDismiss(onClose, { disabled: saving, panelSelector: '.pi-modal' });
  return (
    <div
      className="pi-modal-overlay"
      role="presentation"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div className="ct-modal pi-modal" role="dialog" aria-modal="true" aria-labelledby="pi-move-title">
        <div className="ct-modal-header">
          <h3 id="pi-move-title">Move “{item.name}” to Player</h3>
          <button className="ct-modal-close" onClick={onClose} disabled={saving} aria-label="Close">&times;</button>
        </div>
        <div className="ct-modal-body">
          <label className="ct-label" htmlFor="pi-move-player">Player</label>
          <select id="pi-move-player" className="ct-select" value={player} autoFocus onChange={(e) => onPlayerChange(e.target.value)}>
            {characters.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <label className="ct-label">Quantity (party has {item.quantity})</label>
          <QuantityStepper
            itemLabel={item.name}
            quantity={quantity}
            onStep={(delta) => onQuantityChange(Math.max(1, Math.min(item.quantity, quantity + delta)))}
            onSet={(v) => onQuantityChange(Math.max(1, Math.min(item.quantity, v)))}
          />
          <p className="pi-move-note">Item is added to {player || 'the player'}&rsquo;s backpack.</p>
        </div>
        <div className="ct-modal-footer">
          <div className="ct-modal-buttons">
            <button className="ct-btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button
              className="ct-btn ct-btn-primary"
              onClick={onConfirm}
              disabled={saving || !player}
            >
              <i className="fa-solid fa-right-to-bracket" /> Move to Player
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Move-copy builders (backlog 2026-11-17 CD): the From Players `To Party` buttons used
// to be undifferentiated `.pi-move-btn`s — the row was identifiable only by ancestor
// text. Each button now carries the exact copy its native confirm computes (minus the
// "?") as title/aria-label, and the confirm reuses these builders so label and dialog
// copy can never drift apart.
function currencyMoveCopy(coin, characterName) {
  return `Move ${coin.amount} ${coin.key} from ${characterName} to party inventory`;
}

function playerItemMoveCopy(entry, characterName) {
  return `Move ${entry.quantity} × ${entry.name} from ${characterName} to party inventory`;
}

function PlayersPanel({ characters, campaignName, onMoved, beforeTransfer }) {
  const [selected, setSelected] = useState(null);
  const [moving, setMoving] = useState(null);

  const character = useMemo(
    () => characters.find(c => c.name === selected) || null,
    [characters, selected]
  );

  const backpack = useMemo(() => {
    if (!character) return [];
    const names = [...new Set(normalizeBackpack(character.inventory?.backpack))];
    return sortByName(names.map(name => ({
      name,
      quantity: playerItemQuantity(character, name),
      description: playerItemDescription(character, name),
    })));
  }, [character]);

  // Currency rows (bug-player-currency-give-is-one-way-invisible): the Give lane
  // writes into the character file, so the same player fetch that lists backpack
  // items must surface the purse with a matching `To Party` return. One row per
  // non-zero coin, CURRENCIES order — mirrors the party CurrencyCard layout.
  // Purse resolution lives in the shared services/campaign/characterCurrency.js
  // (single client mirror of the server rule, also used by the sheet's Purse row).
  const purse = useMemo(() => {
    if (!character) return [];
    const currency = characterCurrency(character);
    return CURRENCIES
      .map(({ key, label, icon }) => ({ key, label, icon, amount: currency[key] }))
      .filter(row => row.amount > 0);
  }, [character]);

  const handleMove = async (entry) => {
    if (!character) return;
    // Native confirm naming qty + item + source player + party destination, mirroring
    // the currency Give / Delete idioms (backlog 2026-10-24). Refuse = zero writes.
    if (!window.confirm(`${playerItemMoveCopy(entry, character.name)}?`)) return;
    // Drain any debounced currency-chip deltas first (handleConfirmMove idiom) so the
    // pool credits in click order and the transfer lands on top of the pending batch.
    if (beforeTransfer) beforeTransfer();
    setMoving(entry.name);
    try {
      // The server appends the `N × X moved from <char> to party inventory` audit
      // row on every accepted /transfer — no client-side addEntry here (dedup: a UI
      // transfer must land exactly one row, direct-API drains stay traceable too).
      await transferInventory(campaignName, {
        direction: 'player-to-party',
        playerName: character.name,
        itemName: entry.name,
        quantity: entry.quantity,
      });
      await onMoved();
    } catch (error) {
      console.error('[PartyInventory] player-to-party move failed:', error);
      alert(`Move failed: ${error.message}`);
    } finally {
      setMoving(null);
    }
  };

  // Currency return lane — the exact reverse of GiveCurrencyModal's party-to-player
  // transfer: same native-confirm idiom naming coin + source player + party
  // destination, same atomic player-to-party POST (the server debits the character
  // file and credits the pool, 409 when short); the server writes the directional
  // audit row for every accepted transfer.
  const handleCurrencyMove = async (coin) => {
    if (!character) return;
    const stateKey = `currency:${coin.key}`;
    if (!window.confirm(`${currencyMoveCopy(coin, character.name)}?`)) return;
    if (beforeTransfer) beforeTransfer();
    setMoving(stateKey);
    try {
      await transferInventory(campaignName, {
        direction: 'player-to-party',
        playerName: character.name,
        currency: { [coin.key]: coin.amount },
      });
      await onMoved();
    } catch (error) {
      console.error('[PartyInventory] player-to-party currency move failed:', error);
      alert(`Move failed: ${error.message}`);
    } finally {
      setMoving(null);
    }
  };

  return (
    <div className="pi-players-panel">
      <h3><i className="fa-solid fa-user-injured" /> From Players</h3>
      <select
        className="ct-select"
        value={selected || ''}
        onChange={(e) => setSelected(e.target.value || null)}
        aria-label="Choose player"
      >
        <option value="">Choose a player…</option>
        {characters.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
      </select>
      {character && backpack.length === 0 && purse.length === 0 && (
        <p className="pi-empty">Nothing in {character.name}&rsquo;s backpack.</p>
      )}
      <ul className="pi-player-items">
        {purse.map(coin => (
          <li key={`currency-${coin.key}`}>
            <span className="pi-player-item-name"><i className={coin.icon} /> {coin.label}</span>
            <span className="pi-player-item-qty">{coin.amount} {coin.key}</span>
            <button
              type="button"
              className="ct-btn ct-btn-primary pi-move-btn"
              title={currencyMoveCopy(coin, character.name)}
              aria-label={currencyMoveCopy(coin, character.name)}
              disabled={moving !== null}
              onClick={() => handleCurrencyMove(coin)}
            >
              <i className="fa-solid fa-box-open" /> {moving === `currency:${coin.key}` ? 'Moving…' : 'To Party'}
            </button>
          </li>
        ))}
        {backpack.map(entry => (
          <li key={entry.name}>
            <span className="pi-player-item-name">{entry.name}</span>
            <span className="pi-player-item-qty">×{entry.quantity}</span>
            <button
              type="button"
              className="ct-btn ct-btn-primary pi-move-btn"
              title={playerItemMoveCopy(entry, character.name)}
              aria-label={playerItemMoveCopy(entry, character.name)}
              disabled={moving !== null}
              onClick={() => handleMove(entry)}
            >
              <i className="fa-solid fa-box-open" /> {moving === entry.name ? 'Moving…' : 'To Party'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PartyInventory({ campaignName, characters = [], isLocalhost }) {
  const [inventory, setInventory] = useState({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveQuantity, setMoveQuantity] = useState(1);
  const [movePlayer, setMovePlayer] = useState('');
  const [equipmentData, setEquipmentData] = useState([]);
  const [popupHtml, setPopupHtml] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Give-transfer modal state, lifted from CurrencyCard (improve 2026-11-16) so ONE
  // flag owns "a Party-Inventory modal is open" — that flag drives both the real
  // `disabled` on the currency chips and the `inert` veil on every background section,
  // making the open modal obvious instead of silently swallowing clicks.
  const [giveState, setGiveState] = useState(null);

  // Serialize the ITEM lane as atomic per-row intents (bug-inventory-item-save-concurrent-
  // snapshot-last-writer-wins): writes used to POST the tab's whole item list, so a second
  // GM window's stale snapshot silently erased a concurrent add/edit/step/delete. Each
  // write now queues ONE add/update/setQty/delete intent keyed by row id (FIFO, one
  // in-flight POST per endpoint) which the server applies onto ITS freshly re-read ledger
  // — concurrent windows merge additively. A revision stamp still drops stale acks so
  // out-of-order responses can never wipe landed edits (playbook §39).
  // Currency chips no longer ride this queue at all: they accumulate signed
  // per-coin deltas behind the trailing debounce and flush through the atomic
  // server-side /adjust lane (cross-tab full-doc clobber fix — the server clamps and
  // adds onto ITS ledger, so two GM windows both land).
  const inventoryRef = useRef(inventory);
  const persistQueueRef = useRef({ saving: false, pending: [] });
  const currencyQueueRef = useRef({ saving: false, delta: { pp: 0, gp: 0, sp: 0, cp: 0 } });
  const localRevRef = useRef(0);
  const currencyDebounceRef = useRef(null);

  const applyInventory = useCallback((next, { ack = false } = {}) => {
    if (!ack) localRevRef.current += 1;
    inventoryRef.current = next;
    setInventory(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await loadInventory(campaignName);
      applyInventory(data);
    } catch (error) {
      console.error('[PartyInventory] load failed:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignName, applyInventory]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    loadEquipment().then(setEquipmentData).catch(err => console.error('[PartyInventory] equipment load failed:', err));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSSE(campaignName, (event) => {
      if (event.key === `inventory-${campaignName}`) {
        applyInventory(normalizeInventory(event.data));
      }
    });
    return unsubscribe;
  }, [campaignName, applyInventory]);

  // Items lane: one intent POST in flight at a time, FIFO; each POST carries a single
  // add/update/setQty/delete the server applies onto ITS re-read ledger (currency is
  // server-owned — see flushCurrencyDelta). The delete audit row is written ONLY after
  // the server acked the removal (delete-item-log idiom).
  const flushPersist = useCallback(function flushPersistQueue() {
    const queue = persistQueueRef.current;
    if (queue.saving || queue.pending.length === 0) return;
    const intent = queue.pending.shift();
    const rev = localRevRef.current;
    queue.saving = true;
    setSaving(true);
    applyItemIntent(campaignName, intent)
      .then(saved => {
        // Post-ack only: the Removed row can never claim a deletion the ledger refused.
        // It lands even when a newer local edit already owns the display (whose ack the
        // revision guard below drops) — the server write itself succeeded.
        if (intent.action === 'delete') {
          addEntry(campaignName, {
            type: 'inventory_transfer',
            message: `Removed "${intent.name}" from party inventory`,
            timestamp: Date.now(),
          }).catch(err => console.error('[PartyInventory] log error:', err));
        }
        // Stale-response guard: a newer local edit superseded this intent's ack.
        if (localRevRef.current !== rev) return;
        applyInventory(saved, { ack: true });
      })
      .catch(error => {
        // A 409 conflict carries the server's current merged doc — adopt it: the row
        // vanished in another window, so neither the write nor its optimistic echo
        // survives (409s stay loud: this window's view just lost to a concurrent write).
        // Adoption makes the server sentence's "reload the list" advice dead here —
        // this window shows the current list WITHOUT a reload, so the 409 branch
        // speaks for itself; only non-409 failures quote the server verbatim.
        const merged = error.status === 409 && error.inventory ? error.inventory : null;
        if (merged) {
          applyInventory(merged);
        }
        if (intent.action === 'delete') {
          console.error('[PartyInventory] delete failed:', error);
          alert(merged
            ? `Party item ${conflictItemLabel(intent)} was already deleted elsewhere — this window now shows the current list.`
            : `Delete failed: ${error.message}`);
          // Roll the optimistic delete back so the row re-appears in the open view
          // (server kept the item). The stale guard mirrors the ack above: a newer
          // local edit made while this write was in flight owns the display.
          if (!merged && localRevRef.current === rev) applyInventory(intent.previous);
        } else {
          console.error('[PartyInventory] save failed:', error);
          alert(merged
            ? `Party item ${conflictItemLabel(intent)} was deleted elsewhere — this window now shows the current list; your edit was NOT saved.`
            : `Save failed: ${error.message}`);
        }
      })
      .finally(() => {
        queue.saving = false;
        setSaving(false);
        flushPersistQueue();
      });
  }, [campaignName, applyInventory]);

  // Currency lane: the burst's summed signed per-coin delta goes to the atomic
  // server adjust lane, which clamps-and-adds onto ITS ledger — concurrent presses
  // from other GM sessions merge additively, a snapshot can never clobber one
  // (cross-tab full-doc clobber fix). Every accepted batch writes an audit row:
  // a treasury mint is never silent.
  const flushCurrencyDelta = useCallback(function flushCurrencyQueue() {
    const queue = currencyQueueRef.current;
    if (queue.saving) return;
    const amount = { ...queue.delta };
    if (!CURRENCY_KEYS.some(key => amount[key] !== 0)) return;
    for (const key of CURRENCY_KEYS) queue.delta[key] = 0;
    const rev = localRevRef.current;
    queue.saving = true;
    setSaving(true);
    adjustCurrency(campaignName, amount)
      .then(saved => {
        const parts = CURRENCY_KEYS
          .filter(key => amount[key] !== 0)
          .map(key => `${amount[key] > 0 ? `+${amount[key]}` : amount[key]} ${key}`)
          .join(', ');
        addEntry(campaignName, {
          type: 'inventory_transfer',
          message: `Party currency adjusted: ${parts}`,
          timestamp: Date.now(),
        }).catch(err => console.error('[PartyInventory] log error:', err));
        // Stale-response guard mirrors flushPersist.
        if (localRevRef.current !== rev) return;
        applyInventory(saved, { ack: true });
      })
      .catch(error => {
        console.error('[PartyInventory] currency adjustment failed:', error);
        alert(`Currency save failed: ${error.message}`);
      })
      .finally(() => {
        queue.saving = false;
        setSaving(false);
        flushCurrencyQueue();
      });
  }, [campaignName, applyInventory]);

  // Trailing debounce (network/save debounce — permitted by no-timers guard): each chip
  // click resets the timer, so a burst flushes once, ~CURRENCY_PERSIST_DEBOUNCE_MS after
  // the last click. If a flush is already in flight the pending deltas ride the
  // existing finally-refill; the expired timer then harmlessly no-ops.
  const scheduleCurrencyFlush = useCallback(() => {
    if (currencyDebounceRef.current) clearTimeout(currencyDebounceRef.current);
    currencyDebounceRef.current = setTimeout(() => {
      currencyDebounceRef.current = null;
      flushCurrencyDelta();
    }, CURRENCY_PERSIST_DEBOUNCE_MS);
  }, [flushCurrencyDelta]);

  // Cancel any scheduled burst flush and POST the pending deltas now — used by atomic
  // transfer/move/delete so the chip batch lands on the server ledger in click order
  // ahead of the transfer's own delta.
  const flushCurrencyPersist = useCallback(() => {
    if (currencyDebounceRef.current) {
      clearTimeout(currencyDebounceRef.current);
      currencyDebounceRef.current = null;
    }
    flushCurrencyDelta();
  }, [flushCurrencyDelta]);

  // Never leave a debounced burst stranded by navigation away from the page.
  useEffect(() => {
    const pendingRef = currencyDebounceRef;
    const flush = flushCurrencyPersist;
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
      flush();
    };
  }, [flushCurrencyPersist]);

  const queueItemIntent = useCallback((intent) => {
    persistQueueRef.current.pending.push(intent);
    flushPersist();
  }, [flushPersist]);

  // Currency chip path: optimistic display is instant, and the click contributes its
  // optimistic difference to the pending signed delta (a press that the zero floor
  // swallows contributes nothing — no phantom POST). The burst flushes as ONE /adjust
  // delta POST after the quiet window.
  const handleCurrencyAdjust = (key, delta) => {
    const prev = inventoryRef.current;
    const current = prev.currency[key] || 0;
    const nextAmount = Math.max(0, current + delta);
    if (nextAmount === current) return;
    applyInventory({ ...prev, currency: { ...prev.currency, [key]: nextAmount } });
    currencyQueueRef.current.delta[key] += nextAmount - current;
    scheduleCurrencyFlush();
  };

  const handleCurrencyTransfer = (playerName, amounts) => {
    flushCurrencyPersist();
    setSaving(true);
    transferInventory(campaignName, { direction: 'party-to-player', playerName, currency: amounts })
      .then(result => {
        // The server's accepted /transfer POST already appended the
        // `<parts> moved from party inventory to <player>` audit row — no client
        // duplicate (exactly one row per transfer, either lane face).
        applyInventory(result.inventory);
      })
      .catch(error => {
        console.error('[PartyInventory] currency transfer failed:', error);
        alert(`Transfer failed: ${error.message}`);
      })
      .finally(() => setSaving(false));
  };

  const handleAddItem = () => setEditForm({ ...EMPTY_FORM });

  const handleNameChange = (form, name) => {
    const match = findEquipmentByName(equipmentData, name);
    let description = form.description;
    if (match && (form.id === '' || !description)) {
      description = Array.isArray(match.description) ? match.description.join('\n\n') : (match.description || '');
    }
    return { ...form, name, description };
  };

  const handleSaveItem = () => {
    const name = editForm.name.trim();
    if (!name) return;
    const inv = inventoryRef.current;
    // Resolve the target row before sending: an edit carries its id; a new add matching a
    // stored row's name (case-insensitive) rewrites that row — the historic modal
    // behaviour. A genuinely new row keeps a locally minted id so later stepper/delete
    // intents resolve the same key before the ack lands. No id → server-side 'add'
    // appends onto ITS ledger (never a whole-list replace).
    const targetId = editForm.id
      || inv.items.find(i => i.name.toLowerCase() === name.toLowerCase())?.id
      || null;
    const row = { name, quantity: Math.max(1, editForm.quantity), description: editForm.description };
    const items = [...inv.items];
    const existingIndex = targetId ? items.findIndex(i => i.id === targetId) : -1;
    let id = targetId;
    if (existingIndex === -1) {
      id = targetId || utils.safeUuid();
      items.push({ id, ...row });
    } else {
      items[existingIndex] = { ...items[existingIndex], ...row };
    }
    setEditForm(null);
    applyInventory({ ...inv, items });
    queueItemIntent(targetId
      ? { action: 'update', item: { id: targetId, ...row } }
      : { action: 'add', item: { id, ...row } });
  };

  // Stepper/qty-set path: ONE server-owned absolute quantity for one row — concurrent
  // windows stepping other rows merge instead of replacing each other's lists.
  const setItemQuantity = (item, quantity) => {
    const inv = inventoryRef.current;
    const current = inv.items.find(i => i.id === item.id);
    if (!current || current.quantity === quantity) return;
    applyInventory({ ...inv, items: inv.items.map(i => i.id === item.id ? { ...i, quantity } : i) });
    queueItemIntent({ action: 'setQty', id: item.id, quantity, name: current.name });
  };

  const handleItemStep = (item, delta) => {
    const current = inventoryRef.current.items.find(i => i.id === item.id);
    if (current) setItemQuantity(item, Math.max(1, current.quantity + delta));
  };

  // Delete is an atomic destructive lane on the serialized intent queue (handleConfirmMove
  // idiom): drain the debounced currency deltas, queue the single-row delete, and write
  // the `Removed "X" from party inventory` row ONLY after the server acked it (pre-await
  // audit law, backlog 2026-10-29-AB) — a rejected or conflicted delete writes zero rows.
  // Rejection = console.error + lane-convention alert + optimistic-delete rollback
  // (2026-10-29 AC backlog), and a 409 adopts the server's merged truth instead.
  const handleDeleteItem = (item) => {
    if (!window.confirm(`Delete "${item.name}" from party inventory?`)) return;
    flushCurrencyPersist();
    const inv = inventoryRef.current;
    applyInventory({ ...inv, items: inv.items.filter(i => i.id !== item.id) });
    queueItemIntent({ action: 'delete', id: item.id, name: item.name, previous: inv });
  };

  const handleConfirmMove = () => {
    if (!moveTarget || !movePlayer) return;
    // Native confirm composed from the modal's live qty/item/player state, mirroring
    // the currency Give confirm ("Give 50 gp to War Cleric?"). Fires only on this
    // final click — never on modal open or input changes. Refuse = zero writes.
    if (!window.confirm(`Move ${moveQuantity} × ${moveTarget.name} to ${movePlayer}?`)) return;
    flushCurrencyPersist();
    setSaving(true);
    transferInventory(campaignName, {
      direction: 'party-to-player',
      playerName: movePlayer,
      itemName: moveTarget.name,
      quantity: moveQuantity,
    })
      .then(result => {
        // Server-side audit on the accepted /transfer — the row reads
        // `N × <item> moved from party inventory to <player>`; no client duplicate.
        applyInventory(result.inventory);
      })
      .catch(error => {
        console.error('[PartyInventory] move failed:', error);
        alert(`Move failed: ${error.message}`);
      })
      .finally(() => {
        setSaving(false);
        setMoveTarget(null);
      });
  };

  const openMoveModal = (item) => {
    setMoveTarget(item);
    setMoveQuantity(item.quantity);
    setMovePlayer(characters[0]?.name || '');
  };

  const showItemPopup = async (item) => {
    if (item.description) {
      setPopupHtml(`<b>${item.name}</b><br/><br/>${item.description}`);
      return;
    }
    // Same inversion-tolerant matcher as the Add Item autofill (shared helper above);
    // the dash-fold comparison it replaces was semantically identical (both sides were
    // transformed), so only trim/collapse/inversion behavior is added.
    const eq = findEquipmentByName(equipmentData, item.name)
      || (item.name.endsWith('s') ? findEquipmentByName(equipmentData, item.name.slice(0, -1)) : findEquipmentByName(equipmentData, `${item.name}s`));
    const desc = eq
      ? (Array.isArray(eq.description) ? eq.description.join('<br/><br/>') : (eq.description || ''))
      : '';
    // A found-but-textless catalog row (e.g. Longsword carries no `description` key)
    // is the same no-description face as an out-of-catalog name — one fallback branch.
    if (eq && desc.trim()) {
      setPopupHtml(`<b>${eq.name}</b><br/>${desc}`);
    } else {
      setPopupHtml(`<b>${item.name}</b><br/><br/>No description recorded.`);
    }
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const items = sortByName(inventory.items);
    if (!query) return items;
    return items.filter(i => i.name.toLowerCase().includes(query));
  }, [inventory.items, searchQuery]);

  if (loading) return <div className="ct-container pi-container"><p>Loading party inventory…</p></div>;

  // One flag owns "a Party-Inventory modal is open" (branch-free to stay inside the
  // complexity cap): drives the `inert` veil on every background section.
  const modalOpen = [giveState, editForm, moveTarget].some(Boolean);

  return (
    <div className="ct-container pi-container">
      <div className="ct-header" inert={modalOpen}>
        <h2 className="ct-title">
          <i className="fa-solid fa-boxes-stacked" /> Party Inventory
        </h2>
        {isLocalhost && (
          <button className="ct-new-btn" onClick={handleAddItem}>
            <i className="fa-solid fa-plus" /> Add Item
          </button>
        )}
      </div>

      <CurrencyCard
        currency={inventory.currency}
        onAdjust={handleCurrencyAdjust}
        onGiveOpen={() => setGiveState({ playerName: characters[0]?.name || '', amounts: {} })}
        disabled={saving || modalOpen}
        isLocalhost={isLocalhost}
        inert={modalOpen}
      />

      <div className="pi-main" inert={modalOpen}>
        <div className="pi-items-panel">
          <div className="ct-search-row">
            <i className="fa-solid fa-magnifying-glass ct-search-icon" />
            <input
              type="text"
              className="ct-search-input"
              placeholder="Search party items…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search party items"
            />
            {searchQuery && (
              <button className="ct-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
                <i className="fa-solid fa-circle-xmark" />
              </button>
            )}
          </div>
          {filteredItems.length === 0 ? (
            <div className="ct-empty-state">
              <i className="fa-solid fa-boxes-stacked" />
              {searchQuery
                ? `No party items matching “${searchQuery}”`
                : isLocalhost
                  ? 'No shared items yet. Click “Add Item” to record loot.'
                  : 'No shared items yet.'}
            </div>
          ) : (
            <table className="pi-items-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Qty</th>
                  {isLocalhost && <th className="pi-actions-col no-print">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id}>
                    <td>
                      <span
                        className="clickable pi-item-name"
                        tabIndex={0}
                        role="button"
                        onClick={() => showItemPopup(item)}
                        onKeyDown={(e) => { if (e.key === 'Enter') showItemPopup(item); }}
                      >
                        {item.name}
                      </span>
                    </td>
                    <td>
                      {isLocalhost ? (
                        <QuantityStepper
                          itemLabel={item.name}
                          quantity={item.quantity}
                          onStep={(delta) => handleItemStep(item, delta)}
                          onSet={(v) => setItemQuantity(item, Math.max(1, v))}
                        />
                      ) : (
                        <span>{item.quantity}</span>
                      )}
                    </td>
                    {isLocalhost && (
                    <td className="pi-actions-cell no-print">
                      <button
                        type="button"
                        className="ct-btn"
                        title="Edit item"
                        aria-label="Edit item"
                        onClick={() => setEditForm({ ...item })}
                      >
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button
                        type="button"
                        className="ct-btn ct-btn-primary"
                        title="Move to player"
                        aria-label="Move to player"
                        disabled={characters.length === 0}
                        onClick={() => openMoveModal(item)}
                      >
                        <i className="fa-solid fa-right-to-bracket" /> Move
                      </button>
                      <button
                        type="button"
                        className="ct-btn ct-btn-danger"
                        title="Delete item"
                        aria-label="Delete item"
                        onClick={() => handleDeleteItem(item)}
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <PlayersPanel
          characters={characters}
          campaignName={campaignName}
          onMoved={refresh}
          beforeTransfer={flushCurrencyPersist}
        />
      </div>

      {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml(null)} />}

      {giveState && (
        <GiveCurrencyModal
          currency={inventory.currency}
          characters={characters}
          giveState={giveState}
          onChange={setGiveState}
          onClose={() => setGiveState(null)}
          onTransfer={handleCurrencyTransfer}
        />
      )}

      {editForm && (
        <ItemEditModal
          form={editForm}
          isNew={!editForm.id}
          equipmentData={equipmentData}
          saving={saving}
          onChange={(form) => setEditForm(handleNameChange(form, form.name))}
          onClose={() => setEditForm(null)}
          onSave={handleSaveItem}
        />
      )}

      {moveTarget && (
        <MoveToPlayerModal
          item={moveTarget}
          characters={characters}
          quantity={moveQuantity}
          player={movePlayer}
          saving={saving}
          onQuantityChange={setMoveQuantity}
          onPlayerChange={setMovePlayer}
          onClose={() => setMoveTarget(null)}
          onConfirm={handleConfirmMove}
        />
      )}
    </div>
  );
}

export default PartyInventory;
