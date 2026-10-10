import { useState, useEffect } from 'react';
import { useCrudList } from '../../hooks/useCrudList.js';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';
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
import { addEntry } from '../../services/ui/logService.js';
import SessionListItem from './SessionListItem.jsx';
import SessionPlannerModal from './SessionPlannerModal.jsx';
import './Sessions.css';

async function loadResourceOptions(campaignName) {
  const loaders = [
    ['maps', loadMaps], ['encounters', loadEncounters], ['npcs', loadNPCs],
    ['quests', loadQuests], ['settlements', loadSettlements], ['notes', loadNotes],
  ];
  const settled = await Promise.allSettled(loaders.map(([, fn]) => fn(campaignName)));
  const raw = {};
  settled.forEach((r, i) => {
    const [key] = loaders[i];
    if (r.status !== 'fulfilled') {
      console.error(`Failed to load session picker resources for ${key}:`, r.reason);
      raw[key] = [];
    } else {
      raw[key] = Array.isArray(r.value) ? r.value : (r.value?.[key] || []);
    }
  });
  return {
    maps: raw.maps.map(m => ({ value: m.name, label: m.name })),
    encounters: raw.encounters.map(e => ({ value: e.name, label: e.name })),
    npcs: raw.npcs.map(n => ({ value: n.name, label: n.name })),
    quests: raw.quests.map(q => ({ value: q.name, label: q.name })),
    settlements: raw.settlements.map(s => ({ value: s.name, label: s.name })),
    notes: raw.notes.map(n => ({
      value: n.id,
      label: (n.description || '').replace(/[#*_>`]/g, '').trim().substring(0, 60) || n.id,
    })),
  };
}

function Sessions({ campaignName, characters = [], isLocalhost: _isLocalhost, onBack, onViewInitiative }) {
  const { items: sessions, loading, loadItems, deleteItem: deleteSessionAction } =
    useEntityManagement(campaignName, { load: loadSessions, save: saveSessions, delete: deleteSession }, { responseKey: 'sessions', loadOnMount: false });

  const {
    searchQuery, setSearchQuery, filteredItems: filteredSessions,
    modalOpen, editingItem: editingSession, formData, setFormData,
    saving, setSaving,
    openNew, openEdit, closeModal,
  } = useCrudList(sessions, ['name', 'summary']);

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [picker, setPicker] = useState({ maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] });
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (campaignName) loadItems();
  }, [campaignName, loadItems]);

  useEffect(() => {
    if (!modalOpen || !campaignName) return;
    let cancelled = false;
    loadResourceOptions(campaignName).then(opts => {
      if (!cancelled) setPicker(opts);
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

  const handleNewSession = () => {
    setError(null);
    openNew(getDefaultSessionData());
  };

  const handleEditSession = (session) => {
    setError(null);
    openEdit(getDefaultSessionData(session));
  };

  const hasDuplicateName = () => sessions.some(s =>
    s.name !== editingSession?.name && s.name.toLowerCase() === formData.name.trim().toLowerCase()
  );

  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;
    if (hasDuplicateName()) {
      setError('A session with that name already exists');
      return;
    }
    setSaving(true);
    try {
      const cleaned = { ...formData, name: formData.name.trim() };
      cleaned.checklist = mergeChecklist(cleaned.checklist, cleaned.links);
      await saveSession(campaignName, cleaned, editingSession?.name);
      setError(null);
      await loadItems();
      closeModal();
    } catch (err) {
      console.error('Failed to save session:', err);
      setError(err.message || 'Failed to save session');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSession) return;
    if (!window.confirm('Delete this session plan?')) return;
    setDeleting(true);
    try {
      await deleteSessionAction(editingSession.name);
      closeModal();
    } catch (err) {
      console.error('Failed to delete session:', err);
      setError(err.message || 'Failed to delete session');
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
      await loadItems();
      showToast(`Moved to “${target.name}”`);
    } catch (err) {
      console.error('Failed to move link:', err);
      setError(err.message || 'Failed to move link');
    }
  };

  const handleQuickAction = async (type, value) => {
    try {
      if (type === 'maps') {
        await activateMap(campaignName, value);
        showToast(`${value} set as active map`);
      } else if (type === 'npcs') {
        const npc = await findNpc(value) || { name: value };
        await addNPCToInitiative(campaignName, npc, onViewInitiative);
        showToast(`${value} added to initiative`);
      }
    } catch (err) {
      console.error('Failed to run session quick action:', err);
      setError(err.message || 'Quick action failed');
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
      closeModal();
    } catch (err) {
      console.error('Failed to mark session as played:', err);
      setError(err.message || 'Failed to mark session as played');
    }
  };

  return (
    <div className="ct-container">
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
          characters={characters}
          campaignName={campaignName}
          saving={saving}
          deleting={deleting}
          error={error}
          onClose={closeModal}
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
