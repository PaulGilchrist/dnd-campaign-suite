---
name: map-making
description: How to build indoor D&D fantasy themed dungeon maps.
---

## Core Rules
- Always follow `public/campaigns/maps-indoor.schema.json` for indoor maps or `public/campaigns/maps-outdoor.schema.json` for outdoor maps.
- Maps are saved to `public/campaigns/{campaign name}/maps`.

## Subagent Pipeline
Break map generation into four sequential passes that must be dispatched to a subagent and never done by the primary agent. Each subagent receives the current JSON state and adds only its layer before passing the result forward.

Pass 1 — Architect: Sketch layout (entrance → corridors → rooms → branching paths), then output only walls and rooms. Do not add any other fields yet.

Pass 2 — Door Placer: Receive the walls/rooms JSON. Insert doors where wall cells should open; remove the corresponding wall cell at each door position. Only modify walls and doors.

Pass 3 — Decorator: Receive the current map JSON. Place items, torches, and bookshelves on floor cells only — never on wall cells. Only modify items (or equivalent decoration arrays). Apply rotation rules: torches/bookshelves on left wall = 0°, north wall = 90°, east wall = 180°, south wall = 270°. Bookshelves are 2 squares wide; place by their left square.

Pass 4 — Finisher: Receive the full map JSON. Place player tokens at the entrance in an unfogged area. Apply fog of war to unvisited areas to create exploration tension. Only modify players/tokens and fog.
Each pass must leave all fields from prior passes untouched.

## Learned Best Practices
- Walls define room boundaries. Rooms are the open floor space between them.
- Items must NOT be placed on wall cells — every item's gridX/gridY must be absent from the walls array.
- Doors REPLACE wall cells (the wall at that position is removed). Rotation: north/south wall = 0°, east/west wall = 90°.
- Torches/bookshelves on walls: left wall = 0°, north wall = 90°, east wall = 180°, south wall = 270°.
- Bookshelves are 2 squares wide, placed by their left square.
- Sketch the layout before writing JSON: entrance → corridors → rooms → branching paths → key features.
- Consider narrative flow and place fog to create exploration tension.
- Player tokens start at the entrance in unfogged area.
