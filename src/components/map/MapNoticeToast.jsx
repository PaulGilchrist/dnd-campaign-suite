// @maintained-by-ai
// Rejected-load notice — display-only "Could not load <map>" toast (backlog
// map-fresh-fallback-silent). When a named map's load 404s/aborts/corrupts,
// useMapLoader falls through to a fresh editor; the console.error is loud for
// developers, this makes the same moment visible to the USER so a dead map
// never reads as a silently-blank editor. Reuses the .map-toast tokens
// (Map.css) — same fixed bottom-center amber slot as MapSnapToast.jsx; the
// auto-hide timer lives in Map.jsx (display only, no game state). Hoisted out
// of Map.jsx to keep the Map body under the complexity cap.
const MapNoticeToast = ({ message }) => {
    if (!message) return null;
    return (
        <div className="map-toast" role="status">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {message}
        </div>
    );
};

export default MapNoticeToast;
