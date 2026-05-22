---
name: map-making
description: How to build indoor D&D fantasy themed dungeon maps.
---

## Core Rules
- Always follow `public/campaigns/maps-indoor.schema.json` for indoor maps or `public/campaigns/maps-outdoor.schema.json` for outdoor maps.
- Maps are saved to `public/campaigns/{campaign name}/maps`.

## Learned Best Practices
- Walls define room boundaries. Rooms are the open floor space between them.
- Items must NOT be placed on wall cells — every item's gridX/gridY must be absent from the walls array.
- Doors REPLACE wall cells (the wall at that position is removed). Rotation: north/south wall = 0°, east/west wall = 90°.
- Torches/bookshelves on walls: left wall = 0°, north wall = 90°, east wall = 180°, south wall = 270°.
- Bookshelves are 2 squares wide, placed by their left square.
- Sketch the layout before writing JSON: entrance → corridors → rooms → branching paths → key features.
- Consider narrative flow and place fog to create exploration tension.
- Player tokens start at the entrance in unfogged area.
