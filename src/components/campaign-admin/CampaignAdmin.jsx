import React, { useState, useEffect, useCallback } from 'react';
import './CampaignAdmin.css';
import EnforcementSection from './EnforcementSection.jsx';
import AiRefereeSection from './AiRefereeSection.jsx';
import SessionSection from './SessionSection.jsx';

// Keep in sync with UPLOAD_SIZE_LIMIT in server/routes/campaigns-admin.js —
// the server remains authoritative; this only fronts the rejection.
const UPLOAD_SIZE_LIMIT_MB = 100;
const UPLOAD_SIZE_LIMIT_BYTES = UPLOAD_SIZE_LIMIT_MB * 1024 * 1024;

const BUSY_STATUS_TEXT = {
    'snapshotting': 'Creating snapshot...',
    'rolling-back': 'Rolling back...',
    'downloading': 'Preparing download...',
    'uploading': 'Uploading and extracting...',
    'clearing-change-data': 'Clearing change data...',
    'clearing-log': 'Clearing log...',
    'resetting': 'Performing full reset...'
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

function AdminHeader({ campaignName, onBack }) {
    return (
        <div className="ct-header">
            <button className="ct-back-btn" onClick={onBack}>
                <i className="fas fa-arrow-left"></i> Back
            </button>
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
        <div className={`admin-status admin-status--${kind}`}>
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
                </div>
                <div className="ct-modal-footer">
                    <button className="ct-btn ct-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="ct-btn ct-btn-danger" onClick={() => { onClose(); modal.onConfirm(); }}>
                        <i className="fas fa-exclamation-triangle"></i> Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

function SnapshotList({ snapshots }) {
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
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function CampaignAdmin({ campaignName, onBack, theme, toggleTheme, onRenameCampaign, restoredSnapshot, characters = [] }) {
    const [status, setStatus] = useState(null);
    const [renameModal, setRenameModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [renameError, setRenameError] = useState(null);
    const [renaming, setRenaming] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    // Campaign-lock state from GET /api/server-config. Fail-open default:
    // the Rename button stays enabled until the server explicitly reports a
    // lock (mirrors the snapshots pattern — a failed GET never blocks the
    // normal unlocked flow). Under CAMPAIGN_LOCK the revert PUT of a rename
    // targets the renamed folder and 403s opaquely mid-flow, so we disable
    // the affordance up front instead.
    const [campaignLocked, setCampaignLocked] = useState(false);

    const isBusy = status && typeof status === 'string';

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/server-config');
                const data = await res.json();
                if (!cancelled && res.ok) {
                    setCampaignLocked(data.campaignLocked === true);
                }
            } catch (err) {
                console.error('Failed to load server config:', err.message);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const loadSnapshots = useCallback(async () => {
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/snapshots`);
            const data = await res.json();
            if (!res.ok) {
                console.error('Failed to load snapshots:', data.error || res.status);
                return;
            }
            if (Array.isArray(data.snapshots)) {
                setSnapshots(data.snapshots);
            }
        } catch (err) {
            console.error('Failed to load snapshots:', err.message);
        }
    }, [campaignName]);

    useEffect(() => {
        loadSnapshots();
    }, [loadSnapshots]);

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
            }
        } catch (err) {
            setStatus({ error: err.message });
        }
    };

    const handleRenameSubmit = async () => {
        const trimmed = newName.trim();
        if (!trimmed || !campaignName || trimmed.toLowerCase() === campaignName.toLowerCase()) return;
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

    const handleDeleteCampaign = async () => {
        const charCount = window.prompt(`Type the exact campaign name to confirm deletion of "${campaignName}":`);
        if (charCount !== campaignName) {
            if (charCount !== null) {
                alert('Campaign name did not match. Deletion cancelled.');
            }
            return;
        }
        if (!window.confirm(`WARNING: This will permanently delete the entire campaign "${campaignName}" and ALL its files including characters, maps, encounters, quests, factions, notes, settlements, NPCs, and all runtime data. This CANNOT be undone. Are you absolutely sure?`)) {
            return;
        }
        if (!window.confirm(`FINAL WARNING: ${campaignName} will be completely erased from the server. There is no recovery. Proceed?`)) {
            return;
        }
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) {
                alert('Failed to delete campaign: ' + (data.error || 'Unknown error'));
            } else {
                alert('Campaign deleted successfully.');
                window.location.reload();
            }
        } catch (err) {
            alert('Failed to delete campaign: ' + err.message);
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

    const handleRollback = () => {
        setConfirmModal({
            title: 'Rollback Campaign',
            message: `This will overwrite ALL current campaign data for "${campaignName}" with the last snapshot. All changes since the snapshot will be lost. This cannot be undone.`,
            onConfirm: async () => {
                setStatus('rolling-back');
                try {
                    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/admin/rollback`, { method: 'POST' });
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
            }
        });
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
        if (!file) return;
        if (!file.name.endsWith('.zip')) {
            setStatus({ error: 'Please select a .zip file' });
            e.target.value = '';
            return;
        }
        // Pre-flight size gate mirroring the server's multer limit, so an
        // oversized archive is rejected instantly instead of after a long
        // failed POST round-trip.
        if (file.size > UPLOAD_SIZE_LIMIT_BYTES) {
            setStatus({ error: `File too large (limit ${UPLOAD_SIZE_LIMIT_MB} MB)` });
            e.target.value = '';
            return;
        }
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
                e.target.value = '';
            }
        });
    };

    return (
        <div className="ct-container campaign-admin">
            <AdminHeader campaignName={campaignName} onBack={onBack} />

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
                            disabled={campaignLocked}
                        >
                            <i className="fas fa-pen"></i> Rename Campaign
                        </button>
                        {campaignLocked && (
                            <p className="admin-lock-note">Disabled while campaign is locked</p>
                        )}
                    </div>
                    <div className="admin-action admin-action--danger">
                        <h3>Delete Campaign</h3>
                        <p>Permanently deletes the entire campaign and ALL its files. This cannot be undone.</p>
                        <button className="ct-btn ct-btn-danger" onClick={handleDeleteCampaign}>
                            <i className="fas fa-exclamation-triangle"></i> Delete Campaign
                        </button>
                    </div>
                </div>
            </div>

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
                            <input type="file" accept=".zip" onChange={handleUpload} disabled={isBusy} />
                        </label>
                    </div>
                </div>

                <SnapshotList snapshots={snapshots} />
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

            {confirmModal && (
                <ConfirmModal modal={confirmModal} onClose={() => setConfirmModal(null)} />
            )}
        </div>
    );
}

export default CampaignAdmin;
