import { useState, useEffect, useCallback } from 'react';
import useSSEEqualityGuard from '../../hooks/runtime/useSSEEqualityGuard.js';
import useEphemeralToast from '../map/hooks/useEphemeralToast.js';
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
import GMCopilot from '../GMCopilot/GMCopilot.jsx';

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

// Row Regenerate-button render gate (VG backlog 2026-11-12; list-envelope data
// VX 2026-11-12; render-only-when-stamped doctrine owner-ratified 2026-11-23).
// The server folds each doc's small generationOpts stamp into the /maps list row
// (no per-row whole-doc GET), so the face is known at list-render time: a stamped
// doc renders the enabled control with the read-only "Generated with: …" stamp
// tooltip (the row-tooltip pattern the Description button already rides); a doc
// WITHOUT the stamp (seeded dungeons, hand-authored maps) renders NO Regenerate
// control at all — the old permanently-disabled face was a dead button whose only
// message was why it was dead (ZB backlog 2026-11-23).

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

// Row activate/deactivate notice — display-only ephemeral sink mirroring the
// shared useEphemeralToast lane's null-when-idle contract (CampaignSelection's
// DeleteNotice / MapNoticeToast.jsx). Backlog 2026-11-16 WK: toggling active
// status was feedback-silent — the only confirmation was the row button
// flipping Activate↔Deactivate, which once lagged a beat behind the server.
// The producer fires show() ONLY after the server PUT resolves, so the notice
// reflects server truth, never local optimism.
function MapToggleNotice({ message }) {
    if (!message) return null;
    return (
        <div className="maps-manager-notice" role="status">
            <i className="fa-solid fa-circle-check" aria-hidden="true" /> {message}
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
    const [regeneratingMap, setRegeneratingMap] = useState(null);
    const [regenerating, setRegenerating] = useState(false);
    // Shared ephemeral-toast lane (display-only auto-hide, benign-UI timer):
    // fires the activate/deactivate confirmations (MapToggleNotice sink).
    // 4000ms mirrors CampaignSelection's post-delete notice duration.
    const { message: toggleNotice, show: showToggleNotice } = useEphemeralToast(4000);
    // GM Copilot (Phase 1): arms the one-time "the map is live" explainer
    // after a successful activation. Per-tab trigger; the settled state is
    // the shared gmCopilot campaign key, so it never repeats on any device.
    const [justActivated, setJustActivated] = useState(false);

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

    // Whether a row renders its Regenerate control derives straight from the list
    // row's generationOpts — the server folds the small (≤10-key) stamp into the
    // /maps list envelope (server/routes/maps.js list builder), so mounting this
    // view fires ZERO whole-doc
    // GETs (the old lazy per-row stamp-probe fetched every full map document,
    // 1800-cell terrain docs included, just to render a tooltip — VX backlog
    // 2026-11-12). A campaign switch simply re-fetches the list.

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

    // Confirmation rides the shared ephemeral-toast lane and fires only AFTER
    // the awaited server response (never optimistic) — backlog 2026-11-16 WK.
    // Failures keep the persistent `.maps-manager-error` banner with the
    // server's verbatim refusal copy (an honest error notice, not silence).
    const handleActivate = async (fileName, mapName) => {
        try {
            setError(null);
            await mapsService.activateMap(campaignName, fileName);
            showToggleNotice(`Map "${mapName || fileName}" activated`);
            setJustActivated(true);
            await loadMapsList();
        } catch (err) {
            setError(err.message || 'Failed to activate map');
        }
    };

    // Deactivate twin of handleActivate (backlog 2026-11-04 CQ): clears the
    // server's active map (memory + '__map__' + SSE). The awaited list reload
    // renders the flip immediately (SSE covers other tabs without a reload).
    const handleDeactivate = async (fileName, mapName) => {
        try {
            setError(null);
            await mapsService.deactivateMap(campaignName, fileName);
            showToggleNotice(`Map "${mapName || fileName}" deactivated`);
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

    // Single close lane for the armed rename editor (backlog 2026-11-25 BC):
    // closes ONLY while `fileName` still owns the arm, so a late-resolving
    // commit can never swallow an editor that a later click just armed.
    const closeRenameEditor = (fileName) => {
        setRenamingMap(prev => (prev === fileName ? null : prev));
    };

    // COMMIT LANES ARE ENTER AND THE CONFIRM BUTTON ONLY (backlog 2026-11-25
    // BC): blur is no longer a commit — see handleCancelRename's onBlur ride.
    // Same gates as before (empty/same-name silent cancel, kebab + duplicate
    // inline banners).
    const handleRenameSave = async (oldFileName) => {
        const newName = renameValue.trim();
        if (!newName) {
            // Empty/whitespace commit is a silent cancel — a cancel also drops
            // any stale banner it superseded (backlog 2026-11-12 RS).
            setError(null);
            closeRenameEditor(oldFileName);
            return;
        }
        const existingMap = maps.find(m => m.fileName === oldFileName);
        if (existingMap && existingMap.name === newName) {
            closeRenameEditor(oldFileName);
            return;
        }
        // Same empty-kebab gate as create/rename-server — an empty handle
        // would move the file onto the undeletable `.json` dotfile slug.
        if (!mapsService.toKebabCase(newName)) {
            setError('Map name must contain letters or numbers');
            closeRenameEditor(oldFileName);
            return;
        }
        // Check for duplicates (compare display names directly)
        const newKebab = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (maps.some(m => m.fileName !== oldFileName && m.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') === newKebab)) {
            setError('A map with that name already exists');
            closeRenameEditor(oldFileName);
            return;
        }
        try {
            setError(null);
            await mapsService.renameMap(campaignName, oldFileName, newName);
            closeRenameEditor(oldFileName);
            await loadMapsList();
        } catch (err) {
            setError(err.message || 'Failed to rename map');
            closeRenameEditor(oldFileName);
        }
    };

    // Cancel/REVERT leg of the armed rename: drop any banner the edit
    // superseded and close the editor — zero writes. It rides three lanes
    // (backlog 2026-11-25 BC sharpened the third): the explicit Cancel button,
    // Escape, and BLUR. Blur is a REVERT, never a commit: a cross-row click
    // (or any focus departure without Enter/Confirm) must not silently PUT a
    // rename the user never confirmed.
    const handleCancelRename = (fileName) => {
        setError(null);
        closeRenameEditor(fileName);
    };

    const handleRenameKeyDown = (e, fileName) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleRenameSave(fileName);
        } else if (e.key === 'Escape') {
            handleCancelRename(fileName);
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
    // map_regenerated audit row). Cancel never reaches here — zero writes. The opts
    // ride the list row itself (folded from the doc by the server list builder).
    const handleRegenerate = async (fileName) => {
        const generationOpts = maps.find(m => m.fileName === fileName)?.generationOpts;
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

            <GMCopilot
                campaignName={campaignName}
                tipId="map-activate"
                when={justActivated}
                onAction={() => setJustActivated(false)}
                actionLabel="Got it"
            />

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

            {error && <div className="maps-manager-error" role="status">{error}</div>}

            <MapToggleNotice message={toggleNotice} />

            {loading && <div className="maps-manager-loading">Loading maps...</div>}

            {!loading && maps.length === 0 && (
                <div className="maps-manager-empty">No maps yet. Create one to get started.</div>
            )}

            {maps.length > 0 && (
                <ul className="maps-manager-list">
                    {maps.map(map => (
                        <li
                            key={map.fileName}
                            className={`maps-manager-item ${map.isActive ? 'active' : ''}`}
                            title={map.description || undefined}
                        >
                            <div className="maps-manager-item-info">
                                {renamingMap === map.fileName ? (
                                <input
                                    type="text"
                                    /* Keyed by the armed file (backlog 2026-11-25 BC):
                                       a loadMapsList refresh that keeps this row (same
                                       fileName) reconciles onto the SAME input, so the
                                       armed editor, its pending value and focus survive
                                       the re-render. */
                                    key={`rename-${map.fileName}`}
                                    value={renameValue}
                                        /* Accessible name mirrors the row-control idiom
                                           (`Rename "<map>"`, `Open "<map>"`) so automation
                                           can key the live input by name the same way it
                                           keys every sibling button (backlog GK 2026-11-17:
                                           `input[value=…]` attribute locators raced the
                                           controlled property on `.press()`). */
                                        aria-label={`New name for "${map.name}"`}
                                        /* Distinct placeholder so the armed row can never be
                                           mistaken for the toolbar's `New map name...` create
                                           field (both commit on Enter with DIFFERENT semantics —
                                           the live self-trap behind backlog 2026-11-24 BA). */
                                        placeholder="Rename to…"
                                        autoFocus
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => handleCancelRename(map.fileName)}
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
                                    <button onClick={() => handleDeactivate(map.fileName, map.name)} aria-label={`Deactivate "${map.name}"`}>Deactivate</button>
                                ) : (
                                    <button onClick={() => handleActivate(map.fileName, map.name)} aria-label={`Activate "${map.name}"`}>Activate</button>
                                )}
                                {/* While a row's rename is armed, its Rename button swaps to a
                                    Confirm/Cancel pair (backlog 2026-11-24 BA) so the editor has
                                    an always-visible affordance distinct from the toolbar create
                                    field. Commit lanes are Enter and Confirm ONLY (blur became a
                                    REVERT — backlog 2026-11-25 BC). onMouseDown preventDefault
                                    keeps focus on the input so the editor is never torn down
                                    under the click: without it the button press BLURS first and
                                    the revert closes the editor before onClick lands, so neither
                                    Confirm nor Cancel would fire.
                                    - Confirm = exactly the Enter lane (handleRenameSave).
                                    - Cancel = exactly the Escape/blur revert lane (zero writes). */}
                                {renamingMap === map.fileName ? (
                                    <>
                                        <button
                                            className="rename-confirm-btn"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleRenameSave(map.fileName)}
                                            aria-label={`Confirm rename for "${map.name}"`}
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            className="rename-cancel-btn"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleCancelRename(map.fileName)}
                                            aria-label={`Cancel rename for "${map.name}"`}>
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => handleStartRename(map.fileName, map.name)} aria-label={`Rename "${map.name}"`}>Rename</button>
                                )}
                                <button className="edit-desc-btn" onClick={() => handleEditDescription(map)} title="Edit description" aria-label={`Edit description for "${map.name}"`}><i className="fa-solid fa-pen"></i> Description</button>
                                {/* AI Dress (campaign-authoring residual item 2): in-place op
                                    proposal on the live document — preview first, GM Apply is
                                    the only write, through the normal map save lane. */}
                                <AiDressButton campaignName={campaignName} map={map} />
                                {/* Row Regenerate renders ONLY on docs carrying the
                                    generationOpts stamp, read off the list row itself
                                    (VG backlog 2026-11-12, VX list-envelope fold;
                                    render-only-when-stamped owner-ratified 2026-11-23):
                                    enabled with a read-only "Generated with: …" tooltip.
                                    Unstamped docs (seeded dungeons, hand-authored maps)
                                    render no control at all. */}
                                {map.generationOpts && (
                                    <button
                                        className="regenerate-btn"
                                        onClick={() => setRegeneratingMap(map.fileName)}
                                        title={describeGenerationOpts(map.generationOpts)}
                                        aria-label={`Regenerate "${map.name}"`}
                                    >
                                        <i className="fa-solid fa-rotate"></i> Regenerate
                                    </button>
                                )}
                                <button className="delete-btn" onClick={() => setDeletingMap(map.fileName)} aria-label={`Delete "${map.name}"`}>Delete</button>
                            </div>
                        </li>
                    ))}
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
                    generationOpts={maps.find(m => m.fileName === regeneratingMap)?.generationOpts}
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
