import { useState, useEffect, useMemo, useRef } from 'react';
import { useCrudList } from '../../hooks/useCrudList.js';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';
import { loadSettlements, saveSettlements, deleteSettlement } from '../../services/campaign/settlementsService.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
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

function Settlements({ campaignName, onBack }) {
  const { items: settlements, loading, loadItems: loadSettlementsList, saveItems: saveSettlementAction, deleteItem: deleteSettlementAction } =
    useEntityManagement(campaignName, { load: loadSettlements, save: saveSettlements, delete: deleteSettlement }, { responseKey: 'settlements', loadOnMount: false });

  const {
    searchQuery, setSearchQuery, filteredItems,
    modalOpen, editingItem: editingSettlement, formData, setFormData,
    saving, setSaving,
    openNew, openEdit, closeModal,
  } = useCrudList(settlements, ['name', 'tags', 'description']);
  const [sizeFilter, setSizeFilter] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const descDataRef = useRef(null);

  useEffect(() => {
    if (campaignName) {
      loadSettlementsList();
    }
  }, [campaignName, loadSettlementsList]);

  useEffect(() => {
    fetch('/data/settlement-descriptions.json')
      .then(r => r.json())
      .then(d => { descDataRef.current = d; });
  }, []);

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

  const handleNewSettlement = () => openNew(getDefaultFormData());

  const handleGenerateSettlement = async () => {
    setGenerating(true);
    try {
      const generated = await generateSettlement(settlements);
      openNew(getDefaultFormData(generated));
    } catch (error) {
      console.error('Failed to generate settlement:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleEditSettlement = (settlement) => {
    openEdit(settlement);
    setFormData(getDefaultFormData(settlement));
  };

  const handleCloseModal = closeModal;

  const POPULATION_RANGES = {
    village: ['50-100 souls', '100-200 souls', '200-400 souls', '400-800 souls'],
    town: ['800-1,500 souls', '1,500-3,000 souls', '3,000-5,000 souls'],
    city: ['5,000-12,000 souls', '12,000-25,000 souls', '25,000-50,000 souls'],
    metropolis: ['50,000-100,000 souls', '100,000-250,000 souls', '250,000+ souls'],
  };

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;
    setSaving(true);
    try {
      await saveSettlementAction(formData, editingSettlement?.name);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save settlement:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSettlement) return;
    if (!window.confirm('Delete this settlement?')) return;
    setDeleting(true);
    try {
      await deleteSettlementAction(editingSettlement.name);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to delete settlement:', error);
    } finally {
      setDeleting(false);
    }
  };

  const getSizeStyle = (size) => {
    const colors = SIZE_COLORS[size] || SIZE_COLORS.village;
    return {
      backgroundColor: colors.bg,
      color: colors.color,
      borderColor: colors.border,
    };
  };

  return (
    <div className="ct-container">
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
            <li
              key={settlement.name}
              className="ct-list-item"
              onClick={() => handleEditSettlement(settlement)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleEditSettlement(settlement);
                }
              }}
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
                {settlement.description && (
                  <p className="settlements-list-preview">{settlement.description.length > 120 ? settlement.description.substring(0, 120) + '…' : settlement.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && formData && (
        <div className="ct-modal-overlay">
          <div className="ct-modal settlements-modal">
            <div className="ct-modal-header no-print">
              <h3>{editingSettlement ? 'Edit Settlement' : 'New Settlement'}</h3>
              <button
                className="ct-modal-close"
                onClick={handleCloseModal}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="ct-modal-body">
              <label htmlFor="settlement-name" className="ct-label">
                Name <span className="ct-required">*</span>
              </label>
              <input
                id="settlement-name"
                type="text"
                className="ct-input"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
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
                    onChange={(e) => handleFormChange('size', e.target.value)}
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
                    onChange={(e) => handleFormChange('population', e.target.value)}
                    placeholder="e.g., 2,500 souls"
                  />
                </div>
              </div>

              <PreviewToggle
                id="settlement-government"
                value={formData.government}
                onChange={(value) => handleFormChange('government', value)}
                placeholder="How is this settlement governed?"
                label="Government"
              />

              <PreviewToggle
                id="settlement-description"
                value={formData.description}
                onChange={(value) => handleFormChange('description', value)}
                placeholder="Describe what the settlement looks and feels like…"
                label="Description"
              />

              <PreviewToggle
                id="settlement-atmosphere"
                value={formData.atmosphere}
                onChange={(value) => handleFormChange('atmosphere', value)}
                placeholder="What is the mood and ambiance?"
                label="Atmosphere"
              />

              {formData.threat && (
                <PreviewToggle
                  id="settlement-threat"
                  value={formData.threat}
                  onChange={(value) => handleFormChange('threat', value)}
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
                        onChange={(e) => handleServiceChange(i, 'type', e.target.value)}
                      >
                        {Object.entries(SERVICE_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="ct-input settlements-svc-name"
                        value={svc.name}
                        onChange={(e) => handleServiceChange(i, 'name', e.target.value)}
                        placeholder="Business name"
                      />
                      <button
                        className="ct-btn ct-btn-sm ct-btn-danger"
                        onClick={() => handleRemoveService(i)}
                        title="Remove service"
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                    <textarea
                      className="ct-textarea settlements-svc-desc"
                      value={svc.description}
                      onChange={(e) => handleServiceChange(i, 'description', e.target.value)}
                      placeholder="Description…"
                      rows={2}
                    />
                  </div>
                ))}
                <button className="ct-btn ct-btn-sm" onClick={handleAddService}>
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
                        onChange={(e) => handleNPCChange(i, 'name', e.target.value)}
                        placeholder="NPC name"
                      />
                      <input
                        type="text"
                        className="ct-input settlements-npc-role"
                        value={npc.role}
                        onChange={(e) => handleNPCChange(i, 'role', e.target.value)}
                        placeholder="Role (e.g., Innkeeper)"
                      />
                      <button
                        className="ct-btn ct-btn-sm ct-btn-danger"
                        onClick={() => handleRemoveNPC(i)}
                        title="Remove NPC"
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                    <textarea
                      className="ct-textarea settlements-npc-desc"
                      value={npc.description}
                      onChange={(e) => handleNPCChange(i, 'description', e.target.value)}
                      placeholder="Description…"
                      rows={2}
                    />
                  </div>
                ))}
                <button className="ct-btn ct-btn-sm" onClick={handleAddNPC}>
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
                      onChange={(value) => handleRumorChange(i, value)}
                      placeholder="A rumor or piece of news…"
                      rows={2}
                    />
                    <button
                      className="ct-btn ct-btn-sm ct-btn-danger"
                      onClick={() => handleRemoveRumor(i)}
                      title="Remove rumor"
                    >
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  </div>
                ))}
                <button className="ct-btn ct-btn-sm" onClick={handleAddRumor}>
                  <i className="fa-solid fa-plus" /> Add Rumor
                </button>
              </div>

              <label htmlFor="settlement-tags" className="ct-label">Tags (comma separated)</label>
              <input
                id="settlement-tags"
                type="text"
                className="ct-input"
                value={formData.tags}
                onChange={(e) => handleFormChange('tags', e.target.value)}
                placeholder="e.g., coastal, trade-hub, dwarven"
              />

              <PreviewToggle
                id="settlement-notes"
                value={formData.notes}
                onChange={(value) => handleFormChange('notes', value)}
                placeholder="Additional GM notes…"
                label="Notes"
              />
            </div>

            <div className="ct-modal-footer no-print">
              <div className="ct-modal-actions">
                {editingSettlement && (
                  <button
                    className="ct-btn ct-btn-danger"
                    onClick={handleDelete}
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
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="ct-btn ct-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                >
                  <i className="fa-solid fa-floppy-disk" />{' '}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settlements;
