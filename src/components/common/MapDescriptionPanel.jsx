import MarkdownPreview from './MarkdownPreview.jsx';
import './MapDescriptionPanel.css';

/**
 * Read-only description panel for the map editor header (backlog 2026-10-26:
 * descriptions surfaced nowhere read-only). Shared by both editor roots —
 * indoor (Map.jsx) and outdoor (HexMap.jsx) — mounted directly under each
 * toolbar. Self-gating: renders NOTHING while the description is empty or
 * the document is still loading (mapData null), so call sites add zero
 * branches and an empty description never shows a misleading shell.
 * Markdown renders through MarkdownPreview (marked + DOMPurify via
 * services/ui/sanitize.js) — never raw HTML injection.
 */
function MapDescriptionPanel({ mapData }) {
    const description = mapData?.description;
    if (!description) return null;

    return (
        <div className="map-description-panel" data-testid="map-description-panel">
            <div className="map-description-panel-label">
                <i className="fa-solid fa-scroll"></i> Map Description
            </div>
            <MarkdownPreview text={description} className="map-description-panel-body" />
        </div>
    );
}

export default MapDescriptionPanel;
