import React, { useState } from 'react';
import './CampaignAdmin.css';

function CampaignAdmin({ campaignName, onBack, theme, toggleTheme, onRenameCampaign }) {
    const [status, setStatus] = useState(null);
    const [renameModal, setRenameModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [confirmModal, setConfirmModal] = useState(null);

    const isBusy = status && typeof status === 'string';

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
        if (!newName.trim()) return;
        setRenameModal(false);
        setNewName('');
        await onRenameCampaign(newName.trim());
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
                setStatus({ success: `Snapshot created (${(data.size / 1024).toFixed(1)} KB)` });
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
                    const data = await res.json();
                    if (!res.ok) {
                        setStatus({ error: `${data.error}${data.details ? ': ' + data.details : ''}` });
                        alert(`Upload failed. Campaign has been rolled back to the previous state.\n\nError: ${data.error}${data.details ? '\nDetails: ' + data.details : ''}`);
                    } else {
                        setStatus({ success: data.message });
                        window.location.reload();
                    }
                } catch (err) {
                    setStatus({ error: err.message });
                    alert(`Upload failed. Campaign has been rolled back to the previous state.\n\nError: ${err.message}`);
                }
                e.target.value = '';
            }
        });
    };

    const statusText = isBusy ? (
        status === 'snapshotting' ? 'Creating snapshot...' :
        status === 'rolling-back' ? 'Rolling back...' :
        status === 'downloading' ? 'Preparing download...' :
        status === 'uploading' ? 'Uploading and extracting...' :
        status === 'clearing-change-data' ? 'Clearing change data...' :
        status === 'clearing-log' ? 'Clearing log...' :
        'Performing full reset...'
    ) : null;

    return (
        <div className="ct-container campaign-admin">
            <div className="ct-header">
                <button className="ct-back-btn" onClick={onBack}>
                    <i className="fas fa-arrow-left"></i> Back
                </button>
                <h2>Admin — {campaignName}</h2>
            </div>

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

            <div className="admin-section">
                <h3>Campaign Management</h3>
                <div className="admin-actions-grid">
                    <div className="admin-action">
                        <h3>Rename Campaign</h3>
                        <p>Changes the display name. Character files, maps, and data are preserved.</p>
                        <button className="ct-btn ct-btn-primary" onClick={() => setRenameModal(true)}>
                            <i className="fas fa-pen"></i> Rename Campaign
                        </button>
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
                        <p>Creates a zip backup of the entire campaign folder on the server. This snapshot can be used to rollback if something goes wrong.</p>
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
            </div>

            {status && (
                <div className={`admin-status admin-status--${typeof status === 'string' ? 'loading' : status.error ? 'error' : 'success'}`}>
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
            )}

            {renameModal && (
                <div className="ct-modal-overlay" onClick={() => setRenameModal(false)}>
                    <div className="ct-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ct-modal-header">
                            <h3>Rename Campaign</h3>
                            <button className="ct-modal-close" onClick={() => setRenameModal(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="ct-modal-body">
                            <label className="ct-label">New Campaign Name</label>
                            <input
                                className="ct-input"
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={campaignName}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameSubmit();
                                    if (e.key === 'Escape') setRenameModal(false);
                                }}
                            />
                        </div>
                        <div className="ct-modal-footer">
                            <button className="ct-btn ct-btn-secondary" onClick={() => setRenameModal(false)}>Cancel</button>
                            <button className="ct-btn ct-btn-primary" onClick={handleRenameSubmit} disabled={!newName.trim()}>Rename</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmModal && (
                <div className="ct-modal-overlay" onClick={() => setConfirmModal(null)}>
                    <div className="ct-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ct-modal-header">
                            <h3>{confirmModal.title}</h3>
                            <button className="ct-modal-close" onClick={() => setConfirmModal(null)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="ct-modal-body">
                            <p>{confirmModal.message}</p>
                        </div>
                        <div className="ct-modal-footer">
                            <button className="ct-btn ct-btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
                            <button className="ct-btn ct-btn-danger" onClick={() => { setConfirmModal(null); confirmModal.onConfirm(); }}>
                                <i className="fas fa-exclamation-triangle"></i> Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CampaignAdmin;
