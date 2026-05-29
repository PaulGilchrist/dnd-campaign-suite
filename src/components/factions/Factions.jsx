import { useState, useEffect, useMemo } from 'react';
import useFactionsManagement from '../../hooks/useFactionsManagement.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
import './Factions.css';

const INFLUENCE_COLORS = {
  low: { bg: '#1a472a', color: '#90ee90', border: '#2d6a4f' },
  medium: { bg: '#713f12', color: '#fde047', border: '#a16207' },
  high: { bg: '#7c2d12', color: '#fed7aa', border: '#c2410c' },
  extreme: { bg: '#7f1d1d', color: '#fecaca', border: '#b91c1c' },
};

function Factions({ campaignName, onBack }) {
  const { factions, loading, loadFactionsList, saveFactionsList, deleteFactionAction } =
    useFactionsManagement(campaignName);

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaction, setEditingFaction] = useState(null);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load factions on mount
  useEffect(() => {
    if (campaignName) {
      loadFactionsList();
    }
  }, [campaignName, loadFactionsList]);

  // Filtered factions based on search
  const filteredFactions = useMemo(() => {
    if (!searchQuery.trim()) return factions;
    const query = searchQuery.toLowerCase();
    return factions.filter(
      (faction) => faction.name?.toLowerCase().includes(query)
    );
  }, [factions, searchQuery]);

  // Open modal for new faction
  const handleNewFaction = () => {
    setFormData({
      id: crypto.randomUUID(),
      name: '',
      description: '',
      goals: '',
      influence: 1,
      notes: '',
    });
    setEditingFaction(null);
    setModalOpen(true);
  };

  // Open modal for editing a faction
  const handleEditFaction = (faction) => {
    setFormData({ ...faction });
    setEditingFaction(faction);
    setModalOpen(true);
  };

  // Close modal and reset
  const handleCloseModal = () => {
    setModalOpen(false);
    setFormData(null);
    setEditingFaction(null);
  };

  // Handle form field changes
  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save faction (create or update)
  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;

    setSaving(true);
    try {
      const updated = { ...formData };
      const updatedFactions = editingFaction
        ? factions.map((f) => (f.id === editingFaction.id ? updated : f))
        : [...factions, updated];

      await saveFactionsList(updatedFactions);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save faction:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete faction
  const handleDelete = async () => {
    if (!editingFaction) return;

    if (!window.confirm('Delete this faction?')) return;

    setDeleting(true);
    try {
      await deleteFactionAction(editingFaction.id);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to delete faction:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Truncate text for preview
  const truncateText = (text, maxLength) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '…';
  };

  // Get influence badge styles
  const getInfluenceStyle = (influence) => {
    let level;
    if (influence <= 3) level = 'low';
    else if (influence <= 6) level = 'medium';
    else if (influence <= 8) level = 'high';
    else level = 'extreme';

    const colors = INFLUENCE_COLORS[level] || INFLUENCE_COLORS.medium;
    return {
      backgroundColor: colors.bg,
      color: colors.color,
      borderColor: colors.border,
    };
  };

  return (
    <div className="ct-container">
      {/* Header */}
      <div className="ct-header">
        <button className="ct-back-btn" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
        <h2 className="ct-title">
          <i className="fa-solid fa-handshake" /> Factions
        </h2>
        <button className="ct-new-btn" onClick={handleNewFaction}>
          <i className="fa-solid fa-plus" /> New Faction
        </button>
      </div>

      {/* Search bar */}
      <div className="ct-search-row">
        <i className="fa-solid fa-magnifying-glass ct-search-icon" />
        <input
          type="text"
          className="ct-search-input"
          placeholder="Search factions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search factions"
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

      {/* Loading state */}
      {loading && (
        <div className="ct-empty-state">
          <i className="fa-solid fa-spinner fa-spin" /> Loading factions…
        </div>
      )}

      {/* Factions list */}
      {!loading && filteredFactions.length === 0 && (
        <div className="ct-empty-state">
          {searchQuery ? (
            <>
              <i className="fa-solid fa-search" />
              No factions found matching &ldquo;{searchQuery}&rdquo;
            </>
          ) : (
            <>
              <i className="fa-solid fa-handshake" />
              No factions yet. Click &ldquo;New Faction&rdquo; to create one.
            </>
          )}
        </div>
      )}

      {!loading && filteredFactions.length > 0 && (
        <ul className="ct-list">
          {filteredFactions.map((faction) => (
            <li
              key={faction.id}
              className="ct-list-item"
              onClick={() => handleEditFaction(faction)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleEditFaction(faction);
                }
              }}
              aria-label={`Edit faction: ${faction.name}`}
            >
              <div className="ct-list-item-header">
                <span className="ct-list-name">{faction.name}</span>
                <div className="ct-list-meta">
                  {faction.influence != null && (
                    <span
                      className="factions-list-influence"
                      style={getInfluenceStyle(faction.influence)}
                      title={`Influence: ${faction.influence}`}
                    >
                      {faction.influence}
                    </span>
                  )}
                </div>
              </div>
              <div className="ct-list-details">
                {faction.description && (
                  <span className="factions-list-preview">
                    {truncateText(faction.description, 60)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && formData && (
        <div className="ct-modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) handleCloseModal();
        }}>
          <div className="ct-modal factions-modal">
            <div className="ct-modal-header no-print">
              <h3>{editingFaction ? 'Edit Faction' : 'New Faction'}</h3>
              <button
                className="ct-modal-close"
                onClick={handleCloseModal}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="ct-modal-body">
              {/* Name (required) */}
              <label htmlFor="faction-name" className="ct-label">
                Faction Name <span className="ct-required">*</span>
              </label>
              <input
                id="faction-name"
                type="text"
                className="ct-input"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="Faction name"
                autoFocus
              />

              {/* Description */}
              <PreviewToggle
                id="faction-description"
                value={formData.description}
                onChange={(value) => handleFormChange('description', value)}
                placeholder="What is this faction about?"
                label="Description"
              />

              {/* Goals */}
              <PreviewToggle
                id="faction-goals"
                value={formData.goals}
                onChange={(value) => handleFormChange('goals', value)}
                placeholder="What does this faction want to achieve?"
                label="Goals"
              />

              {/* Influence Level */}
              <label htmlFor="faction-influence" className="ct-label">
                Influence Level
              </label>
              <div className="factions-influence-row">
                <input
                  id="faction-influence"
                  type="range"
                  min="1"
                  max="10"
                  value={formData.influence}
                  onChange={(e) => handleFormChange('influence', parseInt(e.target.value))}
                />
                <span
                  className="factions-influence-value"
                  style={getInfluenceStyle(formData.influence)}
                >
                  {formData.influence}
                </span>
              </div>

              {/* Notes */}
              <PreviewToggle
                id="faction-notes"
                value={formData.notes}
                onChange={(value) => handleFormChange('notes', value)}
                placeholder="Additional notes…"
                label="Notes"
              />
            </div>

            <div className="ct-modal-footer no-print">
              <div className="ct-modal-actions">
                {editingFaction && (
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

export default Factions;
