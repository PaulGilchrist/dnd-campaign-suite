import { useState } from 'react';
import './CustomMagicItemModal.css';

const ITEM_TYPES = [
  'Wondrous Item',
  'Weapon',
  'Armor',
  'Shield',
  'Ring',
  'Amulet',
  'Potion',
  'Scroll',
  'Staff',
  'Wand',
  'Rod',
  'Tool',
  'Other',
];

const ITEM_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
  'varies',
];

const EMPTY_DRAFT = {
  name: '',
  type: 'Wondrous Item',
  rarity: 'uncommon',
  requiresAttunement: false,
  description: '',
};

// Custom magic item editor: builds the full object the wizard stores directly
// in inventory.magicItems (rules-magicItems.js passes unknown objects through
// to the character sheet verbatim, description and all).
function CustomMagicItemModal({ initialItem, isNameTaken, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({ ...EMPTY_DRAFT, ...(initialItem || {}) }));
  const [error, setError] = useState('');

  const isEditing = Boolean(initialItem);

  const setField = (field, value) => {
    setDraft(prev => ({ ...prev, [field]: value }));
    if (field === 'name') setError('');
  };

  const handleSave = () => {
    const name = draft.name.trim();
    if (!name) {
      setError('A name is required.');
      return;
    }
    if (isNameTaken(name)) {
      setError(`An item named "${name}" already exists.`);
      return;
    }
    onSave({
      ...draft,
      name,
      description: draft.description || '',
      custom: true,
    });
  };

  return (
    <div className="equipment-search-modal-overlay">
      <div className="equipment-search-modal custom-magic-item-modal" role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit custom magic item' : 'Add custom magic item'}>
        <div className="search-modal-header">
          <h3>{isEditing ? 'Edit Custom Magic Item' : 'Add Custom Magic Item'}</h3>
          <button type="button" className="close-modal-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="search-modal-body">
          <div className="form-group">
            <label htmlFor="cmi-name">Name *</label>
            <input
              id="cmi-name"
              type="text"
              value={draft.name}
              placeholder="e.g. Stormcaller Blade"
              onChange={(e) => setField('name', e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="cmi-type">Type</label>
            <input
              id="cmi-type"
              type="text"
              list="cmi-type-options"
              value={draft.type}
              onChange={(e) => setField('type', e.target.value)}
            />
            <datalist id="cmi-type-options">
              {ITEM_TYPES.map(type => <option key={type} value={type} />)}
            </datalist>
          </div>

          <div className="form-group">
            <label htmlFor="cmi-rarity">Rarity</label>
            <select
              id="cmi-rarity"
              value={draft.rarity}
              onChange={(e) => setField('rarity', e.target.value)}
            >
              {ITEM_RARITIES.map(rarity => (
                <option key={rarity} value={rarity}>{rarity}</option>
              ))}
            </select>
          </div>

          <div className="form-group custom-magic-item-attunement">
            <label className="filter-checkbox-label">
              <input
                type="checkbox"
                checked={draft.requiresAttunement}
                onChange={(e) => setField('requiresAttunement', e.target.checked)}
              />
              &nbsp;Requires attunement
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="cmi-description">Description</label>
            <textarea
              id="cmi-description"
              rows={5}
              value={draft.description}
              placeholder="What does the item do? This text appears on the character sheet under the item."
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>

          {error && <p className="custom-magic-item-error">{error}</p>}
        </div>

        <div className="search-modal-footer">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="cancel-btn custom-magic-item-save-btn" onClick={handleSave}>
            {isEditing ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomMagicItemModal;
