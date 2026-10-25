// @maintained-by-ai
// Arrival toast — display-only "travel complete" confirmation (backlog 2026-10-25 pm).
// ARRIVAL flips travel-mode inactive and the TravelPanel unmounts, taking its
// lastMessage with it, so the completion used to close silently mid-harness.
// This toast renders above the panel's slot (HexMap.jsx owns the state + the
// benign auto-hide timer) so the message survives the panel's unmount.
// Mirrors the MapSnapToast.jsx pattern (.map-toast tokens in Map.css).
const TravelToast = ({ message }) => {
    if (!message) return null;
    return (
        <div className="travel-toast" role="status">
            <i className="fa-solid fa-flag-checkered" aria-hidden="true" /> {message}
        </div>
    );
};

export default TravelToast;
