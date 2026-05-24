import { useState, useEffect, useCallback } from 'react';
import * as mapsService from '../../services/mapsService.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
import Subscriber from '../common/Subscriber.jsx';
import GenerateDungeonModal from './GenerateDungeonModal.jsx';
import GenerateTerrainModal from './GenerateTerrainModal.jsx';
import './MapsManager.css';

function MapsManager({ campaignName, onOpenMap, onBack }) {
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createName, setCreateName] = useState('');
    const [renamingMap, setRenamingMap] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [deletingMap, setDeletingMap] = useState(null);
    const [error, setError] = useState(null);
    const [mapType, setMapType] = useState('indoor'); // 'indoor' | 'outdoor'
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showTerrainModal, setShowTerrainModal] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingMap, setEditingMap] = useState(null);
    const [editDescription, setEditDescription] = useState('');
    const [loadingMapData, setLoadingMapData] = useState(false);
    const [savingDescription, setSavingDescription] = useState(false);

    const loadMapsList = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await mapsService.loadMaps(campaignName);
            const sorted = (data.maps || []).sort((a, b) => a.name.localeCompare(b.name));
            setMaps(sorted);
        } catch (err) {
            setError(err.message || 'Failed to load maps');
        } finally {
            setLoading(false);
        }
    }, [campaignName]);

    useEffect(() => {
        loadMapsList();
    }, [loadMapsList]);

    // SSE handler — re-fetch maps list on maps-list event, update active map directly on activate event
    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.key) return;
        const mapsListKey = `maps-list-${campaignName}`;
        const activateKey = `map-activate-${campaignName}`;
        if (event.key === mapsListKey) {
            loadMapsList();
        } else if (event.key === activateKey) {
            // Update active map directly without re-fetching the list
            const { activeMap } = event.data;
            setMaps(prev => prev.map(m => ({
                ...m,
                isActive: m.name === activeMap
            })));
        }
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
            await mapsService.createMap(campaignName, name, { type: mapType });
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

    const handleEditDescription = async (map) => {
        try {
            setLoadingMapData(true);
            const mapData = await mapsService.loadMapData(campaignName, map.fileName);
            setEditDescription(mapData.description || '');
            setEditingMap(map);
            setEditModalOpen(true);
        } catch (err) {
            setError(err.message || 'Failed to load map data');
        } finally {
            setLoadingMapData(false);
        }
    };

    const handleSaveDescription = async () => {
        if (!editingMap) return;

        setSavingDescription(true);
        try {
            await mapsService.updateMapDescription(campaignName, editingMap.fileName, editDescription);
            setEditModalOpen(false);
            setEditingMap(null);
            setEditDescription('');
        } catch (err) {
            setError(err.message || 'Failed to save map description');
        } finally {
            setSavingDescription(false);
        }
    };

    const handleCancelDescription = () => {
        setEditModalOpen(false);
        setEditingMap(null);
        setEditDescription('');
    };

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
                <div className="map-type-selector">
                    <label className={`map-type-option ${mapType === 'indoor' ? 'active' : ''}`}>
                        <input type="radio" name="mapType" value="indoor" checked={mapType === 'indoor'}
                            onChange={() => setMapType('indoor')} />
                        <i className="fa-solid fa-dungeon"></i> Indoor
                    </label>
                    <label className={`map-type-option ${mapType === 'outdoor' ? 'active' : ''}`}>
                        <input type="radio" name="mapType" value="outdoor" checked={mapType === 'outdoor'}
                            onChange={() => setMapType('outdoor')} />
                        <i className="fa-solid fa-tree"></i> Outdoor
                    </label>
                </div>
                <button onClick={handleCreate} disabled={!createName.trim()}>
                    Create Map
                </button>
                {mapType === 'indoor' ? (
                    <button
                        className="generate-dungeon-btn"
                        onClick={() => setShowGenerateModal(true)}
                        title="Generate a dungeon map with rooms, hallways, and doorways"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Generate Dungeon
                    </button>
                ) : (
                    <button
                        className="generate-dungeon-btn"
                        onClick={() => setShowTerrainModal(true)}
                        title="Generate a terrain map with biomes"
                    >
                        <i className="fa-solid fa-mountain"></i> Generate Terrain
                    </button>
                )}
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
                                    <span className="maps-manager-item-name">
                                        {mapsService.formatMapName(map.name)}
                                        {map.type && (
                                            <span className={`map-type-badge ${map.type === 'outdoor' ? 'outdoor' : 'indoor'}`}>
                                                {map.type === 'outdoor' ? 'Outdoor' : 'Indoor'}
                                            </span>
                                        )}
                                    </span>
                                )}
                                {map.isActive && <span className="maps-manager-active-badge">Active</span>}
                            </div>
                            <div className="maps-manager-item-actions">
                                <button onClick={() => onOpenMap(map.fileName)}>Open</button>
                                {!map.isActive && <button onClick={() => handleActivate(map.fileName)}>Activate</button>}
                                <button onClick={() => handleStartRename(map.fileName, map.name)}>Rename</button>
                                <button className="edit-desc-btn" onClick={() => handleEditDescription(map)} title="Edit description"><i className="fa-solid fa-pen"></i></button>
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

            {showTerrainModal && (
                <GenerateTerrainModal
                    campaignName={campaignName}
                    initialMapName={createName}
                    onClose={() => setShowTerrainModal(false)}
                    onMapCreated={loadMapsList}
                />
            )}

            {editModalOpen && editingMap && (
                <div className="maps-manager-modal-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) handleCancelDescription();
                }}>
                    <div className="maps-manager-modal" onClick={e => e.stopPropagation()}>
                        <div className="ct-modal-header">
                            <h3>Edit Description — {mapsService.formatMapName(editingMap.name)}</h3>
                            <button className="ct-modal-close" onClick={handleCancelDescription} aria-label="Close">
                                &times;
                            </button>
                        </div>

                        <div className="ct-modal-body">
                            {loadingMapData ? (
                                <div className="maps-manager-loading">Loading map data…</div>
                            ) : (
                                <PreviewToggle
                                    id="map-description"
                                    value={editDescription}
                                    onChange={setEditDescription}
                                    placeholder="Describe this map… (supports Markdown)"
                                    label="Map Description"
                                    minHeight="200px"
                                />
                            )}
                        </div>

                        <div className="ct-modal-footer">
                            <div className="ct-modal-buttons">
                                <button
                                    className="ct-btn ct-btn-secondary"
                                    onClick={handleCancelDescription}
                                    disabled={savingDescription}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="ct-btn ct-btn-primary"
                                    onClick={handleSaveDescription}
                                    disabled={savingDescription}
                                >
                                    <i className="fa-solid fa-floppy-disk" />{' '}
                                    {savingDescription ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MapsManager;
