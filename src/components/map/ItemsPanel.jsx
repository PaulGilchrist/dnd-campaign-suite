import React from 'react';
import BarrelSVG from './BarrelSVG.jsx';
import TableSVG from './TableSVG.jsx';
import BedSVG from './BedSVG.jsx';
import FirePitSVG from './FirePitSVG.jsx';
import DoorSVG from './DoorSVG.jsx';
import SecretDoorSVG from './SecretDoorSVG.jsx';
import TrapSVG from './TrapSVG.jsx';
import PillarSVG from './PillarSVG.jsx';
import StairsSVG from './StairsSVG.jsx';

function ItemsPanel({ itemsPanelOpen, npcs, npcMapPositions, npcMetadata, toggleNpcVisibility, onClose }) {
    if (!itemsPanelOpen) return null;

    return (
        <div className="items-panel">
            <button className="items-panel-close" onClick={onClose}>
                <i className="fa-solid fa-times"></i>
            </button>
            <div className="items-panel-content">
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'barrel');
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <BarrelSVG />
                    </svg>
                    <span>Barrel</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'bed');
                    }}
                >
                    <svg viewBox="0 0 72 36" width="72" height="36">
                        <BedSVG />
                    </svg>
                    <span>Bed</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'door');
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <DoorSVG />
                    </svg>
                    <span>Door</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'firepit');
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <FirePitSVG />
                    </svg>
                    <span>Fire Pit</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'pillar');
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <PillarSVG />
                    </svg>
                    <span>Pillar</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'secretDoor');
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <SecretDoorSVG />
                    </svg>
                    <span>Secret Door</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'stairs');
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <StairsSVG />
                    </svg>
                    <span>Stairs</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'table');
                    }}
                >
                    <svg viewBox="0 0 72 36" width="72" height="36">
                        <TableSVG />
                    </svg>
                    <span>Table</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'trap');
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <TrapSVG />
                    </svg>
                    <span>Trap</span>
                </div>

                {/* NPC section */}
                {npcs && npcs.length > 0 && (
                    <div className="items-panel-npc-section">
                        <h5 className="items-panel-npc-title">
                            <i className="fa-solid fa-users"></i> NPCs
                        </h5>

                        {/* Unplaced NPCs (draggable) */}
                        {npcs.filter(npc => !npcMapPositions.find(p => p.npcId === npc.id)).map((npc) => (
                            <div
                                key={npc.id}
                                className="items-panel-npc-item"
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', `npc:${npc.id}`);
                                }}
                            >
                                <i className="fa-solid fa-user"></i>
                                <span className="items-panel-npc-name">{npc.name}</span>
                            </div>
                        ))}

                        {/* Placed NPCs (with visibility toggle) */}
                        {npcMapPositions.map((npcPos) => {
                            const npc = npcMetadata?.find(n => n.id === npcPos.npcId);
                            if (!npc) return null;
                            return (
                                <div
                                    key={npcPos.npcId}
                                    className="items-panel-npc-item items-panel-npc-placed"
                                >
                                    <i className="fa-solid fa-user"></i>
                                    <span className="items-panel-npc-name">{npc.name}</span>
                                    <button
                                        className="items-panel-npc-toggle"
                                        onClick={() => toggleNpcVisibility(npcPos.npcId)}
                                        title={npcPos.visible ? 'Hide NPC' : 'Show NPC'}
                                    >
                                        <i className={`fa-solid ${npcPos.visible ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ItemsPanel;
