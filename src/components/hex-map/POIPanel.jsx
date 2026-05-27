import { useState } from 'react';
import { POI_TYPES } from '../../config/outdoorConfig';
import SettlementSVG from './svg/SettlementSVG';
import CitySVG from './svg/CitySVG';
import DungeonSVG from './svg/DungeonSVG';
import CampSVG from './svg/CampSVG';
import TowerSVG from './svg/TowerSVG';
import LoreSiteSVG from './svg/LoreSiteSVG';
import HazardSVG from './svg/HazardSVG';
import NaturalWonderSVG from './svg/NaturalWonderSVG';
import LandmarkSVG from './svg/LandmarkSVG';

function POIPanel({ poiPanelOpen, onClose, characters = [] }) {
    const [poiCategory, setPoiCategory] = useState('terrain');

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

    if (!poiPanelOpen) return null;

    const svgComponents = {
        camp: CampSVG,
        city: CitySVG,
        dungeon: DungeonSVG,
        hazard: HazardSVG,
        landmark: LandmarkSVG,
        loreSite: LoreSiteSVG,
        naturalWonder: NaturalWonderSVG,
        settlement: SettlementSVG,
        tower: TowerSVG,
    };

    return (
        <div className="poi-panel">
            <button className="poi-panel-close" onClick={onClose}>
                <i className="fa-solid fa-times"></i>
            </button>

            <div className="poi-tabs">
                <button
                    className={`poi-tab ${poiCategory === 'terrain' ? 'active' : ''}`}
                    onClick={() => setPoiCategory('terrain')}
                >
                    <i className="fa-solid fa-map"></i> Terrain
                </button>
                <button
                    className={`poi-tab ${poiCategory === 'characters' ? 'active' : ''}`}
                    onClick={() => setPoiCategory('characters')}
                >
                    <i className="fa-solid fa-users"></i> Characters
                </button>
            </div>

            {poiCategory === 'terrain' && (
                <div className="poi-panel-content">
                    {POI_TYPES.map(poiType => {
                        const SvgComponent = svgComponents[poiType.id];
                        return (
                            <div
                                key={poiType.id}
                                className="poi-panel-item"
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', poiType.id);
                                    createDragGhost(e);
                                }}
                            >
                                <svg viewBox="0 0 36 36" width="36" height="36">
                                    <SvgComponent />
                                </svg>
                                <span>{poiType.name}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {poiCategory === 'characters' && (
                <div className="poi-panel-content">
                    {characters.length === 0 && (
                        <div className="poi-panel-empty">No characters in campaign.</div>
                    )}
                    {characters.map(char => (
                        <div
                            key={char.name}
                            className="poi-panel-item"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', `character:${char.name}`);
                                createCharDragGhost(e, char.name);
                            }}
                        >
                            <div className="poi-panel-char-avatar">
                                {char.imagePath ? (
                                    <img src={char.imagePath} alt={char.name} className="poi-panel-char-img" />
                                ) : (
                                    <span className="poi-panel-char-initial">{char.name.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <span>{char.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default POIPanel;
