import * as mapsService from '../../services/maps/mapsService.js';
import { backToMapLabel } from '../../services/maps/backToMapLabel.js';
import SpellOverlayControls from './SpellOverlayControls.jsx';
import { OverlayShape } from '../../models/SpellOverlay.js';

const TOGGLE_TOOLS = [
    { tool: 'paint', icon: 'fa-paint-brush', label: 'Paint' },
    { tool: 'erase', icon: 'fa-eraser', label: 'Erase' },
    { tool: 'select', icon: 'fa-arrow-pointer', label: 'Select' },
];

// F17 (visual audit 2026-11-25, Item 7): every map-toolbar button carries a
// hover tooltip next to its aria-label — icon-only controls were the view's
// biggest discoverability cost.
const TOOL_TITLES = {
    paint: 'Paint walls and doors on the grid',
    erase: 'Erase walls and doors from the grid',
    select: 'Marquee-select walls and items to move them as a group',
};

// Hoisted out of the component body — the toolbar sits one branch under its
// ESLint complexity cap (backlog 2026-11-01 BB mount-condition widening).
const hasActiveOverlays = (overlays) => overlays?.length > 0;

// Hoisted out of the component body (complexity cap, playbook §50): the
// deactivated-map advisory (backlog 2026-11-05 CW) renders a subtle header
// hint ONLY while the mounted map is not the campaign's active map. Unknown
// prop (undefined from older callers) reads as active — no hint.
// onViewNewMap (backlog 2026-11-08): the opt-in jump affordance for a visitor
// pinned on an orphaned board while the GM activated ANOTHER map. Absent
// (undefined/null) whenever no other map is active — the deactivation case
// keeps the honest advisory with no button. Never-hijack: nothing changes
// until the visitor clicks it.
const MapDeactivatedHint = ({ mapIsActive = true, onViewNewMap }) =>
    mapIsActive ? null : (
        // The GM deactivated (or switched away from) this map while the view
        // stayed open. Never-hijack keeps the board intact — the hint is what
        // breaks the silence. Subtle status chip, not a modal; derived from
        // the '__map__' activation SSE seam in App.jsx.
        <span className="map-deactivated-hint" role="status">
            <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
            GM deactivated this map — view continues read-only
            {onViewNewMap && (
                <button
                    type="button"
                    className="map-deactivated-view-btn"
                    onClick={onViewNewMap}
                >
                    <i className="fa-solid fa-map" aria-hidden="true"></i>
                    View the new map
                </button>
            )}
        </span>
    );

// Last-known-position mode toggle (roadmap Item 7): a binary button in the
// Spell/Ruler idiom (aria-pressed mirrors the .active class). Hoisted like
// MapDeactivatedHint — the toolbar body sits one branch under its complexity
// cap, so the GM gate and the no-handler mount decision live INSIDE this
// shell (the visitor/outdoor lanes pass nothing meaningful → renders null →
// the pinned GM/visitor button censuses stay byte-exact). The flag itself
// lives ON the map document (see Map.jsx): the press flips it through the
// autosave lane and every client adopts it over the SSE echo.
const LastKnownModeToggle = ({ isLocalhost, active, onToggle }) =>
    (isLocalhost && onToggle) ? (
        <button
            className={active ? 'active' : ''}
            aria-label="Last Seen Ghosts"
            aria-pressed={active}
            title="Last-known-position mode: creatures in unrevealed fog stop moving live on player boards (dimmed ghost at the last-seen cell). The GM always sees the true position."
            onClick={onToggle}
        >
            <i className="fa-solid fa-ghost"></i> Last Seen
        </button>
    ) : null;

// Dynamic lighting veil toggle (deferred plan C): same binary-button idiom and
// the same document-flag lane as Last Seen — the press flips `lighting` ON THE
// MAP DOCUMENT (absent = OFF ⇒ today's rendering byte-identical) through the
// autosave PUT; players adopt on the SSE echo. GM-only control; the veil
// itself is pure spectacle — no rules lane consults light in v1.
const LightingToggle = ({ isLocalhost, active, onToggle }) =>
    (isLocalhost && onToggle) ? (
        <button
            className={active ? 'active' : ''}
            aria-label="Torchlight"
            aria-pressed={active}
            title="Dynamic torchlight: unlit areas darken on every board (GMs see through the veil). Tokens carry their own light setting — read-only spectacle, rules stay untouched. Off = the classic flat-lit map."
            onClick={onToggle}
        >
            <i className="fa-solid fa-fire"></i> Torchlight
        </button>
    ) : null;

// Coordinate legend toggle (backlog 2026-11-21): binary button in the
// Spell/Ruler idiom (aria-pressed mirrors the .active class). Hoisted like
// MapDeactivatedHint for the toolbar's complexity cap. NOT localhost-gated:
// the legend is per-client view state (Map.jsx local useState, zero server
// traffic), so every origin toggles its own.
const CoordsModeToggle = ({ active, onToggle }) => (
    <button
        className={active ? 'active' : ''}
        aria-label="Coords"
        aria-pressed={!!active}
        title="Show grid coordinate labels (the 0-based column,row numbers map messages cite)"
        onClick={onToggle}
    >
        <i className="fa-solid fa-border-all"></i> Coords
    </button>
);

const MapToolbar = ({
    mapName,
    displayName,
    isLocalhost,
    mapIsActive,
    onViewNewMap,
    tool,
    setTool,
    gridSize,
    setGridSize,
    setItemsPanelOpen,
    zoomIn,
    zoomOut,
    resetView,
    resetFog,
    onBack,
    // Current map-history top ({ mapName, mapDisplayName } | null) — while
    // non-null the back button names the map its press pops open instead of
    // the static "Back to maps" (backlog 2026-11-11 JV, label only — the
    // press behaviour is App.handleBackFromMap, unchanged).
    backMapTarget,
    rulerMode,
    setRulerMode,
    // Coordinate legend toggle (backlog 2026-11-21): PER-CLIENT view state
    // (Map.jsx local useState — never server-synced, never a GM lane), so
    // this button is deliberately NOT localhost-gated: a visitor tab toggles
    // its own legend exactly like the ruler is its own per-tab tool.
    coordsMode,
    onToggleCoords,
    onEnter3D,
    spellOverlayState,
    dressButton,
    // Last-known-position mode (roadmap Item 7): { lastKnownMode,
    // onToggleLastKnown } come from the indoor Map.jsx GM lane only — no
    // handler means no button (visitor + outdoor lanes render untouched).
    lastKnownMode,
    onToggleLastKnown,
    // Dynamic lighting veil (deferred plan C): same document-flag lane as
    // lastKnownMode — no handler means no button.
    lightingMode,
    onToggleLighting,
}) => {
    const {
        spellMode,
        setSpellMode,
        selectedShape,
        setSelectedShape,
        shapeParams,
        setShapeParams,
        overlays,
        removeOverlay,
        clearOverlays,
    } = spellOverlayState || {};

    // Management surfacing (backlog 2026-11-01 BB): overlays on the board are
    // enough to mount the controls panel — a GM can remove/clear a stale
    // overlay WITHOUT ever arming placement mode.
    const hasOverlays = hasActiveOverlays(overlays);

    // Empty stack (or legacy hosts passing no target) → byte-identical
    // "Back to maps"; armed stack → names the popped map (JV label fix).
    const backLabel = backToMapLabel(backMapTarget);

    const toggleSpellMode = () => {
        // Defensive-only: the sole production producer (Map.jsx) always passes a
        // full overlay state. With no setSpellMode the mode can never engage, so
        // the honest click is a total inert no-op — not a half-action that drops
        // the paint tool without arming spell mode (#928a).
        if (!setSpellMode) return;
        if (spellMode) {
            setSpellMode(null);
        } else {
            setTool('none');
            // Interlock: arming the wand disarms the ruler. Without this the
            // wand UI arms but useSpellHandlers' rulerMode gate silently
            // swallows every canvas click (ruler-not-interlocked bug, face a).
            if (rulerMode) setRulerMode(false);
            setSpellMode(selectedShape || OverlayShape.SPHERE);
        }
    };

    const onSelectShape = (shape) => {
        setSelectedShape(shape);
        setSpellMode(shape);
    };

    return (
        <>
            <div className="toolbar-row">
                {onBack && (
                    <button onClick={onBack} title={backLabel} aria-label={backLabel} className="toolbar-back-btn no-print">
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                )}
                <h4>{displayName || mapsService.formatMapName(mapName) || 'Map'}</h4>
                <MapDeactivatedHint mapIsActive={mapIsActive} onViewNewMap={onViewNewMap} />
                {isLocalhost && (
                    <label className="grid-size-label no-print">
                        Grid Size&nbsp;&nbsp;
                        <input
                            type="number"
                            min="5"
                            max="100"
                            value={gridSize}
                            onChange={(e) => setGridSize(Number(e.target.value))}
                            className="grid-size-input"
                        />
                    </label>
                )}
                <div className="toolbar no-print">
                    {/* Paint-family tools (Paint/Erase/Select) — toggle buttons
                        in the Spell/Ruler idiom: aria-pressed mirrors the
                        .active class (both driven by the same `tool` prop) so
                        SRs and harnesses can read WHICH wall tool is armed and
                        witness the disarm re-click, not just the class. */}
                    {isLocalhost && TOGGLE_TOOLS.map(({ tool: t, icon, label }) => (
                        <button
                            key={t}
                            className={tool === t ? 'active' : ''}
                            aria-label={label}
                            aria-pressed={tool === t}
                            title={TOOL_TITLES[t]}
                            onClick={() => {
                                const next = tool === t ? 'none' : t;
                                setTool(next);
                                // Interlock: arming a canvas tool disarms the
                                // ruler so one pointerdown is never both a
                                // measurement point and a wall edit.
                                if (next !== 'none' && rulerMode) setRulerMode(false);
                            }}
                        >
                            <i className={`fa-solid ${icon}`}></i> {label}
                        </button>
                    ))}
                    {/* Spell tool — binary toggle: aria-pressed mirrors the .active
                        class (HexMapToolbar travel-button pattern) so SRs and
                        harnesses can read armed/disarmed without probing the
                        controls panel. */}
                    <button
                        className={spellMode ? 'active' : ''}
                        aria-label="Spell"
                        aria-pressed={!!spellMode}
                        title="Place a spell-effect zone on the board"
                        onClick={toggleSpellMode}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Spell
                    </button>
                    {/* Ruler tool — binary toggle: aria-pressed mirrors the .active
                        class (Spell-button/HexMapToolbar travel-button pattern) so
                        SRs and harnesses can read armed/disarmed without probing
                        the .ruler-hint panel. */}
                    <button
                        className={rulerMode ? 'active' : ''}
                        aria-label="Ruler"
                        aria-pressed={!!rulerMode}
                        title="Measure distance — click two points on the grid"
                        onClick={() => setRulerMode(!rulerMode)}
                    >
                        <i className="fa-solid fa-ruler"></i> Ruler
                    </button>
                    {/* Coordinate legend toggle — pure display chrome: no
                        tool/ruler interlock, no server write. See
                        CoordsModeToggle above. */}
                    <CoordsModeToggle active={coordsMode} onToggle={onToggleCoords} />
                    {onEnter3D && (
                        <button onClick={onEnter3D} title="View map in 3D" aria-label="View map in 3D">
                            <i className="fa-solid fa-cube"></i> 3D
                        </button>
                    )}
                    {/* AI Dress mount (backlog ai-dress-belongs-in-map-view): the host
                        Map.jsx supplies the localhost-gated AiDressButton so the GM
                        dresses THIS map with the grid in view; the toolbar stays a
                        presentational shell (players pass nothing → no button). */}
                    {dressButton}
                    {isLocalhost && (
                        <button onClick={() => setItemsPanelOpen(prev => !prev)} aria-label="Items" title="Open the placed-items panel (drag props and tokens onto the board)">
                            <i className="fa-solid fa-box"></i> Items
                        </button>
                    )}
                    <LastKnownModeToggle isLocalhost={isLocalhost} active={!!lastKnownMode} onToggle={onToggleLastKnown} />
                    <LightingToggle isLocalhost={isLocalhost} active={!!lightingMode} onToggle={onToggleLighting} />
                    <button onClick={zoomIn} aria-label="Zoom in" title="Zoom in">
                        <i className="fa-solid fa-magnifying-glass-plus"></i>
                    </button>
                    <button onClick={zoomOut} aria-label="Zoom out" title="Zoom out">
                        <i className="fa-solid fa-magnifying-glass-minus"></i>
                    </button>
                    {isLocalhost ? (
                        <button onClick={() => { resetView(); resetFog(); }} title="Reset fog of war and view" aria-label="Reset Fog">
                            <i className="fa-solid fa-rotate-left"></i> Reset Fog
                        </button>
                    ) : (
                        <button onClick={resetView} title="Reset view" aria-label="Reset View">
                            <i className="fa-solid fa-rotate-left"></i> Reset View
                        </button>
                    )}
                </div>
            </div>
            {/* Truthy gate unifies the falsy arms: '' and null render identically
                (no controls, inactive button) — spellMode is only ever null or a
                non-empty OverlayShape from its producers, and every downstream
                consumer tests truthiness, so '' means inactive (#928b). Overlays
                on the board mount the panel in manage-only mode (isActive=false
                hides Cancel + both placement hints and disables/dims the shape
                picker and param inputs — backlog 2026-11-09 ER); placement
                itself still requires the armed toolbar toggle (Map.jsx pointer
                gate). */}
            {(spellMode || hasOverlays) && (
                <SpellOverlayControls
                    selectedShape={selectedShape}
                    setSelectedShape={onSelectShape}
                    shapeParams={shapeParams}
                    setShapeParams={setShapeParams}
                    overlays={overlays}
                    onRemoveOverlay={removeOverlay}
                    onClearAll={clearOverlays}
                    onCancelMode={() => setSpellMode(null)}
                    isActive={!!spellMode}
                />
            )}
            {rulerMode && (
                <div className="ruler-hint">
                    <i className="fa-solid fa-ruler"></i> Click two points to measure distance
                </div>
            )}
        </>
    );
};

export default MapToolbar;
