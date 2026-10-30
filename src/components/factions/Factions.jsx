import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useCrudList } from '../../hooks/useCrudList.js';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';
import { useReloadGuard } from '../../hooks/management/useReloadGuard.js';
import { loadFactions, saveFactions, deleteFaction } from '../../services/campaign/factionsService.js';
import utils from '../../services/ui/utils.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
import Subscriber from '../common/Subscriber.jsx';
import './Factions.css';

const INFLUENCE_COLORS = {
  low: { bg: '#1a472a', color: '#90ee90', border: '#2d6a4f' },
  medium: { bg: '#713f12', color: '#fde047', border: '#a16207' },
  high: { bg: '#7c2d12', color: '#fed7aa', border: '#c2410c' },
  extreme: { bg: '#7f1d1d', color: '#fecaca', border: '#b91c1c' },
};

function FactionsEmptyState({ searchQuery }) {
  return (
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
  );
}

// Duplicate-name guard (mirrors NPCs.jsx / MapsManager.handleCreate)
const hasDuplicateName = (factions, editingId, name) => factions.some(f =>
  f.id !== editingId && (f.name || '').trim().toLowerCase() === name.trim().toLowerCase()
);

const DUPLICATE_NAME_ERROR = 'A faction with that name already exists';

function getDuplicateState({ modalOpen, formData, factions, editingFaction, saving, error, errorIsConflict }) {
  if (!formData) return { visibleError: error, saveDisabled: true, showErrorReload: false };
  const duplicateNameError = modalOpen && hasDuplicateName(factions, editingFaction?.id, formData.name)
    ? DUPLICATE_NAME_ERROR
    : null;
  return {
    visibleError: duplicateNameError || error,
    saveDisabled: saving || !formData.name.trim() || !!duplicateNameError,
    // Only a genuine conflict (never a live duplicate-name banner layered over
    // a stale error) earns the one-click "Reload list" recovery action.
    showErrorReload: !duplicateNameError && errorIsConflict,
  };
}

// Truncate text for preview
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

// Get influence badge styles
function getInfluenceStyle(influence) {
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
}

function Factions({ campaignName, onBack }) {
  const { items: factions, loading, loadItems: loadFactionsList, saveItems: saveFactionsList, deleteItem: deleteFactionAction } =
    useEntityManagement(campaignName, { load: loadFactions, save: saveFactions, delete: deleteFaction }, { responseKey: 'factions', loadOnMount: false });

  const {
    searchQuery, setSearchQuery, filteredItems: filteredFactions,
    modalOpen, editingItem: editingFaction, formData,
    saving, setSaving,
    openNew, openEdit, closeModal, updateFormField,
  } = useCrudList(factions, ['name']);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  // True when the visible banner error is a 409 concurrent-edit conflict
  // (server body { conflict: true }) — gates the "Reload list" action button.
  const [errorIsConflict, setErrorIsConflict] = useState(false);
  // Skipped-while-editing SSE list broadcasts and rejected (409) saves prove
  // the on-screen list is stale; consumed in handleCloseModal so a reopen
  // re-seeds a fresh row instead of repeating the same 409. Mirrors NPCs.jsx.
  const missedListBroadcast = useRef(false);
  // Draft snapshot powering the reload-discard guard — shared with the NPC
  // lane (useReloadGuard, improve 2026-10-28-T backlog).
  const { seedDraft, clearDraft, confirmDiscardDraft } = useReloadGuard({
    modalOpen,
    formData,
    confirmMessage: 'Reload the faction list and discard your unsaved edits?',
  });

  // Single choke point for the banner: every message carries whether it was a
  // conflict, so the "Reload list" action can never outlive its error copy.
  const showError = (message, conflict = false) => {
    setError(message);
    setErrorIsConflict(conflict);
  };

  // Load factions on mount
  useEffect(() => {
    if (campaignName) {
      loadFactionsList();
    }
  }, [campaignName, loadFactionsList]);

  // SSE handler — re-fetch faction list on factions-list events (another GM
  // tab created/updated/deleted a faction). Skipped while the edit modal is
  // open so an in-progress draft is never squashed mid-edit; the miss is
  // applied on close (see handleCloseModal). Mirrors NPCs.jsx.
  const handleSSEEvent = useCallback((event) => {
    if (!event || event.key !== `factions-list-${campaignName}`) return;
    if (modalOpen) {
      missedListBroadcast.current = true;
      return;
    }
    loadFactionsList();
  }, [campaignName, modalOpen, loadFactionsList]);

  // Open modal for new faction
  const handleNewFaction = () => {
    showError(null);
    const seed = {
      id: utils.safeUuid(),
      name: '',
      description: '',
      goals: '',
      influence: 1,
      notes: '',
    };
    seedDraft(seed);
    openNew(seed);
  };

  // Open modal for editing a faction
  const handleEditFaction = (faction) => {
    showError(null);
    openEdit(faction);
    seedDraft(faction);
  };

  // Close modal and reset
  const handleCloseModal = () => {
    showError(null);
    closeModal();
    clearDraft();
    // A broadcast skipped while editing, or a rejected save, means the rows
    // are stale — refresh so the next reopen seeds fresh (mirrors NPCs.jsx).
    if (missedListBroadcast.current) {
      missedListBroadcast.current = false;
      loadFactionsList();
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
  // naming the faction the editor shows (typed name, else the row's
  // original); an unnamed new draft falls back to the wizard's generic
  // new-draft copy. A clean draft closes silently exactly as before. Kept
  // OUT of handleCloseModal so internal closes (save/delete/reload) never
  // double-confirm; dismiss is fully inert (banner, editor, draft).
  const handleRequestClose = () => {
    const name = (formData?.name || '').trim() || editingFaction?.name;
    if (!confirmDiscardDraft(
      name ? `Discard changes to "${name}"?` : 'Discard this new faction draft?'
    )) return;
    handleCloseModal();
  };

  // Handle form field changes. Name edits also clear a sticky duplicate-name
  // error surfaced by a server 400 (the derived guard above only re-evaluates
  // against the locally-loaded list); unrelated errors stay until Save/Close.
  const handleFormChange = (field, value) => {
    updateFormField(field, value);
    if (field === 'name' && error === DUPLICATE_NAME_ERROR) showError(null);
  };

  // Derived duplicate-name error: shown while typing, cleared as soon as the name changes
  const { visibleError, saveDisabled, showErrorReload } = getDuplicateState({
    modalOpen, formData, factions, editingFaction, saving, error, errorIsConflict,
  });

  // Save faction (create or update); duplicate-name guard mirrors NPCs.jsx
  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;
    if (hasDuplicateName(factions, editingFaction?.id, formData.name)) {
      showError(DUPLICATE_NAME_ERROR);
      return;
    }

    setSaving(true);
    try {
      const updated = { ...formData };
      const updatedFactions = editingFaction
        ? factions.map((f) => (f.id === editingFaction.id ? updated : f))
        : [...factions, updated];

      await saveFactionsList(updatedFactions);
      showError(null);
      missedListBroadcast.current = false;
      flushSync(handleCloseModal);
    } catch (err) {
      // The 409 concurrent-edit conflict is already logged once at warn by
      // the service layer (improve 2026-10-27-J); only genuine failures get
      // a red console line here. The banner below owns user feedback.
      if (!err.conflict) {
        console.error('Failed to save faction:', err);
      }
      missedListBroadcast.current = true;
      showError(err.message || 'Failed to save factions', err.conflict === true);
    } finally {
      setSaving(false);
    }
  };

  // Delete faction
  const handleDelete = async () => {
    if (!editingFaction) return;

    if (!window.confirm(`Delete Faction "${editingFaction.name}"?`)) return;

    setDeleting(true);
    try {
      await deleteFactionAction(editingFaction.id);
      missedListBroadcast.current = false;
      handleCloseModal();
    } catch (error) {
      console.error('Failed to delete faction:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="ct-container">
      <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />

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
        <FactionsEmptyState searchQuery={searchQuery} />
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
        <div className="ct-modal-overlay">
          <div className="ct-modal factions-modal">
            <div className="ct-modal-header no-print">
              <h3>{editingFaction ? 'Edit Faction' : 'New Faction'}</h3>
              <button
                className="ct-modal-close"
                onClick={handleRequestClose}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="ct-modal-body">
              {visibleError && (
                <div className="factions-form-error">
                  {visibleError}
                  {showErrorReload && (
                    <button
                      className="ct-btn factions-error-reload-btn"
                      onClick={handleReloadList}
                    >
                      <i className="fa-solid fa-rotate" /> Reload list
                    </button>
                  )}
                </div>
              )}
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
                  onClick={handleRequestClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="ct-btn ct-btn-primary"
                  onClick={handleSave}
                  disabled={saveDisabled}
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
