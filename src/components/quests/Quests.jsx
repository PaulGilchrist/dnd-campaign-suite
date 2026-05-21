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
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h2 className="quests-title"><i className="fa-solid fa-scroll"></i> Quests</h2>
        <button className="quests-new-btn" onClick={handleNewQuest}>
          <i className="fa-solid fa-plus"></i> New Quest
        </button>
      </div>

      <div className="quests-search-row">
        <i className="fa-solid fa-search quests-search-icon"></i>
        <input
          className="quests-search-input"
          type="text"
          placeholder="Search quests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="quests-search-clear" onClick={() => setSearchQuery('')}>
            <i className="fa-solid fa-times"></i>
          </button>
        )}
      </div>

      {loading ? (
        <div className="quests-empty-state">
          <i className="fa-solid fa-spinner fa-spin"></i> Loading quests...
        </div>
      ) : filteredQuests.length === 0 ? (
        <div className="quests-empty-state">
          {searchQuery ? 'No quests match your search.' : 'No quests yet. Click "New Quest" to create one.'}
        </div>
      ) : (
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
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleEditQuest(quest); }}
                aria-label={`Edit quest: ${quest.name}`}
              >
                <div className="quests-list-item-header">
                  <span className="quests-list-name">{quest.name}</span>
                  <span
                    className="quests-list-status"
                    style={{
                      backgroundColor: statusColor.bg,
                      color: statusColor.color,
                      borderColor: statusColor.border
                    }}
                  >
                    {quest.status}
                  </span>
                </div>
                {quest.description && (
                  <div className="quests-list-description">
                    {quest.description.length > 100 ? quest.description.substring(0, 100) + '...' : quest.description}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <div className="quests-modal-overlay" onClick={handleCloseModal}>
          <div className="quests-modal" onClick={(e) => e.stopPropagation()}>
            <div className="quests-modal-header">
              <h3>{editingQuest ? 'Edit Quest' : 'New Quest'}</h3>
              <button className="quests-modal-close" onClick={handleCloseModal}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="quests-modal-body">
              <div className="quests-form-row">
                <label className="quests-label">
                  Quest Name <span className="quests-required">*</span>
                </label>
                <input
                  className="quests-input"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  autoFocus
                  placeholder="Enter quest name"
                />
              </div>
              <div className="quests-form-row">
                <label className="quests-label">Status</label>
                <select
                  className="quests-select"
                  value={formData.status}
                  onChange={(e) => handleFormChange('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="quests-form-row">
                <PreviewToggle
                  id="quest-description"
                  label="Description"
                  value={formData.description}
                  onChange={(val) => handleFormChange('description', val)}
                  placeholder="Describe the quest..."
                  rows={4}
                />
              </div>
              <div className="quests-form-row">
                <PreviewToggle
                  id="quest-rewards"
                  label="Rewards"
                  value={formData.rewards}
                  onChange={(val) => handleFormChange('rewards', val)}
                  placeholder="Describe rewards..."
                  rows={4}
                />
              </div>
              <div className="quests-form-row">
                <PreviewToggle
                  id="quest-notes"
                  label="Notes"
                  value={formData.notes}
                  onChange={(val) => handleFormChange('notes', val)}
                  placeholder="Additional notes..."
                  rows={4}
                />
              </div>
            </div>
            <div className="quests-modal-footer">
              <div className="quests-modal-actions">
                {editingQuest && (
                  <button
                    className="quests-btn quests-btn-danger"
                    onClick={() => handleDelete(editingQuest)}
                    disabled={deleting === editingQuest.id}
                  >
                    <i className="fa-solid fa-trash"></i> {deleting === editingQuest.id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
              <div className="quests-modal-buttons">
                <button className="quests-btn quests-btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button className="quests-btn quests-btn-primary" onClick={handleSave} disabled={saving || !formData.name?.trim()}>
                  {saving ? 'Saving...' : 'Save'}
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
