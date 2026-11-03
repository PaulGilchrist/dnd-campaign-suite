// @maintained-by-ai
// Map notice toast — display-only shared .map-toast slot (Map.css). Fed by
// Map.jsx's useEphemeralToast channel with (a) the rejected-load notice
// "Could not load <map>" (backlog map-fresh-fallback-silent) and (b) the
// §8.4 opportunity-attack advisories surfaced through the three move lanes'
// `setPopupHtml` sink (backlog 2026-11-03: OA advisory popup was a dead
// sink — enforcement_triggered/denied text now renders on the board, not
// only in the campaign log). Reuses the .map-toast tokens — same fixed
// bottom-center amber slot as MapSnapToast.jsx; the auto-hide timer lives in
// Map.jsx (display only, no game state). Hoisted out of Map.jsx to keep the
// Map body under the complexity cap.
const MapNoticeToast = ({ message }) => {
    if (!message) return null;
    return (
        <div className="map-toast" role="status">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {message}
        </div>
    );
};

export default MapNoticeToast;
