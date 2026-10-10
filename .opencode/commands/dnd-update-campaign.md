---
name: dnd-update-campaign
description: Takes an existing D&D campaign and the party current level, then fleshes out the next 3 levels with full detail including NPCs, encounters, combat, treasure, side quests, and foreshadowing. Use when the party has progressed through earlier levels and you need to expand the next 3 level outlines into playable content.
agent: dnd-campaign-writer
permission:
  skill:
    "*": deny
    "dnd-tools-browser": "allow"
---

## Arguments
- **campaign_name** (string, required): The name of the campaign folder (e.g., "Shadows of the Shattered Crown")
- **current_level** (number, required): The level the party is currently at (e.g., 4)

## Behavior
- Read all exisitng campaign data files at `./public/campaigns{**campaign_name**}` (including its subfolders) to understand the full campaign arc, themes, antagonist reveal plan, and level progression
- For each of the next 3 levels ({**current_level**}, {**current_level** + 1}, {**current_level** + 2}):
  - Expand the outline into full detail matching the format of Levels 1-3
  - Include:
    - NPCs (short-term and long-term relevance) with full combat stats
    - Main quest with investigation steps
    - Encounters (combat, social, skill challenges) with tactics
    - Side quests with rewards
    - Treasure and magic items appropriate to the current player level
    - Treasure: Gold and magic items appropriate to the current player level
    - One or more indoor and outdoor maps used for quests or encounters using `dungeon-generator.mjs` for all indoor maps and `hex-terrain-generator.mjs` for outdoor maps.
    - Level-up reward
    - DM notes
  - Maintain consistency with the campaign arc, antagonist reveal plan, and existing NPCs
  - Ensure each level feels distinct in theme, terrain, and encounter design
  - The antagonist should be unveiled slowly according to the campaign plan
  - Each level should be roughly 4-8 hours of gameplay
- Update the status field in each level note from "outline" to "detailed"
- Update `./public/campaigns/{campaign_name}/data/sessions.json` (read by the in-app GM-only **Session Planner**) as each level is expanded:
  - For each of the 3 newly-detailed levels, create (or flesh out the existing outline entry for) that level's session: `name` "Session {level}: <episode title>", `status` "planned", `playedAt` null, a short DM `summary`, `links` to every map, encounter, NPC, quest, and settlement created for that level (exact `name`; notes by `id` — never invent names), and 2-3 If → then `contingencies` color-coded by `branch` (green `negotiate`, blue `alternate`, amber `failure`).
  - Populate each session's `checklist` with the auto-generated baseline — `"Player characters up to date"` (`auto-baseline-chars`), `"Initiative and dice ready"` (`auto-baseline-init`), plus per-link items `"{name} set as active map"` + `"Fog of war reset"` (`auto-map-<slug>`, `auto-map-<slug>-fog`), `"{name} encounter saved and ready"` (`auto-enc-<slug>`), `"{name} quest brief ready to share"` (`auto-quest-<slug>`), `"{name} ready to roleplay"` (`auto-settle-<slug>`), `"{name} notes on hand"` (`auto-npc-<slug>`) — all `auto: true`, `done: false`, and any DM custom items as `auto: false` with `custom-<unique>` ids (slug = name lowercased, non-alphanumeric runs → `-`).
  - If a session exists for level {current_level} - 1 (the level the party just finished) and is still `"planned"`, set its `status` to `"played"` with a `playedAt` ISO timestamp and fold any known recap into its `summary`.
- Confirm completion and list the 3 levels that were expanded, plus any session that was marked played

## Assumptions
- The campaign follows the structure created by the dnd-create-campaign command
- Levels 1-3 are already fully detailed
- The campaign takes place in the world of Toril on the continent of Faerun
- The theme is classic D&D fantasy with a focus on exploration and encounters over role playing

## Agent
- @dnd-campaign-writer

## Skills
- dnd-tools-browser
