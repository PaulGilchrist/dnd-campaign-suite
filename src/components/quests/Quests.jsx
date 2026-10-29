import { useState, useCallback, useRef } from 'react';
import { useCrudList } from '../../hooks/useCrudList.js';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';
import { loadQuests, saveQuests, deleteQuest } from '../../services/campaign/questsService.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
import MarkdownPreview from '../common/MarkdownPreview.jsx';
import Subscriber from '../common/Subscriber.jsx';
import './Quests.css';

const STATUS_OPTIONS = ['active', 'completed', 'failed'];

// Truncate description for the row preview (mirrors Notes.jsx; markdown is
// then rendered sanitized+clamped instead of printed raw).
function truncateDescription(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Mirrors server/utils/nameUniqueness.js output for quests (byte-identical),
// so client- and server-surfaced duplicate errors clear the same way.
const DUPLICATE_NAME_ERROR = 'A quest with that name already exists';

// Duplicate-name guard + derived modal state (mirrors Factions.jsx verbatim):
// the banner and Save-disable are DERIVED on every render, so a duplicate
// blocks LIVE while typing, not just on the Save press.
const hasDuplicateName = (quests, editingId, name) => quests.some(q =>
  q.id !== editingId && (q.name || '').trim().toLowerCase() === name.trim().toLowerCase()
);

function getDuplicateState({ modalOpen, formData, quests, editingQuest, saving, error, errorIsConflict }) {
  if (!formData) return { visibleError: error, saveDisabled: true, showErrorReload: false };
  const duplicateNameError = modalOpen && hasDuplicateName(quests, editingQuest?.id, formData.name)
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

const STATUS_COLORS = {
  active: { bg: '#d1fae5', color: '#065f46', border: '#34d399' },
  completed: { bg: '#dbeafe', color: '#1e40af', border: '#60a5fa' },
  failed: { bg: '#fee2e2', color: '#991b1b', border: '#f87171' }
};

function QuestEmptyState({ searchQuery }) {
  return (
    <div className="ct-empty-state">
      {searchQuery ? (
        <>
          <i className="fa-solid fa-search" />
          No quests found matching &ldquo;{searchQuery}&rdquo;
        </>
      ) : (
        <>
          <i className="fa-solid fa-scroll" />
          No quests yet. Click &ldquo;New Quest&rdquo; to create one.
        </>
      )}
    </div>
  );
}

function QuestFormModal({ editingQuest, formData, saving, deleting, error, errorConflict, saveDisabled, onChange, onClose, onReloadList, onSave, onDelete }) {
  return (
    <div className="ct-modal-overlay">
      <div className="ct-modal quests-modal">
        <div className="ct-modal-header no-print">
          <h3>{editingQuest ? 'Edit Quest' : 'New Quest'}</h3>
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
            <div className="quests-form-error">
              {error}
              {errorConflict && onReloadList && (
                <button
                  className="ct-btn quests-error-reload-btn"
                  onClick={onReloadList}
                >
                  <i className="fa-solid fa-rotate" /> Reload list
                </button>
              )}
            </div>
          )}
          <label htmlFor="quest-name" className="ct-label">
            Name <span className="ct-required">*</span>
          </label>
          <input
            id="quest-name"
            type="text"
            className="ct-input"
            value={formData.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Quest name"
            autoFocus
          />

          <label htmlFor="quest-status" className="ct-label">
            Status
          </label>
          <select
            id="quest-status"
            className="ct-select"
            value={formData.status}
            onChange={(e) => onChange('status', e.target.value)}
          >
            {STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
            ))}
          </select>

          <PreviewToggle
            id="quest-description"
            value={formData.description}
            onChange={(value) => onChange('description', value)}
            placeholder="Describe the quest…"
            label="Description"
          />

          <PreviewToggle
            id="quest-rewards"
            value={formData.rewards}
            onChange={(value) => onChange('rewards', value)}
            placeholder="Describe rewards…"
            label="Rewards"
          />

          <PreviewToggle
            id="quest-notes"
            value={formData.notes}
            onChange={(value) => onChange('notes', value)}
            placeholder="Additional notes…"
            label="Notes"
          />
        </div>

        <div className="ct-modal-footer no-print">
          <div className="ct-modal-actions">
            {editingQuest && (
              <button
                className="ct-btn ct-btn-danger"
                onClick={() => onDelete(editingQuest)}
                disabled={deleting}
              >
                <i className="fa-solid fa-trash-can" />{' '}
                {deleting ? 'Deleting\u2026' : 'Delete'}
              </button>
            )}
          </div>
          <div className="ct-modal-buttons">
            <button
              className="ct-btn ct-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="ct-btn ct-btn-primary"
              onClick={onSave}
              disabled={saveDisabled}
            >
              <i className="fa-solid fa-floppy-disk" />{' '}
              {saving ? 'Saving\u2026' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Quests({ campaignName, isLocalhost, onBack }) {
  const { items: quests, loading, loadItems: loadQuestsList, saveItems: saveQuestsList, deleteItem: deleteQuestAction } = useEntityManagement(campaignName, { load: loadQuests, save: saveQuests, delete: deleteQuest });
  const {
    searchQuery, setSearchQuery, filteredItems: filteredQuests,
    modalOpen, editingItem: editingQuest, formData, setFormData,
    saving, setSaving,
    openNew, openEdit, closeModal, updateFormField,
  } = useCrudList(quests, ['name']);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);
  // True when the visible banner error is a 409 concurrent-edit conflict
  // (server body { conflict: true }) — gates the "Reload list" action button.
  const [errorIsConflict, setErrorIsConflict] = useState(false);
  // Skipped-while-editing SSE list broadcasts and rejected (409) saves prove
  // the on-screen list is stale; consumed in handleCloseModal so a reopen
  // re-seeds a fresh row instead of repeating the same 409. Mirrors NPCs.jsx.
  const missedListBroadcast = useRef(false);

  // Single choke point for the banner: every message carries whether it was a
  // conflict, so the "Reload list" action can never outlive its error copy.
  const showError = (message, conflict = false) => {
    setError(message);
    setErrorIsConflict(conflict);
  };

  // SSE handler — re-fetch quest list on quests-list events (another GM tab
  // created/updated/deleted a quest). Skipped while the edit modal is open so
  // an in-progress draft is never squashed mid-edit; the miss is applied on
  // close (see handleCloseModal). Mirrors NPCs.jsx.
  const handleSSEEvent = useCallback((event) => {
    if (!event || event.key !== `quests-list-${campaignName}`) return;
    if (modalOpen) {
      missedListBroadcast.current = true;
      return;
    }
    loadQuestsList();
  }, [campaignName, modalOpen, loadQuestsList]);

  if (!isLocalhost) return null;

  const handleNewQuest = () => {
    showError(null);
    openNew({ name: '', status: 'active', description: '', rewards: '', notes: '' });
  };

  const handleEditQuest = (quest) => {
    showError(null);
    openEdit(quest);
  };

  const handleCloseModal = () => {
    showError(null);
    closeModal();
    setFormData({ name: '', status: 'active', description: '', rewards: '', notes: '' });
    // A broadcast skipped while editing, or a rejected save, means the rows
    // are stale — refresh so the next reopen seeds fresh (mirrors NPCs.jsx).
    if (missedListBroadcast.current) {
      missedListBroadcast.current = false;
      loadQuestsList();
    }
  };

  // One-click guided recovery for the 409 banner: force the sanctioned stale
  // close path (close the editor + consume the list refresh) so the reopen
  // immediately seeds the fresh row — no trial-and-error.
  const handleReloadList = () => {
    missedListBroadcast.current = true;
    handleCloseModal();
  };

  // Name edits clear a sticky duplicate-name banner surfaced by a server 400
  // (the derived guard below re-evaluates live while typing); unrelated
  // save/delete errors stay until Save/Close. Mirrors Factions.jsx.
  const handleFormChange = (field, value) => {
    updateFormField(field, value);
    if (field === 'name' && error === DUPLICATE_NAME_ERROR) showError(null);
  };

  // Derived duplicate-name error: shown live while typing, cleared as soon as
  // the name is unique again; Save stays disabled while it persists.
  const { visibleError, saveDisabled, showErrorReload } = getDuplicateState({
    modalOpen, formData, quests, editingQuest, saving, error, errorIsConflict,
  });

  // Save quest (create or update); duplicate-name guard remains as backstop
  // for programmatic/edge paths (server check is the final authority).
  const handleSave = async () => {
    if (!formData.name?.trim()) return;
    if (hasDuplicateName(quests, editingQuest?.id, formData.name)) {
      showError(DUPLICATE_NAME_ERROR);
      return;
    }
    setSaving(true);
    try {
      const questsArray = editingQuest
        ? quests.map(q => q.id === editingQuest.id ? { ...formData } : q)
        : [...quests, { id: crypto.randomUUID(), ...formData }];
      await saveQuestsList(questsArray);
      showError(null);
      missedListBroadcast.current = false;
      handleCloseModal();
    } catch (err) {
      // The 409 concurrent-edit conflict is already logged once at warn by
      // the service layer (improve 2026-10-27-J); only genuine failures get
      // a red console line here. The banner below owns user feedback.
      if (!err.conflict) {
        console.error('Failed to save quest:', err);
      }
      missedListBroadcast.current = true;
      showError(err.message || 'Failed to save quests', err.conflict === true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (quest) => {
    if (!window.confirm(`Delete quest "${quest.name}"?`)) return;
    setDeleting(quest.id);
    try {
      await deleteQuestAction(quest.id);
      showError(null);
      missedListBroadcast.current = false;
      // Close the modal on success — mirrors NPCs/Notes/Factions/Sessions deletes.
      handleCloseModal();
    } catch (error) {
      console.error('Failed to delete quest:', error);
      showError(error.message || 'Failed to delete quest');
    } finally {
      setDeleting(null);
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
          <i className="fa-solid fa-scroll" /> Quests
        </h2>
        <button className="ct-new-btn" onClick={handleNewQuest}>
          <i className="fa-solid fa-plus" /> New Quest
        </button>
      </div>

      <div className="ct-search-row">
        <i className="fa-solid fa-magnifying-glass ct-search-icon" />
        <input
          type="text"
          className="ct-search-input"
          placeholder="Search Quests…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search Quests"
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

      {loading && (
        <div className="ct-empty-state">
          <i className="fa-solid fa-spinner fa-spin" /> Loading quests…
        </div>
      )}

      {!loading && filteredQuests.length === 0 && (
        <QuestEmptyState searchQuery={searchQuery} />
      )}

      {!loading && filteredQuests.length > 0 && (
        <ul className="ct-list">
          {filteredQuests.map(quest => {
            const statusColor = STATUS_COLORS[quest.status] || STATUS_COLORS.active;
            return (
              <li
                key={quest.id}
                className="ct-list-item"
                onClick={() => handleEditQuest(quest)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleEditQuest(quest);
                  }
                }}
                aria-label={`Edit quest: ${quest.name}`}
              >
                <div className="ct-list-item-header">
                  <span className="ct-list-name">{quest.name}</span>
                  <div className="ct-list-meta">
                    <span
                      className="quests-list-status"
                      style={statusColor}
                      title={quest.status}
                    >
                      {quest.status}
                    </span>
                  </div>
                </div>
                {quest.description && (
                  <div className="ct-list-details">
                    <MarkdownPreview
                      className="quests-list-subtitle"
                      text={truncateDescription(quest.description, 100)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && formData && (
        <QuestFormModal
          editingQuest={editingQuest}
          formData={formData}
          saving={saving}
          deleting={deleting}
          error={visibleError}
          errorConflict={showErrorReload}
          saveDisabled={saveDisabled}
          onChange={handleFormChange}
          onClose={handleCloseModal}
          onReloadList={handleReloadList}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

export default Quests;
