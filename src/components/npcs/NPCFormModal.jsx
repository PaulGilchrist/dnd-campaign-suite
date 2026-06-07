import { useState } from 'react';
import { npcHasStatBlock } from '../../services/encounters/npcStatBlockUtils.js';
import AvatarImage from '../common/AvatarImage.jsx';
import AvatarModal from '../common/AvatarModal.jsx';
import NPCRoleplayForm from './NPCRoleplayForm.jsx';
import NPCStatBlockForm from './NPCStatBlockForm.jsx';

function NPCFormModal({
  formData,
  setFormData,
  editingNPC,
  saving,
  deleting,
  disabled,
  onClose,
  onSave,
  onDelete,
  onSaveAndAddToInitiative,
}) {
  const [activeTab, setActiveTab] = useState('roleplay');
  const [showNpcAvatarModal, setShowNpcAvatarModal] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData((prev) => ({
        ...prev,
        image: event.target.result,
        imageName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      image: '',
      imageName: '',
      imagePath: '',
    }));
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <div className="ct-modal-overlay">
        <div className="ct-modal npcs-modal">
          <div className="ct-modal-header no-print">
            <h3>{editingNPC ? 'Edit NPC' : 'New NPC'}</h3>
            <button
              className="ct-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className="npcs-avatar-section no-print">
            <AvatarImage
              name={formData.name}
              imagePath={formData.image || formData.imagePath}
              size={80}
              onClick={(formData.image || formData.imagePath) ? () => setShowNpcAvatarModal(true) : undefined}
            />
            <div className="npcs-avatar-controls">
              <label className="ct-btn ct-btn-sm">
                <i className="fa-solid fa-camera" /> Upload Avatar
                <input
                  type="file"
                  accept="image/*"
                  className="npcs-avatar-input"
                  onChange={handleImageUpload}
                />
              </label>
              {(formData.image || formData.imagePath) && (
                <button className="ct-btn ct-btn-sm ct-btn-danger" onClick={handleRemoveImage}>
                  <i className="fa-solid fa-trash-can" /> Remove
                </button>
              )}
            </div>
          </div>

          <div className="npcs-tabs no-print">
            <button
              className={`npcs-tab ${activeTab === 'roleplay' ? 'npcs-tab-active' : ''}`}
              onClick={() => setActiveTab('roleplay')}
            >
              <i className="fa-solid fa-book" /> Roleplay
            </button>
            <button
              className={`npcs-tab ${activeTab === 'stats' ? 'npcs-tab-active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              <i className="fa-solid fa-shield" /> Stats
            </button>
          </div>

          <div className="ct-modal-body">
            <label htmlFor="npc-name" className="ct-label">
              Name <span className="ct-required">*</span>
            </label>
            <input
              id="npc-name"
              type="text"
              className="ct-input"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="NPC name"
              autoFocus
            />

            <div className={`npcs-roleplay-tab${activeTab !== 'roleplay' ? ' npcs-tab-hidden' : ''}`}>
              <NPCRoleplayForm formData={formData} onFieldChange={handleFieldChange} />
            </div>

            <div className={`npcs-stats-tab${activeTab !== 'stats' ? ' npcs-tab-hidden' : ''}`.trim()}>
              <NPCStatBlockForm formData={formData} setFormData={setFormData} />
            </div>
          </div>

          <div className="ct-modal-footer no-print">
            <div className="ct-modal-actions">
              {editingNPC && (
                <button
                  className="ct-btn ct-btn-danger"
                  onClick={onDelete}
                  disabled={deleting}
                >
                  <i className="fa-solid fa-trash-can" />{' '}
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              )}
              {npcHasStatBlock(formData) && onSaveAndAddToInitiative && (
                <button
                  className="ct-btn"
                  onClick={onSaveAndAddToInitiative}
                  disabled={disabled}
                  title="Save and add to initiative"
                >
                  <i className="fa-solid fa-shield-alt" /> Save & Add to Initiative
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
                disabled={disabled}
              >
                <i className="fa-solid fa-floppy-disk" />{' '}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showNpcAvatarModal && (formData.image || formData.imagePath) && (
        <AvatarModal
          name={formData.name}
          imagePath={formData.image || formData.imagePath}
          onClose={() => setShowNpcAvatarModal(false)}
        />
      )}
    </>
  );
}

export default NPCFormModal;
