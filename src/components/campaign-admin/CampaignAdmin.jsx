import React, { useState } from 'react';
import './CampaignAdmin.css';

function CampaignAdmin({ campaignName, onBack, theme, toggleTheme, onRenameCampaign }) {
    const [status, setStatus] = useState(null);
    const [renameModal, setRenameModal] = useState(false);
    const [newName, setNewName] = useState('');

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

    return (
        <div className="ct-container campaign-admin">
            <div className="ct-header">
                <button className="ct-back-btn" onClick={onBack}>
                    <i className="fas fa-arrow-left"></i> Back
                </button>
                <h2>Admin — {campaignName}</h2>
            </div>

            <div className="admin-intro">
                <p>
                    GM-only tools for managing your campaign. Theme switching, campaign rename and delete,
                    and data management actions are all available below.
                </p>
            </div>

            <div className="admin-section">
                <h3>Appearance</h3>
                <div className="admin-theme-toggle">
                    <button className="ct-btn" onClick={toggleTheme}>
                        <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                        Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
                    </button>
                </div>
            </div>

            <div className="admin-section">
                <div className="admin-action">
                    <h3>Rename Campaign</h3>
                    <p>
                        Changes the display name of this campaign. Character files, maps, and data
                        are preserved.
                    </p>
                    <button className="ct-btn ct-btn-primary" onClick={() => setRenameModal(true)}>
                        <i className="fas fa-pen"></i> Rename Campaign
                    </button>
                </div>

                <div className="admin-action admin-action--danger">
                    <h3>Delete Campaign</h3>
                    <p>
                        Permanently deletes the entire campaign and ALL its files — characters, maps,
                        encounters, quests, factions, notes, settlements, NPCs, and all runtime data.
                        This cannot be undone. You will need to type the campaign name to confirm.
                    </p>
                    <button className="ct-btn ct-btn-danger" onClick={handleDeleteCampaign}>
                        <i className="fas fa-exclamation-triangle"></i> Delete Campaign
                    </button>
                </div>

            </div>

            <div className="admin-section">
                <div className="admin-action">
                    <h3>Clear Change Data</h3>
                    <p>
                        Removes all runtime state (HP, conditions, spell slots, death saves, target effects,
                        active buffs, and position data). The character base files are untouched.
                        You will need to re-establish combat state.
                    </p>
                    <button className="ct-btn ct-btn-primary" onClick={handleClearChangeData}>
                        <i className="fas fa-eraser"></i> Clear Change Data
                    </button>
                </div>

                <div className="admin-action">
                    <h3>Clear Campaign Log</h3>
                    <p>
                        Deletes all entries from the campaign log. Roll history, combat events, and
                        ability use records will be permanently lost.
                    </p>
                    <button className="ct-btn ct-btn-primary" onClick={handleClearLog}>
                        <i className="fas fa-trash"></i> Clear Campaign Log
                    </button>
                </div>

                <div className="admin-action admin-action--danger">
                    <h3>Full Reset</h3>
                    <p>
                        Clears both the campaign log and change data in one action.
                        This is usually what you want to fix a corrupted campaign state.
                    </p>
                    <button className="ct-btn ct-btn-danger" onClick={handleFullReset}>
                        <i className="fas fa-exclamation-triangle"></i> Full Reset
                    </button>
                </div>
            </div>

            {status && (
                <div className={`admin-status admin-status--${typeof status === 'string' ? 'loading' : status.error ? 'error' : 'success'}`}>
                    {typeof status === 'string' ? (
                        <span>
                            <i className="fas fa-spinner fa-spin"></i> {status === 'clearing-change-data' ? 'Clearing change data...' : status === 'clearing-log' ? 'Clearing log...' : 'Performing full reset...'}
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
        </div>
    );
}

export default CampaignAdmin;
