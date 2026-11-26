import { useState, useEffect } from 'react';
import { formatEncounterName, loadEncounter } from '../../services/encounters/encountersService.js';
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';
import MarkdownPreview from '../common/MarkdownPreview.jsx';
import HandoutPreview from '../handouts/HandoutPreview.jsx';
import EncounterSheetHandout from '../handouts/EncounterSheetHandout.jsx';
import './EncounterBuilder.css';

// Named-delete copy wrapper over the shared DeleteConfirmModal a11y tier
// (role="dialog" + aria-modal + labelled heading, initial focus on Cancel, Tab
// trap, Escape/backdrop → onCancel), mirroring MapsManager's DeleteMapModal
// (QA backlog 2026-11-24: the pool-row trash retired its native
// window.confirm, which blocked the whole automation lane until handled).
// The open-guard lives HERE (null name → renders nothing) rather than as a
// `{deleteTarget && …}` JSX arm in EncounterModal — complexity-cap hoist.
function DeleteEncounterModal({ encounterName, onCancel, onConfirm }) {
  if (!encounterName) return null;
  return (
    <DeleteConfirmModal
      titleId="encounter-modal-delete-title"
      title="Delete Encounter"
      confirmLabel="Yes, Delete Permanently"
      onCancel={onCancel}
      onConfirm={() => onConfirm(encounterName)}
    >
      This will permanently delete the encounter &apos;<strong>{formatEncounterName(encounterName)}</strong>&apos;.
      This <strong>cannot be undone</strong>.
    </DeleteConfirmModal>
  );
}

// Item 4 handout lane: the printed sheet is pure presentation over the SAVED
// row — no load, no PUT, no XP recompute (the builder's load seam stays the
// only lane that recomputes). The list lane serves summary rows, so the full
// roster is fetched by GET only when the row lacks it; CR/XP columns and the
// difficulty verdict are derived at print time from the host's live bestiary
// + party.
function EncounterPrintPreview({ campaignName, encounter, monsters, playerLevels, onClose }) {
  const [fullRow, setFullRow] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!encounter) {
      setFullRow(null);
      setLoadError(null);
      return undefined;
    }
    if (Array.isArray(encounter.selectedMonsters)) {
      setFullRow(encounter);
      setLoadError(null);
      return undefined;
    }
    let alive = true;
    setFullRow(null);
    setLoadError(null);
    loadEncounter(campaignName, encounter.name)
      .then((row) => { if (alive) setFullRow(row); })
      .catch((err) => {
        console.error('Failed to fetch the saved encounter for the printed sheet:', err);
        if (alive) setLoadError(err.message || 'Failed to load the saved roster');
      });
    return () => { alive = false; };
  }, [campaignName, encounter]);

  if (!encounter) return null;
  return (
    <HandoutPreview
      label={`Encounter Sheet — ${formatEncounterName(encounter.name)}`}
      campaignName={campaignName}
      onClose={onClose}
    >
      {loadError ? (
        <p className="handout-empty">{loadError} — reopen the sheet to retry.</p>
      ) : !fullRow ? (
        <p className="handout-empty">
          <i className="fa-solid fa-spinner fa-spin" /> Loading the saved roster…
        </p>
      ) : (
        <EncounterSheetHandout
          encounter={fullRow}
          monsters={monsters || []}
          partyLevels={playerLevels || []}
        />
      )}
    </HandoutPreview>
  );
}

function EncounterModal({ isOpen, onClose, mode, onSave, onLoad, onDelete, onRename, encounters, loading, renameTarget: renameTargetProp, monsters, playerLevels, campaignName }) {
  const [name, setName] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  // Raw name of the row whose DeleteConfirmModal is open (null = closed).
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Saved row whose printed sheet preview is open (null = closed). The list
  // stays the sheet's data source; monsters/playerLevels feed the derived
  // columns. Display-only — closing the Load modal resets it like the
  // transient rename state.
  const [printTarget, setPrintTarget] = useState(null);

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

  // QA backlog 2026-11-02: Escape closes, mirroring the house overlay-dismiss
  // pattern (DiceTray.jsx:42-48, FontOfMagicModal.jsx:75) — Escape is ×-parity.
  // QA backlog 2026-11-24: the delete leg's native window.confirm retired in
  // favor of the shared DeleteConfirmModal dialog, so this modal DOES own a
  // nested dialog now — while it is open, Escape answers only the dialog
  // (zero-write close of the confirm), never the whole Load overlay.
  //
  // The dialog-open lane MUST consume Escape at the document CAPTURE phase
  // with stopPropagation (live-proved 2026-11-24): the dialog's own React
  // onKeyDown runs when the keydown reaches the app root, and React's
  // synchronous discrete-event flush removes the dialog AND re-runs this very
  // effect (re-attaching the closed-state bubbling listener) BEFORE the same
  // in-flight keydown bubbles on to document — a closure/attach-order guard
  // then lets that one keystroke close dialog + overlay together. Capture at
  // document runs before the root handler exists in the path, and
  // stopPropagation guarantees the event never reaches any listener
  // (re)attached during the dispatch.
  useEffect(() => {
    if (!isOpen) {
      // The modal hides without unmounting (:if-guard below), so every dismiss
      // lane (Escape / × / backdrop / post-action onClose) must reset the
      // transient rename state here. The pen sets modal-local renameTarget
      // while the parent's mode prop stays 'load', and only a SUCCESSFUL
      // rename cleared it — cancelling stranded the target and the next Load
      // reopened straight into the Rename Encounter form with the list
      // unreachable. Mirrors the mode-transition form-field reset above.
      setRenameTarget(null);
      setNewName('');
      setError('');
      setDeleteTarget(null);
      setPrintTarget(null);
      return undefined;
    }
    if (deleteTarget) {
      const guardEscape = (e) => {
        if (e.key !== 'Escape') return;
        // Consume the keystroke for the dialog only (its Cancel button,
        // backdrop and the shared panel lane remain the other dismiss paths).
        e.stopPropagation();
        setDeleteTarget(null);
      };
      document.addEventListener('keydown', guardEscape, true);
      return () => document.removeEventListener('keydown', guardEscape, true);
    }
    // Item 4: while a handout preview is open over this list, Escape answers
    // ONLY the preview — HandoutPreview's own document-CAPTURE listener
    // consumes the keystroke before the bubbling handler below can run.
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, deleteTarget]);

  if (!isOpen) return null;

  // Validation-family convergence (2026-11-16 QA backlog): the commit buttons
  // DISABLE while the name is blank, mirroring the NPC/Quest majority pattern
  // (NPCs.jsx `disabled={saving || !formData.name.trim()}`, Quests.jsx
  // `saveDisabled`). The blank guards in handleSave/handleRename below stay
  // live as the Enter-key lane's honest refusal (same backstop role the
  // siblings keep in their handlers) — never a silent no-op.
  // QA backlog 2026-11-16 XB: editing the name clears the inline error,
  // mirroring the maps generate-modal change lane (GenerateDungeonModal.jsx
  // `editName = (event) => { setError(null); ... }`) — a stale red refusal
  // must not linger once the user is fixing the very field it names.
  const editName = (event) => {
    setError('');
    setName(event.target.value);
  };

  const editNewName = (event) => {
    setError('');
    setNewName(event.target.value);
  };

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
      // Backlog 2026-10-28-U: no console.error here — the service already logs
      // the one line (c5d784d1f canon); this leaf owns only the inline copy.
      setError(err.message || 'Failed to rename encounter');
    }
  };

  // Confirm leg of the pool-row delete lane (DeleteEncounterModal above is the
  // gate — no native window.confirm anywhere). Mirrors MapsManager.handleDelete:
  // the dialog closes on BOTH outcomes; on success the Load modal also closes
  // (d4da4ebc1), on failure it stays open with the inline .encounter-modal-error
  // copy (quest fix 752a00c43 shape).
  const handleDelete = async (encounterName) => {
    try {
      // Parent reloads the encounter list before resolving and throws on
      // non-2xx/network failure, so a resolved await here is a true success.
      await onDelete(encounterName);
      setDeleteTarget(null);
      setError('');
      // Close the modal on success — mirrors the quest delete fix (752a00c43).
      onClose();
    } catch (err) {
      console.error('Failed to delete encounter:', err);
      setError(err.message || 'Failed to delete encounter');
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <div
        className="ct-modal-overlay"
        role="presentation"
        onClick={(e) => {
          // Backdrop dismiss mirrors the DiceTray popup-overlay convention
          // (DiceTray.jsx:73-80): clicks bubbling from inside the panel are
          // inert; a pure backdrop click is onClose only — no dispatch, no
          // state write — while the open (2026-11-02 BF: the z-1000 overlay
          // used to swallow every click, incl. sidebar nav, until ×).
          // .ct-* kit convergence (tranche 1): the shell rides the shared
          // .ct-modal* chrome (scoped by the EncounterBuilder root's
          // .ct-container); the in-panel guard follows the renamed kit class.
          // The DeleteConfirmModal rides BELOW this overlay as a fragment
          // sibling (not a DOM descendant), so its own backdrop clicks never
          // bubble here and can never close the Load picker alongside it.
          if (e.target.closest('.ct-modal')) return;
          onClose();
        }}
      >
        <div className="ct-modal">
          <div className="ct-modal-header">
            <h3>
              {mode === 'save' && 'Save Encounter'}
              {mode === 'load' && !renameTarget && 'Load Encounter'}
              {(mode === 'rename' || renameTarget) && 'Rename Encounter'}
            </h3>
            <button className="ct-modal-close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>

          <div className="ct-modal-body">
            {error && <div className="encounter-modal-error">{error}</div>}

            {/* .ct-* kit convergence (tranche 1): save/rename fields ride the kit
                tiers (.ct-label/.ct-input/.ct-btn); the wrapper divs stay as the
                flex layout container tests anchor the form to. */}
            {mode === 'save' && (
              <div className="encounter-modal-save">
                <label htmlFor="encounter-name" className="ct-label">Encounter Name</label>
                <input
                  id="encounter-name"
                  type="text"
                  className="ct-input"
                  value={name}
                  onChange={editName}
                  placeholder="e.g., Goblin Ambush"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                <button className="ct-btn ct-btn-primary" onClick={handleSave} disabled={!name.trim()}>
                  <i className="fa-solid fa-floppy-disk" /> Save
                </button>
              </div>
            )}

            {/* Fix#38 (#410): reachable via local renameTarget (pen click) OR prop
                mode==='rename' (prop path preserved for renameTargetProp consumers). */}
            {(mode === 'rename' || renameTarget) && (
              <div className="encounter-modal-rename">
                <label htmlFor="encounter-rename" className="ct-label">New Name</label>
                <input
                  id="encounter-rename"
                  type="text"
                  className="ct-input"
                  value={newName}
                  onChange={editNewName}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  autoFocus
                />
                <button className="ct-btn ct-btn-primary" onClick={handleRename} disabled={!newName.trim()}>
                  <i className="fa-solid fa-pen" /> Rename
                </button>
              </div>
            )}

            {mode === 'load' && !renameTarget && (
              encounters.length === 0 ? (
                loading ? (
                  <div className="encounter-modal-loading">Loading...</div>
                ) : (
                  <div className="ct-empty-state">No saved encounters yet.</div>
                )
              ) : (
                // QA 2026-10-24: rows render during a list refresh but every row
                // action is natively `disabled` while `loading` — a stale-node or
                // eager click in the reload window is absorbed by the browser
                // (silent-close flake), mirroring the EB empty-save / Save-gate
                // disable-until-ready precedent.
                // List rows stay on the bespoke .encounter-list tiers by design:
                // the kit .ct-list-item carries the clickable-row cursor, while
                // these rows act ONLY through their (now kit-styled) action
                // buttons.
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
                          className="ct-btn ct-btn-sm ct-btn-primary"
                          onClick={() => handleLoad(enc.name)}
                          aria-label={`Load "${enc.name}"`}
                          disabled={loading}
                        >
                          <i className="fa-solid fa-download" /> Load
                        </button>
                        <button
                          className="ct-btn ct-btn-sm"
                          onClick={() => setRenameTarget(enc)}
                          aria-label={`Rename "${enc.name}"`}
                          title={`Rename "${enc.name}"`}
                          disabled={loading}
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                        {/* Item 4 handout: labeled verb on the row it prints
                            (F12 law); opens the paper preview, writes nothing. */}
                        <button
                          className="ct-btn ct-btn-sm"
                          onClick={() => setPrintTarget(enc)}
                          aria-label={`Print sheet for "${enc.name}"`}
                          title={`Print sheet for "${enc.name}"`}
                          disabled={loading}
                        >
                          <i className="fa-solid fa-print" /> Print
                        </button>
                        <button
                          className="ct-btn ct-btn-sm ct-btn-danger"
                          onClick={() => setDeleteTarget(enc.name)}
                          aria-label={`Delete "${enc.name}"`}
                          title={`Delete "${enc.name}"`}
                          disabled={loading}
                        >
                          <i className="fa-solid fa-trash-can" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </div>
      </div>

      <DeleteEncounterModal
        encounterName={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <EncounterPrintPreview
        encounter={printTarget}
        campaignName={campaignName}
        monsters={monsters}
        playerLevels={playerLevels}
        onClose={() => setPrintTarget(null)}
      />
    </>
  );
}

export default EncounterModal;
