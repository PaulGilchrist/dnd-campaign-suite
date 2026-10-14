import { useState, useEffect, useCallback } from 'react';
import { useCrudList } from '../../hooks/useCrudList.js';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';
import { loadNPCs, saveNPC, saveNPCs, deleteNPC } from '../../services/npcs/npcsService.js';
import NPCListItem from './NPCListItem.jsx';
import NPCFormModal from './NPCFormModal.jsx';
import Subscriber from '../common/Subscriber.jsx';
import { getDefaultFormData, cleanNPCData } from '../../services/npcs/npcFormUtils.js';
import { addNPCToInitiative } from '../../services/npcs/npcCombatService.js';
import { generateNPC } from '../../services/npcs/npcGenerator.js';
import './NPCs.css';

function NPCs({ campaignName, onBack, onViewInitiative }) {
  const { items: npcs, loading, loadItems: loadNPCsList, deleteItem: deleteNPCAction } =
    useEntityManagement(campaignName, { load: loadNPCs, save: saveNPCs, delete: deleteNPC }, { responseKey: 'npcs', loadOnMount: false });

  const {
    searchQuery, setSearchQuery, filteredItems: filteredNPCs,
    modalOpen, editingItem: editingNPC, formData, setFormData,
    saving, setSaving,
    openNew, openEdit, closeModal,
  } = useCrudList(npcs, ['name', 'race', 'classRole', 'tags']);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [modalInitialTab, setModalInitialTab] = useState('roleplay');
  const [modalKey, setModalKey] = useState(0);

  useEffect(() => {
    if (campaignName) {
      loadNPCsList();
    }
  }, [campaignName, loadNPCsList]);

  // SSE handler — re-fetch NPC list on npcs-list events (another GM tab
  // created/deleted an NPC). Skipped while the edit modal is open so an
  // in-progress draft is never squashed mid-edit.
  const handleSSEEvent = useCallback((event) => {
    if (!event || event.key !== `npcs-list-${campaignName}`) return;
    if (modalOpen) return;
    loadNPCsList();
  }, [campaignName, modalOpen, loadNPCsList]);

  const handleNewNPC = () => {
    setError(null);
    setModalInitialTab('roleplay');
    openNew(getDefaultFormData());
  };

  const handleGenerateNPC = async () => {
    const generated = await generateNPC(npcs);
    setError(null);
    setModalInitialTab('roleplay');
    openNew(getDefaultFormData(generated));
  };

  const handleEditNPC = (npc, tab = 'roleplay') => {
    setError(null);
    setModalInitialTab(tab);
    openEdit(npc);
    setFormData(getDefaultFormData(npc));
  };

  const handleCloseModal = () => {
    setError(null);
    closeModal();
  };

  // Duplicate-name guard (mirrors MapsManager.handleCreate)
  const hasDuplicateName = () => npcs.some(n =>
    n.name !== editingNPC?.name && n.name.toLowerCase() === formData.name.trim().toLowerCase()
  );

  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;
    if (hasDuplicateName()) {
      setError('An NPC with that name already exists');
      return;
    }
    setSaving(true);
    try {
      const cleaned = cleanNPCData(formData);
      await saveNPC(campaignName, cleaned, editingNPC?.name);
      setError(null);
      await loadNPCsList();
      handleCloseModal();
    } catch (err) {
      console.error('Failed to save NPC:', err);
      setError(err.message || 'Failed to save NPC');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingNPC) return;
    if (!window.confirm('Delete this NPC?')) return;
    setDeleting(true);
    try {
      await deleteNPCAction(editingNPC.name);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to delete NPC:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddToInitiative = async (npc) => {
    try {
      const status = await addNPCToInitiative(campaignName, npc, onViewInitiative);
      if (status === 'needs-weapon') {
        setError(`${npc.name} was not added — give them at least one weapon in the Stats tab.`);
        handleEditNPC(npc, 'stats');
      }
    } catch (err) {
      console.error('Failed to add NPC to initiative:', err);
      setError(err.message || 'Failed to add NPC to initiative');
    }
  };

  const handleSaveAndAddToInitiative = async () => {
    if (!formData || !formData.name.trim()) return;
    if (hasDuplicateName()) {
      setError('An NPC with that name already exists');
      return;
    }
    setSaving(true);
    try {
      const snapshot = { ...formData };
      const cleaned = cleanNPCData(snapshot);
      const result = await saveNPC(campaignName, cleaned, editingNPC?.name);
      const savedNpc = result?.npc || snapshot;
      const npcForInitiative = {
        ...savedNpc,
        image: savedNpc.image || snapshot.image,
        imagePath: savedNpc.imagePath || snapshot.image || '',
      };
      setError(null);
      await loadNPCsList();
      const status = await addNPCToInitiative(campaignName, npcForInitiative, onViewInitiative);
      if (status === 'needs-weapon') {
        setError(`${npcForInitiative.name} was saved but not added — give them at least one weapon in the Stats tab, then save again.`);
        // Modal stays open; bump the key so it remounts showing the Stats tab.
        setModalInitialTab('stats');
        setModalKey(k => k + 1);
        return;
      }
      handleCloseModal();
    } catch (err) {
      console.error('Failed to save NPC:', err);
      setError(err.message || 'Failed to save NPC');
    } finally {
      setSaving(false);
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
          <i className="fa-solid fa-users" /> NPCs
        </h2>
        <button className="ct-new-btn" onClick={handleNewNPC}>
          <i className="fa-solid fa-plus" /> New NPC
        </button>
        <button className="ct-generate-btn" onClick={handleGenerateNPC}>
          <i className="fa-solid fa-wand-magic-sparkles" /> Generate NPC
        </button>
      </div>

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

      {!loading && error && !modalOpen && (
        <div className="npcs-form-error">{error}</div>
      )}

      {loading && (
        <div className="ct-empty-state">
          <i className="fa-solid fa-spinner fa-spin" /> Loading NPCs…
        </div>
      )}

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
            <NPCListItem
              key={npc.name}
              npc={npc}
              campaignName={campaignName}
              onEdit={handleEditNPC}
              onAddToInitiative={handleAddToInitiative}
            />
          ))}
        </ul>
      )}

      {modalOpen && formData && (
        <NPCFormModal
          key={modalKey}
          formData={formData}
          setFormData={setFormData}
          editingNPC={editingNPC}
          campaignName={campaignName}
          initialTab={modalInitialTab}
          saving={saving}
          deleting={deleting}
          error={error}
          disabled={saving || !formData.name.trim()}
          onClose={handleCloseModal}
          onSave={handleSave}
          onDelete={handleDelete}
          onSaveAndAddToInitiative={handleSaveAndAddToInitiative}
        />
      )}
    </div>
  );
}

export default NPCs;
