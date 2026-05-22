---
name: map-making
description: How to build indoor D&D fantasy themed dungeon maps.
---

## Core Rules
- Always follow `public/campaigns/maps-indoor.schema.json` for indoor maps or `public/campaigns/maps-outdoor.schema.json` for outdoor maps.
- Maps are saved to `public/campaigns/{campaign name}/maps`.
- **Every map JSON must include metadata:** `name`, `description`, `gridSize`, `zoom`, `panX`, `panY`. These are required by the schema.

## Subagent Pipeline
Break map generation into four sequential passes that must be dispatched to a subagent and never done by the primary agent. Each subagent receives the current JSON state and adds only its layer before passing the result forward.

Pass 1 — Architect: Dispatch to subagent.
- Input: grid size, walls array format explanation, any size constraints.
- Task: Design a complex, interconnected network of rooms and corridors.
- Constraint: Maximize grid utilization. Avoid "rooms in a void." Ensure a logical flow from entrance to various objectives.
- Tell the subagent not to be concerned with doorways.
- Output: JSON with walls array only.

Pass 2 — Door Placer: Dispatch to subagent.
- Input: walls JSON from Pass 1.
- Task: Insert doors where wall cells should open; remove the corresponding wall cell at each door position. Apply rotation rules.
- Constraint: **Doorways must be at least 2 cells wide** to allow comfortable passage. Remove all wall cells in the doorway area.
- Output: JSON with walls and placedItems (doors)

Pass 3 — Decorator: Dispatch to subagent.
- Input: walls + doors JSON from Pass 2.
- Task: Populate the map with flavor (furniture) and gameplay (traps, monsters, treasure). Place items on floor cells only — never on wall cells. Apply rotation rules.
- Constraint: Path Clearance: Do NOT place items in corridors or doorways that block movement.
- Challenge: Every map must include at least one trap and one NPC/Monster.
- Output: Full map JSON (including placedItems)

Pass 4 — Finisher: Dispatch to subagent.
- Input: full map JSON from Pass 3.
- Task: Place players at entrance and apply fog.
- Constraint: Total Fog: The fog array must contain every coordinate that is NOT part of the immediate playable area (entrance, corridors, and rooms). If a cell is not meant to be seen, it must be in the fog array.
- Output: Final complete map JSON.

## Common Pitfalls
- **Decorator Rotation:** When placing items like doors, torches, or furniture, ensure the `rotation` property is set correctly based on the item's orientation (e.g., doors should match the wall they are in).
- **Fog of War:** Fog should cover the ENTIRE map by default. Only the cells immediately surrounding the player's starting position (the entrance) should be unfogged. Do not unfog entire rooms unless explicitly explored.
- **Missing Metadata:** Always include `gridSize`, `name`, `description`, `zoom`, `panX`, and `panY` in the final map JSON. Without `gridSize`, the map will default to an incorrect size.
- **Entrance Blocked:** Ensure the entrance corridor is completely clear of walls. The first few cells from the map edge must be open floor.
- **Doorway Width:** Doorways should be at least 2 cells wide. A single-cell doorway can feel cramped and may cause visual issues.
- **Furniture Orientation:** Set explicit rotation for furniture (e.g., chairs should face tables).

## Learned Best Practices
- Walls define room boundaries and two rooms can share a wall. Rooms are the open floor space between walls.
- Items must NOT be placed on wall cells — every item's gridX/gridY must be absent from the walls array.
- Doors REPLACE wall cells (the wall at that position is removed). Rotation: north/south wall = 0°, east/west wall = 90°.
- Torches/bookshelves on walls: left wall = 0°, north wall = 90°, east wall = 180°, south wall = 270°.
- Bookshelves are 2 squares wide, placed by their left square.
- Sketch the layout before writing JSON: entrance → corridors → rooms → branching paths → key features.
- Consider narrative flow and place fog to create exploration tension.
- Player tokens start at the entrance in unfogged area.
- **Always verify the final JSON includes all required schema fields** before saving.
