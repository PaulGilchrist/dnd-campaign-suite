// @maintained-by-ai
// Sidebar entry gate for the app shell: renders the navigation sidebar, or
// NOTHING while the Initiative tracker is in per-client TV mode (tvModeStore
// broadcast from useTvPresentation). Nobody reads the sidebar from across the
// room, and hiding it lets App.css's `.app-body:not(:has(.sidebar))` rule
// reclaim the fixed 180px gutter for the creature-card carousel. Unmounting
// the tracker (any other view) always brings the sidebar back.
import { useSyncExternalStore } from 'react';
import Sidebar from './Sidebar.jsx';
import { subscribeTvModeActive, getTvModeActive } from '../../services/ui/tvModeStore.js';

function SidebarShell(props) {
    const tvModeActive = useSyncExternalStore(subscribeTvModeActive, getTvModeActive);
    if (tvModeActive) return null;
    return <Sidebar {...props} />;
}

export default SidebarShell;
