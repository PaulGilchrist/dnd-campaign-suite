import { useState, useMemo } from 'react';
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
  const { quests, loading, saveQuestsList, deleteQuestAction } = useQuestsManagement(campaignName);
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

  if (!isLocalhost) return null;

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
    <div className="ct-container">
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
          placeholder="Search Quests\u2026"
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
          <i className="fa-solid fa-spinner fa-spin" /> Loading quests\u2026
        </div>
      )}

      {!loading && filteredQuests.length === 0 && (
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
        <div className="ct-modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) handleCloseModal();
        }}>
          <div className="ct-modal quests-modal">
            <div className="ct-modal-header no-print">
              <h3>{editingQuest ? 'Edit Quest' : 'New Quest'}</h3>
              <button
                className="ct-modal-close"
                onClick={handleCloseModal}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="ct-modal-body">
              <label htmlFor="quest-name" className="ct-label">
                Name <span className="ct-required">*</span>
              </label>
              <input
                id="quest-name"
                type="text"
                className="ct-input"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
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

            <div className="ct-modal-footer no-print">
              <div className="ct-modal-actions">
                {editingQuest && (
                  <button
                    className="ct-btn ct-btn-danger"
                    onClick={() => handleDelete(editingQuest)}
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
