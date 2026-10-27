import { useState, useEffect, useCallback, useRef } from 'react';
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
  // True when the visible banner error is a 409 concurrent-edit conflict
  // (server body { conflict: true }) — gates the "Reload list" action button.
  const [errorIsConflict, setErrorIsConflict] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState('roleplay');
  const [modalKey, setModalKey] = useState(0);
  // Skipped-while-editing SSE list broadcasts and rejected (409) saves prove
  // the on-screen list is stale: a reopened editor would re-seed the old row
  // (stale updatedAt) and its next save would repeat the SAME 409 forever.
  // Consumed in handleCloseModal — the first safe moment to re-sync — so the
  // conflict guidance ("reload the list and re-apply") actually works in-view.
  const missedListBroadcast = useRef(false);

  // Single choke point for the banner: every message carries whether it was a
  // conflict, so the "Reload list" action can never outlive its error copy.
  const showError = (message, conflict = false) => {
    setError(message);
    setErrorIsConflict(conflict);
  };

  useEffect(() => {
    if (campaignName) {
      loadNPCsList();
    }
  }, [campaignName, loadNPCsList]);

  // SSE handler — re-fetch NPC list on npcs-list events (another GM tab
  // created/updated/deleted an NPC). Skipped while the edit modal is open so
  // an in-progress draft is never squashed mid-edit — but the miss is noted
  // and applied on close, so a reopen never re-seeds a stale row.
  const handleSSEEvent = useCallback((event) => {
    if (!event || event.key !== `npcs-list-${campaignName}`) return;
    if (modalOpen) {
      // Note the miss — handleCloseModal will re-fetch so a reopen seeds fresh.
      missedListBroadcast.current = true;
      return;
    }
    loadNPCsList();
  }, [campaignName, modalOpen, loadNPCsList]);

  const handleNewNPC = () => {
    showError(null);
    setModalInitialTab('roleplay');
    openNew(getDefaultFormData());
  };

  const handleGenerateNPC = async () => {
    const generated = await generateNPC(npcs);
    showError(null);
    setModalInitialTab('roleplay');
    openNew(getDefaultFormData(generated));
  };

  const handleEditNPC = (npc, tab = 'roleplay') => {
    showError(null);
    setModalInitialTab(tab);
    openEdit(npc);
    setFormData(getDefaultFormData(npc));
  };

  const handleCloseModal = () => {
    showError(null);
    closeModal();
    // A broadcast skipped while editing, or a save the server rejected, means
    // the list rows are stale — refresh now so the next reopen seeds a fresh
    // row (and a re-applied edit saves clean) instead of looping on 409.
    if (missedListBroadcast.current) {
      missedListBroadcast.current = false;
      loadNPCsList();
    }
  };

  // One-click guided recovery for the 409 banner: force the sanctioned stale
  // close path (close the editor + consume the list refresh) so the reopen
  // immediately seeds the fresh row — no trial-and-error.
  const handleReloadList = () => {
    missedListBroadcast.current = true;
    handleCloseModal();
  };

  // Duplicate-name guard (mirrors MapsManager.handleCreate)
  const hasDuplicateName = () => npcs.some(n =>
    n.name !== editingNPC?.name && n.name.toLowerCase() === formData.name.trim().toLowerCase()
  );

  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;
    if (hasDuplicateName()) {
      showError('An NPC with that name already exists');
      return;
    }
    setSaving(true);
    try {
      const cleaned = cleanNPCData(formData);
      await saveNPC(campaignName, cleaned, editingNPC?.name);
      showError(null);
      await loadNPCsList();
      missedListBroadcast.current = false;
      handleCloseModal();
    } catch (err) {
      console.error('Failed to save NPC:', err);
      // A rejected save means the server row moved on without us — the list
      // is stale; closing refreshes it (see handleCloseModal).
      missedListBroadcast.current = true;
      showError(err.message || 'Failed to save NPC', err.conflict === true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingNPC) return;
    if (!window.confirm(`Delete NPC "${editingNPC.name}"?`)) return;
    setDeleting(true);
    try {
      await deleteNPCAction(editingNPC.name);
      missedListBroadcast.current = false;
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
        showError(`${npc.name} was not added — give them at least one weapon in the Stats tab.`);
        handleEditNPC(npc, 'stats');
      }
    } catch (err) {
      console.error('Failed to add NPC to initiative:', err);
      showError(err.message || 'Failed to add NPC to initiative');
    }
  };

  const handleSaveAndAddToInitiative = async () => {
    if (!formData || !formData.name.trim()) return;
    if (hasDuplicateName()) {
      showError('An NPC with that name already exists');
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
      showError(null);
      await loadNPCsList();
      missedListBroadcast.current = false;
      const status = await addNPCToInitiative(campaignName, npcForInitiative, onViewInitiative);
      if (status === 'needs-weapon') {
        showError(`${npcForInitiative.name} was saved but not added — give them at least one weapon in the Stats tab, then save again.`);
        // Modal stays open; bump the key so it remounts showing the Stats tab.
        setModalInitialTab('stats');
        setModalKey(k => k + 1);
        return;
      }
      handleCloseModal();
    } catch (err) {
      console.error('Failed to save NPC:', err);
      missedListBroadcast.current = true;
      showError(err.message || 'Failed to save NPC', err.conflict === true);
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
          errorConflict={errorIsConflict}
          disabled={saving || !formData.name.trim()}
          onClose={handleCloseModal}
          onReloadList={handleReloadList}
          onSave={handleSave}
          onDelete={handleDelete}
          onSaveAndAddToInitiative={handleSaveAndAddToInitiative}
        />
      )}
    </div>
  );
}

export default NPCs;
