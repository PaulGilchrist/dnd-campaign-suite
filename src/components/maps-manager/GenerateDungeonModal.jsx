import { useState } from 'react';
import { generateDungeon, generateAdjacentDungeon } from '../../services/maps/dungeonGenerator.js';
import { parseGridInput } from '../../services/maps/gridInput.js';
import { parseSeedInput } from '../../services/maps/seedInput.js';
import * as mapsService from '../../services/maps/mapsService.js';
import { FEET_PER_CELL } from '../../services/combat/movementBudget.js';
import './GenerateDungeonModal.css';
import './gen-modal-shared.css';

const MODE_OPTIONS = [
    { value: 'bsp', label: 'BSP Dungeon', icon: 'fa-solid fa-grid-2' },
    { value: 'adjacent', label: 'Room Adjacent', icon: 'fa-solid fa-layer-group' },
];

const LAYOUT_OPTIONS = [
    { value: 'balanced', label: 'Balanced' },
    { value: 'linear', label: 'Linear' },
    { value: 'forking', label: 'Forking' },
    { value: 'winding', label: 'Winding' },
];

const CORRIDOR_OPTIONS = [
    { value: 'compact', label: 'Compact (rooms adjacent)' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'sprawling', label: 'Sprawling (long halls)' },
];

function GenerateDungeonModal({ campaignName, initialMapName, onClose, onMapCreated }) {
    const [mapName, setMapName] = useState(initialMapName || '');
    const [gridSize, setGridSize] = useState(30);
    const [density, setDensity] = useState(50);
    const [seed, setSeed] = useState('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    // Mode
    const [mode, setMode] = useState('bsp');
    // Adjacent-mode controls
    const [roomCount, setRoomCount] = useState(8);
    const [roomSize, setRoomSize] = useState('standard'); // 'cramped' | 'standard' | 'spacious'
    const [corridorLength, setCorridorLength] = useState('compact');
    const [layoutStyle, setLayoutStyle] = useState('balanced');

    // Editing any field clears a stale error banner so it never lingers next
    // to now-valid inputs (TE backlog 2026-11-12).
    const editName = (event) => { setError(null); setMapName(event.target.value); };
    const editGrid = (event) => { setError(null); setGridSize(Number(event.target.value)); };
    const editSeed = (event) => { setError(null); setSeed(event.target.value); };

    const handleGenerate = async () => {
        const name = mapName.trim();
        if (!name) {
            setError('Map name cannot be empty');
            return;
        }

        // Block an out-of-range grid size with a persistent inline error BEFORE
        // generating — the old clamp set a (wrongly-worded) message but kept
        // going, and onClose() unmounted the modal so it was never seen
        // (SD 2026-11-12). Empty input reads as 0, so NaN and blanks are
        // honestly refused here too. Shared with the terrain twin via
        // gridInput.js so the gates cannot drift apart again.
        const gridInput = parseGridInput(gridSize, 7, 100);
        if (gridInput.error) {
            setError(gridInput.error);
            return;
        }

        // Block a non-numeric seed with an inline error BEFORE generating —
        // a NaN seed silently degraded to seed 0 on disk (null) (SD 2026-11-12).
        const seedInput = parseSeedInput(seed);
        if (seedInput.error) {
            setError(seedInput.error);
            return;
        }
        const seedValue = seedInput.seed ?? Math.floor(Math.random() * 2147483647);

        setGenerating(true);

        try {

            let result;
            let generationOpts;
            if (mode === 'adjacent') {
                const sizeMultiplier = roomSize === 'cramped' ? 0.7 : roomSize === 'spacious' ? 1.3 : 1;
                // Cap room bounds to what the grid can hold (1-cell wall margin
                // per side, matching the generator's clamp) — the old floors
                // handed a 7-wide grid an impossible 4–8-wide spec (2026-11-12).
                const roomMaxSpan = Math.max(2, gridSize - 2);
                const baseMinRoom = Math.min(Math.max(4, Math.floor(gridSize / 8)), roomMaxSpan);
                const baseMaxRoom = Math.min(Math.max(8, Math.min(18, Math.floor(gridSize / 2.5))), roomMaxSpan);
                const adjacentOpts = {
                    gridSize: gridSize,
                    density: density / 100,
                    seed: seedValue,
                    roomCount: roomCount,
                    corridorLength: corridorLength,
                    layoutStyle: layoutStyle,
                    minRoom: Math.min(Math.max(3, Math.floor(baseMinRoom * sizeMultiplier)), roomMaxSpan),
                    maxRoom: Math.min(Math.max(6, Math.floor(baseMaxRoom * sizeMultiplier)), roomMaxSpan),
                };
                result = generateAdjacentDungeon(adjacentOpts);
                // Chosen UI label on top of the effective generator options so
                // the saved doc alone re-derives the dungeon (UF backlog
                // 2026-11-12); mode mirrors the top-level generationMode law.
                generationOpts = { mode: 'adjacent', roomSize: roomSize, ...adjacentOpts };
            } else {
                const bspOpts = {
                    gridSize: gridSize,
                    density: density / 100,
                    seed: seedValue,
                };
                result = generateDungeon(bspOpts);
                generationOpts = { mode: 'bsp', ...bspOpts };
            }

            const { name: generatedName, ...mapData } = result;
            void generatedName;
            // Full effective options ride the create body so the saved doc can
            // re-derive its own dungeon (UF backlog 2026-11-12); the server
            // create builders pass `generationOpts` through verbatim.
            await mapsService.createMap(campaignName, name, { ...mapData, generationOpts });

            onMapCreated();
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to generate dungeon');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="maps-manager-modal-overlay">
            <div className="maps-manager-modal dungeon-gen-modal">
                <h3>Generate Dungeon Map</h3>

                {error && <div className="maps-manager-error">{error}</div>}

                <div className="gen-modal-form">
                    <label className="gen-modal-field">
                        <span>Map Name</span>
                        <input
                            type="text"
                            value={mapName}
                            onChange={editName}
                            placeholder="e.g. Goblin Hideout"
                            autoFocus
                        />
                    </label>

                    {/* Mode selector */}
                    <div className="gen-modal-mode-selector">
                        <span className="gen-modal-field-label">Generation Mode</span>
                        <div className="gen-modal-mode-options">
                            {MODE_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    className={`gen-modal-mode-btn ${mode === opt.value ? 'active' : ''}`}
                                    onClick={() => setMode(opt.value)}
                                >
                                    <i className={opt.icon}></i> {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === 'bsp' ? (
                        <>
                            <label className="gen-modal-field">
                                <span>Grid Size</span>
                                <input
                                    type="number"
                                    min={7}
                                    max={100}
                                    value={gridSize}
                                    onChange={editGrid}
                                />
                                <span className="gen-modal-hint">
                                    {gridSize * FEET_PER_CELL} ft &times; {gridSize * FEET_PER_CELL} ft ({gridSize * gridSize} squares)
                                </span>
                            </label>

                            <label className="gen-modal-field">
                                <span>Density: {density}%</span>
                                <input
                                    type="range"
                                    min={10}
                                    max={100}
                                    step={10}
                                    value={density}
                                    onChange={e => setDensity(Number(e.target.value))}
                                />
                                <span className="gen-modal-hint">
                                    {density <= 30 ? 'Sparse — wide halls, fewer rooms' :
                                     density <= 60 ? 'Moderate — balanced layout' :
                                     'Dense — many rooms, tight corridors'}
                                </span>
                            </label>
                        </>
                    ) : (
                        <>
                            <label className="gen-modal-field">
                                <span>Grid Size</span>
                                <input
                                    type="number"
                                    min={7}
                                    max={100}
                                    value={gridSize}
                                    onChange={editGrid}
                                />
                                <span className="gen-modal-hint">
                                    {gridSize * FEET_PER_CELL} ft &times; {gridSize * FEET_PER_CELL} ft ({gridSize * gridSize} squares)
                                </span>
                            </label>

                            <label className="gen-modal-field">
                                <span>Room Count: {roomCount}</span>
                                <input
                                    type="range"
                                    min={3}
                                    max={20}
                                    step={1}
                                    value={roomCount}
                                    onChange={e => setRoomCount(Number(e.target.value))}
                                />
                            </label>

                            <label className="gen-modal-field">
                                <span>Room Size</span>
                                <div className="gen-modal-option-group">
                                    {['cramped', 'standard', 'spacious'].map(size => (
                                        <button
                                            key={size}
                                            className={`gen-modal-option-btn ${roomSize === size ? 'active' : ''}`}
                                            onClick={() => setRoomSize(size)}
                                        >
                                            {size.charAt(0).toUpperCase() + size.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </label>

                            <label className="gen-modal-field">
                                <span>Corridor Length</span>
                                <div className="gen-modal-option-group">
                                    {CORRIDOR_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`gen-modal-option-btn ${corridorLength === opt.value ? 'active' : ''}`}
                                            onClick={() => setCorridorLength(opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </label>

                            <label className="gen-modal-field">
                                <span>Layout Style</span>
                                <div className="gen-modal-option-group">
                                    {LAYOUT_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`gen-modal-option-btn ${layoutStyle === opt.value ? 'active' : ''}`}
                                            onClick={() => setLayoutStyle(opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </label>
                        </>
                    )}

                    <label className="gen-modal-field">
                        <span>Seed (optional)</span>
                        <input
                            type="text"
                            value={seed}
                            onChange={editSeed}
                            placeholder="Random if empty"
                        />
                    </label>

                </div>
                <div>
                    Note: This is meant to be just a starting point for you to finish into a fully fleshed out map<br/>
                </div>
                <div className="maps-manager-modal-actions">
                    <button onClick={onClose} disabled={generating}>
                        Cancel
                    </button>
                    <button
                        className="gen-modal-generate-btn"
                        onClick={handleGenerate}
                        disabled={!mapName.trim() || generating}
                    >
                        {generating ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default GenerateDungeonModal;
