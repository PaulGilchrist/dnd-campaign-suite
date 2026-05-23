import AltarSVG from './AltarSVG.jsx';
import BarrelSVG from './BarrelSVG.jsx';
import BedSVG from './BedSVG.jsx';
import BookshelfSVG from './BookshelfSVG.jsx';
import ChairSVG from './ChairSVG.jsx';
import ChestSVG from './ChestSVG.jsx';
import CrateSVG from './CrateSVG.jsx';
import DoorSVG from './DoorSVG.jsx';
import FirePitSVG from './FirePitSVG.jsx';
import FountainSVG from './FountainSVG.jsx';
import PillarSVG from './PillarSVG.jsx';
import SecretDoorSVG from './SecretDoorSVG.jsx';
import SkeletonSVG from './SkeletonSVG.jsx';
import StairsSVG from './StairsSVG.jsx';
import StatueSVG from './StatueSVG.jsx';
import TableSVG from './TableSVG.jsx';
import TorchSVG from './TorchSVG.jsx';
import TrapSVG from './TrapSVG.jsx';
import WebSVG from './WebSVG.jsx';

function ItemsPanel({ itemsPanelOpen, placedItems, onToggleItemVisibility, onClose, characters = [], players = [] }) {
    const createDragGhost = (e) => {
        const svgEl = e.currentTarget.querySelector('svg');
        if (!svgEl) return;

        const clonedSvg = svgEl.cloneNode(true);
        const origW = parseInt(svgEl.getAttribute('width'), 10) || 36;
        const origH = parseInt(svgEl.getAttribute('height'), 10) || 36;
        const maxSize = 48;
        const scale = Math.min(maxSize / Math.max(origW, origH), 1);
        const ghostW = Math.round(origW * scale);
        const ghostH = Math.round(origH * scale);

        clonedSvg.setAttribute('width', ghostW);
        clonedSvg.setAttribute('height', ghostH);

        const ghost = document.createElement('div');
        ghost.style.position = 'absolute';
        ghost.style.top = '-9999px';
        ghost.style.left = '-9999px';
        ghost.appendChild(clonedSvg);
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, ghostW / 2, ghostH / 2);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const createCharDragGhost = (e, charName) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '40');
        svg.setAttribute('height', '40');
        svg.setAttribute('viewBox', '0 0 40 40');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '20');
        circle.setAttribute('cy', '20');
        circle.setAttribute('r', '18');
        circle.setAttribute('fill', '#4a90d9');
        circle.setAttribute('stroke', '#2c5f8a');
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '20');
        text.setAttribute('y', '25');
        text.setAttribute('textAnchor', 'middle');
        text.setAttribute('fill', '#fff');
        text.setAttribute('font-size', '18');
        text.setAttribute('font-weight', 'bold');
        text.textContent = charName.charAt(0).toUpperCase();
        svg.appendChild(text);

        const ghost = document.createElement('div');
        ghost.style.position = 'absolute';
        ghost.style.top = '-9999px';
        ghost.style.left = '-9999px';
        ghost.appendChild(svg);
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 20, 20);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    if (!itemsPanelOpen) return null;

    const playerNames = new Set(players.map(p => p.name));
    const missingChars = characters.filter(c => !playerNames.has(c.name));

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
                        e.dataTransfer.setData('text/plain', 'altar');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 72 36" width="72" height="36">
                        <AltarSVG />
                    </svg>
                    <span>Altar</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'barrel');
                        createDragGhost(e);
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
                        createDragGhost(e);
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
                        e.dataTransfer.setData('text/plain', 'bookshelf');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 72 36" width="72" height="36">
                        <BookshelfSVG />
                    </svg>
                    <span>Bookshelf</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'chair');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <ChairSVG />
                    </svg>
                    <span>Chair</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'crate');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <CrateSVG />
                    </svg>
                    <span>Crate</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'door');
                        createDragGhost(e);
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
                        createDragGhost(e);
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
                        e.dataTransfer.setData('text/plain', 'fountain');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <FountainSVG />
                    </svg>
                    <span>Fountain</span>
                </div>

                {/* NPC - single draggable icon */}
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'npc');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <circle cx="18" cy="18" r="16" fill="#c0392b" stroke="#e74c3c" strokeWidth="2" />
                        <text x="18" y="23" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold">N</text>
                    </svg>
                    <span>NPC</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'pillar');
                        createDragGhost(e);
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
                        createDragGhost(e);
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
                        e.dataTransfer.setData('text/plain', 'skeleton');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <SkeletonSVG />
                    </svg>
                    <span>Skeleton</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'web');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <WebSVG />
                    </svg>
                    <span>Spider Web</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'stairs');
                        createDragGhost(e);
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
                        e.dataTransfer.setData('text/plain', 'statue');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <StatueSVG />
                    </svg>
                    <span>Statue</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'table');
                        createDragGhost(e);
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
                        e.dataTransfer.setData('text/plain', 'torch');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <TorchSVG />
                    </svg>
                    <span>Torch</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'trap');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <TrapSVG />
                    </svg>
                    <span>Trap</span>
                </div>
                <div
                    className="items-panel-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', 'chest');
                        createDragGhost(e);
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <ChestSVG />
                    </svg>
                    <span>Treasure Chest</span>
                </div>
            </div>

            {missingChars.length > 0 && (
                <div className="items-panel-section">
                    <div className="items-panel-section-title">Characters</div>
                    <div className="items-panel-content">
                        {missingChars.map(char => (
                            <div
                                key={char.name}
                                className="items-panel-item items-panel-char"
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', `character:${char.name}`);
                                    createCharDragGhost(e, char.name);
                                }}
                            >
                                <div className="items-panel-char-avatar">
                                    {char.imagePath ? (
                                        <img src={char.imagePath} alt={char.name} className="items-panel-char-img" />
                                    ) : (
                                        <span className="items-panel-char-initial">{char.name.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <span>{char.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ItemsPanel;
