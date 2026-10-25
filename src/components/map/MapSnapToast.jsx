// @maintained-by-ai
// Enforcement snap-back toast — display-only visibility for the movement-budget
// clamp (backlog 2026-10-25). When usePlayerDragging's drop-side clamp
// repositions a token onto the snapped cell, this names the creature + the ft
// so the revert doesn't read as a stuck drag. Mirrors the .sessions-toast /
// .encounter-toast / .music-toast tokens; the auto-hide timer lives in the
// hook (display only, no game state). Hoisted out of Map.jsx to keep the
// Map body under the complexity cap.
const MapSnapToast = ({ snapToast }) => {
    if (!snapToast) return null;
    return (
        <div className="map-toast" role="status">
            <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true" /> {snapToast.message}
        </div>
    );
};

export default MapSnapToast;
