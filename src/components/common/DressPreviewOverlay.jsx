import './DressPreviewOverlay.css';

/**
 * AI Dress overlay preview (backlog ai-dress-belongs-in-map-view) — renders a
 * dress proposal's op markers ON the open map's own grid, ABOVE fog/tokens,
 * before anything is applied. Sits inside the host map's <svg> so it tracks
 * zoom/pan for free (same viewBox as the cells it labels).
 *
 * Pure presentation: markers come from buildDressMarkers (dressPreview.js),
 * pixel mapping from the host map (squareDressGeometry / hexDressGeometry).
 * pointerEvents="none" — it never steals canvas gestures, and it unmounts
 * with the proposal (close/Apply ⇒ the parent drops the ops ⇒ zero residue).
 *
 * Visual language (distinct from spell overlays, selection and fog):
 *   add / move-destination → cyan dot + `add chest at 12,8` label
 *   remove                 → fuchsia cell outline + ✕ + `remove torch at 3,4`
 *   move source            → amber cell outline
 *   valid:false (off-grid) → red dashed outline + ⚠ prefix (defensive — the
 *                            server's all-or-nothing validation normally
 *                            means these never reach a preview at all)
 */
const LABEL_DY = 24;

function Marker({ marker, cellCenter, cellPath }) {
    const c = cellCenter(marker.x, marker.y);
    const cls = marker.valid ? '' : ' dress-preview-invalid';
    if (marker.kind === 'add') {
        return (
            <g className={`dress-preview-marker dress-preview-marker-add${cls}`}>
                <circle cx={c.x} cy={c.y} r={10} className="dress-preview-dot" />
                {marker.label && (
                    <text x={c.x} y={c.y + LABEL_DY} className="dress-preview-label">
                        {marker.valid ? '' : '⚠ '}{marker.label}
                    </text>
                )}
            </g>
        );
    }
    return (
        <g className={`dress-preview-marker dress-preview-marker-${marker.kind}${cls}`}>
            <path d={cellPath(c)} className="dress-preview-cell" />
            {marker.kind === 'remove' && (
                <text x={c.x} y={c.y + 5} className="dress-preview-x">✕</text>
            )}
            {marker.label && (
                <text x={c.x} y={c.y + LABEL_DY} className="dress-preview-label">
                    {marker.valid ? '' : '⚠ '}{marker.label}
                </text>
            )}
        </g>
    );
}

function DressPreviewOverlay({ markers, cellCenter, cellPath }) {
    // Coord-less markers (id not on this view) have nothing to anchor to on
    // the canvas — the modal's text preview stays their honest surface.
    const drawable = (markers || []).filter(
        m => Number.isInteger(m.x) && Number.isInteger(m.y)
    );
    if (!drawable.length) return null;
    return (
        <g className="dress-preview-layer" data-testid="dress-preview" pointerEvents="none">
            {drawable.map(m => <Marker key={m.key} marker={m} cellCenter={cellCenter} cellPath={cellPath} />)}
        </g>
    );
}

export default DressPreviewOverlay;
