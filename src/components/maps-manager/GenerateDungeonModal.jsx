import { useState } from 'react';
import { generateDungeon } from '../../services/dungeonGenerator.js';
import * as mapsService from '../../services/mapsService.js';
import './GenerateDungeonModal.css';

function GenerateDungeonModal({ campaignName, initialMapName, onClose, onMapCreated }) {
    const [mapName, setMapName] = useState(initialMapName || '');
    const [gridSize, setGridSize] = useState(20);
    const [corridorWidth, setCorridorWidth] = useState(1);
    const [generateDoors, setGenerateDoors] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    const handleGenerate = async () => {
        const name = mapName.trim();
        if (!name) {
            setError('Map name cannot be empty');
            return;
        }

        const safeGridSize = Math.max(5, Math.min(100, gridSize));
        if (safeGridSize !== gridSize) {
            setError(`Grid size must be between 5 and 25. Using ${safeGridSize}.`);
        }

        setGenerating(true);

        try {
            const seed = Math.floor(Math.random() * 2147483647);
            const result = generateDungeon(safeGridSize, {
                corridorWidth,
                generateDoors,
                seed,
            });

            await mapsService.createMap(campaignName, name, {
                gridSize: safeGridSize,
                walls: result.walls,
                doors: result.doors,
            });

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

                    <label className="dungeon-gen-field">
                        <span>Grid Size</span>
                        <input
                            type="number"
                            min={5}
                            max={100}
                            value={gridSize}
                            onChange={e => setGridSize(Number(e.target.value))}
                        />
                        <span className="dungeon-gen-hint">
                            {gridSize} ft &times; {gridSize} ft ({gridSize} squares) &mdash; ~{Math.max(2, Math.floor(gridSize / 3))} rooms
                        </span>
                    </label>

                    <div className="dungeon-gen-field">
                        <span>Corridor Width</span>
                        <div className="dungeon-gen-toggle">
                            <label className={`dungeon-gen-option ${corridorWidth === 1 ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="corridorWidth"
                                    value={1}
                                    checked={corridorWidth === 1}
                                    onChange={() => setCorridorWidth(1)}
                                />
                                5 ft (1 square)
                            </label>
                            <label className={`dungeon-gen-option ${corridorWidth === 2 ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="corridorWidth"
                                    value={2}
                                    checked={corridorWidth === 2}
                                    onChange={() => setCorridorWidth(2)}
                                />
                                10 ft (2 squares)
                            </label>
                        </div>
                    </div>

                    <label className="dungeon-gen-field dungeon-gen-checkbox">
                        <input
                            type="checkbox"
                            checked={generateDoors}
                            onChange={e => setGenerateDoors(e.target.checked)}
                        />
                        <span>Place Doors at Doorways</span>
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
