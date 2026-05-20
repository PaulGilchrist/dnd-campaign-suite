import { useState, useEffect, useCallback } from 'react';
import * as mapsService from '../../services/mapsService.js';
import Subscriber from '../common/Subscriber.jsx';
import GenerateDungeonModal from './GenerateDungeonModal.jsx';
import './MapsManager.css';

function MapsManager({ campaignName, onOpenMap, onBack }) {
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createName, setCreateName] = useState('');
    const [renamingMap, setRenamingMap] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [deletingMap, setDeletingMap] = useState(null);
    const [error, setError] = useState(null);
    const [showGenerateModal, setShowGenerateModal] = useState(false);

    const loadMapsList = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await mapsService.loadMaps(campaignName);
            setMaps(data.maps || []);
        } catch (err) {
            setError(err.message || 'Failed to load maps');
        } finally {
            setLoading(false);
        }
    }, [campaignName]);

    useEffect(() => {
        loadMapsList();
    }, [loadMapsList]);

    // SSE handler — re-fetch maps list on any maps-list event
    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.key) return;
        const expectedKey = `maps-list-${campaignName}`;
        if (event.key !== expectedKey) return;
        loadMapsList();
    }, [campaignName, loadMapsList]);

    const handleCreate = async () => {
        const name = createName.trim();
        if (!name) {
            setError('Map name cannot be empty');
            return;
        }
        // Check for duplicate names
        if (maps.some(m => m.name.toLowerCase() === name.toLowerCase())) {
            setError('A map with that name already exists');
            return;
        }
        try {
            setError(null);
            await mapsService.createMap(campaignName, name);
            setCreateName('');
            await loadMapsList();
        } catch (err) {
            setError(err.message || 'Failed to create map');
        }
    };

    const handleActivate = async (fileName) => {
        try {
            setError(null);
            await mapsService.activateMap(campaignName, fileName);
            await loadMapsList();
        } catch (err) {
            setError(err.message || 'Failed to activate map');
        }
    };

    const handleStartRename = (fileName, currentName) => {
        setRenamingMap(fileName);
        setRenameValue(currentName);
    };

    const handleRenameSave = async (oldFileName) => {
        const newName = renameValue.trim();
        if (!newName) {
            setRenamingMap(null);
            return;
        }
        if (newName === maps.find(m => m.fileName === oldFileName)?.name) {
            setRenamingMap(null);
            return;
        }
        // Check for duplicates
        if (maps.some(m => m.fileName !== oldFileName && m.name.toLowerCase() === newName.toLowerCase())) {
            setError('A map with that name already exists');
            setRenamingMap(null);
            return;
        }
        try {
            setError(null);
            await mapsService.renameMap(campaignName, oldFileName, newName);
            setRenamingMap(null);
            await loadMapsList();
        } catch (err) {
            setError(err.message || 'Failed to rename map');
            setRenamingMap(null);
        }
    };

    const handleRenameKeyDown = (e, fileName) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleRenameSave(fileName);
        } else if (e.key === 'Escape') {
            setRenamingMap(null);
        }
    };

    const handleDelete = async (fileName) => {
        try {
            setError(null);
            await mapsService.deleteMap(campaignName, fileName);
            setDeletingMap(null);
            await loadMapsList();
        } catch (err) {
            setError(err.message || 'Failed to delete map');
            setDeletingMap(null);
        }
    };

    const handleMapCreated = useCallback(async () => {
        setError(null);
        await loadMapsList();
    }, [loadMapsList]);

    const deletingMapName = deletingMap
        ? (maps.find(m => m.fileName === deletingMap)?.name || deletingMap)
        : '';

    return (
        <div className="maps-manager">
            <Subscriber handleEvent={handleSSEEvent} />

            <div className="maps-manager-header">
                <h2>Maps</h2>
                <button className="back-button" onClick={onBack}>
                    <i className="fa-solid fa-arrow-left"></i> Back
                </button>
            </div>

            <div className="maps-manager-create">
                <input
                    type="text"
                    placeholder="New map name..."
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreate();
                        }
                    }}
                />
                <button onClick={handleCreate} disabled={!createName.trim()}>
                    Create Map
                </button>
                <button
                    className="generate-dungeon-btn"
                    onClick={() => setShowGenerateModal(true)}
                    title="Generate a dungeon map with rooms, hallways, and doorways"
                >
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Generate Dungeon
                </button>
            </div>

            {error && <div className="maps-manager-error">{error}</div>}

            {loading && <div className="maps-manager-loading">Loading maps...</div>}

            {!loading && maps.length === 0 && (
                <div className="maps-manager-empty">No maps yet. Create one to get started.</div>
            )}

            {maps.length > 0 && (
                <ul className="maps-manager-list">
                    {maps.map(map => (
                        <li key={map.fileName} className={`maps-manager-item ${map.isActive ? 'active' : ''}`}>
                            <div className="maps-manager-item-info">
                                {renamingMap === map.fileName ? (
                                <input
                                    type="text"
                                    value={renameValue}
                                        autoFocus
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => handleRenameSave(map.fileName)}
                                        onKeyDown={(e) => handleRenameKeyDown(e, map.fileName)}
                                    />
                                ) : (
                                    <span className="maps-manager-item-name">{mapsService.formatMapName(map.name)}</span>
                                )}
                                {map.isActive && <span className="maps-manager-active-badge">Active</span>}
                            </div>
                            <div className="maps-manager-item-actions">
                                <button onClick={() => onOpenMap(map.fileName)}>Open</button>
                                {!map.isActive && <button onClick={() => handleActivate(map.fileName)}>Activate</button>}
                                <button onClick={() => handleStartRename(map.fileName, map.name)}>Rename</button>
                                <button className="delete-btn" onClick={() => setDeletingMap(map.fileName)}>Delete</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {deletingMap && (
                <div className="maps-manager-modal-overlay" onClick={() => setDeletingMap(null)}>
                    <div className="maps-manager-modal" onClick={e => e.stopPropagation()}>
                        <h3>Delete Map</h3>
                        <p>
                            This will permanently delete the map '<strong>{mapsService.formatMapName(deletingMapName)}</strong>' and all its
                            contents (walls, items, creature positions). This <strong>cannot be undone</strong>.
                        </p>
                        <div className="maps-manager-modal-actions">
                            <button onClick={() => setDeletingMap(null)}>Cancel</button>
                            <button className="delete-confirm-btn" onClick={() => handleDelete(deletingMap)}>
                                Yes, Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showGenerateModal && (
                <GenerateDungeonModal
                    campaignName={campaignName}
                    initialMapName={createName}
                    onClose={() => setShowGenerateModal(false)}
                    onMapCreated={handleMapCreated}
                />
            )}
        </div>
    );
}

export default MapsManager;
