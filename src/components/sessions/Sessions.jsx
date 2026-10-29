import { useState, useEffect, useRef, useCallback } from 'react';
import { useCrudList } from '../../hooks/useCrudList.js';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';
import { useReloadGuard } from '../../hooks/management/useReloadGuard.js';
import Subscriber from '../common/Subscriber.jsx';
import { loadSessions, saveSession, saveSessions, deleteSession } from '../../services/campaign/sessionsService.js';
import {
  getDefaultSessionData,
  mergeChecklist,
  newContingency,
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
import SessionListItem from './SessionListItem.jsx';
import SessionPlannerModal from './SessionPlannerModal.jsx';
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

function Sessions({ campaignName, characters = [], isLocalhost: _isLocalhost, onBack, onViewInitiative }) {
  const { items: sessions, loading, loadItems, deleteItem: deleteSessionAction } =
    useEntityManagement(campaignName, { load: loadSessions, save: saveSessions, delete: deleteSession }, { responseKey: 'sessions', loadOnMount: false });

  const {
    searchQuery, setSearchQuery, filteredItems: filteredSessions,
    modalOpen, editingItem: editingSession, formData, setFormData,
    saving, setSaving,
    openNew, openEdit, closeModal,
  } = useCrudList(sessions, ['name', 'summary', 'notes']);

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  // True when the visible banner error is a 409 concurrent-edit conflict
  // (server body { conflict: true }) — gates the "Reload list" action button.
  const [errorIsConflict, setErrorIsConflict] = useState(false);
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
  const { seedDraft, clearDraft, confirmDiscardDraft } = useReloadGuard({
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

  // Single choke point for the banner: every message carries whether it was a
  // conflict, so the "Reload list" action can never outlive its error copy.
  const showError = (message, conflict = false) => {
    setError(message);
    setErrorIsConflict(conflict);
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
  const handleReloadList = () => {
    if (!confirmDiscardDraft()) return;
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
  const handleRequestClose = () => {
    const name = (formData?.name || '').trim() || editingSession?.name;
    if (!confirmDiscardDraft(
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

  const handleDelete = async () => {
    if (!editingSession) return;
    if (!window.confirm(`Delete Session Plan "${editingSession.name}"?`)) return;
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
          showToast(`${value} was not added — give them at least one weapon on the NPCs page`);
        } else {
          showToast(`${value} added to initiative`);
        }
      }
    } catch (err) {
      console.error('Failed to run session quick action:', err);
      showError(err.message || 'Quick action failed');
    }
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

  const handleMarkPlayed = async () => {
    if (!editingSession || !formData) return;
    const recap = prompt('Session recap (optional) — added to the campaign log:');
    if (recap === null) return;
    const playedAt = new Date().toISOString();
    const playedName = formData.name.trim() || editingSession.name;
    const updated = {
      ...formData,
      name: playedName,
      summary: recap.trim() || formData.summary,
      status: 'played',
      playedAt,
    };
    try {
      await saveSession(campaignName, updated, editingSession.name);
      await addEntry(campaignName, {
        type: 'session-played',
        text: `Session “${playedName}” marked as played${recap.trim() ? ` — ${recap.trim()}` : ''}`,
      });
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
        <button className="ct-back-btn" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
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
              onEdit={handleEditSession}
            />
          ))}
        </ul>
      )}

      {modalOpen && formData && (
        <SessionPlannerModal
          formData={formData}
          editingSession={editingSession}
          otherSessions={otherSessions}
          resourceOptions={picker}
          pickerLoadError={pickerLoadFailed}
          characters={characters}
          campaignName={campaignName}
          saving={saving}
          deleting={deleting}
          error={error}
          errorConflict={errorIsConflict}
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
        />
      )}
    </div>
  );
}

export default Sessions;
