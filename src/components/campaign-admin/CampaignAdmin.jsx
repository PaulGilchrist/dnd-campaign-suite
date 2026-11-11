import React, { useState, useEffect, useCallback, useRef } from 'react';
import './CampaignAdmin.css';
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';
import EnforcementSection from './EnforcementSection.jsx';
import AiRefereeSection from './AiRefereeSection.jsx';
import SessionSection from './SessionSection.jsx';
import { loadStarterSeed } from '../../services/campaign/starterSeedService.js';
import { regenerateAdventure } from '../../services/campaign/seededCampaign.js';

// Keep in sync with UPLOAD_SIZE_LIMIT in server/routes/campaigns-admin.js —
// the server remains authoritative; this only fronts the rejection.
const UPLOAD_SIZE_LIMIT_MB = 100;
const UPLOAD_SIZE_LIMIT_BYTES = UPLOAD_SIZE_LIMIT_MB * 1024 * 1024;

const BUSY_STATUS_TEXT = {
    'snapshotting': 'Creating snapshot...',
    'rolling-back': 'Rolling back...',
    'downloading': 'Preparing download...',
    'checking-archive': 'Checking archive...',
    'uploading': 'Uploading and extracting...',
    'clearing-change-data': 'Clearing change data...',
    'clearing-log': 'Clearing log...',
    'resetting': 'Performing full reset...',
    'regenerating-adventure': 'Re-rolling the adventure...'
};

function formatBytes(bytes) {
    if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatSnapshotDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
}

// Human relative age for the rollback warning copy, e.g. "2 days old".
// Floor-based so a snapshot from 2 days and 12 hours ago reads "2 days old".
function formatRelativeAge(timestamp) {
    const time = new Date(timestamp).getTime();
    if (Number.isNaN(time)) return '';
    const seconds = Math.floor((Date.now() - time) / 1000);
    if (seconds < 60) return 'less than a minute old';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} old`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} old`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} old`;
}

// Newest-first timestamp wins even if the server list order ever changes.
function getLatestSnapshot(snapshots) {
    return snapshots.reduce(
        (latest, snapshot) => (!latest || String(snapshot.timestamp) > String(latest.timestamp) ? snapshot : latest),
        null
    );
}

// Fully deselect the upload control so a later pick of the SAME file fires a
// change event (real browsers drop `files` with the value; assign the empty
// list explicitly where FileList semantics are not emulated, e.g. tests).
function clearFileInput(input) {
    if (!input) return;
    input.value = '';
    try {
        // Via window so environments without DataTransfer (SSR lint/tests)
        // take the fallback branch instead of a bare-reference throw.
        input.files = new window.DataTransfer().files;
    } catch (_err) {
        input.files = [];
    }
}

// Read-only pre-flight of a chosen archive: POSTs it to the dry-run
// /admin/upload-inspect endpoint (which lists zip entries without touching
// campaign data) and decides whether the destructive confirm gate may open.
// Fail-closed on every path — an unrecognizable archive, a corrupt one, and
// any transport/protocol failure in the check itself all abort the flow with
// a visible status before any POST to /admin/upload can happen. Returns true
// only when the server reports recognizable campaign content.
async function inspectUploadArchive(campaignName, file, setStatus, input) {
    const abort = (message) => {
        console.error('Upload pre-flight check:', message);
        setStatus({ error: `Upload aborted — ${message}` });
        clearFileInput(input);
        return false;
    };
    setStatus('checking-archive');
    let res;
    let data;
    try {
        const formData = new FormData();
        formData.append('file', file);
        res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/upload-inspect`, {
            method: 'POST',
            body: formData
        });
        data = await res.json();
    } catch (err) {
        return abort(`could not check the archive (${err.message})`);
    }
    if (!res.ok) {
        return abort(data && data.error ? data.error : `archive check failed (HTTP ${res.status})`);
    }
    if (!data || typeof data.recognizableCount !== 'number') {
        return abort('the archive check returned an unreadable response');
    }
    if (data.recognizableCount === 0) {
        setStatus({ error: `No campaign data found in ${file.name} — contains 0 recognizable campaign files` });
        clearFileInput(input);
        return false;
    }
    // Recognised — release the busy line; the confirm modal carries the UX
    // from here (Confirm re-posts the file with its own "uploading" status,
    // Cancel resets the status again).
    setStatus(null);
    return true;
}

function AdminHeader({ campaignName }) {
    return (
        <div className="ct-header">
            <h2>Admin — {campaignName}</h2>
        </div>
    );
}

function AppearanceSection({ theme, toggleTheme }) {
    return (
        <div className="admin-section">
            <h3>Appearance</h3>
            <div className="admin-actions-grid">
                <div className="admin-action admin-action--full">
                    <button className="ct-btn" onClick={toggleTheme}>
                        <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                        Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatusDisplay({ status }) {
    if (!status) return null;
    const statusText = typeof status === 'string' ? BUSY_STATUS_TEXT[status] : null;
    const kind = typeof status === 'string' ? 'loading' : (status.error ? 'error' : 'success');
    return (
        <div className={`admin-status admin-status--${kind}`} role="status" aria-live="polite">
            {statusText ? (
                <span>
                    <i className="fas fa-spinner fa-spin"></i> {statusText}
                </span>
            ) : (
                <>
                    <i className={`fas ${status.error ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
                    {status.error ? status.error : status.success}
                </>
            )}
        </div>
    );
}

// Client mirror of createCampaignRenameGuard (server/utils/campaignLock.js):
// under a set-form lock ("primary,throwawayA,throwawayB") only a non-primary
// member may rename, and only onto another allowlisted name; the primary/
// harness campaign is never renamable. Lives outside the component to keep
// CampaignAdmin under the complexity cap.
function renameLockFlags(campaignLocked, lockNames, campaignName) {
    const renameWhileLocked = campaignLocked && lockNames.length > 1
        && campaignName !== lockNames[0] && lockNames.includes(campaignName);
    return {
        renameWhileLocked,
        renameDisabled: campaignLocked && !renameWhileLocked,
        allowedTargets: lockNames.filter((n) => n !== campaignName).join(', '),
    };
}

function RenameModal({ campaignName, newName, onNewNameChange, onClose, onSubmit, error, isBusy }) {
    const trimmed = newName.trim();
    const isUnchanged = trimmed !== '' && trimmed.toLowerCase() === campaignName.toLowerCase();
    return (
        <div className="ct-modal-overlay">
            <div className="ct-modal">
                <div className="ct-modal-header">
                    <h3>Rename Campaign</h3>
                    <button className="ct-modal-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="ct-modal-body">
                    <label className="ct-label" htmlFor="rename-campaign-input">New Campaign Name</label>
                    <input
                        id="rename-campaign-input"
                        className="ct-input"
                        type="text"
                        value={newName}
                        onChange={(e) => onNewNameChange(e.target.value)}
                        placeholder={campaignName}
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onSubmit();
                            if (e.key === 'Escape') onClose();
                        }}
                    />
                    {isUnchanged && (
                        <p className="admin-status admin-status--error">The campaign already has this name</p>
                    )}
                    {error && (
                        <p className="admin-status admin-status--error">{error}</p>
                    )}
                </div>
                <div className="ct-modal-footer">
                    <button className="ct-btn ct-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="ct-btn ct-btn-primary" onClick={onSubmit} disabled={!trimmed || isUnchanged || isBusy}>
                        {isBusy ? 'Renaming...' : 'Rename'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Toolbar "Rollback to Snapshot" modal content, derived on every render from
// the freshly fetched snapshot list (opened via handleRollback). A ready,
// non-empty list names the EXACT newest file and its relative age — mirroring
// the per-row Restore lane's naming. While the list is loading, failed to
// load, or is empty, the destructive Confirm stays natively disabled behind
// an explanatory note (fail-closed: this modal used to offer a blind confirm
// that only learned "No snapshot found" AFTER the user accepted).
function buildRollbackLatestModal(campaignName, snapshots, snapshotsState, onConfirm) {
    const overwriteCopy = `This will overwrite ALL current campaign data for "${campaignName}" with the latest snapshot on the server.`;
    if (snapshotsState === 'error') {
        return {
            title: 'Rollback Campaign',
            message: overwriteCopy,
            note: 'Could not load the snapshot list — close this dialog and try again.',
            confirmDisabled: true
        };
    }
    if (snapshotsState !== 'ready') {
        return {
            title: 'Rollback Campaign',
            message: overwriteCopy,
            note: 'Loading the snapshot list…',
            confirmDisabled: true
        };
    }
    const latest = getLatestSnapshot(snapshots);
    if (!latest) {
        return {
            title: 'Rollback Campaign',
            message: `There is nothing to roll back to — the server has no snapshots for "${campaignName}".`,
            note: 'No snapshots exist',
            confirmDisabled: true
        };
    }
    return {
        title: 'Rollback Campaign',
        message: `This will overwrite ALL current campaign data for "${campaignName}" with snapshot ${latest.filename} (${formatRelativeAge(latest.timestamp)}). All changes since the snapshot will be lost. This cannot be undone.`,
        onConfirm
    };
}

// Named-delete copy wrapper over the shared DeleteConfirmModal role="dialog"
// tier (the same one the map/POI/overlay lanes ride). Replaces the old native
// prompt→confirm→confirm→alert chain for campaign deletion (backlog
// 2026-11-04 CO): ONE confirm button, the exact-name gate typed INSIDE the
// dialog, mismatch surfaced as inline copy (see handleDeleteConfirm).
function DeleteCampaignModal({ campaignName, typedName, onTypedNameChange, error, onCancel, onConfirm }) {
    return (
        <DeleteConfirmModal
            titleId="delete-campaign-title"
            title="Delete Campaign"
            confirmLabel={`Delete "${campaignName}"`}
            onCancel={onCancel}
            onConfirm={onConfirm}
            typedConfirm={{
                label: `Type the exact campaign name to confirm deletion of "${campaignName}":`,
                value: typedName,
                onChange: onTypedNameChange,
            }}
            error={error}
        >
            This will permanently delete the entire campaign &apos;<strong>{campaignName}</strong>&apos;
            and ALL its files — characters, maps, encounters, quests, factions, notes,
            settlements, NPCs, and all runtime data. There is no recovery. This
            <strong> cannot be undone</strong>.
        </DeleteConfirmModal>
    );
}

// Regenerate-Adventure gate (backlog 2026-11-04 CS): the Admin starter lane's
// last native window.confirm migrated onto the shared DeleteConfirmModal
// role="dialog" tier — the same reuse precedent FriendlyFireConfirmModal set.
// The retired native copy lives here VERBATIM (minus the "Continue?" tail the
// explicit buttons now answer) so the table sees the exact same ask; the
// confirm label differs from the trigger button so role queries stay unique.
function RegenerateAdventureModal({ campaignName, onCancel, onConfirm }) {
    return (
        <DeleteConfirmModal
            titleId="regenerate-adventure-title"
            title="Regenerate Adventure"
            confirmLabel="Yes, Regenerate"
            onCancel={onCancel}
            onConfirm={onConfirm}
        >
            {`Regenerate the adventure in "${campaignName}"? A brand-new dungeon with fresh monsters and treasure replaces the current one, and the portal and main quest are re-pointed at it. The settlement, party, and log stay.`}
        </DeleteConfirmModal>
    );
}

function ConfirmModal({ modal, onClose }) {
    return (
        <div className="ct-modal-overlay">
            <div className="ct-modal">
                <div className="ct-modal-header">
                    <h3>{modal.title}</h3>
                    <button className="ct-modal-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="ct-modal-body">
                    <p>{modal.message}</p>
                    {modal.note && (
                        <p className="admin-snapshots-empty" role="status">{modal.note}</p>
                    )}
                </div>
                <div className="ct-modal-footer">
                    <button className="ct-btn ct-btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="ct-btn ct-btn-danger"
                        onClick={() => { onClose(); modal.onConfirm(); }}
                        disabled={modal.confirmDisabled}
                    >
                        <i className="fas fa-exclamation-triangle"></i> Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

function SnapshotList({ snapshots, onRestore, disabled }) {
    return (
        <div className="admin-snapshots">
            <h3>Available Snapshots</h3>
            {snapshots.length === 0 ? (
                <p className="admin-snapshots-empty">No snapshots on the server yet.</p>
            ) : (
                <ul className="admin-snapshots-list">
                    {snapshots.map((snapshot) => (
                        <li key={snapshot.filename} className="admin-snapshot-row">
                            <span className="admin-snapshot-name">{snapshot.filename}</span>
                            <span className="admin-snapshot-meta">
                                {formatSnapshotDate(snapshot.timestamp)} · {formatBytes(snapshot.size)}
                            </span>
                            <button
                                className="ct-btn ct-btn-danger admin-snapshot-restore"
                                onClick={() => onRestore(snapshot)}
                                disabled={disabled}
                                aria-label={`Restore "${snapshot.filename}"`}
                            >
                                <i className="fas fa-undo"></i> Restore
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function CampaignAdmin({ campaignName, theme, toggleTheme, onRenameCampaign, restoredSnapshot, characters = [], isLocalhost = false }) {
    const [status, setStatus] = useState(null);
    const [renameModal, setRenameModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [renameError, setRenameError] = useState(null);
    const [renaming, setRenaming] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);
    // Toolbar rollback lane: modal open flag + snapshot-list load state, so
    // the warning copy names the exact snapshot the server would restore and
    // Confirm can stay disabled until the list lands (or forever at zero).
    const [rollbackModal, setRollbackModal] = useState(false);
    const [snapshots, setSnapshots] = useState([]);
    const [snapshotsState, setSnapshotsState] = useState('loading');
    // Campaign-lock state from GET /api/server-config. Fail-open default:
    // the Rename button stays enabled until the server explicitly reports a
    // lock (mirrors the snapshots pattern — a failed GET never blocks the
    // normal unlocked flow). A set-form lock ("primary,throwawayA,throwawayB")
    // additionally lets a THROWAWAY member rename onto another allowlisted
    // name — the client mirror of createCampaignRenameGuard (see derived
    // flags below); the primary/harness campaign and single-name locks stay
    // disabled up front, since the server 403s those mid-flow (live incident
    // 2026-10-28).
    const [campaignLocked, setCampaignLocked] = useState(false);
    const [lockNames, setLockNames] = useState([]);
    // Starter adventure lane: non-null after load iff this campaign carries a
    // starter-seed document (seeded quick-create). Drives the Regenerate card.
    const [starterSeed, setStarterSeed] = useState(null);
    // Delete-Campaign lane (role=dialog tier, backlog 2026-11-04 CO): modal
    // open flag, the typed exact-name draft, and inline mismatch/failure copy.
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTypedName, setDeleteTypedName] = useState('');
    const [deleteError, setDeleteError] = useState(null);
    // Regenerate-Adventure gate (role=dialog tier, backlog 2026-11-04 CS):
    // ephemeral modal-open flag only — the mutation itself stays in
    // confirmRegenerateAdventure, mirroring the old confirm→work shape.
    const [regenModalOpen, setRegenModalOpen] = useState(false);
    // The upload file input, so a dismissed (cancelled) Upload confirm can
    // reset it — otherwise the cancelled file stays selected and re-choosing
    // the SAME file fires no change event (silent no-op).
    const uploadInputRef = useRef(null);

    const isBusy = status && typeof status === 'string';
    const { renameWhileLocked, renameDisabled, allowedTargets } =
        renameLockFlags(campaignLocked, lockNames, campaignName);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/server-config');
                const data = await res.json();
                if (!cancelled && res.ok) {
                    setCampaignLocked(data.campaignLocked === true);
                    setLockNames(typeof data.lockedCampaign === 'string'
                        ? data.lockedCampaign.split(',').map((n) => n.trim()).filter(Boolean)
                        : []);
                }
            } catch (err) {
                console.error('Failed to load server config:', err.message);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Starter seed probe — a missing document (regular campaign) answers
    // { seed: null }, so the Regenerate card stays hidden without error noise.
    useEffect(() => {
        let cancelled = false;
        loadStarterSeed(campaignName)
            .then(seed => { if (!cancelled) setStarterSeed(seed); })
            .catch(() => { if (!cancelled) setStarterSeed(null); });
        return () => { cancelled = true; };
    }, [campaignName]);

    const loadSnapshots = useCallback(async () => {
        setSnapshotsState('loading');
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/snapshots`);
            const data = await res.json();
            if (!res.ok || !Array.isArray(data.snapshots)) {
                console.error('Failed to load snapshots:', data.error || res.status);
                setSnapshotsState('error');
                return;
            }
            setSnapshots(data.snapshots);
            setSnapshotsState('ready');
        } catch (err) {
            console.error('Failed to load snapshots:', err.message);
            setSnapshotsState('error');
        }
    }, [campaignName]);

    useEffect(() => {
        loadSnapshots();
    }, [loadSnapshots]);

    // Starter adventure regenerate (arena-starter §3.2): the old native
    // window.confirm gate now opens the shared RegenerateAdventureModal
    // (role=dialog tier, backlog 2026-11-04 CS); the mutation runs
    // UNCHANGED from the modal's Confirm — Re-rolls dungeon/monsters/
    // treasure through the shared orchestrator; settlement and party stay
    // untouched, and the orchestrator appends one adventure_regenerated
    // audit row to the campaign log. Cancel is fully inert: no status, no
    // request.
    const confirmRegenerateAdventure = async () => {
        setRegenModalOpen(false);
        setStatus('regenerating-adventure');
        try {
            const result = await regenerateAdventure(campaignName);
            setStarterSeed(await loadStarterSeed(campaignName));
            // The first-session checklist (this tab AND every other open tab)
            // refreshes from the server's starter-seed-<campaign> SSE
            // broadcast — the PUT /starter-seed in regenerateAdventure
            // publishes the updated document (no local window event needed).
            setStatus({ success: `New adventure rolled: ${result.dungeonTitle} — waves re-rolled, portal and main quest re-pointed.` });
        } catch (err) {
            setStatus({ error: err.message });
        }
    };

    const handleClearChangeData = async () => {
        if (!window.confirm(`This will clear all runtime state for "${campaignName}" including HP, conditions, spell slots, death saves, and target effects. You will need to re-establish combat state. Continue?`)) {
            return;
        }
        setStatus('clearing-change-data');
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/clear-change-data`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setStatus({ error: data.error });
            } else {
                setStatus({ success: data.message });
            }
        } catch (err) {
            setStatus({ error: err.message });
        }
    };

    const handleClearLog = async () => {
        if (!window.confirm(`This will permanently delete the campaign log for "${campaignName}". Roll history will be lost. Continue?`)) {
            return;
        }
        setStatus('clearing-log');
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/clear-log`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setStatus({ error: data.error });
            } else {
                setStatus({ success: data.message });
            }
        } catch (err) {
            setStatus({ error: err.message });
        }
    };

    const handleFullReset = async () => {
        if (!window.confirm(`FULL RESET: This will delete both the campaign log AND all change data for "${campaignName}". All runtime state will be lost. This cannot be undone. Continue?`)) {
            return;
        }
        setStatus('resetting');
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/full-reset`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setStatus({ error: data.error });
            } else {
                setStatus({ success: data.message });
                // Align with the rollback/upload-success lanes: the acting tab
                // reloads so its React state (sidebar, sheet, runtime store)
                // reflects the wipe immediately instead of serving stale
                // in-memory data until the next manual refresh. Other tabs get
                // the reload notice via the SSE broadcast (CampaignReloadNotice).
                window.location.reload();
            }
        } catch (err) {
            setStatus({ error: err.message });
        }
    };

    const handleRenameSubmit = async () => {
        const trimmed = newName.trim();
        if (!trimmed || !campaignName || trimmed.toLowerCase() === campaignName.toLowerCase()) return;
        if (renameWhileLocked && !lockNames.includes(trimmed)) {
            setRenameError(`While the campaign is locked, you can only rename to an allowlisted name: ${allowedTargets || '(none configured — add a destination to CAMPAIGN_LOCK)'}`);
            return;
        }
        setRenameError(null);
        setRenaming(true);
        try {
            await onRenameCampaign(trimmed);
            // Success reloads the page (or leaves the app renamed) — clear the draft.
            setRenameModal(false);
            setNewName('');
        } catch (err) {
            // Keep the modal open with the draft so the server error (e.g.
            // "Campaign already exists") is surfaced in-context, like the
            // maps-manager rename inline errors.
            setRenameError(err.message || 'Failed to rename campaign');
        } finally {
            setRenaming(false);
        }
    };

    const openDeleteModal = () => {
        setDeleteTypedName('');
        setDeleteError(null);
        setDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setDeleteModalOpen(false);
        setDeleteError(null);
    };

    // Delete-Campaign gate inside the dialog: a mismatched (or empty) typed
    // name surfaces inline copy and keeps the dialog open; the exact name
    // fires the single DELETE. Success reloads onto the refreshed campaign
    // selection — the same hand-off the old success alert + reload had, with
    // zero native dialogs anywhere in the flow (backlog 2026-11-04 CO).
    const handleDeleteConfirm = async () => {
        if (deleteTypedName !== campaignName) {
            setDeleteError('Campaign name did not match. Deletion cancelled.');
            return;
        }
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) {
                setDeleteError('Failed to delete campaign: ' + (data.error || 'Unknown error'));
                return;
            }
            // Post-delete carry-over (mirrors the postRestoreNotice handoff
            // below): one-shot sessionStorage notice the campaign-selection
            // page consumes + clears to render "<name> deleted successfully!"
            // across this reload boundary (backlog CP 2026-11-04: the retired
            // success alert left the vanished row as the only signal).
            // UI feedback only — never game state.
            try {
                sessionStorage.setItem('postDeleteNotice', JSON.stringify({ campaign: campaignName }));
            } catch (err) {
                console.error('Failed to store post-delete notice:', err);
            }
            window.location.reload();
        } catch (err) {
            setDeleteError('Failed to delete campaign: ' + err.message);
        }
    };

    const handleSnapshot = async () => {
        setStatus('snapshotting');
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/snapshot`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setStatus({ error: data.error });
            } else {
                setStatus({ success: `Snapshot created: ${data.filename} (${formatBytes(data.size)})` });
                await loadSnapshots();
            }
        } catch (err) {
            setStatus({ error: err.message });
        }
    };

    // Shared destructive machinery for both rollback lanes: the POST (no
    // filename → server's legacy newest-first behavior, exact filename →
    // per-row lane), postRestoreNotice handoff, acting-tab reload. Everything
    // BEFORE this (which message, disabled gate) is lane-specific.
    const runRollback = async (filename) => {
        setStatus('rolling-back');
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/rollback`, {
                method: 'POST',
                ...(filename ? {
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename })
                } : {})
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus({ error: data.error });
            } else {
                setStatus({ success: data.message });
                try {
                    sessionStorage.setItem('postRestoreNotice', JSON.stringify({ campaign: campaignName, restored: data.restored }));
                } catch (err) {
                    console.error('Failed to store post-restore notice:', err);
                }
                window.location.reload();
            }
        } catch (err) {
            setStatus({ error: err.message });
        }
    };

    // Per-row Restore lane: static message naming the exact snapshot.
    const openRollbackConfirm = (message, filename) => {
        setConfirmModal({
            title: 'Rollback Campaign',
            message,
            onConfirm: () => runRollback(filename)
        });
    };

    // Toolbar lane: open the modal immediately and REFRESH the snapshot list
    // so its copy names the exact newest file + age once loaded (Confirm is
    // disabled until then, and permanently at zero). The POST stays body-less
    // — the server's newest-first selection is unchanged.
    const handleRollback = () => {
        setRollbackModal(true);
        loadSnapshots();
    };

    const handleRestoreSnapshot = (snapshot) => {
        openRollbackConfirm(`This will overwrite ALL current campaign data for "${campaignName}" with the snapshot "${snapshot.filename}". All changes since that snapshot will be lost. This cannot be undone.`, snapshot.filename);
    };

    const handleDownload = async () => {
        setStatus('downloading');
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/download`);
            if (!res.ok) {
                const data = await res.json();
                setStatus({ error: data.error });
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${campaignName}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            setStatus({ success: 'Download started' });
        } catch (err) {
            setStatus({ error: err.message });
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        const input = e.target;
        if (!file) return;
        if (!file.name.endsWith('.zip')) {
            setStatus({ error: 'Please select a .zip file' });
            clearFileInput(input);
            return;
        }
        // Pre-flight size gate mirroring the server's multer limit, so an
        // oversized archive is rejected instantly instead of after a long
        // failed POST round-trip.
        if (file.size > UPLOAD_SIZE_LIMIT_BYTES) {
            setStatus({ error: `File too large (limit ${UPLOAD_SIZE_LIMIT_MB} MB)` });
            clearFileInput(input);
            return;
        }
        // Read-only server sniff of the archive BEFORE the destructive
        // confirm gate: an empty/foreign/corrupt zip never reaches a state
        // where Confirm could wipe the campaign.
        const recognisable = await inspectUploadArchive(campaignName, file, setStatus, input);
        if (!recognisable) return;
        setConfirmModal({
            title: 'Upload Campaign',
            message: `This will replace ALL current campaign data for "${campaignName}" with the contents of "${file.name}". A snapshot of the current state will be saved first as a safety net. If the upload or reload fails, the campaign will be automatically rolled back.`,
            onConfirm: async () => {
                setStatus('uploading');
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/upload`, {
                        method: 'POST',
                        body: formData
                    });
                    // Parse defensively: anything that fails before the route
                    // body (or a generic server error page) may not be JSON,
                    // and res.json() on such a body throws in here.
                    const isJson = (res.headers.get('content-type') || '').includes('json');
                    const data = isJson
                        ? await res.json().catch(() => ({ error: `Server returned an invalid JSON response (HTTP ${res.status})` }))
                        : { error: `Server returned a non-JSON error response (HTTP ${res.status})` };
                    if (res.ok) {
                        setStatus({ success: data.message });
                        window.location.reload();
                    } else {
                        const details = data.details ? `: ${data.details}` : '';
                        setStatus({ error: `${data.error}${details}` });
                        // Only the route body reports failures as HTTP 500 JSON,
                        // and only it runs after the safety snapshot (so those
                        // failures genuinely self-restore). Pre-route rejections
                        // (413 oversize, 400/403/404, non-JSON error pages) never
                        // touched campaign data — claiming a rollback there is false.
                        if (res.status === 500 && isJson) {
                            alert(`Upload failed. Campaign has been rolled back to the previous state.\n\nError: ${data.error}${data.details ? '\nDetails: ' + data.details : ''}`);
                        } else {
                            alert(`Upload failed before any campaign data was replaced.\n\nError: ${data.error}${data.details ? '\nDetails: ' + data.details : ''}`);
                        }
                    }
                } catch (err) {
                    setStatus({ error: err.message });
                    alert(`Upload failed. The request did not complete, so no changes were confirmed.\n\nError: ${err.message}`);
                }
                clearFileInput(input);
            }
        });
    };

    const handleConfirmModalClose = () => {
        // Dismissing the Upload confirmation without confirming must reset the
        // file input, otherwise it keeps the cancelled file and re-choosing the
        // SAME file fires no change event (the button looks dead). Clearing the
        // status too keeps the line honest about the latest action. (The
        // confirm path holds its own File reference, so resetting the input
        // here never affects an in-flight upload.)
        if (confirmModal?.title === 'Upload Campaign') {
            clearFileInput(uploadInputRef.current);
            setStatus(null);
        }
        setConfirmModal(null);
    };

    return (
        <div className="ct-container campaign-admin">
            <AdminHeader campaignName={campaignName} />

            {restoredSnapshot && (
                <div className="admin-status admin-status--success" role="status">
                    <i className="fas fa-check-circle"></i> Campaign restored from {restoredSnapshot}
                </div>
            )}

            <AppearanceSection theme={theme} toggleTheme={toggleTheme} />

            {/* L5-001: enforcement master switch + sub-flags (default OFF ⇒ L1–4 as-is). */}
            <EnforcementSection campaignName={campaignName} />

            {/* L5 Phase 4 §10: session state machine console + enforcement/AI audit ledger. */}
            <SessionSection campaignName={campaignName} />

            {/* L5-005 §9.2: AI referee console (aiConfig unset/off ⇒ no console, no traffic). */}
            <AiRefereeSection campaignName={campaignName} characters={characters} />

            <div className="admin-section">
                <h3>Campaign Management</h3>
                <div className="admin-actions-grid">
                    <div className="admin-action">
                        <h3>Rename Campaign</h3>
                        <p>Changes the display name. Character files, maps, and data are preserved.</p>
                        <button
                            className="ct-btn ct-btn-primary"
                            onClick={() => { setRenameError(null); setRenameModal(true); }}
                            disabled={renameDisabled}
                        >
                            <i className="fas fa-pen"></i> Rename Campaign
                        </button>
                        {renameDisabled && (
                            <p className="admin-lock-note">Disabled while campaign is locked</p>
                        )}
                        {renameWhileLocked && (
                            <p className="admin-lock-note">Locked: renames allowed only between the allowlisted campaigns ({allowedTargets})</p>
                        )}
                    </div>
                    <div className="admin-action admin-action--danger">
                        <h3>Delete Campaign</h3>
                        <p>Permanently deletes the entire campaign and ALL its files. This cannot be undone.</p>
                        <button className="ct-btn ct-btn-danger" onClick={openDeleteModal}>
                            <i className="fas fa-exclamation-triangle"></i> Delete Campaign
                        </button>
                    </div>
                </div>
            </div>

            {starterSeed && (
                <div className="admin-section">
                    <h3>Starter Adventure</h3>
                    <div className="admin-actions-grid">
                        <div className="admin-action">
                            <h3>Regenerate Adventure</h3>
                            <p>
                                Re-rolls the dungeon (<strong>{starterSeed.entities?.dungeonTitle}</strong>),
                                the Wave monster line-ups, and the treasure, then re-points the portal and
                                main quest. The village, party, and campaign log stay exactly as they are.
                            </p>
                            {isLocalhost ? (
                                // backlog 2026-11-04 CU: testid pins the PRIMARY action so
                                // role/testid queries can never land on the checklist's
                                // Admin deep-link step button.
                                <button className="ct-btn ct-btn-primary" data-testid="regenerate-adventure-btn" onClick={() => setRegenModalOpen(true)} disabled={isBusy}>
                                    <i className="fas fa-dice"></i> Regenerate Adventure
                                </button>
                            ) : (
                                <p className="admin-lock-note">GM-only (localhost)</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="admin-section">
                <h3>Data Management</h3>
                <div className="admin-actions-grid">
                    <div className="admin-action">
                        <h3>Clear Change Data</h3>
                        <p>Removes all runtime state (HP, conditions, spell slots, death saves, target effects, active buffs, and position data).</p>
                        <button className="ct-btn ct-btn-primary" onClick={handleClearChangeData} disabled={isBusy}>
                            <i className="fas fa-eraser"></i> Clear Change Data
                        </button>
                    </div>
                    <div className="admin-action">
                        <h3>Clear Campaign Log</h3>
                        <p>Deletes all entries from the campaign log. Roll history, combat events, and ability use records will be permanently lost.</p>
                        <button className="ct-btn ct-btn-primary" onClick={handleClearLog} disabled={isBusy}>
                            <i className="fas fa-trash"></i> Clear Campaign Log
                        </button>
                    </div>
                    <div className="admin-action admin-action--danger">
                        <h3>Full Reset</h3>
                        <p>Clears both the campaign log and change data in one action. Use to fix corrupted campaign state.</p>
                        <button className="ct-btn ct-btn-danger" onClick={handleFullReset} disabled={isBusy}>
                            <i className="fas fa-exclamation-triangle"></i> Full Reset
                        </button>
                    </div>
                </div>
            </div>

            <div className="admin-section">
                <h3>Backup &amp; Restore</h3>
                <div className="admin-actions-grid">
                    <div className="admin-action">
                        <h3>Snapshot</h3>
                        <p>Creates a timestamped zip backup of the entire campaign folder on the server. Snapshots are kept (newest 10) and never overwrite each other, so you can roll back more than one step.</p>
                        <button className="ct-btn ct-btn-primary" onClick={handleSnapshot} disabled={isBusy}>
                            <i className="fas fa-camera"></i> Create Snapshot
                        </button>
                    </div>
                    <div className="admin-action">
                        <h3>Download</h3>
                        <p>Downloads the entire campaign folder as a .zip file to your computer.</p>
                        <button className="ct-btn ct-btn-primary" onClick={handleDownload} disabled={isBusy}>
                            <i className="fas fa-download"></i> Download Campaign
                        </button>
                    </div>
                    <div className="admin-action admin-action--danger">
                        <h3>Rollback</h3>
                        <p>Restores the campaign to the last snapshot. All changes since the snapshot will be lost.</p>
                        <button className="ct-btn ct-btn-danger" onClick={handleRollback} disabled={isBusy}>
                            <i className="fas fa-undo"></i> Rollback to Snapshot
                        </button>
                    </div>
                    <div className="admin-action">
                        <h3>Upload</h3>
                        <p>Replaces the current campaign with an uploaded .zip file. A safety snapshot is saved first and used if upload fails.</p>
                        <label className="ct-btn ct-btn-primary admin-upload-label">
                            <i className="fas fa-upload"></i> Upload Campaign
                            <input type="file" accept=".zip" ref={uploadInputRef} onChange={handleUpload} disabled={isBusy} />
                        </label>
                    </div>
                </div>

                <SnapshotList snapshots={snapshots} onRestore={handleRestoreSnapshot} disabled={isBusy} />
            </div>

            <StatusDisplay status={status} />

            {renameModal && (
                <RenameModal
                    campaignName={campaignName}
                    newName={newName}
                    onNewNameChange={setNewName}
                    onClose={() => setRenameModal(false)}
                    onSubmit={handleRenameSubmit}
                    error={renameError}
                    isBusy={renaming}
                />
            )}

            {deleteModalOpen && (
                <DeleteCampaignModal
                    campaignName={campaignName}
                    typedName={deleteTypedName}
                    onTypedNameChange={setDeleteTypedName}
                    error={deleteError}
                    onCancel={closeDeleteModal}
                    onConfirm={handleDeleteConfirm}
                />
            )}

            {regenModalOpen && (
                <RegenerateAdventureModal
                    campaignName={campaignName}
                    onCancel={() => setRegenModalOpen(false)}
                    onConfirm={confirmRegenerateAdventure}
                />
            )}

            {confirmModal && (
                <ConfirmModal modal={confirmModal} onClose={handleConfirmModalClose} />
            )}

            {rollbackModal && (
                <ConfirmModal
                    modal={buildRollbackLatestModal(campaignName, snapshots, snapshotsState, () => runRollback())}
                    onClose={() => setRollbackModal(false)}
                />
            )}
        </div>
    );
}

export default CampaignAdmin;
