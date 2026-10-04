import { useState, useEffect, useMemo, useCallback } from 'react';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import { addEntry } from '../../services/ui/logService.js';
import { loadEquipment } from '../../services/ui/dataLoader.js';
import { loadInventory, saveInventory, transferInventory, normalizeInventory } from '../../services/campaign/inventoryService.js';
import Popup from '../common/Popup.jsx';
import './PartyInventory.css';

const CURRENCIES = [
  { key: 'pp', label: 'Platinum', icon: 'fa-solid fa-coins' },
  { key: 'gp', label: 'Gold', icon: 'fa-solid fa-circle-dollar-to-slot' },
  { key: 'sp', label: 'Silver', icon: 'fa-solid fa-medal' },
  { key: 'cp', label: 'Copper', icon: 'fa-solid fa-penny' },
];

const AMOUNT_CHIPS = [1, 10, 100];

const EMPTY_FORM = { id: '', name: '', quantity: 1, description: '' };

const sortByName = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name));

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

function QuantityStepper({ quantity, onStep, onSet }) {
  return (
    <span className="pi-qty-stepper">
      <button
        type="button"
        className="pi-step-btn"
        aria-label="Decrease quantity"
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
        aria-label="Increase quantity"
        onClick={() => onStep(1)}
      >
        <i className="fa-solid fa-plus" />
      </button>
    </span>
  );
}

function CurrencyCard({ currency, characters, onAdjust, onTransfer, disabled }) {
  const [giveState, setGiveState] = useState(null);

  const applyGive = () => {
    if (!giveState) return;
    const amounts = {};
    Object.entries(giveState.amounts).forEach(([k, v]) => {
      const n = Math.floor(Number(v));
      if (n > 0) amounts[k] = n;
    });
    if (Object.keys(amounts).length === 0) {
      setGiveState(null);
      return;
    }
    onTransfer(giveState.playerName, amounts);
    setGiveState(null);
  };

  return (
    <div className="pi-currency-card">
      <h3><i className="fa-solid fa-sack-dollar" /> Party Currency</h3>
      {CURRENCIES.map(({ key, label, icon }) => (
        <div key={key} className="pi-currency-row">
          <span className="pi-currency-label"><i className={icon} /> {label}</span>
          <span className="pi-currency-amount">{currency[key]}</span>
          <span className="pi-currency-chips">
            {AMOUNT_CHIPS.map(amount => (
              <span key={amount} className="pi-chip-pair">
                <button
                  type="button"
                  className="pi-step-btn ct-btn"
                  title={`Add ${amount} ${key}`}
                  disabled={disabled}
                  onClick={() => onAdjust(key, amount)}
                >
                  +{amount}
                </button>
                <button
                  type="button"
                  className="pi-step-btn ct-btn"
                  title={`Remove ${amount} ${key}`}
                  disabled={disabled || currency[key] < amount}
                  onClick={() => onAdjust(key, -amount)}
                >
                  −{amount}
                </button>
              </span>
            ))}
            <button
              type="button"
              className="ct-btn pi-give-btn"
              title={`Give ${label} to a player`}
              disabled={disabled || currency[key] <= 0}
              onClick={() => setGiveState({ playerName: characters[0]?.name || '', amounts: { [key]: Math.min(1, currency[key]) } })}
            >
              <i className="fa-solid fa-hand-holding-heart" /> Give
            </button>
          </span>
        </div>
      ))}
      {giveState && (
        <div className="pi-modal-overlay" role="presentation">
          <div className="ct-modal pi-modal">
            <div className="ct-modal-header">
              <h3>Give Currency to Player</h3>
              <button className="ct-modal-close" onClick={() => setGiveState(null)} aria-label="Close">&times;</button>
            </div>
            <div className="ct-modal-body">
              <label className="ct-label">Player</label>
              <select
                className="ct-select"
                value={giveState.playerName}
                onChange={(e) => setGiveState(prev => ({ ...prev, playerName: e.target.value }))}
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
                    onChange={(e) => setGiveState(prev => ({
                      ...prev,
                      amounts: { ...prev.amounts, [key]: Math.max(0, Math.min(currency[key], parseInt(e.target.value, 10) || 0)) },
                    }))}
                  />
                </div>
              ))}
            </div>
            <div className="ct-modal-footer">
              <div className="ct-modal-buttons">
                <button className="ct-btn" onClick={() => setGiveState(null)}>Cancel</button>
                <button
                  className="ct-btn ct-btn-primary"
                  onClick={applyGive}
                  disabled={!giveState.playerName}
                >
                  <i className="fa-solid fa-hand-holding-heart" /> Give
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemEditModal({ form, equipmentData, isNew, saving, onChange, onClose, onSave }) {
  return (
    <div className="pi-modal-overlay" role="presentation">
      <div className="ct-modal pi-modal">
        <div className="ct-modal-header">
          <h3>{isNew ? 'Add Item' : `Edit ${form.name}`}</h3>
          <button className="ct-modal-close" onClick={onClose} aria-label="Close">&times;</button>
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
  return (
    <div className="pi-modal-overlay" role="presentation">
      <div className="ct-modal pi-modal">
        <div className="ct-modal-header">
          <h3>Move “{item.name}” to Player</h3>
          <button className="ct-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="ct-modal-body">
          <label className="ct-label">Player</label>
          <select className="ct-select" value={player} onChange={(e) => onPlayerChange(e.target.value)}>
            {characters.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <label className="ct-label">Quantity (party has {item.quantity})</label>
          <QuantityStepper
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

function PlayersPanel({ characters, campaignName, onMoved }) {
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

  const handleMove = async (entry) => {
    if (!character) return;
    setMoving(entry.name);
    try {
      await transferInventory(campaignName, {
        direction: 'player-to-party',
        playerName: character.name,
        itemName: entry.name,
        quantity: entry.quantity,
      });
      addEntry(campaignName, {
        type: 'inventory_transfer',
        message: `${entry.quantity} × ${entry.name} moved from ${character.name} to party inventory`,
        timestamp: Date.now(),
      }).catch(err => console.error('[PartyInventory] log error:', err));
      await onMoved();
    } catch (error) {
      console.error('[PartyInventory] player-to-party move failed:', error);
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
      {character && backpack.length === 0 && (
        <p className="pi-empty">Nothing in {character.name}&rsquo;s backpack.</p>
      )}
      <ul className="pi-player-items">
        {backpack.map(entry => (
          <li key={entry.name}>
            <span className="pi-player-item-name">{entry.name}</span>
            <span className="pi-player-item-qty">×{entry.quantity}</span>
            <button
              type="button"
              className="ct-btn ct-btn-primary pi-move-btn"
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

function PartyInventory({ campaignName, characters = [], onBack }) {
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

  const refresh = useCallback(async () => {
    try {
      const data = await loadInventory(campaignName);
      setInventory(data);
    } catch (error) {
      console.error('[PartyInventory] load failed:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    loadEquipment().then(setEquipmentData).catch(err => console.error('[PartyInventory] equipment load failed:', err));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSSE(campaignName, (event) => {
      if (event.key === `inventory-${campaignName}`) {
        setInventory(normalizeInventory(event.data));
      }
    });
    return unsubscribe;
  }, [campaignName]);

  const persist = useCallback(async (next) => {
    setSaving(true);
    try {
      const saved = await saveInventory(campaignName, next);
      if (saved) setInventory(saved);
      else await refresh();
    } catch (error) {
      console.error('[PartyInventory] save failed:', error);
      alert(`Save failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }, [campaignName, refresh]);

  const handleCurrencyAdjust = (key, delta) => {
    const next = {
      ...inventory,
      currency: { ...inventory.currency, [key]: Math.max(0, (inventory.currency[key] || 0) + delta) },
    };
    setInventory(next);
    persist(next);
  };

  const handleCurrencyTransfer = (playerName, amounts) => {
    setSaving(true);
    transferInventory(campaignName, { direction: 'party-to-player', playerName, currency: amounts })
      .then(result => {
        setInventory(result.inventory);
        const parts = Object.entries(amounts).map(([k, v]) => `${v} ${k}`).join(', ');
        addEntry(campaignName, {
          type: 'inventory_transfer',
          message: `${parts} moved from party inventory to ${playerName}`,
          timestamp: Date.now(),
        }).catch(err => console.error('[PartyInventory] log error:', err));
      })
      .catch(error => {
        console.error('[PartyInventory] currency transfer failed:', error);
        alert(`Transfer failed: ${error.message}`);
      })
      .finally(() => setSaving(false));
  };

  const handleAddItem = () => setEditForm({ ...EMPTY_FORM });

  const handleNameChange = (form, name) => {
    const match = equipmentData.find(eq => eq.name.toLowerCase() === name.trim().toLowerCase());
    let description = form.description;
    if (match && (form.id === '' || !description)) {
      description = Array.isArray(match.desc) ? match.desc.join('\n\n') : (match.desc || '');
    }
    return { ...form, name, description };
  };

  const handleSaveItem = () => {
    const name = editForm.name.trim();
    if (!name) return;
    const existingIndex = editForm.id
      ? inventory.items.findIndex(i => i.id === editForm.id)
      : inventory.items.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
    const items = [...inventory.items];
    if (existingIndex === -1) {
      items.push({ id: crypto.randomUUID(), name, quantity: editForm.quantity, description: editForm.description });
    } else {
      items[existingIndex] = { ...items[existingIndex], ...editForm, name, quantity: Math.max(1, editForm.quantity) };
    }
    setEditForm(null);
    persist({ ...inventory, items });
  };

  const handleItemStep = (item, delta) => {
    const quantity = Math.max(1, item.quantity + delta);
    if (quantity === item.quantity) return;
    persist({ ...inventory, items: inventory.items.map(i => i.id === item.id ? { ...i, quantity } : i) });
  };

  const handleDeleteItem = (item) => {
    if (!window.confirm(`Delete "${item.name}" from party inventory?`)) return;
    persist({ ...inventory, items: inventory.items.filter(i => i.id !== item.id) });
    addEntry(campaignName, {
      type: 'inventory_transfer',
      message: `Removed "${item.name}" from party inventory`,
      timestamp: Date.now(),
    }).catch(err => console.error('[PartyInventory] log error:', err));
  };

  const handleConfirmMove = () => {
    if (!moveTarget || !movePlayer) return;
    setSaving(true);
    transferInventory(campaignName, {
      direction: 'party-to-player',
      playerName: movePlayer,
      itemName: moveTarget.name,
      quantity: moveQuantity,
    })
      .then(result => {
        setInventory(result.inventory);
        addEntry(campaignName, {
          type: 'inventory_transfer',
          message: `${moveQuantity} × ${moveTarget.name} moved from party inventory to ${movePlayer}`,
          timestamp: Date.now(),
        }).catch(err => console.error('[PartyInventory] log error:', err));
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
    const lookup = (n) => equipmentData.find(eq => eq.name.toLowerCase().replace(/\s+/g, '-') === n.toLowerCase().replace(/\s+/g, '-'));
    const eq = lookup(item.name) || (item.name.endsWith('s') ? lookup(item.name.slice(0, -1)) : lookup(`${item.name}s`));
    if (eq) {
      const desc = Array.isArray(eq.desc) ? eq.desc.join('<br/><br/>') : '';
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

  return (
    <div className="ct-container pi-container">
      <div className="ct-header">
        <button className="ct-back-btn" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
        <h2 className="ct-title">
          <i className="fa-solid fa-boxes-stacked" /> Party Inventory
        </h2>
        <button className="ct-new-btn" onClick={handleAddItem}>
          <i className="fa-solid fa-plus" /> Add Item
        </button>
      </div>

      <CurrencyCard
        currency={inventory.currency}
        characters={characters}
        onAdjust={handleCurrencyAdjust}
        onTransfer={handleCurrencyTransfer}
        disabled={saving}
      />

      <div className="pi-main">
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
              {searchQuery ? `No party items matching “${searchQuery}”` : 'No shared items yet. Click “Add Item” to record loot.'}
            </div>
          ) : (
            <table className="pi-items-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Qty</th>
                  <th className="pi-actions-col no-print">Actions</th>
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
                      <QuantityStepper
                        quantity={item.quantity}
                        onStep={(delta) => handleItemStep(item, delta)}
                        onSet={(v) => persist({ ...inventory, items: inventory.items.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, v) } : i) })}
                      />
                    </td>
                    <td className="pi-actions-cell no-print">
                      <button
                        type="button"
                        className="ct-btn"
                        title="Edit item"
                        onClick={() => setEditForm({ ...item })}
                      >
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button
                        type="button"
                        className="ct-btn ct-btn-primary"
                        title="Move to player"
                        disabled={characters.length === 0}
                        onClick={() => openMoveModal(item)}
                      >
                        <i className="fa-solid fa-right-to-bracket" /> Move
                      </button>
                      <button
                        type="button"
                        className="ct-btn ct-btn-danger"
                        title="Delete item"
                        onClick={() => handleDeleteItem(item)}
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </td>
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
        />
      </div>

      {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml(null)} />}

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
