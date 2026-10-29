import { useState, useEffect } from 'react';
import { formatEncounterName } from '../../services/encounters/encountersService.js';
import MarkdownPreview from '../common/MarkdownPreview.jsx';
import './EncounterBuilder.css';

function EncounterModal({ isOpen, onClose, mode, onSave, onLoad, onDelete, onRename, encounters, loading, renameTarget: renameTargetProp }) {
  const [name, setName] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);

  useEffect(() => {
    if (mode === 'save') {
      setName('');
      setError('');
    } else if (renameTarget) {
      // Fix#38 (#410): the pen (:145) sets modal-local renameTarget while the
      // sole caller's prop mode stays 'load' — seed the form from local state so
      // the rename UI is reachable in the prod path (was mode === 'rename' only).
      setNewName(renameTarget.name);
      setError('');
    }
  }, [mode, renameTarget]);

  useEffect(() => {
    if (mode === 'rename' && renameTargetProp) {
      setNewName(renameTargetProp.name);
      setError('');
    }
  }, [mode, renameTargetProp]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Encounter name is required');
      return;
    }
    setError('');
    await onSave(name.trim());
    setName('');
    onClose();
  };

  const handleLoad = async (encounterName) => {
    // QA backlog 2026-10-28-S: close-on-action parity with this modal's save leg
    // above and the generator Apply auto-close (bad3f6e86) — arm the draft, then
    // drop the overlay so the toolbar Save is immediately clickable (no extra ×
    // click, no pointer-events interception). The parent handleLoadEncounter
    // catches its own failures (toast copy), so a resolved await always means
    // the dispatch completed — same success/failure ownership as the save leg.
    await onLoad(encounterName);
    onClose();
  };

  const handleRename = async () => {
    if (!newName.trim()) {
      setError('New name is required');
      return;
    }
    setError('');
    const targetName = renameTargetProp ? renameTargetProp.name : renameTarget?.name;
    try {
      // Parent reloads the encounter list before resolving and throws on
      // non-2xx/network failure, so a resolved await here is a true success.
      await onRename(targetName, newName.trim());
      setRenameTarget(null);
      setNewName('');
      setError('');
      // Close the modal on success — mirrors the delete lane (d4da4ebc1).
      onClose();
    } catch (err) {
      console.error('Failed to rename encounter:', err);
      setError(err.message || 'Failed to rename encounter');
    }
  };

  const handleDelete = async (encounterName) => {
    if (window.confirm(`Delete "${formatEncounterName(encounterName)}"?`)) {
      try {
        // Parent reloads the encounter list before resolving and throws on
        // non-2xx/network failure, so a resolved await here is a true success.
        await onDelete(encounterName);
        setError('');
        // Close the modal on success — mirrors the quest delete fix (752a00c43).
        onClose();
      } catch (err) {
        console.error('Failed to delete encounter:', err);
        setError(err.message || 'Failed to delete encounter');
      }
    }
  };

  return (
    <div className="encounter-modal-overlay">
      <div className="encounter-modal">
        <div className="encounter-modal-header">
          <h3>
            {mode === 'save' && 'Save Encounter'}
            {mode === 'load' && !renameTarget && 'Load Encounter'}
            {(mode === 'rename' || renameTarget) && 'Rename Encounter'}
          </h3>
          <button className="encounter-modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="encounter-modal-body">
          {error && <div className="encounter-modal-error">{error}</div>}

          {mode === 'save' && (
            <div className="encounter-modal-save">
              <label htmlFor="encounter-name">Encounter Name</label>
              <input
                id="encounter-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Goblin Ambush"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              <button className="encounter-btn encounter-btn-primary" onClick={handleSave}>
                <i className="fa-solid fa-floppy-disk" /> Save
              </button>
            </div>
          )}

          {/* Fix#38 (#410): reachable via local renameTarget (pen click) OR prop
              mode==='rename' (prop path preserved for renameTargetProp consumers). */}
          {(mode === 'rename' || renameTarget) && (
            <div className="encounter-modal-rename">
              <label htmlFor="encounter-rename">New Name</label>
              <input
                id="encounter-rename"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                autoFocus
              />
              <button className="encounter-btn encounter-btn-primary" onClick={handleRename}>
                <i className="fa-solid fa-pen" /> Rename
              </button>
            </div>
          )}

          {mode === 'load' && !renameTarget && (
            <div className="encounter-modal-load">
              {encounters.length === 0 ? (
                loading ? (
                  <div className="encounter-modal-loading">Loading...</div>
                ) : (
                  <div className="encounter-modal-empty">No saved encounters yet.</div>
                )
              ) : (
                // QA 2026-10-24: rows render during a list refresh but every row
                // action is natively `disabled` while `loading` — a stale-node or
                // eager click in the reload window is absorbed by the browser
                // (silent-close flake), mirroring the EB empty-save / Save-gate
                // disable-until-ready precedent.
                <ul className="encounter-list">
                  {[...encounters].sort((a, b) => (a.effectiveXP || 0) - (b.effectiveXP || 0)).map((enc) => (
                    <li key={enc.name} className="encounter-list-item">
                      <div className="encounter-list-info">
                        <span className="encounter-list-name">{formatEncounterName(enc.name)}</span>
                        {enc.effectiveXP != null && (
                          <span className="encounter-list-xp">
                            {enc.effectiveXP.toLocaleString()} effective XP
                          </span>
                        )}
                        {enc.description && (
                          <div className="encounter-list-description">
                            <MarkdownPreview text={enc.description} />
                          </div>
                        )}
                      </div>
                      <div className="encounter-list-actions">
                        <button
                          className="encounter-btn encounter-btn-sm encounter-btn-primary"
                          onClick={() => handleLoad(enc.name)}
                          aria-label={`Load "${enc.name}"`}
                          disabled={loading}
                        >
                          <i className="fa-solid fa-download" /> Load
                        </button>
                        <button
                          className="encounter-btn encounter-btn-sm encounter-btn-secondary"
                          onClick={() => setRenameTarget(enc)}
                          aria-label={`Rename "${enc.name}"`}
                          disabled={loading}
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button
                          className="encounter-btn encounter-btn-sm encounter-btn-danger"
                          onClick={() => handleDelete(enc.name)}
                          aria-label={`Delete "${enc.name}"`}
                          disabled={loading}
                        >
                          <i className="fa-solid fa-trash-can" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EncounterModal;
