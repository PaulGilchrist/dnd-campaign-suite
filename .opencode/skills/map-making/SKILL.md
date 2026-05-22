---
name: map-making
description: How to build indoor D&D fantasy themed dungeon maps.
---

## Core Rules
- Always follow `public/campaigns/maps-indoor.schema.json`.
- Always follow `public/campaigns/maps-indoor.schema.json`.
- Maps are saved as ``public/campaigns/Map Training/maps/map-N.json` incrementing N each new map.

## Learned Best Practices
- Any item placed against a wall (torches, bookshelves) uses the same rotation: left wall = 0°, north wall = 90°, east wall = 180°, south wall = 270°.
- Doors are placed instead of a wall not on top of a wall with facing: east/west = 0°, north/south wall = 90°.
- Bookshelves and Tables are 2 squares wide and placed by their left square.
- Before writing JSON, mentally or sketch the full dungeon layout: entrance, corridors, rooms, branching paths, and key features.
- Consider narrative flow (e.g., entrance → courtyard → branching paths → boss chamber).
- Place player tokens at the entrance and fog all squares except the area around the players.
