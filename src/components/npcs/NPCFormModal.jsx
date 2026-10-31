import { useState } from 'react';
import { npcHasStatBlock } from '../../services/encounters/npcStatBlockUtils.js';
import { projectNPCForRefine } from '../../services/npcs/npcFormUtils.js';
import AvatarImage from '../common/AvatarImage.jsx';
import AvatarModal from '../common/AvatarModal.jsx';
import AiRefineButton from '../common/AiRefineButton.jsx';
import NPCRoleplayForm from './NPCRoleplayForm.jsx';
import NPCStatBlockForm from './NPCStatBlockForm.jsx';

function NPCFormFooter({
  editingNPC,
  formData,
  setFormData,
  campaignName,
  saving,
  deleting,
  disabled,
  onClose,
  onSave,
  onDelete,
  onSaveAndAddToInitiative,
}) {
  return (
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
        {editingNPC && campaignName && (
          <AiRefineButton
            campaignName={campaignName}
            kind="npc"
            entity={projectNPCForRefine(formData)}
            onReplaced={(replacement) =>
              // Merge, never replace: the schema-clean proposal carries no
              // GM-owned image fields or row stamps — a bare setFormData
              // would drop them and a later Save would wipe the avatar.
              setFormData((prev) => ({ ...prev, ...replacement }))
            }
          />
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
  );
}

function NPCFormModal({
  formData,
  setFormData,
  editingNPC,
  campaignName,
  initialTab = 'roleplay',
  saving,
  deleting,
  error,
  errorConflict,
  disabled,
  onClose,
  onReloadList,
  onSave,
  onDelete,
  onSaveAndAddToInitiative,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
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

  const avatarPath = formData.image || formData.imagePath;

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
              imagePath={avatarPath}
              campaignName={campaignName}
              size={80}
              onClick={avatarPath ? () => setShowNpcAvatarModal(true) : undefined}
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
              {avatarPath && (
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
            {error && (
              <div className="npcs-form-error">
                {error}
                {/* 409 conflicts only: one-click sanctioned recovery (close +
                    refetch) so the guided "reload the list" step needs no
                    trial-and-error. Mirrors handleCloseModal's stale path. */}
                {errorConflict && onReloadList && (
                  <button
                    className="ct-btn npcs-error-reload-btn"
                    onClick={onReloadList}
                  >
                    <i className="fa-solid fa-rotate" /> Reload list
                  </button>
                )}
              </div>
            )}

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

          <NPCFormFooter
            editingNPC={editingNPC}
            formData={formData}
            setFormData={setFormData}
            campaignName={campaignName}
            saving={saving}
            deleting={deleting}
            disabled={disabled}
            onClose={onClose}
            onSave={onSave}
            onDelete={onDelete}
            onSaveAndAddToInitiative={onSaveAndAddToInitiative}
          />
        </div>
      </div>
      {showNpcAvatarModal && avatarPath && (
        <AvatarModal
          name={formData.name}
          imagePath={avatarPath}
          campaignName={campaignName}
          onClose={() => setShowNpcAvatarModal(false)}
        />
      )}
    </>
  );
}

export default NPCFormModal;
