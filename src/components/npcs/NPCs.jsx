import { useState, useEffect, useMemo } from 'react';
import useNPCsManagement from '../../hooks/useNPCsManagement.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
import './NPCs.css';

const ATTITUDE_OPTIONS = [
  { value: 'deep bonds', label: 'Deep Bonds' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
  { value: 'extreme opposition', label: 'Extreme Opposition' },
];

const ATTITUDE_COLORS = {
  'deep bonds': { bg: '#1a472a', color: '#90ee90', border: '#2d6a4f' },
  positive: { bg: '#1b4332', color: '#b7e4c7', border: '#40916c' },
  neutral: { bg: '#4a4a4a', color: '#e0e0e0', border: '#6b6b6b' },
  negative: { bg: '#7b241c', color: '#f4a0a0', border: '#a43330' },
  'extreme opposition': { bg: '#5c030e', color: '#ff6b6b', border: '#8b0000' },
};

function NPCs({ campaignName, onBack }) {
  const { npcs, loading, loadNPCsList, saveNPCsList, deleteNPCAction } =
    useNPCsManagement(campaignName);

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNPC, setEditingNPC] = useState(null);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load NPCs on mount
  useEffect(() => {
    if (campaignName) {
      loadNPCsList();
    }
  }, [campaignName, loadNPCsList]);

  // Filtered NPCs based on search
  const filteredNPCs = useMemo(() => {
    if (!searchQuery.trim()) return npcs;
    const query = searchQuery.toLowerCase();
    return npcs.filter(
      (npc) =>
        npc.name?.toLowerCase().includes(query) ||
        npc.race?.toLowerCase().includes(query) ||
        npc.classRole?.toLowerCase().includes(query) ||
        npc.tags?.toLowerCase().includes(query)
    );
  }, [npcs, searchQuery]);

  // Open modal for new NPC
  const handleNewNPC = () => {
    setFormData({
      id: crypto.randomUUID(),
      name: '',
      race: '',
      classRole: '',
      appearance: '',
      personality: '',
      goals: '',
      secrets: '',
      notes: '',
      tags: '',
      attitude: 'neutral',
    });
    setEditingNPC(null);
    setModalOpen(true);
  };

  // Open modal for editing an NPC
  const handleEditNPC = (npc) => {
    setFormData({ ...npc });
    setEditingNPC(npc);
    setModalOpen(true);
  };

  // Close modal and reset
  const handleCloseModal = () => {
    setModalOpen(false);
    setFormData(null);
    setEditingNPC(null);
  };

  // Handle form field changes
  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save NPC (create or update)
  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;

    setSaving(true);
    try {
      const updated = { ...formData };
      const updatedNPCs = editingNPC
        ? npcs.map((n) => (n.id === editingNPC.id ? updated : n))
        : [...npcs, updated];

      await saveNPCsList(updatedNPCs);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save NPC:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete NPC
  const handleDelete = async () => {
    if (!editingNPC) return;

    if (!window.confirm('Delete this NPC?')) return;

    setDeleting(true);
    try {
      await deleteNPCAction(editingNPC.id);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to delete NPC:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Get attitude badge styles
  const getAttitudeStyle = (attitude) => {
    const colors = ATTITUDE_COLORS[attitude] || ATTITUDE_COLORS.neutral;
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
          <i className="fa-solid fa-users" /> NPCs
        </h2>
        <button className="ct-new-btn" onClick={handleNewNPC}>
          <i className="fa-solid fa-plus" /> New NPC
        </button>
      </div>

      {/* Search bar */}
      <div className="ct-search-row">
        <i className="fa-solid fa-magnifying-glass ct-search-icon" />
        <input
          type="text"
          className="ct-search-input"
          placeholder="Search NPCs…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search NPCs"
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
          <i className="fa-solid fa-spinner fa-spin" /> Loading NPCs…
        </div>
      )}

      {/* NPCs list */}
      {!loading && filteredNPCs.length === 0 && (
        <div className="ct-empty-state">
          {searchQuery ? (
            <>
              <i className="fa-solid fa-search" />
              No NPCs found matching &ldquo;{searchQuery}&rdquo;
            </>
          ) : (
            <>
              <i className="fa-solid fa-users" />
              No NPCs yet. Click &ldquo;New NPC&rdquo; to create one.
            </>
          )}
        </div>
      )}

      {!loading && filteredNPCs.length > 0 && (
        <ul className="ct-list">
          {filteredNPCs.map((npc) => (
            <li
              key={npc.id}
              className="ct-list-item"
              onClick={() => handleEditNPC(npc)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleEditNPC(npc);
                }
              }}
              aria-label={`Edit NPC: ${npc.name}`}
            >
              <div className="ct-list-item-header">
                <span className="ct-list-name">{npc.name}</span>
                <div className="ct-list-meta">
                  {npc.attitude && (
                    <span
                      className="ct-list-attitude"
                      style={getAttitudeStyle(npc.attitude)}
                      title={npc.attitude}
                    >
                      {npc.attitude}
                    </span>
                  )}
                </div>
              </div>
              <div className="ct-list-details">
                {(npc.race || npc.classRole) && (
                  <span className="ct-list-subtitle">
                    {npc.race && <span>{npc.race}</span>}
                    {npc.race && npc.classRole && <span className="ct-list-separator"> / </span>}
                    {npc.classRole && <span>{npc.classRole}</span>}
                  </span>
                )}
                {npc.tags && (
                  <span className="ct-list-tags">
                    <i className="fa-solid fa-tags" /> {npc.tags}
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
          <div className="ct-modal">
            <div className="ct-modal-header">
              <h3>{editingNPC ? 'Edit NPC' : 'New NPC'}</h3>
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
              <label htmlFor="npc-name" className="ct-label">
                Name <span className="ct-required">*</span>
              </label>
              <input
                id="npc-name"
                type="text"
                className="ct-input"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="NPC name"
                autoFocus
              />

              {/* Race */}
              <label htmlFor="npc-race" className="ct-label">
                Race
              </label>
              <input
                id="npc-race"
                type="text"
                className="ct-input"
                value={formData.race}
                onChange={(e) => handleFormChange('race', e.target.value)}
                placeholder="e.g., Human, Elf, Dwarf"
              />

              {/* Class / Role */}
              <label htmlFor="npc-classRole" className="ct-label">
                Class / Role
              </label>
              <input
                id="npc-classRole"
                type="text"
                className="ct-input"
                value={formData.classRole}
                onChange={(e) => handleFormChange('classRole', e.target.value)}
                placeholder="e.g., Fighter, Wizard, Merchant"
              />

              {/* Attitude */}
              <label htmlFor="npc-attitude" className="ct-label">
                Attitude
              </label>
              <select
                id="npc-attitude"
                className="ct-select"
                value={formData.attitude}
                onChange={(e) => handleFormChange('attitude', e.target.value)}
              >
                {ATTITUDE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Appearance */}
              <PreviewToggle
                id="npc-appearance"
                value={formData.appearance}
                onChange={(value) => handleFormChange('appearance', value)}
                placeholder="Physical description…"
                label="Appearance"
              />

              {/* Personality */}
              <PreviewToggle
                id="npc-personality"
                value={formData.personality}
                onChange={(value) => handleFormChange('personality', value)}
                placeholder="Personality traits, ideals, bonds, flaws…"
                label="Personality"
              />

              {/* Goals */}
              <PreviewToggle
                id="npc-goals"
                value={formData.goals}
                onChange={(value) => handleFormChange('goals', value)}
                placeholder="What does this NPC want?"
                label="Goals"
              />

              {/* Secrets */}
              <PreviewToggle
                id="npc-secrets"
                value={formData.secrets}
                onChange={(value) => handleFormChange('secrets', value)}
                placeholder="Hidden truths about this NPC…"
                label="Secrets"
              />

              {/* Notes */}
              <PreviewToggle
                id="npc-notes"
                value={formData.notes}
                onChange={(value) => handleFormChange('notes', value)}
                placeholder="Additional notes…"
                label="Notes"
              />

              {/* Tags */}
              <label htmlFor="npc-tags" className="ct-label">
                Tags (comma separated)
              </label>
              <input
                id="npc-tags"
                type="text"
                className="ct-input"
                value={formData.tags}
                onChange={(e) => handleFormChange('tags', e.target.value)}
                placeholder="e.g., ally, enemy, quest-giver"
              />

            </div>

            <div className="ct-modal-footer">
              <div className="ct-modal-actions">
                {editingNPC && (
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
                  className="ct-btn ct-btn"
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

export default NPCs;
