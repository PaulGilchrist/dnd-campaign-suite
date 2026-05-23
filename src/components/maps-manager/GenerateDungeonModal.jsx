import { useState } from 'react';
import { generateDungeon } from '../../services/dungeonGenerator.js';
import * as mapsService from '../../services/mapsService.js';
import './GenerateDungeonModal.css';

function GenerateDungeonModal({ campaignName, initialMapName, onClose, onMapCreated }) {
    const [mapName, setMapName] = useState(initialMapName || '');
    const [gridSize, setGridSize] = useState(20);
    const [numRooms, setNumRooms] = useState({ min: Math.round(4*gridSize/10), max: Math.round(10*gridSize/10) });
    const [seed, setSeed] = useState('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

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
            const result = generateDungeon({
                gridSize: safeGridSize,
                numRooms: [numRooms.min, numRooms.max],
                seed: seedValue,
            });

            const { name: _generatedName, ...mapData } = result;
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
                        <span>Rooms (min &ndash; max)</span>
                        <div className="dungeon-gen-room-range">
                            <input
                                type="number"
                                min={2}
                                max={numRooms.max}
                                value={numRooms.min}
                                onChange={e => setNumRooms(prev => ({ ...prev, min: Math.max(2, Number(e.target.value)) }))}
                            />
                            <span className="dungeon-gen-range-sep">&ndash;</span>
                            <input
                                type="number"
                                min={numRooms.min}
                                max={50}
                                value={numRooms.max}
                                onChange={e => setNumRooms(prev => ({ ...prev, max: Number(e.target.value) }))}
                            />
                        </div>
                    </label>

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
