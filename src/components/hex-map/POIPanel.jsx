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

function POIPanel({ onClose }) {
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
