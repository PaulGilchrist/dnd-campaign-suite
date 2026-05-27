import AltarSVG from './AltarSVG.jsx';
import ArrowSlitWallSVG from './ArrowSlitWallSVG.jsx';
import BarrelSVG from './BarrelSVG.jsx';
import BedSVG from './BedSVG.jsx';
import BookshelfSVG from './BookshelfSVG.jsx';
import BoulderSVG from './BoulderSVG.jsx';
import BushSVG from './BushSVG.jsx';
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
import TreeSVG from './TreeSVG.jsx';
import WebSVG from './WebSVG.jsx';

function ItemsPanel({ itemsPanelOpen, onClose, characters = [], players = [], mapVariant = 'indoor' }) {
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
    const isOutdoor = mapVariant === 'outdoor';

    const Item = ({ type, viewBox, width, children, label }) => (
        <div className="items-panel-item" draggable
            onDragStart={(e) => { e.dataTransfer.setData('text/plain', type); createDragGhost(e); }}
        >
            <svg viewBox={viewBox} width={width} height="36">{children}</svg>
            <span>{label}</span>
        </div>
    );

    return (
        <div className="items-panel">
            <button className="items-panel-close" onClick={onClose}>
                <i className="fa-solid fa-times"></i>
            </button>
            <div className="items-panel-content">
                {isOutdoor ? (<>
                    <Item type="barrel" viewBox="0 0 36 36" width="36" label="Barrel"><BarrelSVG /></Item>
                    <Item type="boulder" viewBox="0 0 36 36" width="36" label="Boulder"><BoulderSVG /></Item>
                    <Item type="bush" viewBox="0 0 36 36" width="36" label="Bush"><BushSVG /></Item>
                    <Item type="crate" viewBox="0 0 36 36" width="36" label="Crate"><CrateSVG /></Item>
                    <Item type="firepit" viewBox="0 0 36 36" width="36" label="Fire Pit"><FirePitSVG /></Item>
                    <Item type="torch" viewBox="0 0 36 36" width="36" label="Torch"><TorchSVG /></Item>
                    <Item type="tree" viewBox="0 0 36 36" width="36" label="Tree"><TreeSVG /></Item>
                </>) : (<>
                    <Item type="altar" viewBox="0 0 72 36" width="72" label="Altar"><AltarSVG /></Item>
                    <Item type="arrowSlitWall" viewBox="0 0 36 36" width="36" label="Arrow Slit Wall"><ArrowSlitWallSVG /></Item>
                    <Item type="barrel" viewBox="0 0 36 36" width="36" label="Barrel"><BarrelSVG /></Item>
                    <Item type="bed" viewBox="0 0 72 36" width="72" label="Bed"><BedSVG /></Item>
                    <Item type="bookshelf" viewBox="0 0 72 36" width="72" label="Bookshelf"><BookshelfSVG /></Item>
                    <Item type="chair" viewBox="0 0 36 36" width="36" label="Chair"><ChairSVG /></Item>
                    <Item type="chest" viewBox="0 0 36 36" width="36" label="Treasure Chest"><ChestSVG /></Item>
                    <Item type="crate" viewBox="0 0 36 36" width="36" label="Crate"><CrateSVG /></Item>
                    <Item type="door" viewBox="0 0 36 36" width="36" label="Door"><DoorSVG /></Item>
                    <Item type="firepit" viewBox="0 0 36 36" width="36" label="Fire Pit"><FirePitSVG /></Item>
                    <Item type="fountain" viewBox="0 0 36 36" width="36" label="Fountain"><FountainSVG /></Item>
                    <Item type="pillar" viewBox="0 0 36 36" width="36" label="Pillar"><PillarSVG /></Item>
                    <Item type="secretDoor" viewBox="0 0 36 36" width="36" label="Secret Door"><SecretDoorSVG /></Item>
                    {/* <Item type="skeleton" viewBox="0 0 36 36" width="36" label="Skeleton"><SkeletonSVG /></Item> */}
                    <Item type="stairs" viewBox="0 0 36 36" width="36" label="Stairs"><StairsSVG /></Item>
                    <Item type="statue" viewBox="0 0 36 36" width="36" label="Statue"><StatueSVG /></Item>
                    <Item type="table" viewBox="0 0 72 36" width="72" label="Table"><TableSVG /></Item>
                    <Item type="torch" viewBox="0 0 36 36" width="36" label="Torch"><TorchSVG /></Item>
                    <Item type="trap" viewBox="0 0 36 36" width="36" label="Trap"><TrapSVG /></Item>
                    <Item type="web" viewBox="0 0 36 36" width="36" label="Spider Web"><WebSVG /></Item>
                </>)}
                {/* NPC - single draggable icon */}
                <div className="items-panel-item" draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', 'npc'); createDragGhost(e); }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36">
                        <circle cx="18" cy="18" r="16" fill="#c0392b" stroke="#e74c3c" strokeWidth="2" />
                        <text x="18" y="23" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold">N</text>
                    </svg>
                    <span>NPC</span>
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
