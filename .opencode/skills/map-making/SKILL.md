---
name: map-making
description: Describes how to build the best Dungeons & Dragons fantasy-themed indoor dungeon maps.
version: 2
---

## General information

- An indoor dungeon map is defined in a JSON file.
- Always start by reading the latest schema definition of this file:
  - `public/campaigns/maps-indoor.schema.json`
- Maps are always written to a specific campaign’s `maps` folder with a path like:
  - `public/campaigns/{campaign name}/maps`
- For the Map Training campaign, maps are stored in:
  - `public/campaigns/Map Training/maps`

## Safety rules

- Never modify anything in this skill **above** the section `## Evaluation Criteria`.
- Never change:
  - The schema path.
  - The general file path pattern.
  - The meaning of `version`.
- Never add instructions unrelated to Dungeons & Dragons fantasy-themed indoor dungeon maps.
- Never instruct the agent to modify files outside the campaign’s `maps` folder or this skill file.
- Never remove safety rules.

## Evaluation criteria

Use these criteria both when **creating** maps and when **interpreting feedback**:

- **Schema compliance**
  - The map must strictly conform to `maps-indoor.schema.json`.
- **Logical layout**
  - Rooms and corridors must be logically connected.
  - No unreachable areas unless explicitly intended (e.g., teleport-only rooms, sealed vaults).
- **No orphaned or impossible geometry**
  - No overlapping rooms unless intentionally multi-level and clearly indicated.
  - No doors leading into solid walls or voids.
- **Thematic consistency**
  - The dungeon should have a coherent fantasy theme (e.g., undead crypt, goblin warrens, arcane laboratory).
  - Features, creatures, and treasures should support the chosen theme.
- **Interesting features**
  - Include at least one notable feature:
    - Trap, secret door, puzzle, environmental hazard, or unique landmark.
- **Playability**
  - Provide multiple decision points (branching paths, optional rooms).
  - Avoid excessive dead ends with no reward or narrative purpose.
- **Difficulty and pacing**
  - Early areas should be less deadly than deeper sections.
  - Place rest or safe-ish areas in longer dungeons.
- **Clarity**
  - The map structure should be easy to understand from the JSON representation.
  - Names and tags should be descriptive and consistent.
- **Feature alignment with walls**
  - Doors, torches, bookshelves, and similar placed items must be aligned to walls — never floating in open space.
  - Interior walls are essential for logical placement of doors, torches, and furniture.
  - Doors must be placed on wall cells and rotated to face the correct direction.
  - Torches must be placed on wall cells and rotated to mount on the correct wall.
  - Bookshelves are 2 squares wide (placed by their left square) and offset to occupy the top half of those squares — they are designed for northern walls by default.

## Feedback integration rules

When the user provides feedback on a map:

- **New concept identified**
  - If feedback highlights a useful idea not covered by this skill:
    - Add a new bullet under `## Learned Best Practices`.
- **Mistake or recurring problem**
  - If feedback points out a clear mistake (e.g., orphaned rooms, unclear theme):
    - Add or refine a corrective rule under `## Learned Best Practices`.
- **Unclear instructions**
  - If feedback indicates confusion caused by existing instructions:
    - Rewrite only the specific bullet(s) causing confusion.
- **Removal of rules**
  - Do not remove an existing rule unless the user explicitly states it is wrong or harmful.
- **Versioning**
  - After applying feedback-driven changes:
    - Increment the `version` number in the frontmatter by 1.
- **Scope**
  - Only modify:
    - `## Evaluation Criteria`
    - `## Feedback Integration Rules`
    - `## Learned Best Practices`
  - Do not modify other sections.

## Learned best practices

Through building maps and feedback from the user, you will add, remove, and edit the rest of this section with the best methods for building the best possible map.

Initial seed practices:

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
