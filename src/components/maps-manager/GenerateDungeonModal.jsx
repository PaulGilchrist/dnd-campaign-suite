import { useState } from 'react';
import { generateDungeon, generateAdjacentDungeon } from '../../services/dungeonGenerator.js';
import * as mapsService from '../../services/mapsService.js';
import './GenerateDungeonModal.css';

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

    const handleGenerate = async () => {
        const name = mapName.trim();
        if (!name) {
            setError('Map name cannot be empty');
            return;
        }

        const safeGridSize = Math.max(7, Math.min(100, gridSize));
        if (safeGridSize !== gridSize) {
            setError(`Grid size must be between 5 and 100. Using ${safeGridSize}.`);
        }

        setGenerating(true);

        try {
            const seedValue = seed ? parseInt(seed, 10) : Math.floor(Math.random() * 2147483647);

            let result;
            if (mode === 'adjacent') {
                const sizeMultiplier = roomSize === 'cramped' ? 0.7 : roomSize === 'spacious' ? 1.3 : 1;
                const baseMinRoom = Math.max(4, Math.floor(safeGridSize / 8));
                const baseMaxRoom = Math.max(8, Math.min(18, Math.floor(safeGridSize / 2.5)));
                result = generateAdjacentDungeon({
                    gridSize: safeGridSize,
                    density: density / 100,
                    seed: seedValue,
                    roomCount: roomCount,
                    corridorLength: corridorLength,
                    layoutStyle: layoutStyle,
                    minRoom: Math.max(3, Math.floor(baseMinRoom * sizeMultiplier)),
                    maxRoom: Math.max(6, Math.floor(baseMaxRoom * sizeMultiplier)),
                });
            } else {
                result = generateDungeon({
                    gridSize: safeGridSize,
                    density: density / 100,
                    seed: seedValue,
                });
            }

            const { name: generatedName, ...mapData } = result;
            void generatedName;
            await mapsService.createMap(campaignName, name, mapData);

            onMapCreated();
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to generate dungeon');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="maps-manager-modal-overlay" onClick={onClose}>
            <div className="maps-manager-modal dungeon-gen-modal" onClick={e => e.stopPropagation()}>
                <h3>Generate Dungeon Map</h3>

                {error && <div className="maps-manager-error">{error}</div>}

                <div className="dungeon-gen-form">
                    <label className="dungeon-gen-field">
                        <span>Map Name</span>
                        <input
                            type="text"
                            value={mapName}
                            onChange={e => setMapName(e.target.value)}
                            placeholder="e.g. Goblin Hideout"
                            autoFocus
                        />
                    </label>

                    {/* Mode selector */}
                    <div className="dungeon-gen-mode-selector">
                        <span className="dungeon-gen-field-label">Generation Mode</span>
                        <div className="dungeon-gen-mode-options">
                            {MODE_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    className={`dungeon-gen-mode-btn ${mode === opt.value ? 'active' : ''}`}
                                    onClick={() => setMode(opt.value)}
                                >
                                    <i className={opt.icon}></i> {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === 'bsp' ? (
                        <>
                            <label className="dungeon-gen-field">
                                <span>Grid Size</span>
                                <input
                                    type="number"
                                    min={7}
                                    max={100}
                                    value={gridSize}
                                    onChange={e => setGridSize(Number(e.target.value))}
                                />
                                <span className="dungeon-gen-hint">
                                    {gridSize} ft &times; {gridSize} ft ({gridSize} squares)
                                </span>
                            </label>

                            <label className="dungeon-gen-field">
                                <span>Density: {density}%</span>
                                <input
                                    type="range"
                                    min={10}
                                    max={100}
                                    step={10}
                                    value={density}
                                    onChange={e => setDensity(Number(e.target.value))}
                                />
                                <span className="dungeon-gen-hint">
                                    {density <= 30 ? 'Sparse — wide halls, fewer rooms' :
                                     density <= 60 ? 'Moderate — balanced layout' :
                                     'Dense — many rooms, tight corridors'}
                                </span>
                            </label>
                        </>
                    ) : (
                        <>
                            <label className="dungeon-gen-field">
                                <span>Grid Size</span>
                                <input
                                    type="number"
                                    min={7}
                                    max={100}
                                    value={gridSize}
                                    onChange={e => setGridSize(Number(e.target.value))}
                                />
                                <span className="dungeon-gen-hint">
                                    {gridSize} ft &times; {gridSize} ft ({gridSize} squares)
                                </span>
                            </label>

                            <label className="dungeon-gen-field">
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

                            <label className="dungeon-gen-field">
                                <span>Room Size</span>
                                <div className="dungeon-gen-option-group">
                                    {['cramped', 'standard', 'spacious'].map(size => (
                                        <button
                                            key={size}
                                            className={`dungeon-gen-option-btn ${roomSize === size ? 'active' : ''}`}
                                            onClick={() => setRoomSize(size)}
                                        >
                                            {size.charAt(0).toUpperCase() + size.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </label>

                            <label className="dungeon-gen-field">
                                <span>Corridor Length</span>
                                <div className="dungeon-gen-option-group">
                                    {CORRIDOR_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`dungeon-gen-option-btn ${corridorLength === opt.value ? 'active' : ''}`}
                                            onClick={() => setCorridorLength(opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </label>

                            <label className="dungeon-gen-field">
                                <span>Layout Style</span>
                                <div className="dungeon-gen-option-group">
                                    {LAYOUT_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`dungeon-gen-option-btn ${layoutStyle === opt.value ? 'active' : ''}`}
                                            onClick={() => setLayoutStyle(opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </label>
                        </>
                    )}

                    <label className="dungeon-gen-field">
                        <span>Seed (optional)</span>
                        <input
                            type="text"
                            value={seed}
                            onChange={e => setSeed(e.target.value)}
                            placeholder="Random if empty"
                        />
                    </label>

                </div>
                <div>
                    Note: This is meant to be just a starting point for you to finish into a fully flushed out map<br/>
                </div>
                <div className="maps-manager-modal-actions">
                    <button onClick={onClose} disabled={generating}>
                        Cancel
                    </button>
                    <button
                        className="dungeon-gen-generate-btn"
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
