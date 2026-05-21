import React from 'react';
import { POI_TYPES } from '../../config/outdoorConfig';
import SettlementSVG from './svg/SettlementSVG';
import DungeonSVG from './svg/DungeonSVG';
import CampSVG from './svg/CampSVG';
import TowerSVG from './svg/TowerSVG';
import LoreSiteSVG from './svg/LoreSiteSVG';
import HazardSVG from './svg/HazardSVG';
import NaturalWonderSVG from './svg/NaturalWonderSVG';
import LandmarkSVG from './svg/LandmarkSVG';

function POIPanel({ poiPanelOpen, onClose }) {
    const createDragGhost = (e) => {
        const svgEl = e.currentTarget.querySelector('svg');
        if (!svgEl) return;

        // Clone the SVG so we don't modify the one in the DOM tree
        const clonedSvg = svgEl.cloneNode(true);

        // Get original dimensions (fallback to 36×36 if not set)
        const origW = parseInt(svgEl.getAttribute('width'), 10) || 36;
        const origH = parseInt(svgEl.getAttribute('height'), 10) || 36;

        // Scale to a reasonable drag ghost size (max 48px in any dimension, maintain aspect ratio)
        const maxSize = 48;
        const scale = Math.min(maxSize / Math.max(origW, origH), 1);
        const ghostW = Math.round(origW * scale);
        const ghostH = Math.round(origH * scale);

        clonedSvg.setAttribute('width', ghostW);
        clonedSvg.setAttribute('height', ghostH);

        // Create temporary container for the ghost
        const ghost = document.createElement('div');
        ghost.style.position = 'absolute';
        ghost.style.top = '-9999px';
        ghost.style.left = '-9999px';
        ghost.appendChild(clonedSvg);
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, ghostW / 2, ghostH / 2);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    if (!poiPanelOpen) return null;

    const svgComponents = {
        settlement: SettlementSVG,
        dungeon: DungeonSVG,
        camp: CampSVG,
        tower: TowerSVG,
        loreSite: LoreSiteSVG,
        hazard: HazardSVG,
        naturalWonder: NaturalWonderSVG,
        landmark: LandmarkSVG,
    };

    return (
        <div className="poi-panel">
            <button className="poi-panel-close" onClick={onClose}>
                <i className="fa-solid fa-times"></i>
            </button>
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
        </div>
    );
}

export default POIPanel;
