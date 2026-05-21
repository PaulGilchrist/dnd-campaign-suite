import { useState, useEffect, useMemo } from 'react';
import useQuestsManagement from '../../hooks/useQuestsManagement.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
import './Quests.css';

const STATUS_OPTIONS = ['active', 'completed', 'failed'];

const STATUS_COLORS = {
  active: { bg: '#d1fae5', color: '#065f46', border: '#34d399' },
  completed: { bg: '#dbeafe', color: '#1e40af', border: '#60a5fa' },
  failed: { bg: '#fee2e2', color: '#991b1b', border: '#f87171' }
};

function Quests({ campaignName, isLocalhost, onBack }) {
  if (!isLocalhost) return null;

  const { quests, loading, loadQuestsList, saveQuestsList, deleteQuestAction } = useQuestsManagement(campaignName);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState(null);
  const [formData, setFormData] = useState({ name: '', status: 'active', description: '', rewards: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const filteredQuests = useMemo(() => {
    if (!searchQuery.trim()) return quests;
    const query = searchQuery.toLowerCase();
    return quests.filter(q => q.name?.toLowerCase().includes(query));
  }, [quests, searchQuery]);

  const handleNewQuest = () => {
    setFormData({ name: '', status: 'active', description: '', rewards: '', notes: '' });
    setEditingQuest(null);
    setModalOpen(true);
  };

  const handleEditQuest = (quest) => {
    setFormData({ ...quest });
    setEditingQuest(quest);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingQuest(null);
    setFormData({ name: '', status: 'active', description: '', rewards: '', notes: '' });
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) return;
    setSaving(true);
    try {
      const questsArray = editingQuest
        ? quests.map(q => q.id === editingQuest.id ? { ...formData } : q)
        : [...quests, { id: crypto.randomUUID(), ...formData }];
      await saveQuestsList(questsArray);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save quest:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (quest) => {
    if (!window.confirm(`Delete quest "${quest.name}"?`)) return;
    setDeleting(quest.id);
    try {
      await deleteQuestAction(quest.id);
    } catch (error) {
      console.error('Failed to delete quest:', error);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="quests-container">
      <div className="quests-header">
        <button className="quests-back-btn" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
        <h2 className="quests-title">
          <i className="fa-solid fa-scroll" /> Quests
        </h2>
        <button className="quests-new-btn" onClick={handleNewQuest}>
          <i className="fa-solid fa-plus" /> New Quest
        </button>
      </div>

      <div className="quests-search-row">
        <i className="fa-solid fa-magnifying-glass quests-search-icon" />
        <input
          type="text"
          className="quests-search-input"
          placeholder="Search Quests\u2026"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search Quests"
        />
        {searchQuery && (
          <button
            className="quests-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {loading && (
        <div className="quests-empty-state">
          <i className="fa-solid fa-spinner fa-spin" /> Loading quests\u2026
        </div>
      )}

      {!loading && filteredQuests.length === 0 && (
        <div className="quests-empty-state">
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
      )}

      {!loading && filteredQuests.length > 0 && (
        <ul className="quests-list">
          {filteredQuests.map(quest => {
            const statusColor = STATUS_COLORS[quest.status] || STATUS_COLORS.active;
            return (
              <li
                key={quest.id}
                className="quests-list-item"
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
                <div className="quests-list-item-header">
                  <span className="quests-list-name">{quest.name}</span>
                  <div className="quests-list-meta">
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
                  <div className="quests-list-details">
                    <span className="quests-list-subtitle">
                      {quest.description.length > 100 ? quest.description.substring(0, 100) + '...' : quest.description}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && formData && (
        <div className="quests-modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) handleCloseModal();
        }}>
          <div className="quests-modal">
            <div className="quests-modal-header">
              <h3>{editingQuest ? 'Edit Quest' : 'New Quest'}</h3>
              <button
                className="quests-modal-close"
                onClick={handleCloseModal}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="quests-modal-body">
              <label htmlFor="quest-name" className="quests-label">
                Name <span className="quests-required">*</span>
              </label>
              <input
                id="quest-name"
                type="text"
                className="quests-input"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="Quest name"
                autoFocus
              />

              <label htmlFor="quest-status" className="quests-label">
                Status
              </label>
              <select
                id="quest-status"
                className="quests-select"
                value={formData.status}
                onChange={(e) => handleFormChange('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                ))}
              </select>

              <PreviewToggle
                id="quest-description"
                value={formData.description}
                onChange={(value) => handleFormChange('description', value)}
                placeholder="Describe the quest\u2026"
                label="Description"
              />

              <PreviewToggle
                id="quest-rewards"
                value={formData.rewards}
                onChange={(value) => handleFormChange('rewards', value)}
                placeholder="Describe rewards\u2026"
                label="Rewards"
              />

              <PreviewToggle
                id="quest-notes"
                value={formData.notes}
                onChange={(value) => handleFormChange('notes', value)}
                placeholder="Additional notes\u2026"
                label="Notes"
              />
            </div>

            <div className="quests-modal-footer">
              <div className="quests-modal-actions">
                {editingQuest && (
                  <button
                    className="quests-btn quests-btn-danger"
                    onClick={() => handleDelete(editingQuest)}
                    disabled={deleting}
                  >
                    <i className="fa-solid fa-trash-can" />{' '}
                    {deleting ? 'Deleting\u2026' : 'Delete'}
                  </button>
                )}
              </div>
              <div className="quests-modal-buttons">
                <button
                  className="quests-btn quests-btn-secondary"
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="quests-btn quests-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                >
                  <i className="fa-solid fa-floppy-disk" />{' '}
                  {saving ? 'Saving\u2026' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Quests;
