---
name: map-making
description: How to build indoor D&D fantasy themed dungeon maps.
---

## Core Rules
- Always follow `public/campaigns/maps-indoor.schema.json`.
- Always follow `public/campaigns/maps-indoor.schema.json`.
- Maps are saved as ``public/campaigns/Map Training/maps/map-N.json` incrementing N each new map.

## Learned Best Practices
- Doors are placed instead of a wall not on top of a wall.
- Door rotation: north/south wall = 0°, east/west wall = 90°.
- Torch always placed on a wall with rotation: left wall = 0°, north wall = 90°, east wall = 180°, south wall = 270°.
- Bookshelves are 2 squares wide and placed by their left square.
- Bookshelf when placed on a wall use rotation: left wall = 0°, north wall = 90°, east wall = 180°, south wall = 270°.
- Before writing JSON, mentally or sketch the full dungeon layout: entrance, corridors, rooms, branching paths, and key features.
- Consider narrative flow (e.g., entrance → courtyard → branching paths → boss chamber).
- Plan fog of war to create exploration tension — reveal only the entrance area initially.
- Place player tokens at the entrance in an unfogged area so they can see where they are before venturing into the unknown.
