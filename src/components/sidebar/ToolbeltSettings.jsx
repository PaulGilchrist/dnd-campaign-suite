import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalDismiss from '../../hooks/ui/useModalDismiss.js';
import { TOOLBELT_VIEWS, TOOLBELT_PRESETS, matchToolbeltPreset } from '../../services/ui/sidebarNav.js';
import './ToolbeltSettings.css';

// Trailing debounce for toolbelt checkbox writes — the SAME benign network
// debounce idiom as EnforcementSection (600ms quiet window coalesces a burst
// of clicks into one PUT; writes are deferred, never dropped: the timer or
// the unmount flush always fires them. No game state rides this timer).
const TOOLBELT_PERSIST_DEBOUNCE_MS = 600;

/**
 * Personalized toolbelt dialog (learnability backlog Item 1) — GM-only,
 * opened from the sidebar footer "Sidebar" button. One checkbox per sidebar
 * view; hidden views disappear from EVERY device in the campaign. The
 * starting-point pills are one-click batch-sets of the checkboxes (presets
 * are conveniences, never modes — nothing preset-shaped is stored, the
 * active chip is DERIVED by matchToolbeltPreset, and every checkbox stays
 * editable before and after a pill click). Writes ride the campaign-meta
 * lane (App → useCampaignMeta → PUT /meta); this dialog owns only its
 * optimistic draft and its honest success/failure line.
 */
export function ToolbeltSettings({ hiddenViews, onSave, onClose }) {
    const [draft, setDraft] = useState(() => [...hiddenViews]);
    const [status, setStatus] = useState(null);
    const panelRef = useRef(null);

    // Optimistic write lane (mirrors EnforcementSection exactly): `draft` is
    // what the checkboxes render while a burst is pending; the debounced
    // flush PUTs it once the clicks stop.
    const draftRef = useRef(null);
    const timerRef = useRef(null);
    const mountedRef = useRef(true);
    const saveRef = useRef(onSave);
    saveRef.current = onSave;

    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const pending = draftRef.current;
        if (!pending) return;
        draftRef.current = null;
        saveRef.current(pending)
            .then(() => {
                if (mountedRef.current) {
                    setStatus({ kind: 'success', message: 'Sidebar updated — everyone at this table sees these views.' });
                }
            })
            .catch((error) => {
                if (mountedRef.current) {
                    setStatus({ kind: 'error', message: `Save failed: ${error.message}` });
                }
            });
    }, []);

    const writeDebounced = useCallback((views) => {
        setDraft(views);
        draftRef.current = views;
        setStatus(null);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, TOOLBELT_PERSIST_DEBOUNCE_MS);
    }, [flush]);

    // Closing the dialog (or navigating away) mid-burst must flush, not drop
    // the last click; the mounted flag is cleared by the FIRST cleanup so the
    // flush's own status never lands on an unmounted dialog.
    useEffect(() => () => { mountedRef.current = false; }, []);
    useEffect(() => flush, [flush]);

    // Focus the panel on open so Escape targets the dialog subtree (the
    // shared dismiss hook's panel lane), mirroring the app-wide dialog law.
    useEffect(() => { panelRef.current?.focus(); }, []);
    const dismiss = useModalDismiss(onClose, { panelSelector: '.ct-modal' });

    const activePreset = matchToolbeltPreset(draft);
    // A TICKED box means SHOWN — the draft itself is the hidden set (the
    // canonical stored shape), so showing a view REMOVES it from the draft.
    const setView = (view, shown) => writeDebounced(
        shown ? draft.filter((v) => v !== view) : [...draft, view]
    );
    // A pill click on the ALREADY-active preset is a genuine no-op — skip
    // the write entirely so idempotent clicks never churn the lane.
    const applyPreset = (preset) => {
        if (activePreset?.id === preset.id) return;
        writeDebounced([...preset.hidden]);
    };

    // Portal to <body>: the sidebar is a position:fixed z-index:100 STACKING
    // CONTEXT, so a dialog rendered inside the nav could never rise above the
    // main content's confirm modals (z-1000 tier). Rendering the kit host as a
    // body child puts it in the root context where .ct-modal-overlay's z-1000
    // behaves exactly as it does for every other ct-modal consumer.
    return createPortal(
        <div className="ct-container toolbelt-modal-host">
            <div
                className="ct-modal-overlay"
                role="presentation"
                onMouseDown={dismiss.handleOverlayMouseDown}
                onClick={dismiss.handleOverlayClick}
            >
                <div
                    className="ct-modal toolbelt-section"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="toolbelt-title"
                    tabIndex={-1}
                    ref={panelRef}
                    onKeyDown={dismiss.handleKeyDown}
                >
                    <div className="ct-modal-header">
                        <h3 id="toolbelt-title"><i className="fa-solid fa-pen-to-square"></i> Sidebar toolbelt</h3>
                        <button className="ct-modal-close" onClick={onClose} aria-label="Close">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="ct-modal-body">
                        <p className="toolbelt-intro">
                            Tick the tools this table needs <strong>right now</strong>. Hidden views disappear
                            from everyone&apos;s sidebar in this campaign — nothing is deleted, and showing a
                            view again brings it straight back. These are not fixed modes: the starting points
                            below just batch-set the checkboxes, and every checkbox stays editable.
                        </p>

                        <div className="toolbelt-presets" role="group" aria-label="Starting points">
                            {TOOLBELT_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    className={`session-phase-pill${activePreset?.id === preset.id ? ' active' : ''}`}
                                    aria-pressed={activePreset?.id === preset.id}
                                    title={preset.hint}
                                    onClick={() => applyPreset(preset)}
                                >
                                    {preset.label}
                                </button>
                            ))}
                            {!activePreset && (
                                <span className="session-phase-pill" title="Custom selection — checkboxes no longer match a starting point">
                                    Custom
                                </span>
                            )}
                        </div>

                        <fieldset className="toolbelt-views" aria-label="Sidebar views">
                            {TOOLBELT_VIEWS.map(({ view, label }) => (
                                <label key={view} className="enforcement-toggle">
                                    <input
                                        type="checkbox"
                                        checked={!draft.includes(view)}
                                        onChange={(e) => setView(view, e.target.checked)}
                                    />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </fieldset>
                        <p className="toolbelt-note">
                            GM-only views (Admin, Drafts, Factions, GM Screen, Notes, NPCs, Quests, Sessions,
                            Settlements, Encounters) never appear to players, whatever is ticked here.
                        </p>

                        {status && (
                            <div className={`toolbelt-status toolbelt-status--${status.kind}`} role="status" aria-live="polite">
                                {status.message}
                            </div>
                        )}
                    </div>
                    <div className="ct-modal-footer">
                        <div className="ct-modal-buttons">
                            <button className="ct-btn ct-btn-primary" onClick={onClose}>Done</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

export default ToolbeltSettings;
