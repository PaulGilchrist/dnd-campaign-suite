import { useState, useEffect, useRef, useCallback } from 'react';
import { useCrudList } from '../../hooks/useCrudList.js';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';
import { useReloadGuard } from '../../hooks/management/useReloadGuard.js';
import Subscriber from '../common/Subscriber.jsx';
import { loadSessions, saveSession, saveSessions, deleteSession, requestSessionRecap } from '../../services/campaign/sessionsService.js';
import {
  getDefaultSessionData,
  mergeChecklist,
  newContingency,
  buildSessionPlayedLogText,
} from '../../services/campaign/sessionPlannerUtils.js';
import { loadMaps } from '../../services/maps/mapsService.js';
import { loadEncounters } from '../../services/encounters/encountersService.js';
import { loadNPCs } from '../../services/npcs/npcsService.js';
import { loadQuests } from '../../services/campaign/questsService.js';
import { loadSettlements } from '../../services/campaign/settlementsService.js';
import { loadNotes } from '../../services/campaign/notesService.js';
import { activateMap } from '../../services/maps/mapsService.js';
import { addNPCToInitiative } from '../../services/npcs/npcCombatService.js';
import { npcHasStatBlock } from '../../services/encounters/npcStatBlockUtils.js';
import { addEntry } from '../../services/ui/logService.js';
import { setActiveSession } from '../../services/combat/sessionService.js';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import SessionListItem from './SessionListItem.jsx';
import SessionPlannerModal from './SessionPlannerModal.jsx';
import SessionPlayedModal from './SessionPlayedModal.jsx';
import NpcUnarmedConfirmModal from '../npcs/NpcUnarmedConfirmModal.jsx';
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';
import useDeleteRequest from '../common/useDeleteRequest.js';
import './Sessions.css';

// The six entity lists whose changes must invalidate the picker cache below
// (server publishes `<entity>-list-<campaign>` for each — see server/routes/*).
const PICKER_ENTITIES = ['maps', 'encounters', 'npcs', 'quests', 'settlements', 'notes'];

async function loadResourceOptions(campaignName) {
  const loaders = [
    ['maps', loadMaps], ['encounters', loadEncounters], ['npcs', loadNPCs],
    ['quests', loadQuests], ['settlements', loadSettlements], ['notes', loadNotes],
  ];
  const settled = await Promise.allSettled(loaders.map(([, fn]) => fn(campaignName)));
  const raw = {};
  // A failed list is filled with [] for display but marks the batch incomplete
  // so it is never cached (dataLoader's "failure is a cache miss by law").
  let complete = true;
  settled.forEach((r, i) => {
    const [key] = loaders[i];
    if (r.status !== 'fulfilled') {
      // 1-service/0-wrapper console canon (0a026c804): the service layer
      // already logs the one line per failure (e.g. `Error loading notes:`),
      // so this batch wrapper logs NOTHING — it owns only the single inline
      // planner hint below (improve sessions-picker-failure-double-console).
      raw[key] = [];
      complete = false;
    } else {
      raw[key] = Array.isArray(r.value) ? r.value : (r.value?.[key] || []);
    }
  });
  const options = {
    maps: raw.maps.map(m => ({ value: m.name, label: m.name })),
    encounters: raw.encounters.map(e => ({ value: e.name, label: e.name })),
    npcs: raw.npcs.map(n => ({ value: n.name, label: n.name, combatReady: npcHasStatBlock(n) })),
    quests: raw.quests.map(q => ({ value: q.name, label: q.name })),
    settlements: raw.settlements.map(s => ({ value: s.name, label: s.name })),
    notes: raw.notes.map(n => ({
      value: n.id,
      label: (n.description || '').replace(/[#*_>`]/g, '').trim().substring(0, 60) || n.id,
    })),
  };
  return { options, complete };
}

// sessionState.name projection + GM-only handler gate (kept module-scope so
// the Sessions component body stays under the complexity ceiling).
function activeNameFrom(sessionState) {
  return typeof sessionState?.name === 'string' && sessionState.name.trim() ? sessionState.name : null;
}

function activeSessionHandlerFor(isLocalhost, handler) {
  return isLocalhost ? handler : undefined;
}

// Named-delete confirm over the shared DeleteConfirmModal role="dialog" tier
// (QA backlog 2026-11-24: retires the native `Delete Session Plan "X"?`
// window.confirm and mirrors the Settlements/EB-pool row-delete chrome).
// Renders null while idle so the destructive copy never lingers behind the
// planner.
function DeleteSessionModal({ pending, onCancel, onConfirm }) {
  if (!pending) return null;
  return (
    <DeleteConfirmModal
      titleId="sessions-delete-title"
      title="Delete Session Plan"
      confirmLabel="Yes, Delete Permanently"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      This will permanently delete the session plan &apos;<strong>{pending.label}</strong>&apos;
      from the campaign. This <strong>cannot be undone</strong>.
    </DeleteConfirmModal>
  );
}

function Sessions({ campaignName, characters = [], isLocalhost, onViewInitiative }) {
  const { items: sessions, loading, loadItems, deleteItem: deleteSessionAction } =
    useEntityManagement(campaignName, { load: loadSessions, save: saveSessions, delete: deleteSession }, { responseKey: 'sessions', loadOnMount: false });

  const {
    searchQuery, setSearchQuery, filteredItems: filteredSessions,
    modalOpen, editingItem: editingSession, formData, setFormData,
    saving, setSaving,
    openNew, openEdit, closeModal,
  } = useCrudList(sessions, ['name', 'summary', 'notes']);

  const [deleting, setDeleting] = useState(false);
  // Shared pendingDelete staging for the role="dialog" delete tier (QA backlog
  // 2026-11-24, mirrors Settlements.jsx): the DeleteConfirmModal's confirm is
  // the ONLY writer, so Cancel/Escape/backdrop fire zero requests.
  const { pendingDelete, requestDelete, cancelDelete, confirmDelete } = useDeleteRequest();
  // The planner modal's ONE inline banner region as a single state concept:
  // { message, kind, conflict } or null. `kind` carries the tone — 'error' is
  // refusal/failure copy (red), 'success' is an action's persistent in-modal
  // witness (green) — so both faces share the same region and the same
  // lifecycle (reset per attempt, discarded on close). Backlog 2026-11-21 GGG:
  // recap success rode only the transient toast, leaving the open modal with
  // zero witness once it faded; it now rides this banner like its refusal twin.
  // `conflict` marks a 409 concurrent-edit (server body { conflict: true }) —
  // gates the "Reload list" action button.
  const [banner, setBanner] = useState(null);
  // Skipped-while-editing SSE list broadcasts and rejected (409) saves prove
  // the on-screen list is stale; consumed in handleCloseModal so a reopen
  // re-seeds a fresh row instead of repeating the same 409. Mirrors NPCs.jsx
  // (9cee7bfa2) / Notes.jsx (broadcast wired server-side in routes/sessions.js,
  // improve settlements-sessions-no-list-sse).
  const missedListBroadcast = useRef(false);
  // Deep snapshot of the draft the planner was seeded with (new/edit), powering
  // the unsaved-edits check in handleReloadList via the shared useReloadGuard
  // so all six .ct-* CRUD lanes share the guard (improve 2026-10-29-V backlog;
  // mirrors NPCs.jsx ba51c25ee).
  const { seedDraft, clearDraft, confirmDiscardDraft, discardDialog } = useReloadGuard({
    modalOpen,
    formData,
    confirmMessage: 'Reload the session list and discard your unsaved edits?',
  });
  const [picker, setPicker] = useState({ maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] });
  // Picker-options cache for the lifetime of this view mount (improve
  // 2026-10-29-W backlog): re-fetching all six link lists on EVERY planner
  // open meant a second open seconds later cost 6 more GETs with nothing
  // changed. Component scope is the freshness contract — a view switch
  // remounts Sessions and re-fetches (same-tab edits can never serve stale),
  // and while mounted, any `<entity>-list-<campaign>` SSE broadcast (another
  // tab editing a picker list) invalidates the cache so the NEXT open
  // re-fetches. Failed batches are never cached (see loadResourceOptions).
  const pickerCache = useRef(null); // { campaign, options }
  // Single inline planner hint (improve sessions-picker-failure-double-console):
  // a partial picker-batch failure is loud ONCE in the modal instead of being
  // silent empty-option lists. Reset on close and on every (re)load, so the
  // notice never outlives the open that produced it; a failed batch is never
  // cached, so the reopen that clears it is also the retry.
  const [pickerLoadFailed, setPickerLoadFailed] = useState(false);
  const [toast, setToast] = useState('');
  // Attack-less join refusal staged for the in-app NpcUnarmedConfirmModal
  // (backlog 2026-11-17 EG): the quick-action chip arms the NPC here instead
  // of the retired inverted native confirm; ephemeral UI pair, never the
  // runtime store (FriendlyFireConfirmModal idiom).
  const [pendingUnarmedNpc, setPendingUnarmedNpc] = useState(null);

  // Single choke points for the banner: every message carries its kind (and
  // whether it was a conflict), so the "Reload list" action can never outlive
  // its error copy and success/refusal never fight over two parallel states.
  const showError = (message, conflict = false) => {
    setBanner(message ? { message, kind: 'error', conflict } : null);
  };

  const showSuccess = (message) => {
    setBanner({ message, kind: 'success', conflict: false });
  };

  useEffect(() => {
    if (campaignName) loadItems();
  }, [campaignName, loadItems]);

  // SSE handler — re-fetch session list on sessions-list events (another GM
  // tab created/updated/deleted a session). Skipped while the planner modal is
  // open so an in-progress draft is never squashed mid-edit; the miss is
  // applied on close (see handleCloseModal). Mirrors Notes.jsx/NPCs.jsx.
  // Any of the six PICKER_ENTITIES list broadcasts additionally invalidates
  // the picker cache so the next planner open re-fetches fresh options
  // (improve 2026-10-29-W backlog — stale-data safety for link lists).
  const handleSSEEvent = useCallback((event) => {
    if (!event || !event.key) return;
    if (PICKER_ENTITIES.some(entity => event.key === `${entity}-list-${campaignName}`)) {
      pickerCache.current = null;
      return;
    }
    if (event.key !== `sessions-list-${campaignName}`) return;
    if (modalOpen) {
      missedListBroadcast.current = true;
      return;
    }
    loadItems();
  }, [campaignName, modalOpen, loadItems]);

  useEffect(() => {
    if (!modalOpen || !campaignName) return;
    const cached = pickerCache.current;
    if (cached && cached.campaign === campaignName) {
      setPicker(cached.options);
      setPickerLoadFailed(false);
      return;
    }
    let cancelled = false;
    loadResourceOptions(campaignName).then(({ options, complete }) => {
      if (cancelled) return;
      setPicker(options);
      setPickerLoadFailed(!complete);
      if (complete) pickerCache.current = { campaign: campaignName, options };
    });
    return () => { cancelled = true; };
  }, [modalOpen, campaignName]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2500);
  };

  const otherSessions = sessions.filter(s => s.name !== formData?.name);

  // Keep the auto-generated baseline in sync with the linked resources
  useEffect(() => {
    if (!modalOpen || !formData) return;
    const next = mergeChecklist(formData.checklist, formData.links);
    if (JSON.stringify(next) !== JSON.stringify(formData.checklist)) {
      setFormData(prev => prev ? { ...prev, checklist: next } : prev);
    }
  }, [modalOpen, formData, setFormData]);

  // Seed the guard with the SAME shape the merge-checklist effect will settle
  // on (auto items merged in), so opening a row never looks like an unsaved
  // edit before the user has typed anything (clean-draft leg stays silent).
  const handleNewSession = () => {
    showError(null);
    const seed = getDefaultSessionData();
    seed.checklist = mergeChecklist(seed.checklist, seed.links);
    seedDraft(seed);
    openNew(seed);
  };

  const handleEditSession = (session) => {
    showError(null);
    const seed = getDefaultSessionData(session);
    seed.checklist = mergeChecklist(seed.checklist, seed.links);
    seedDraft(seed);
    openEdit(seed);
  };

  // Close modal and reset
  const handleCloseModal = () => {
    showError(null);
    setPickerLoadFailed(false);
    closeModal();
    clearDraft();
    // A save the server rejected means the rows are stale — refresh so the
    // next reopen seeds fresh (mirrors NPCs.jsx handleCloseModal).
    if (missedListBroadcast.current) {
      missedListBroadcast.current = false;
      loadItems();
    }
  };

  // One-click guided recovery for the 409 banner: force the sanctioned stale
  // close path (close the editor + consume the list refresh) so the reopen
  // immediately seeds the fresh row — no trial-and-error. That recovery
  // throws away the open draft, so with unsaved edits the shared
  // useReloadGuard states the loss up front and Cancel keeps the banner,
  // editor, and draft fully inert (mirrors NPCs.jsx handleReloadList).
  const handleReloadList = async () => {
    if (!await confirmDiscardDraft()) return;
    missedListBroadcast.current = true;
    handleCloseModal();
  };

  // ×/Cancel close path (improve 2026-10-29-V backlog): a dirty draft pays
  // the house NAMED confirm — wizard precedent `Discard changes to "X"?` —
  // naming the session the editor shows (typed name, else the row's
  // original); an unnamed new draft falls back to the wizard's generic
  // new-draft copy. A clean draft closes silently exactly as before. Kept
  // OUT of handleCloseModal so internal closes (save/delete/mark-played/
  // reload) never double-confirm; dismiss is fully inert.
  const handleRequestClose = async () => {
    const name = (formData?.name || '').trim() || editingSession?.name;
    if (!await confirmDiscardDraft(
      name ? `Discard changes to "${name}"?` : 'Discard this new session draft?'
    )) return;
    handleCloseModal();
  };

  const hasDuplicateName = () => sessions.some(s =>
    s.name !== editingSession?.name && s.name.toLowerCase() === formData.name.trim().toLowerCase()
  );

  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;
    if (hasDuplicateName()) {
      showError('A session with that name already exists');
      return;
    }
    setSaving(true);
    try {
      const cleaned = { ...formData, name: formData.name.trim() };
      cleaned.checklist = mergeChecklist(cleaned.checklist, cleaned.links);
      await saveSession(campaignName, cleaned, editingSession?.name);
      showError(null);
      await loadItems();
      missedListBroadcast.current = false;
      handleCloseModal();
    } catch (err) {
      // The 409 concurrent-edit conflict is already logged once at warn by
      // the service layer (improve 2026-10-27-J); only genuine failures get
      // a red console line here. The banner below owns user feedback.
      if (!err.conflict) {
        console.error('Failed to save session:', err);
      }
      // A rejected save means the server row moved on without us — the list
      // is stale; closing refreshes it (see handleCloseModal).
      missedListBroadcast.current = true;
      showError(err.message || 'Failed to save session', err.conflict === true);
    } finally {
      setSaving(false);
    }
  };

  // Delete session — the footer button arms the shared DeleteConfirmModal tier
  // (role="dialog", focus lands Cancel, Escape/backdrop zero-write); the
  // staged descriptor's confirm is the only writer (Settlements precedent).
  const handleDelete = () => {
    if (!editingSession) return;
    requestDelete({
      label: editingSession.name,
      confirm: async () => {
        setDeleting(true);
        try {
          await deleteSessionAction(editingSession.name);
          missedListBroadcast.current = false;
          handleCloseModal();
        } catch (err) {
          console.error('Failed to delete session:', err);
          showError(err.message || 'Failed to delete session');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const handleAddLink = (type, value) => {
    setFormData(prev => ({
      ...prev,
      links: { ...prev.links, [type]: [...(prev.links[type] || []), value] },
    }));
  };

  const handleRemoveLink = (type, value) => {
    setFormData(prev => ({
      ...prev,
      links: { ...prev.links, [type]: (prev.links[type] || []).filter(v => v !== value) },
    }));
  };

  const handleMoveLink = async (type, value, targetName) => {
    const target = sessions.find(s => s.name === targetName);
    if (!target) return;
    try {
      const updatedSource = {
        ...formData,
        links: { ...formData.links, [type]: (formData.links[type] || []).filter(v => v !== value) },
      };
      updatedSource.checklist = mergeChecklist(updatedSource.checklist, updatedSource.links);

      const targetLinks = { ...target.links };
      if (!(targetLinks[type] || []).includes(value)) {
        targetLinks[type] = [...(targetLinks[type] || []), value];
      }
      const updatedTarget = { ...target, links: targetLinks };
      updatedTarget.checklist = mergeChecklist(updatedTarget.checklist, updatedTarget.links);

      await saveSession(campaignName, updatedSource, editingSession?.name);
      await saveSession(campaignName, updatedTarget, target.name);
      setFormData(updatedSource);
      // Editor stays open — the moved-link draft just hit the server, so it is
      // the new baseline for the unsaved-edits check (mirrors NPCs.jsx
      // handleSaveAndAddToInitiative's re-baseline).
      seedDraft(updatedSource);
      await loadItems();
      showToast(`Moved to “${target.name}”`);
    } catch (err) {
      // The 409 concurrent-edit conflict is already logged once at warn by
      // the service layer (improve 2026-10-27-J); only genuine failures get
      // a red console line here. The banner below owns user feedback.
      if (!err.conflict) {
        console.error('Failed to move link:', err);
      }
      missedListBroadcast.current = true;
      showError(err.message || 'Failed to move link', err.conflict === true);
    }
  };

  const handleQuickAction = async (type, value) => {
    try {
      if (type === 'maps') {
        await activateMap(campaignName, value);
        showToast(`${value} set as active map`);
      } else if (type === 'npcs') {
        const npc = await findNpc(value);
        // Pre-validate like the NPCs view (.npcs-init-btn) — a statless NPC must
        // never reach addNPCToInitiative, which throws instead of nudging.
        if (!npcHasStatBlock(npc)) {
          showToast(`${value} needs AC and HP filled in (Stats tab) before joining initiative`);
          return;
        }
        const status = await addNPCToInitiative(campaignName, npc, onViewInitiative);
        if (status === 'needs-weapon') {
          // Zero-write refusal — arm the honest in-app Add-anyway confirm.
          setPendingUnarmedNpc(npc);
        } else {
          showToast(`${value} added to initiative`);
        }
      }
    } catch (err) {
      console.error('Failed to run session quick action:', err);
      showError(err.message || 'Quick action failed');
    }
  };

  // `Add anyway` re-runs the service with the host-confirmed flag — join
  // bytes and log row exactly the old proceed path's (`added` toast included).
  const handleUnarmedAddAnyway = async () => {
    const npc = pendingUnarmedNpc;
    if (!npc) return;
    setPendingUnarmedNpc(null);
    try {
      await addNPCToInitiative(campaignName, npc, onViewInitiative, { addUnarmed: true });
      showToast(`${npc.name} added to initiative`);
    } catch (err) {
      console.error('Failed to run session quick action:', err);
      showError(err.message || 'Quick action failed');
    }
  };

  // `Cancel` adds nothing — zero writes, board unchanged; the retired
  // refusal guidance survives as this inert outcome's toast.
  const handleUnarmedCancel = () => {
    const npc = pendingUnarmedNpc;
    if (!npc) return;
    setPendingUnarmedNpc(null);
    showToast(`${npc.name} was not added — give them at least one weapon on the NPCs page`);
  };

  const findNpc = async (name) => {
    const res = await loadNPCs(campaignName);
    return (res?.npcs || []).find(n => n.name === name);
  };

  const handleAddContingency = () => {
    setFormData(prev => ({ ...prev, contingencies: [...(prev.contingencies || []), newContingency()] }));
  };

  const handleContingencyChange = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      contingencies: (prev.contingencies || []).map(c => c.id === id ? { ...c, [field]: value } : c),
    }));
  };

  const handleRemoveContingency = (id) => {
    setFormData(prev => ({
      ...prev,
      contingencies: (prev.contingencies || []).filter(c => c.id !== id),
    }));
  };

  const handleToggleChecklist = (id) => {
    setFormData(prev => ({
      ...prev,
      checklist: (prev.checklist || []).map(item => item.id === id ? { ...item, done: !item.done } : item),
    }));
  };

  const handleAddChecklistItem = (label) => {
    setFormData(prev => ({
      ...prev,
      checklist: [...(prev.checklist || []), { id: `custom-${Date.now()}`, label, done: false, auto: false }],
    }));
  };

  const handleRemoveChecklistItem = (id) => {
    setFormData(prev => ({
      ...prev,
      checklist: (prev.checklist || []).filter(item => item.id !== id),
    }));
  };

  // ── Active session (log memory stamp, 2026-11-21) ──
  // sessionState.name: the one Session the table is playing right now. Every
  // campaign log row is stamped with it server-side (server/routes/log.js
  // addEntry), which is what later lets the AI mine "everything from Session
  // N" for a recap. GM (localhost) orchestrates it, like the phase pills.
  const sessionState = useRuntimeValue('campaign', 'sessionState', campaignName);
  const activeSession = activeNameFrom(sessionState);

  const handleSetActiveSession = async () => {
    if (!editingSession || !formData) return;
    const name = formData.name.trim() || editingSession.name;
    const next = activeSession === name ? null : name;
    try {
      await setActiveSession({ campaignName, name: next });
      showToast(next ? `“${next}” is the active session — log rows are stamped with it` : 'Active session cleared');
    } catch (err) {
      console.error('Failed to set the active session:', err);
      showError(err.message || 'Failed to set the active session');
    }
  };

  // ── Session recap (roadmap Step 8) ──
  // GM-only, like the active-session toggle: the server gathers the rows
  // stamped to this session and posts the AI's story as a `session_recap`
  // log row (SSE shows it in every tab). Both outcomes land verbatim in the
  // planner banner — plain-English server copy on refusal, a persistent
  // success witness on landing (backlog 2026-11-21 GGG: the toast alone had
  // faded while the modal stayed open, leaving nothing to prove the recap
  // arrived). The model call is bounded by the provider's own fetch timeout,
  // so the busy flag can only outlive a hung request by that bound.
  const [recapBusy, setRecapBusy] = useState(false);

  const handleWriteRecap = async () => {
    if (!editingSession || !formData || recapBusy) return;
    const name = formData.name.trim() || editingSession.name;
    // A new attempt never keeps the previous banner glowing while it runs —
    // same reset discipline every attempt pays.
    showError(null);
    setRecapBusy(true);
    try {
      await requestSessionRecap(campaignName, name);
      showSuccess(`Recap of “${name}” posted to the campaign log — open the Log to read it`);
    } catch (err) {
      console.error('Failed to write the session recap:', err);
      showError(err.message || 'Failed to write the session recap');
    } finally {
      setRecapBusy(false);
    }
  };

  // ── Mark as Played (recap prompt, QA backlog 2026-11-24) ──
  // The retired native window.prompt becomes an in-app dialog pair: clicking
  // the footer button stages the row (pendingPlayedSession) and opens the
  // SessionPlayedModal with a live Preview; Cancel/Escape/backdrop close it
  // zero-write (session stays planned, no log rows); Confirm runs the OK path
  // — save played, post the session-played log row while the session is still
  // the tracked active one (bookend stamp law, QA backlog 2026-11-24), then
  // clear the active stamp if it was this session (the Preview and the row
  // share buildSessionPlayedLogText, so they can never drift).
  const [pendingPlayedSession, setPendingPlayedSession] = useState(null);
  const [playedRecap, setPlayedRecap] = useState('');

  const handleMarkPlayed = () => {
    if (!editingSession || !formData) return;
    setPlayedRecap('');
    setPendingPlayedSession(editingSession);
  };

  const handleCancelMarkPlayed = () => setPendingPlayedSession(null);

  const handleConfirmMarkPlayed = async () => {
    const target = pendingPlayedSession;
    if (!target || !formData) return;
    setPendingPlayedSession(null);
    const recap = playedRecap.trim();
    const playedAt = new Date().toISOString();
    const playedName = formData.name.trim() || target.name;
    const updated = {
      ...formData,
      name: playedName,
      summary: recap || formData.summary,
      status: 'played',
      playedAt,
    };
    try {
      await saveSession(campaignName, updated, target.name);
      // Bookend stamp law (QA backlog 2026-11-24): the server stamps every log
      // row from its LIVE sessionState (server/routes/log.js addEntry), so the
      // recap row is posted while this session is still the tracked active one
      // and carries session:"<name>" — the row that NAMES the session stays
      // filterable BY it. The old order (clear first, then log) stamped both
      // closing rows null.
      await addEntry(campaignName, {
        type: 'session-played',
        text: buildSessionPlayedLogText(playedName, recap),
      });
      if (activeSession === playedName) {
        // Playing it ends it: stop stamping future rows with a session that is
        // now archived (the clear posts its own session_active audit row before
        // the clear lands, likewise stamped with the outgoing name).
        await setActiveSession({ campaignName, name: null });
      }
      showToast(`“${playedName}” archived to the campaign log`);
      await loadItems();
      missedListBroadcast.current = false;
      handleCloseModal();
    } catch (err) {
      // The 409 concurrent-edit conflict is already logged once at warn by
      // the service layer (improve 2026-10-27-J); only genuine failures get
      // a red console line here. The banner below owns user feedback.
      if (!err.conflict) {
        console.error('Failed to mark session as played:', err);
      }
      missedListBroadcast.current = true;
      showError(err.message || 'Failed to mark session as played', err.conflict === true);
    }
  };

  return (
    <div className="ct-container">
      <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />

      <div className="ct-header">
        <h2 className="ct-title">
          <i className="fa-solid fa-calendar-check" /> Sessions
        </h2>
        <button className="ct-new-btn" onClick={handleNewSession}>
          <i className="fa-solid fa-plus" /> New Session
        </button>
      </div>

      <div className="ct-search-row">
        <i className="fa-solid fa-magnifying-glass ct-search-icon" />
        <input
          type="text"
          className="ct-search-input"
          placeholder="Search sessions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search sessions"
        />
        {searchQuery && (
          <button className="ct-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {toast && <div className="sessions-toast">{toast}</div>}

      {loading && (
        <div className="ct-empty-state">
          <i className="fa-solid fa-spinner fa-spin" /> Loading sessions…
        </div>
      )}

      {!loading && filteredSessions.length === 0 && (
        <div className="ct-empty-state">
          {searchQuery ? (
            <>
              <i className="fa-solid fa-search" />
              No sessions found matching &ldquo;{searchQuery}&rdquo;
            </>
          ) : (
            <>
              <i className="fa-solid fa-calendar-check" />
              No sessions yet. Click &ldquo;New Session&rdquo; to plan the next adventure.
            </>
          )}
        </div>
      )}

      {!loading && filteredSessions.length > 0 && (
        <ul className="ct-list">
          {filteredSessions.map((session) => (
            <SessionListItem
              key={session.name}
              session={session}
              isActive={activeSession != null && session.name === activeSession}
              onEdit={handleEditSession}
            />
          ))}
        </ul>
      )}

      {modalOpen && formData && (
        <SessionPlannerModal
          formData={formData}
          setFormData={setFormData}
          editingSession={editingSession}
          otherSessions={otherSessions}
          resourceOptions={picker}
          pickerLoadError={pickerLoadFailed}
          characters={characters}
          campaignName={campaignName}
          saving={saving}
          deleting={deleting}
          banner={banner}
          onClose={handleRequestClose}
          onReloadList={handleReloadList}
          onSave={handleSave}
          onDelete={handleDelete}
          onFormChange={handleFormChange}
          onAddLink={handleAddLink}
          onRemoveLink={handleRemoveLink}
          onMoveLink={handleMoveLink}
          onQuickAction={handleQuickAction}
          onAddContingency={handleAddContingency}
          onContingencyChange={handleContingencyChange}
          onRemoveContingency={handleRemoveContingency}
          onToggleChecklist={handleToggleChecklist}
          onAddChecklistItem={handleAddChecklistItem}
          onRemoveChecklistItem={handleRemoveChecklistItem}
          onMarkPlayed={handleMarkPlayed}
          activeSession={activeSession}
          onSetActiveSession={activeSessionHandlerFor(isLocalhost, handleSetActiveSession)}
          recapBusy={recapBusy}
          onWriteRecap={activeSessionHandlerFor(isLocalhost, handleWriteRecap)}
        />
      )}

      <NpcUnarmedConfirmModal
        pending={pendingUnarmedNpc}
        onCancel={handleUnarmedCancel}
        onConfirm={handleUnarmedAddAnyway}
      />

      {/* Delete Confirm — shared role="dialog" tier riding ABOVE the planner as
          a fragment sibling (EB/MapsManager law: its own backdrop never
          touches the modal underneath). */}
      <DeleteSessionModal pending={pendingDelete} onCancel={cancelDelete} onConfirm={confirmDelete} />

      {/* Mark-as-Played recap prompt (in-app, live Preview) — same sibling law.
          The component derives the displayed name, so no branch is added to
          the Sessions body (complexity ceiling). */}
      <SessionPlayedModal
        pendingSession={pendingPlayedSession}
        formData={formData}
        recap={playedRecap}
        onRecapChange={setPlayedRecap}
        onCancel={handleCancelMarkPlayed}
        onConfirm={handleConfirmMarkPlayed}
      />

      {/* Dirty-draft toll (QA backlog 2026-11-24): SIBLING mount above the
          planner — its backdrop/Escape answer only the toll. */}
      {discardDialog}
    </div>
  );
}

export default Sessions;
