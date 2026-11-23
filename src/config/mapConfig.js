export const CELL_SIZE = 40;
export const DEFAULT_GRID_SIZE = 30;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

// Tactical grid feet per cell — the ONE constant (spell range math, torch
// radii, everything that converts cells ⇄ feet).
export const FEET_PER_CELL = 5;

// 2D dynamic lighting (deferred plan C) — torch convention: bright light
// reaches 20 ft and doubles as dim light for another 20 ft. A token set to
// 'dim' halves both. The veil is READ-ONLY spectacle: nothing in the rules
// engine consults light (owner decision — stealth stays a follow-up).
export const LIGHT_BRIGHT_RADIUS_FT = 20;
export const LIGHT_DIM_EXTENSION_FT = 20;

export const TOOL_NONE = 'none';
export const TOOL_PAINT = 'paint';
export const TOOL_ERASE = 'erase';
export const TOOL_SELECT = 'select';

// GM-view dim for hidden (visible === false) markers, shared by every map
// lane (indoor props/tokens, indoor POIs, hex POIs, 3D meshes) so "hidden"
// reads the same everywhere. Players never see hidden markers at all —
// the dim is GM-only; visibility filtering stays in each lane.
export const HIDDEN_MARKER_OPACITY = 0.4;
