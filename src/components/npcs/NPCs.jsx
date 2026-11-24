import { useState, useEffect, useCallback, useRef } from 'react';
import { useCrudList } from '../../hooks/useCrudList.js';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';
import { useReloadGuard } from '../../hooks/management/useReloadGuard.js';
import useDeleteRequest from '../common/useDeleteRequest.js';
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';
import { loadNPCs, saveNPC, saveNPCs, deleteNPC } from '../../services/npcs/npcsService.js';
import NPCListItem from './NPCListItem.jsx';
import NPCFormModal from './NPCFormModal.jsx';
import NpcUnarmedConfirmModal from './NpcUnarmedConfirmModal.jsx';
import Subscriber from '../common/Subscriber.jsx';
import { getDefaultFormData, cleanNPCData } from '../../services/npcs/npcFormUtils.js';
import { addNPCToInitiative } from '../../services/npcs/npcCombatService.js';
import { generateNPC } from '../../services/npcs/npcGenerator.js';
import { loadBestiaryMonsterNames, isBestiaryMonsterName, bestiaryNameError } from '../../services/npcs/bestiaryNameGuard.js';
import './NPCs.css';

// Named-delete confirm over the shared DeleteConfirmModal role="dialog" tier
// (QA backlog 2026-11-24 sweep: the native `Delete NPC "X"?` window.confirm
// retired alongside the Quests/Party-Inventory lanes so every useReloadGuard
// CRUD lane is native-dialog-free; mirrors the Notes/Sessions row-delete
// chrome). Renders null while idle so the destructive copy never lingers.
function DeleteNpcModal({ pending, onCancel, onConfirm }) {
  if (!pending) return null;
  return (
    <DeleteConfirmModal
      titleId="npcs-delete-title"
      title="Delete NPC"
      confirmLabel="Yes, Delete Permanently"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      This will permanently delete the NPC &apos;<strong>{pending.label}</strong>&apos;
      from the campaign. This <strong>cannot be undone</strong>.
    </DeleteConfirmModal>
  );
}

function NPCs({ campaignName, onViewInitiative }) {
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
  // Shared pendingDelete staging for the role="dialog" delete tier (QA backlog
  // 2026-11-24 sweep, mirrors Notes/Sessions.jsx): the DeleteConfirmModal's
  // confirm is the ONLY writer, so Cancel/Escape/backdrop fire zero requests.
  const { pendingDelete, requestDelete, cancelDelete, confirmDelete } = useDeleteRequest();
  const [modalInitialTab, setModalInitialTab] = useState('roleplay');
  const [modalKey, setModalKey] = useState(0);
  // Attack-less join refusal staged for the in-app NpcUnarmedConfirmModal
  // (backlog 2026-11-17 EG, replaces the inverted native window.confirm in
  // the service): { npc, origin: 'row' | 'editor', snapshot? } — 'editor' is
  // the Save-&-Add lane, where the row is already SAVED and snapshot is the
  // post-save draft re-baselining the unsaved-edits check on Cancel.
  // Ephemeral UI pair (FriendlyFireConfirmModal idiom), never the runtime store.
  const [pendingUnarmed, setPendingUnarmed] = useState(null);
  // Bestiary-name client gate (2026-11-16 QA backlog): the lower-cased
  // monsters.json name-set, fetched ONCE (module memo) and non-blocking.
  // null = still loading or the load failed → gate inert, the server 400
  // stays the authoritative backstop with its verbatim inline refusal.
  const [bestiaryNames, setBestiaryNames] = useState(null);
  useEffect(() => {
    let alive = true;
    loadBestiaryMonsterNames().then((nameSet) => {
      if (alive) setBestiaryNames(nameSet);
    });
    return () => { alive = false; };
  }, []);
  // Skipped-while-editing SSE list broadcasts and rejected (409) saves prove
  // the on-screen list is stale: a reopened editor would re-seed the old row
  // (stale updatedAt) and its next save would repeat the SAME 409 forever.
  // Consumed in handleCloseModal — the first safe moment to re-sync — so the
  // conflict guidance ("reload the list and re-apply") actually works in-view.
  const missedListBroadcast = useRef(false);
  // Deep snapshot of the draft the editor was seeded with (edit/new/generate).
  // Powers the unsaved-edits check in handleReloadList — lifted into the
  // shared useReloadGuard so all five .ct-* CRUD lanes share the guard
  // (improve 2026-10-28-T backlog); behavior unchanged from ba51c25ee.
  const { seedDraft, clearDraft, confirmDiscardDraft, discardDialog } = useReloadGuard({
    modalOpen,
    formData,
    confirmMessage: 'Reload the NPC list and discard your unsaved edits?',
  });

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
    const seed = getDefaultFormData();
    seedDraft(seed);
    openNew(seed);
  };

  const handleGenerateNPC = async () => {
    const generated = await generateNPC(npcs);
    showError(null);
    setModalInitialTab('roleplay');
    const seed = getDefaultFormData(generated);
    seedDraft(seed);
    openNew(seed);
  };

  const handleEditNPC = (npc, tab = 'roleplay') => {
    showError(null);
    setModalInitialTab(tab);
    openEdit(npc);
    const seed = getDefaultFormData(npc);
    seedDraft(seed);
    setFormData(seed);
  };

  const handleCloseModal = () => {
    showError(null);
    closeModal();
    clearDraft();
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
  // immediately seeds the fresh row — no trial-and-error. That recovery
  // throws away the open draft, so with unsaved edits (deep-compare against
  // the seed snapshot, house NAMED-confirm pattern) the loss is stated up
  // front and Cancel keeps the banner, editor, and draft fully inert. The
  // dirty-check now lives in the shared useReloadGuard (all five lanes).
  const handleReloadList = async () => {
    if (!await confirmDiscardDraft()) return;
    missedListBroadcast.current = true;
    handleCloseModal();
  };

  // ×/Cancel close path (improve 2026-10-29-V backlog): a dirty draft pays
  // the house NAMED confirm — wizard precedent `Discard changes to "X"?` —
  // naming the NPC the editor shows (typed name, else the row's original);
  // an unnamed new draft falls back to the wizard's generic new-draft copy.
  // A clean draft closes silently exactly as before. Kept OUT of
  // handleCloseModal so internal closes (save/save-and-add/delete/reload)
  // never double-confirm; dismiss is fully inert (banner, editor, draft).
  const handleRequestClose = async () => {
    const name = (formData?.name || '').trim() || editingNPC?.name;
    if (!await confirmDiscardDraft(
      name ? `Discard changes to "${name}"?` : 'Discard this new NPC draft?'
    )) return;
    handleCloseModal();
  };

  // Duplicate-name guard (mirrors MapsManager.handleCreate)
  const hasDuplicateName = () => npcs.some(n =>
    n.name !== editingNPC?.name && n.name.toLowerCase() === formData.name.trim().toLowerCase()
  );

  /**
   * Bestiary-name law, DERIVED live while typing (mirrors the dup-quest block
   * in Quests.jsx and its getDuplicateState shape): a published-monster name
   * disables Save and shows the server guard's copy verbatim inline, so the
   * doomed 400 round-trip is never paid. Only fires once the loaded name-set
   * proves the match; while the set is null (loading/failed) the gate is
   * inert and the server 400 stays the authoritative backstop.
   */
  const getBestiaryGateState = () => {
    if (!modalOpen || !formData) return null;
    const bestiaryError = isBestiaryMonsterName(formData.name, bestiaryNames)
      ? bestiaryNameError(formData.name)
      : null;
    return {
      visibleError: bestiaryError || error,
      visibleConflict: !bestiaryError && errorIsConflict,
      saveDisabled: saving || !formData.name.trim() || !!bestiaryError,
    };
  };
  const gateState = getBestiaryGateState();

  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;
    if (isBestiaryMonsterName(formData.name, bestiaryNames)) return; // button disabled + live hint
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
      // The 409 concurrent-edit conflict is already logged once at warn by
      // the service layer (improve 2026-10-27-J); only genuine failures get
      // a red console line here. The banner below owns user feedback.
      if (!err.conflict) {
        console.error('Failed to save NPC:', err);
      }
      // A rejected save means the server row moved on without us — the list
      // is stale; closing refreshes it (see handleCloseModal).
      missedListBroadcast.current = true;
      showError(err.message || 'Failed to save NPC', err.conflict === true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingNPC) return;
    requestDelete({
      label: editingNPC.name,
      confirm: async () => {
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
      },
    });
  };

  const handleAddToInitiative = async (npc) => {
    try {
      const status = await addNPCToInitiative(campaignName, npc, onViewInitiative);
      if (status === 'needs-weapon') {
        // Zero-write refusal from the service — arm the honest in-app confirm.
        setPendingUnarmed({ npc, origin: 'row' });
      }
    } catch (err) {
      console.error('Failed to add NPC to initiative:', err);
      showError(err.message || 'Failed to add NPC to initiative');
    }
  };

  const handleSaveAndAddToInitiative = async () => {
    if (!formData || !formData.name.trim()) return;
    if (isBestiaryMonsterName(formData.name, bestiaryNames)) return; // button disabled + live hint
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
        // Saved but not joined (zero writes) — the honest Add-anyway question
        // rides the shared modal on top of the still-open editor.
        setPendingUnarmed({ npc: npcForInitiative, origin: 'editor', snapshot });
        return;
      }
      handleCloseModal();
    } catch (err) {
      // The 409 concurrent-edit conflict is already logged once at warn by
      // the service layer (improve 2026-10-27-J); only genuine failures get
      // a red console line here. The banner below owns user feedback.
      if (!err.conflict) {
        console.error('Failed to save NPC:', err);
      }
      missedListBroadcast.current = true;
      showError(err.message || 'Failed to save NPC', err.conflict === true);
    } finally {
      setSaving(false);
    }
  };

  // `Add anyway` re-runs the service with the host-confirmed flag — the join
  // bytes, initiative roll, and log row are exactly the old proceed path's.
  // The 'editor' lane had already saved, so a completed join closes the editor
  // like a normal Save-&-Add would.
  const handleUnarmedAddAnyway = async () => {
    const entry = pendingUnarmed;
    if (!entry) return;
    setPendingUnarmed(null);
    try {
      await addNPCToInitiative(campaignName, entry.npc, onViewInitiative, { addUnarmed: true });
      if (entry.origin === 'editor') handleCloseModal();
    } catch (err) {
      console.error('Failed to add NPC to initiative:', err);
      showError(err.message || 'Failed to add NPC to initiative');
    }
  };

  // `Cancel` adds nothing — zero writes, board unchanged. The guidance half of
  // the retired prompt survives as the outcome it always described: send the
  // GM to the Stats tab to fit a weapon (the row lane's original OK branch).
  const handleUnarmedCancel = () => {
    const entry = pendingUnarmed;
    if (!entry) return;
    setPendingUnarmed(null);
    if (entry.origin === 'editor') {
      showError(`${entry.npc.name} was saved but not added — give them at least one weapon in the Stats tab, then save again.`);
      // Modal stays open — the saved draft is the new baseline for the
      // unsaved-edits check (see handleReloadList).
      seedDraft(entry.snapshot);
      // bump the key so it remounts showing the Stats tab.
      setModalInitialTab('stats');
      setModalKey(k => k + 1);
      return;
    }
    showError(`${entry.npc.name} was not added — give them at least one weapon in the Stats tab.`);
    handleEditNPC(entry.npc, 'stats');
  };

  return (
    <div className="ct-container">
      <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />

      <div className="ct-header">
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

      {gateState && (
        <NPCFormModal
          key={modalKey}
          formData={formData}
          setFormData={setFormData}
          editingNPC={editingNPC}
          campaignName={campaignName}
          initialTab={modalInitialTab}
          saving={saving}
          deleting={deleting}
          /* Live-gate hint (never a server error) shadows the banner while
             it stands; the server-copy lane below it stays byte-unchanged
             for every non-gated save (fail-open backstop included). */
          error={gateState.visibleError}
          errorConflict={gateState.visibleConflict}
          disabled={gateState.saveDisabled}
          onClose={handleRequestClose}
          onReloadList={handleReloadList}
          onSave={handleSave}
          onDelete={handleDelete}
          onSaveAndAddToInitiative={handleSaveAndAddToInitiative}
        />
      )}

      <NpcUnarmedConfirmModal
        pending={pendingUnarmed ? pendingUnarmed.npc : null}
        onCancel={handleUnarmedCancel}
        onConfirm={handleUnarmedAddAnyway}
      />

      {/* Dirty-draft toll (QA backlog 2026-11-24): SIBLING mount above the
          editor modal — its backdrop/Escape answer only the toll. */}
      {discardDialog}

      <DeleteNpcModal pending={pendingDelete} onCancel={cancelDelete} onConfirm={confirmDelete} />
    </div>
  );
}

export default NPCs;
