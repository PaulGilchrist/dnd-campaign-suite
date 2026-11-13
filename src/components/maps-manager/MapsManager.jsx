import { useState, useEffect, useCallback } from 'react';
import useSSEEqualityGuard from '../../hooks/runtime/useSSEEqualityGuard.js';
import * as mapsService from '../../services/maps/mapsService.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
import Subscriber from '../common/Subscriber.jsx';
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';
import GenerateDungeonModal from './GenerateDungeonModal.jsx';
import GenerateTerrainModal from './GenerateTerrainModal.jsx';
import AiDressButton from './AiDressButton.jsx';
import { regenerateMapDocument, describeGenerationOpts } from '../../services/maps/regenerateMap.js';
import './MapsManager.css';
import DraftFlag from '../common/DraftFlag.jsx';

const GENERATE_BUTTONS = {
    indoor: {
        icon: 'fa-solid fa-wand-magic-sparkles',
        label: 'Generate Dungeon',
        title: 'Generate a dungeon map with rooms, hallways, and doorways',
    },
    outdoor: {
        icon: 'fa-solid fa-mountain',
        label: 'Generate Terrain',
        title: 'Generate a terrain map with biomes',
    },
};

// Named-delete copy wrapper over the shared DeleteConfirmModal (the dialog +
// focus-trap machinery was extracted from here VERBATIM so the indoor map
// editor's removal lanes ride the same role="dialog" tier — backlog 2026-11-01
// AZ2). Semantics unchanged: labelled "Delete Map" heading, initial focus on
// Cancel, Tab trap, Cancel / "Yes, Delete Permanently" (pinned by
// MapsManager.delete-a11y.test.jsx).
function DeleteMapModal({ maps, fileName, onCancel, onConfirm }) {
    const mapName = maps.find(m => m.fileName === fileName)?.name || fileName;
    return (
        <DeleteConfirmModal
            titleId="maps-manager-delete-title"
            title="Delete Map"
            confirmLabel="Yes, Delete Permanently"
            onCancel={onCancel}
            onConfirm={() => onConfirm(fileName)}
        >
            This will permanently delete the map &apos;<strong>{mapName}</strong>&apos; and all its
            contents (walls, items, creature positions). This <strong>cannot be undone</strong>.
        </DeleteConfirmModal>
    );
}

// Row Regenerate-button faces (VG backlog 2026-11-12). Three honest states: stamped doc
// → enabled with the read-only "Generated with: …" stamp tooltip (the row-tooltip
// pattern the Description button already rides); fetched doc WITHOUT the stamp (legacy
// fixtures, hand-authored maps) → disabled with the plain-English reason; probe still
// in flight → disabled "Checking…" (never promises an affordance it hasn't verified).
const LEGACY_REGENERATE_TITLE = 'No generation options recorded for this map';
const CHECKING_REGENERATE_TITLE = 'Checking generation options…';

function regenerateFace(generationOpts, fetched) {
    if (generationOpts) return { disabled: false, title: describeGenerationOpts(generationOpts) };
    return { disabled: true, title: fetched ? LEGACY_REGENERATE_TITLE : CHECKING_REGENERATE_TITLE };
}

// Regenerate gate over the same shared DeleteConfirmModal a11y tier as the row's
// Delete (role="dialog", initial focus on Cancel, Tab trap); confirm label follows
// the starter lane's RegenerateAdventureModal precedent ("Yes, Regenerate"). Only
// ever opened from a row whose stamp was read back — the dialog names the recorded
// opts so the GM sees exactly what will be re-rolled before confirming.
function RegenerateMapModal({ maps, fileName, generationOpts, busy, onCancel, onConfirm }) {
    const mapName = maps.find(m => m.fileName === fileName)?.name || fileName;
    const optsLine = describeGenerationOpts(generationOpts);
    return (
        <DeleteConfirmModal
            titleId="maps-manager-regenerate-title"
            title="Regenerate Map"
            confirmLabel="Yes, Regenerate"
            confirmDisabled={busy}
            onCancel={onCancel}
            onConfirm={() => onConfirm(fileName)}
        >
            Re-roll{' '}<strong>{mapName}</strong>
            {optsLine ? <> from its recorded options (<em>{optsLine}</em>)</> : ' from its recorded options'}
            . Names, description and tokens stay &mdash; the generated layout (and any
            hand-edits to it) is replaced. This <strong>cannot be undone</strong>.
        </DeleteConfirmModal>
    );
}

function DescriptionEditModal({ map, description, onDescriptionChange, loading, saving, onCancel, onSave }) {
    if (!map) return null;
    return (
        <div className="maps-manager-modal-overlay">
            <div className="maps-manager-modal">
                <div className="ct-modal-header">
                    <h3>Edit Description — {map.name}</h3>
                    <button className="ct-modal-close" onClick={onCancel} aria-label="Close">
                        &times;
                    </button>
                </div>

                <div className="ct-modal-body">
                    {loading ? (
                        <div className="maps-manager-loading">Loading map data…</div>
                    ) : (
                        <PreviewToggle
                            id="map-description"
                            value={description}
                            onChange={onDescriptionChange}
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
                            onClick={onCancel}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            className="ct-btn ct-btn-primary"
                            onClick={onSave}
                            disabled={saving}
                        >
                            <i className="fa-solid fa-floppy-disk" />{' '}
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MapsManager({ campaignName, onOpenMap, onMapDeleted }) {
    const [maps, setMaps] = useState([]);
    const setMapsGuarded = useSSEEqualityGuard(setMaps);
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
    const [generationOptsByFile, setGenerationOptsByFile] = useState({});
    const [regeneratingMap, setRegeneratingMap] = useState(null);
    const [regenerating, setRegenerating] = useState(false);

    const generateModalOpeners = { indoor: setShowGenerateModal, outdoor: setShowTerrainModal };

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

    // The maps-LIST row envelope carries no generationOpts (server/routes/maps.js list
    // builder) and the server stays untouched, so the row faces derive from a lazy
    // per-row document GET — reads only, zero writes. null = read cleanly but no
    // stamp (legacy face); absent key = still in flight (checking face). A failed read
    // also lands on null: mapsService.loadMapData already console.errors it, and the
    // honest face for "no stamp could be read" stays the legacy one (VG backlog
    // 2026-11-12). Results are cached per fileName — the stamp never changes under a
    // row (whole-doc PUTs pass generationOpts through), so list reloads reuse it.
    useEffect(() => {
        const pending = maps.filter(m => !(m.fileName in generationOptsByFile));
        if (pending.length === 0) return undefined;
        let cancelled = false;
        Promise.all(pending.map(async (m) => {
            try {
                const doc = await mapsService.loadMapData(campaignName, m.fileName);
                return [m.fileName, doc?.generationOpts || null];
            } catch {
                return [m.fileName, null];
            }
        })).then(faces => {
            if (!cancelled) {
                setGenerationOptsByFile(prev => ({ ...prev, ...Object.fromEntries(faces) }));
            }
        });
        return () => { cancelled = true; };
    }, [maps, campaignName, generationOptsByFile]);

    // A campaign switch must not carry the previous campaign's per-file stamps over.
    useEffect(() => {
        setGenerationOptsByFile({});
    }, [campaignName]);

    // SSE handler — re-fetch maps list on maps-list event, update active map directly on activate event
    // WARNING: SSE re-render loop risk — guarded setters via useSSEEqualityGuard
    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.key) return;
        const mapsListKey = `maps-list-${campaignName}`;
        const activateKey = `map-activate-${campaignName}`;
        if (event.key === mapsListKey) {
            loadMapsList();
          } else if (event.key === activateKey) {
              // Update active map directly without re-fetching the list
            const { activeMap } = event.data || {};
            if (activeMap) {
                setMapsGuarded(prev => prev.map(m => ({
                      ...m,
                      isActive: m.fileName.replace(/\.json$/, '') === activeMap
                   })));
            } else if (activeMap === null) {
                // Deactivate echo ({ activeMap: null }): no row is active any
                // more — drop the badge and flip every row's button back to
                // Activate with zero re-fetch (mirrors the direct-update
                // contract of the activate face above).
                setMapsGuarded(prev => prev.map(m => (m.isActive ? { ...m, isActive: false } : m)));
            }
          }
      }, [campaignName, loadMapsList, setMapsGuarded]);

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
        // Names with no letters/digits kebab to an empty file handle — the
        // server create gate refuses them with this same message (an inline
        // `.json` dotfile would be undeletable; bug-map-name-empty-kebab).
        if (!mapsService.toKebabCase(name)) {
            setError('Map name must contain letters or numbers');
            return;
        }
        try {
            setError(null);
            const result = await mapsService.createMap(campaignName, name, { type: mapType });
            if (result?.alreadyExists) {
                // Kebab collision the display-name dup-check above missed
                // (e.g. '??' when '!!!' exists) — surface the server message
                // instead of silently swallowing it.
                setError(result.error || 'A map with that name already exists');
                return;
            }
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

    // Deactivate twin of handleActivate (backlog 2026-11-04 CQ): clears the
    // server's active map (memory + '__map__' + SSE). The awaited list reload
    // renders the flip immediately (SSE covers other tabs without a reload).
    const handleDeactivate = async (fileName) => {
        try {
            setError(null);
            await mapsService.deactivateMap(campaignName, fileName);
            await loadMapsList();
        } catch (err) {
            setError(err.message || 'Failed to deactivate map');
        }
    };

    // A fresh rename must not inherit a stale banner (e.g. the dup-rename
    // "already exists" left hovering after an earlier cancel) — mirrors the
    // setError(null)-on-action pattern of the activate/create lanes
    // (backlog 2026-11-12 RS).
    const handleStartRename = (fileName, currentName) => {
        setError(null);
        setRenamingMap(fileName);
        setRenameValue(currentName);
    };

    const handleRenameSave = async (oldFileName) => {
        const newName = renameValue.trim();
        if (!newName) {
            // Empty/whitespace blur is a silent cancel — a cancel also drops any
            // stale banner it superseded (backlog 2026-11-12 RS).
            setError(null);
            setRenamingMap(null);
            return;
        }
        const existingMap = maps.find(m => m.fileName === oldFileName);
        if (existingMap && existingMap.name === newName) {
            setRenamingMap(null);
            return;
        }
        // Same empty-kebab gate as create/rename-server — an empty handle
        // would move the file onto the undeletable `.json` dotfile slug.
        if (!mapsService.toKebabCase(newName)) {
            setError('Map name must contain letters or numbers');
            setRenamingMap(null);
            return;
        }
        // Check for duplicates (compare display names directly)
        const newKebab = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (maps.some(m => m.fileName !== oldFileName && m.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') === newKebab)) {
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
            // Escape cancels — clear any banner from an earlier commit attempt
            // so nothing stale survives the cancel (backlog 2026-11-12 RS).
            setError(null);
            setRenamingMap(null);
        }
    };

    const handleDelete = async (fileName) => {
        try {
            setError(null);
            await mapsService.deleteMap(campaignName, fileName);
            // Tell the app the slug (the naming convention activeMapName and
            // the server '__map__' key both use) so it can drop a stale active
            // map from its roller-lane context after an ACTIVE-map deletion.
            onMapDeleted?.(fileName.replace(/\.json$/, ''));
            setDeletingMap(null);
            await loadMapsList();
        } catch (err) {
            setError(err.message || 'Failed to delete map');
            setDeletingMap(null);
        }
    };

    // Confirm leg of the row Regenerate lane: re-derive the doc's stamped opts through
    // the client generators and PUT back onto the same doc (service owns the single
    // map_regenerated audit row). Cancel never reaches here — zero writes.
    const handleRegenerate = async (fileName) => {
        const generationOpts = generationOptsByFile[fileName];
        if (!generationOpts) {
            setRegeneratingMap(null);
            return;
        }
        setRegenerating(true);
        try {
            setError(null);
            await regenerateMapDocument(campaignName, fileName, generationOpts);
            setRegeneratingMap(null);
            await loadMapsList();
        } catch (err) {
            setError(err.message || 'Failed to regenerate map');
            setRegeneratingMap(null);
        } finally {
            setRegenerating(false);
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
            // The dedicated description route broadcasts map-data-<campaign>-<slug>,
            // never maps-list — re-fetch so row tooltips show the new description.
            await loadMapsList();
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

    return (
        <div className="maps-manager">
            <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />

            <div className="maps-manager-header">
                <h2>Maps</h2>
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
                <button onClick={handleCreate} disabled={!createName.trim()} aria-label="Create Map">
                    Create Map
                </button>
                <button
                    className="generate-dungeon-btn"
                    onClick={() => generateModalOpeners[mapType](true)}
                    title={GENERATE_BUTTONS[mapType].title}
                    aria-label={GENERATE_BUTTONS[mapType].label}
                >
                    <i className={GENERATE_BUTTONS[mapType].icon}></i> {GENERATE_BUTTONS[mapType].label}
                </button>
            </div>

            {error && <div className="maps-manager-error">{error}</div>}

            {loading && <div className="maps-manager-loading">Loading maps...</div>}

            {!loading && maps.length === 0 && (
                <div className="maps-manager-empty">No maps yet. Create one to get started.</div>
            )}

            {maps.length > 0 && (
                <ul className="maps-manager-list">
                    {maps.map(map => {
                        const face = regenerateFace(generationOptsByFile[map.fileName], map.fileName in generationOptsByFile);
                        return (
                        <li
                            key={map.fileName}
                            className={`maps-manager-item ${map.isActive ? 'active' : ''}`}
                            title={map.description || undefined}
                        >
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
                                        {map.name}
                                        <DraftFlag row={map} />
                                    </span>
                                )}
                                {' '}
                                {/* Type badge is a sibling of the name (same flex lane as the
                                    Active badge) so the row's existing 10px gap separates them
                                    visually, and the {' '} text node keeps the text layer reading
                                    "Test Map Indoor" instead of "Test MapIndoor" for innerText
                                    scans and screen readers (backlog 2026-11-03 CK: badge chrome
                                    was nested in the name span and ran together). Hidden during
                                    rename, as the badge used to be while the input replaces it. */}
                                {map.type && renamingMap !== map.fileName && (
                                    <span
                                        className={`map-type-badge ${map.type === 'outdoor' ? 'outdoor' : 'indoor'}`}
                                        aria-label={`Map type: ${map.type === 'outdoor' ? 'Outdoor' : 'Indoor'}`}
                                    >
                                        {map.type === 'outdoor' ? 'Outdoor' : 'Indoor'}
                                    </span>
                                )}
                                {map.isActive && <span className="maps-manager-active-badge">Active</span>}
                            </div>
                            <div className="maps-manager-item-actions">
                                {/* Strip the .json suffix at this seam: the server publishes
                                    map-data-<campaign>-<name> suffix-free (server/routes/maps.js:169),
                                    so the editor's SSE expectedKey only matches a suffix-free mapName
                                    (same normalization as App.jsx loadActiveMapAndOpen). The row's
                                    display name rides along as the 2nd arg so a rejected document load
                                    can name the map the way the user just saw it (backlog
                                    map-load-notice-slug-naming) — the slug stays the storage key. */}
                                <button onClick={() => onOpenMap(map.fileName.replace(/\.json$/, ''), map.name)} aria-label={`Open "${map.name}"`}>Open</button>
                                {/* Row-level activation toggle (backlog 2026-11-04 CQ):
                                    active rows get Deactivate (the server route nulls
                                    activeMaps + '__map__' and broadcasts activeMap:null),
                                    inactive rows keep Activate — one toggle button per row,
                                    same class/aria conventions as every sibling action. */}
                                {map.isActive ? (
                                    <button onClick={() => handleDeactivate(map.fileName)} aria-label={`Deactivate "${map.name}"`}>Deactivate</button>
                                ) : (
                                    <button onClick={() => handleActivate(map.fileName)} aria-label={`Activate "${map.name}"`}>Activate</button>
                                )}
                                <button onClick={() => handleStartRename(map.fileName, map.name)} aria-label={`Rename "${map.name}"`}>Rename</button>
                                <button className="edit-desc-btn" onClick={() => handleEditDescription(map)} title="Edit description" aria-label={`Edit description for "${map.name}"`}><i className="fa-solid fa-pen"></i> Description</button>
                                {/* AI Dress (campaign-authoring residual item 2): in-place op
                                    proposal on the live document — preview first, GM Apply is
                                    the only write, through the normal map save lane. */}
                                <AiDressButton campaignName={campaignName} map={map} />
                                {/* Row Regenerate from the doc's generationOpts stamp (VG backlog
                                    2026-11-12): enabled with a read-only "Generated with: …" tooltip
                                    on stamped rows; an honest disabled face (zero writes on any
                                    interaction) on legacy docs. */}
                                <button
                                    className="regenerate-btn"
                                    onClick={() => setRegeneratingMap(map.fileName)}
                                    disabled={face.disabled}
                                    title={face.title}
                                    aria-label={`Regenerate "${map.name}"`}
                                >
                                    <i className="fa-solid fa-rotate"></i> Regenerate
                                </button>
                                <button className="delete-btn" onClick={() => setDeletingMap(map.fileName)} aria-label={`Delete "${map.name}"`}>Delete</button>
                            </div>
                        </li>
                        );
                    })}
                </ul>
            )}

            {deletingMap && (
                <DeleteMapModal
                    maps={maps}
                    fileName={deletingMap}
                    onCancel={() => setDeletingMap(null)}
                    onConfirm={handleDelete}
                />
            )}

            {regeneratingMap && (
                <RegenerateMapModal
                    maps={maps}
                    fileName={regeneratingMap}
                    generationOpts={generationOptsByFile[regeneratingMap]}
                    busy={regenerating}
                    onCancel={() => setRegeneratingMap(null)}
                    onConfirm={handleRegenerate}
                />
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

            {editModalOpen && (
                <DescriptionEditModal
                    map={editingMap}
                    description={editDescription}
                    onDescriptionChange={setEditDescription}
                    loading={loadingMapData}
                    saving={savingDescription}
                    onCancel={handleCancelDescription}
                    onSave={handleSaveDescription}
                />
            )}
        </div>
    );
}

export default MapsManager;
