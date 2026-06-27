import { useState, useEffect } from 'react';
import { useCrudList } from '../../hooks/useCrudList.js';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';
import { loadNPCs, saveNPCs, deleteNPC } from '../../services/npcs/npcsService.js';
import NPCListItem from './NPCListItem.jsx';
import NPCFormModal from './NPCFormModal.jsx';
import { getDefaultFormData, cleanNPCData } from '../../services/npcs/npcFormUtils.js';
import { addNPCToInitiative } from '../../services/npcs/npcCombatService.js';
import { generateNPC } from '../../services/npcs/npcGenerator.js';
import './NPCs.css';

function NPCs({ campaignName, onBack, onViewInitiative }) {
  const { items: npcs, loading, loadItems: loadNPCsList, saveItems: saveNPCAction, deleteItem: deleteNPCAction } =
    useEntityManagement(campaignName, { load: loadNPCs, save: saveNPCs, delete: deleteNPC }, { responseKey: 'npcs', loadOnMount: false });

  const {
    searchQuery, setSearchQuery, filteredItems: filteredNPCs,
    modalOpen, editingItem: editingNPC, formData, setFormData,
    saving, setSaving,
    openNew, openEdit, closeModal,
  } = useCrudList(npcs, ['name', 'race', 'classRole', 'tags']);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (campaignName) {
      loadNPCsList();
    }
  }, [campaignName, loadNPCsList]);

  const handleNewNPC = () => openNew(getDefaultFormData());

  const handleGenerateNPC = async () => {
    const generated = await generateNPC(npcs);
    openNew(getDefaultFormData(generated));
  };

  const handleEditNPC = (npc) => {
    openEdit(npc);
    setFormData(getDefaultFormData(npc));
  };

  const handleCloseModal = closeModal;

  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;
    setSaving(true);
    try {
      await saveNPCAction(cleanNPCData(formData), editingNPC?.name);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save NPC:', error);
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
    await addNPCToInitiative(campaignName, npc, onViewInitiative);
  };

  const handleSaveAndAddToInitiative = async () => {
    if (!formData || !formData.name.trim()) return;
    setSaving(true);
    try {
      const snapshot = { ...formData };
      const cleaned = cleanNPCData(snapshot);
      const result = await saveNPCAction(cleaned, editingNPC?.name);
      const savedNpc = result?.npc || snapshot;
      const npcForInitiative = {
        ...savedNpc,
        image: savedNpc.image || snapshot.image,
        imagePath: savedNpc.imagePath || snapshot.image || '',
      };
      handleCloseModal();
      await addNPCToInitiative(campaignName, npcForInitiative, onViewInitiative);
    } catch (error) {
      console.error('Failed to save NPC:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ct-container">
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
              onEdit={handleEditNPC}
              onAddToInitiative={handleAddToInitiative}
            />
          ))}
        </ul>
      )}

      {modalOpen && formData && (
        <NPCFormModal
          formData={formData}
          setFormData={setFormData}
          editingNPC={editingNPC}
          saving={saving}
          deleting={deleting}
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
