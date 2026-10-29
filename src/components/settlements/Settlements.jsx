import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useCrudList } from '../../hooks/useCrudList.js';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';
import { useReloadGuard } from '../../hooks/management/useReloadGuard.js';
import { loadSettlements, saveSettlement, deleteSettlement } from '../../services/campaign/settlementsService.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
import Subscriber from '../common/Subscriber.jsx';
import { generateSettlement } from '../../services/campaign/settlementGenerator.js';
import './Settlements.css';

const SIZE_OPTIONS = [
  { value: 'village', label: 'Village' },
  { value: 'town', label: 'Town' },
  { value: 'city', label: 'City' },
  { value: 'metropolis', label: 'Metropolis' },
];

const SIZE_ICONS = {
  village: 'fa-house-chimney',
  town: 'fa-hotel',
  city: 'fa-city',
  metropolis: 'fa-landmark-dome',
};

const SIZE_COLORS = {
  village: { bg: '#2d5a27', color: '#a8d5a2', border: '#4a8c3f' },
  town: { bg: '#2b4570', color: '#a8c4e8', border: '#4a7fb8' },
  city: { bg: '#5c3d7a', color: '#d4b8f0', border: '#8a5fbf' },
  metropolis: { backgroundColor: '#7a5c2d', color: '#f0d4a8', borderColor: '#bf8a4c' },
};

const POPULATION_RANGES = {
  village: ['50-100 souls', '100-200 souls', '200-400 souls', '400-800 souls'],
  town: ['800-1,500 souls', '1,500-3,000 souls', '3,000-5,000 souls'],
  city: ['5,000-12,000 souls', '12,000-25,000 souls', '25,000-50,000 souls'],
  metropolis: ['50,000-100,000 souls', '100,000-250,000 souls', '250,000+ souls'],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const SERVICE_TYPE_LABELS = {
  inn: 'Inn',
  tavern: 'Tavern',
  blacksmith: 'Blacksmith',
  general_store: 'General Store',
  magic_shop: 'Magic Shop',
  temple: 'Temple',
  guild: 'Guild',
  alchemist: 'Alchemist',
  bakery: 'Bakery',
  butcher: 'Butcher',
  tailor: 'Tailor',
  stable: 'Stable',
  bank: 'Bank',
};

function SettlementListItem({ settlement, onEdit }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onEdit(settlement);
    }
  };
  const preview = settlement.description
    ? (settlement.description.length > 120 ? settlement.description.substring(0, 120) + '…' : settlement.description)
    : null;

  return (
    <li
      className="ct-list-item"
      onClick={() => onEdit(settlement)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Edit settlement: ${settlement.name}`}
    >
      <div className="settlements-list-header">
        <div className="settlements-list-name-row">
          <span className="ct-list-name">{settlement.name}</span>
        </div>
        <div className="ct-list-meta">
          {settlement.size && (
            <span
              className="settlements-size-badge"
              style={getSizeStyle(settlement.size)}
              title={settlement.size}
            >
              <i className={`fa-solid ${SIZE_ICONS[settlement.size] || 'fa-house'}`} />
              {settlement.size}
            </span>
          )}
        </div>
      </div>
      <div className="ct-list-details">
        {(settlement.population || settlement.size) && (
          <span className="settlements-list-subtitle">
            {settlement.population && <span>{settlement.population}</span>}
          </span>
        )}
        <div className="settlements-list-actions-row">
          {settlement.tags && (
            <span className="settlements-list-tags">
              <i className="fa-solid fa-tags" /> {settlement.tags}
            </span>
          )}
          {settlement.services && settlement.services.length > 0 && (
            <span className="settlements-list-services">
              <i className="fa-solid fa-shop" /> {settlement.services.length} service{settlement.services.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {preview && <p className="settlements-list-preview">{preview}</p>}
      </div>
    </li>
  );
}

function SettlementModal({
  formData, editingSettlement, saving, deleting, error, errorConflict,
  onClose, onReloadList, onSave, onDelete, onFormChange,
  onAddService, onServiceChange, onRemoveService,
  onAddNPC, onNPCChange, onRemoveNPC,
  onAddRumor, onRumorChange, onRemoveRumor,
}) {
  return (
    <div className="ct-modal-overlay">
      <div className="ct-modal settlements-modal">
        <div className="ct-modal-header no-print">
          <h3>{editingSettlement ? 'Edit Settlement' : 'New Settlement'}</h3>
          <button
            className="ct-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="ct-modal-body">
          {error && (
            <div className="settlements-form-error">
              {error}
              {/* 409 conflicts only: one-click sanctioned recovery (close +
                  refetch) so the guided "reload the list" step needs no
                  trial-and-error. Mirrors NPCs.jsx's stale-close path. */}
              {errorConflict && onReloadList && (
                <button
                  className="ct-btn settlements-error-reload-btn"
                  onClick={onReloadList}
                >
                  <i className="fa-solid fa-rotate" /> Reload list
                </button>
              )}
            </div>
          )}
          <label htmlFor="settlement-name" className="ct-label">
            Name <span className="ct-required">*</span>
          </label>
          <input
            id="settlement-name"
            type="text"
            className="ct-input"
            value={formData.name}
            onChange={(e) => onFormChange('name', e.target.value)}
            placeholder="Settlement name"
            autoFocus
          />

          <div className="settlements-form-row">
            <div className="settlements-form-col">
              <label htmlFor="settlement-size" className="ct-label">Size</label>
              <select
                id="settlement-size"
                className="ct-select"
                value={formData.size}
                onChange={(e) => onFormChange('size', e.target.value)}
              >
                {SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="settlements-form-col">
              <label htmlFor="settlement-population" className="ct-label">Population</label>
              <input
                id="settlement-population"
                type="text"
                className="ct-input"
                value={formData.population}
                onChange={(e) => onFormChange('population', e.target.value)}
                placeholder="e.g., 2,500 souls"
              />
            </div>
          </div>

          <PreviewToggle
            id="settlement-government"
            value={formData.government}
            onChange={(value) => onFormChange('government', value)}
            placeholder="How is this settlement governed?"
            label="Government"
          />

          <PreviewToggle
            id="settlement-description"
            value={formData.description}
            onChange={(value) => onFormChange('description', value)}
            placeholder="Describe what the settlement looks and feels like…"
            label="Description"
          />

          <PreviewToggle
            id="settlement-atmosphere"
            value={formData.atmosphere}
            onChange={(value) => onFormChange('atmosphere', value)}
            placeholder="What is the mood and ambiance?"
            label="Atmosphere"
          />

          {formData.threat && (
            <PreviewToggle
              id="settlement-threat"
              value={formData.threat}
              onChange={(value) => onFormChange('threat', value)}
              placeholder="Current dangers or tensions…"
              label="Threats"
            />
          )}

          <h4 className="settlements-section-title">Services</h4>
          <div className="settlements-services-section">
            {(formData.services || []).map((svc, i) => (
              <div key={i} className="settlements-service-row">
                <div className="settlements-service-fields-row">
                  <select
                    className="ct-select settlements-svc-type"
                    value={svc.type}
                    onChange={(e) => onServiceChange(i, 'type', e.target.value)}
                  >
                    {Object.entries(SERVICE_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="ct-input settlements-svc-name"
                    value={svc.name}
                    onChange={(e) => onServiceChange(i, 'name', e.target.value)}
                    placeholder="Business name"
                  />
                  <button
                    className="ct-btn ct-btn-sm ct-btn-danger"
                    onClick={() => onRemoveService(i)}
                    title="Remove service"
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                </div>
                <textarea
                  className="ct-textarea settlements-svc-desc"
                  value={svc.description}
                  onChange={(e) => onServiceChange(i, 'description', e.target.value)}
                  placeholder="Description…"
                  rows={2}
                />
              </div>
            ))}
            <button className="ct-btn ct-btn-sm" onClick={onAddService}>
              <i className="fa-solid fa-plus" /> Add Service
            </button>
          </div>

          <h4 className="settlements-section-title">Notable NPCs</h4>
          <div className="settlements-npcs-section">
            {(formData.notableNPCs || []).map((npc, i) => (
              <div key={i} className="settlements-npc-row">
                <div className="settlements-npc-fields-row">
                  <input
                    type="text"
                    className="ct-input settlements-npc-name"
                    value={npc.name}
                    onChange={(e) => onNPCChange(i, 'name', e.target.value)}
                    placeholder="NPC name"
                  />
                  <input
                    type="text"
                    className="ct-input settlements-npc-role"
                    value={npc.role}
                    onChange={(e) => onNPCChange(i, 'role', e.target.value)}
                    placeholder="Role (e.g., Innkeeper)"
                  />
                  <button
                    className="ct-btn ct-btn-sm ct-btn-danger"
                    onClick={() => onRemoveNPC(i)}
                    title="Remove NPC"
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                </div>
                <textarea
                  className="ct-textarea settlements-npc-desc"
                  value={npc.description}
                  onChange={(e) => onNPCChange(i, 'description', e.target.value)}
                  placeholder="Description…"
                  rows={2}
                />
              </div>
            ))}
            <button className="ct-btn ct-btn-sm" onClick={onAddNPC}>
              <i className="fa-solid fa-plus" /> Add NPC
            </button>
          </div>

          <h4 className="settlements-section-title">Rumors &amp; News</h4>
          <div className="settlements-rumors-section">
            {(formData.rumors || []).map((rumor, i) => (
              <div key={i} className="settlements-rumor-row">
                <PreviewToggle
                  id={`settlement-rumor-${i}`}
                  value={rumor}
                  onChange={(value) => onRumorChange(i, value)}
                  placeholder="A rumor or piece of news…"
                  rows={2}
                />
                <button
                  className="ct-btn ct-btn-sm ct-btn-danger"
                  onClick={() => onRemoveRumor(i)}
                  title="Remove rumor"
                >
                  <i className="fa-solid fa-trash-can" />
                </button>
              </div>
            ))}
            <button className="ct-btn ct-btn-sm" onClick={onAddRumor}>
              <i className="fa-solid fa-plus" /> Add Rumor
            </button>
          </div>

          <label htmlFor="settlement-tags" className="ct-label">Tags (comma separated)</label>
          <input
            id="settlement-tags"
            type="text"
            className="ct-input"
            value={formData.tags}
            onChange={(e) => onFormChange('tags', e.target.value)}
            placeholder="e.g., coastal, trade-hub, dwarven"
          />

          <PreviewToggle
            id="settlement-notes"
            value={formData.notes}
            onChange={(value) => onFormChange('notes', value)}
            placeholder="Additional GM notes…"
            label="Notes"
          />
        </div>

        <div className="ct-modal-footer no-print">
          <div className="ct-modal-actions">
            {editingSettlement && (
              <button
                className="ct-btn ct-btn-danger"
                onClick={onDelete}
                disabled={deleting}
              >
                <i className="fa-solid fa-trash-can" />{' '}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          <div className="ct-modal-buttons">
            <button
              className="ct-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="ct-btn ct-btn-primary"
              onClick={onSave}
              disabled={saving || !formData.name.trim()}
            >
              <i className="fa-solid fa-floppy-disk" />{' '}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSizeStyle(size) {
  const colors = SIZE_COLORS[size] || SIZE_COLORS.village;
  return {
    backgroundColor: colors.bg,
    color: colors.color,
    borderColor: colors.border,
  };
}

function Settlements({ campaignName, onBack }) {
  const { items: settlements, loading, loadItems, deleteItem: deleteSettlementAction } =
    useEntityManagement(campaignName, { load: loadSettlements, save: saveSettlement, delete: deleteSettlement }, { responseKey: 'settlements', loadOnMount: false });

  const {
    searchQuery, setSearchQuery, filteredItems,
    modalOpen, editingItem: editingSettlement, formData, setFormData,
    saving, setSaving,
    openNew, openEdit, closeModal,
  } = useCrudList(settlements, ['name', 'tags', 'description']);
  const [sizeFilter, setSizeFilter] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  // True when the visible banner error is a 409 concurrent-edit conflict
  // (server body { conflict: true }) — gates the "Reload list" action button.
  const [errorIsConflict, setErrorIsConflict] = useState(false);
  // Skipped-while-editing SSE list broadcasts and rejected (409) saves prove
  // the on-screen list is stale; consumed in handleCloseModal so a reopen
  // re-seeds a fresh row instead of repeating the same 409. Mirrors NPCs.jsx
  // (9cee7bfa2) / Notes.jsx (broadcast wired server-side in routes/
  // settlements.js, improve settlements-sessions-no-list-sse).
  const missedListBroadcast = useRef(false);
  const descDataRef = useRef(null);
  // Draft snapshot powering the reload-discard guard — shared with the NPC
  // lane (useReloadGuard, improve 2026-10-28-T backlog).
  const { seedDraft, clearDraft, confirmDiscardDraft } = useReloadGuard({
    modalOpen,
    formData,
    confirmMessage: 'Reload the settlement list and discard your unsaved edits?',
  });

  // Single choke point for the banner: every message carries whether it was a
  // conflict, so the "Reload list" action can never outlive its error copy.
  const showError = (message, conflict = false) => {
    setError(message);
    setErrorIsConflict(conflict);
  };

  useEffect(() => {
    if (campaignName) {
      loadItems();
    }
  }, [campaignName, loadItems]);

  useEffect(() => {
    fetch('/data/settlement-descriptions.json')
      .then(r => r.json())
      .then(d => { descDataRef.current = d; });
  }, []);

  // SSE handler — re-fetch settlement list on settlements-list events (another
  // GM tab created/updated/deleted a settlement). Skipped while the edit modal
  // is open so an in-progress draft is never squashed mid-edit; the miss is
  // applied on close (see handleCloseModal). Mirrors Notes.jsx/NPCs.jsx.
  const handleSSEEvent = useCallback((event) => {
    if (!event || event.key !== `settlements-list-${campaignName}`) return;
    if (modalOpen) {
      missedListBroadcast.current = true;
      return;
    }
    loadItems();
  }, [campaignName, modalOpen, loadItems]);

  const filteredSettlements = useMemo(() => {
    let result = filteredItems;
    if (sizeFilter) {
      result = result.filter(s => s.size === sizeFilter);
    }
    return result;
  }, [filteredItems, sizeFilter]);

  const getDefaultFormData = (overrides = {}) => ({
    name: '',
    size: 'village',
    description: '',
    atmosphere: '',
    government: '',
    population: '',
    services: [],
    notableNPCs: [],
    rumors: [],
    tags: '',
    notes: '',
    threat: '',
    ...overrides,
  });

  const handleNewSettlement = () => {
    showError(null);
    const seed = getDefaultFormData();
    seedDraft(seed);
    openNew(seed);
  };

  // Dirty-form guard: the generator replaces every form field, so warn before
  // discarding user-entered content. size defaults to 'village' and is never
  // itself a dirty marker; empty/default forms generate with zero friction.
  const settlementFormHasUserInput = () => {
    if (!formData) return false;
    const textFields = ['name', 'description', 'atmosphere', 'government', 'population', 'tags', 'notes', 'threat'];
    return textFields.some((field) => (formData[field] || '').trim() !== '') ||
      (formData.services || []).length > 0 ||
      (formData.notableNPCs || []).length > 0 ||
      (formData.rumors || []).length > 0;
  };

  const handleGenerateSettlement = async () => {
    if (settlementFormHasUserInput() && !window.confirm('Generate will replace your entered settlement details?')) return;
    setGenerating(true);
    try {
      const generated = await generateSettlement(settlements);
      showError(null);
      const seed = getDefaultFormData(generated);
      seedDraft(seed);
      openNew(seed);
    } catch (error) {
      console.error('Failed to generate settlement:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleEditSettlement = (settlement) => {
    showError(null);
    openEdit(settlement);
    const seed = getDefaultFormData(settlement);
    seedDraft(seed);
    setFormData(seed);
  };

  // Close modal and reset
  const handleCloseModal = () => {
    showError(null);
    closeModal();
    clearDraft();
    // A save the server rejected means the rows are stale — refresh so the
    // next reopen seeds fresh (mirrors NPCs.jsx handleCloseModal).
    if (missedListBroadcast.current) {
      missedListBroadcast.current = false;
      loadItems();
    }
  };

  // One-click guided recovery for the 409 banner: force the sanctioned stale
  // close path (close the editor + consume the list refresh) so the reopen
  // immediately seeds the fresh row — no trial-and-error. That recovery
  // throws away the open draft, so with unsaved edits the loss is NAMED up
  // front and Cancel keeps the banner, editor, and draft fully inert
  // (mirrors NPCs.jsx via shared useReloadGuard).
  const handleReloadList = () => {
    if (!confirmDiscardDraft()) return;
    missedListBroadcast.current = true;
    handleCloseModal();
  };

  // ×/Cancel close path (improve 2026-10-29-V backlog): a dirty draft pays
  // the house NAMED confirm — wizard precedent `Discard changes to "X"?` —
  // naming the settlement the editor shows (typed name, else the row's
  // original); an unnamed new draft falls back to the wizard's generic
  // new-draft copy. A clean draft closes silently exactly as before. Kept
  // OUT of handleCloseModal so internal closes (save/delete/reload) never
  // double-confirm; dismiss is fully inert (banner, editor, draft).
  const handleRequestClose = () => {
    const name = (formData?.name || '').trim() || editingSettlement?.name;
    if (!confirmDiscardDraft(
      name ? `Discard changes to "${name}"?` : 'Discard this new settlement draft?'
    )) return;
    handleCloseModal();
  };

  const handleFormChange = (field, value) => {
    if (field === 'size') {
      const descs = descDataRef.current;
      const sizeDescs = (descs && descs[value]) || {};
      const newPopulation = pick(POPULATION_RANGES[value] || POPULATION_RANGES.village);
      const newDescription = pick(sizeDescs.descriptions || []);
      const newAtmosphere = pick(sizeDescs.atmospheres || []);
      const newGovernment = pick(sizeDescs.governments || '');
      const newThreat = pick(sizeDescs.threats || []);
      setFormData((prev) => ({
        ...prev,
        size: value,
        population: newPopulation,
        description: newDescription,
        atmosphere: newAtmosphere,
        government: newGovernment,
        threat: newThreat,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleAddService = () => {
    setFormData((prev) => ({
      ...prev,
      services: [...(prev.services || []), { type: 'tavern', name: '', description: '' }],
    }));
  };

  const handleServiceChange = (index, field, value) => {
    setFormData((prev) => {
      const services = [...(prev.services || [])];
      services[index] = { ...services[index], [field]: value };
      return { ...prev, services };
    });
  };

  const handleRemoveService = (index) => {
    setFormData((prev) => ({
      ...prev,
      services: (prev.services || []).filter((_, i) => i !== index),
    }));
  };

  const handleAddNPC = () => {
    setFormData((prev) => ({
      ...prev,
      notableNPCs: [...(prev.notableNPCs || []), { name: '', role: '', description: '' }],
    }));
  };

  const handleNPCChange = (index, field, value) => {
    setFormData((prev) => {
      const npcs = [...(prev.notableNPCs || [])];
      npcs[index] = { ...npcs[index], [field]: value };
      return { ...prev, notableNPCs: npcs };
    });
  };

  const handleRemoveNPC = (index) => {
    setFormData((prev) => ({
      ...prev,
      notableNPCs: (prev.notableNPCs || []).filter((_, i) => i !== index),
    }));
  };

  const handleAddRumor = () => {
    setFormData((prev) => ({
      ...prev,
      rumors: [...(prev.rumors || []), ''],
    }));
  };

  const handleRumorChange = (index, value) => {
    setFormData((prev) => {
      const rumors = [...(prev.rumors || [])];
      rumors[index] = value;
      return { ...prev, rumors };
    });
  };

  const handleRemoveRumor = (index) => {
    setFormData((prev) => ({
      ...prev,
      rumors: (prev.rumors || []).filter((_, i) => i !== index),
    }));
  };

  // Duplicate-name guard (mirrors NPCs.jsx / MapsManager.handleCreate)
  const hasDuplicateName = () => settlements.some(s =>
    s.name !== editingSettlement?.name && (s.name || '').trim().toLowerCase() === formData.name.trim().toLowerCase()
  );

  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;
    if (hasDuplicateName()) {
      showError('A settlement with that name already exists');
      return;
    }
    setSaving(true);
    try {
      await saveSettlement(campaignName, formData, editingSettlement?.name);
      await loadItems();
      showError(null);
      missedListBroadcast.current = false;
      handleCloseModal();
    } catch (err) {
      // The 409 concurrent-edit conflict is already logged once at warn by
      // the service layer (improve 2026-10-27-J); only genuine failures get
      // a red console line here. The banner below owns user feedback.
      if (!err.conflict) {
        console.error('Failed to save settlement:', err);
      }
      // A rejected save means the server row moved on without us — the list
      // is stale; closing refreshes it (see handleCloseModal).
      missedListBroadcast.current = true;
      showError(err.message || 'Failed to save settlement', err.conflict === true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSettlement) return;
    if (!window.confirm(`Delete Settlement "${editingSettlement.name}"?`)) return;
    setDeleting(true);
    try {
      await deleteSettlementAction(editingSettlement.name);
      missedListBroadcast.current = false;
      handleCloseModal();
    } catch (error) {
      console.error('Failed to delete settlement:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="ct-container">
      <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />

      <div className="ct-header">
        <button className="ct-back-btn" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
        <h2 className="ct-title">
          <i className="fa-solid fa-city" /> Settlements
        </h2>
        <button className="ct-new-btn" onClick={handleNewSettlement}>
          <i className="fa-solid fa-plus" /> New Settlement
        </button>
        <button className="ct-generate-btn" onClick={handleGenerateSettlement} disabled={generating}>
          <i className="fa-solid fa-wand-magic-sparkles" /> {generating ? 'Generating…' : 'Generate Settlement'}
        </button>
      </div>

      <div className="ct-search-row">
        <i className="fa-solid fa-magnifying-glass ct-search-icon" />
        <input
          type="text"
          className="ct-search-input"
          placeholder="Search settlements…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search settlements"
        />
        {searchQuery && (
          <button
            className="ct-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {SIZE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`settlements-size-btn${sizeFilter === opt.value ? ' settlements-size-btn-active' : ''}`}
          style={sizeFilter === opt.value ? getSizeStyle(opt.value) : {}}
          onClick={() => setSizeFilter(sizeFilter === opt.value ? '' : opt.value)}
          title={`Filter: ${opt.label}`}
        >
          <i className={`fa-solid ${SIZE_ICONS[opt.value]}`} /> {opt.label}
        </button>
      ))}

      {loading && (
        <div className="ct-empty-state">
          <i className="fa-solid fa-spinner fa-spin" /> Loading settlements…
        </div>
      )}

      {!loading && filteredSettlements.length === 0 && (
        <div className="ct-empty-state">
          {searchQuery || sizeFilter ? (
            <>
              <i className="fa-solid fa-search" />
              No settlements found matching your filters.
            </>
          ) : (
            <>
              <i className="fa-solid fa-city" />
              No settlements yet. Click &ldquo;New Settlement&rdquo; to create one.
            </>
          )}
        </div>
      )}

      {!loading && filteredSettlements.length > 0 && (
        <ul className="ct-list">
          {filteredSettlements.map((settlement) => (
            <SettlementListItem
              key={settlement.name}
              settlement={settlement}
              onEdit={handleEditSettlement}
            />
          ))}
        </ul>
      )}

      {modalOpen && formData && (
        <SettlementModal
          formData={formData}
          editingSettlement={editingSettlement}
          saving={saving}
          deleting={deleting}
          error={error}
          errorConflict={errorIsConflict}
          onClose={handleRequestClose}
          onReloadList={handleReloadList}
          onSave={handleSave}
          onDelete={handleDelete}
          onFormChange={handleFormChange}
          onAddService={handleAddService}
          onServiceChange={handleServiceChange}
          onRemoveService={handleRemoveService}
          onAddNPC={handleAddNPC}
          onNPCChange={handleNPCChange}
          onRemoveNPC={handleRemoveNPC}
          onAddRumor={handleAddRumor}
          onRumorChange={handleRumorChange}
          onRemoveRumor={handleRemoveRumor}
        />
      )}
    </div>
  );
}

export default Settlements;
