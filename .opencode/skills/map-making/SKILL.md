---
name: map-making
description: Describes how to build the best Dungeons & Dragons fantasy-themed indoor dungeon maps.
version: 1
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

As feedback is received, extend and refine these bullets according to the **Feedback Integration Rules**.
