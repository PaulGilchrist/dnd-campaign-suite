---
name: map-making
description: How to build indoor D&D dungeon maps.
version: 2
---

## Core Rules
- Always follow `public/campaigns/maps-indoor.schema.json`.
- Maps are saved as `map-N.json` inside the campaign’s `maps` folder.
- Keep maps simple, clear, and logically connected.

## What Makes a Good Dungeon Map
- Rooms connect logically with no unreachable areas.
- No impossible geometry (overlaps, doors into walls).
- Theme is consistent (e.g., crypt, lair, ruins).
- Include at least one interesting feature (trap, secret, hazard).
- Optional rooms should reward exploration.
- Names and descriptions should be clear and concise.

## How Feedback Updates This Skill
- If feedback identifies a missing idea → add a bullet to Learned Best Practices.
- If feedback identifies a mistake → add a corrective bullet.
- Only modify the Learned Best Practices section.
- Do not change Core Rules or What Makes a Good Dungeon Map.
- After updating, increase the version number by 1.

## Learned Best Practices
(Updated after each training cycle based on user feedback.)

- **Entrance design**
  - Provide a clear, identifiable entrance area that sets the tone of the dungeon.
- **Looping paths**
  - Where appropriate, include loops so players can approach key areas from multiple directions.
- **Rewarding exploration**
  - Side paths and optional rooms should usually contain:
    - Treasure, lore, shortcuts, or other meaningful rewards.
- **Secret content**
  - At least one secret or hidden element (room, passage, cache) should be discoverable by careful play.
- **Environmental storytelling**
  - Use room names, features, and connections to imply history and purpose (e.g., barracks near an armory, shrine near a reliquary).
- **Interior walls are essential**
  - Always define interior walls to create distinct rooms and corridors.
  - Without interior walls, doors, torches, and furniture appear randomly placed or floating.
  - Plan the full room layout (walls, doors, corridors) before placing furniture and decorations.
- **Door rotation**
  - Doors default to mounting on a left wall (rotation 0°).
  - When replacing a horizontal wall, rotate the door 90° (rotation: 90).
  - Always verify the door faces the correct direction relative to the corridor it connects.
- **Torch rotation**
  - Torches default to mounting on a left wall (rotation 0°).
  - Rotation mapping: left wall = 0°, north wall = 90°, east wall = 180°, south wall = 270°.
  - Place torches on wall cells, not in the middle of rooms.
- **Bookshelf placement**
  - Bookshelves are 2 squares wide and placed by their left square — the right square extends one cell further right.
  - If a wall exists on the right side, place the bookshelf one cell further left to compensate.
  - Bookshelves are offset to occupy the top half of the two squares — designed for northern walls by default.
  - Rotation mapping: north wall = 0°, east wall = 90° (1x), south wall = 180° (2x), west wall = 270° (3x).
- **Pre-planning layout**
  - Before writing JSON, mentally or sketch the full dungeon layout: entrance, corridors, rooms, branching paths, and key features.
  - Consider narrative flow (e.g., entrance → courtyard → branching paths → boss chamber).
  - Plan fog of war to create exploration tension — reveal only the entrance area initially.
- **Player starting position**
  - Place player tokens at the entrance in an unfogged area so they can see where they are before venturing into the unknown.

As feedback is received, extend and refine these bullets according to the **Feedback Integration Rules**.
