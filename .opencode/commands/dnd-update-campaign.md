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
    - One or more indoor and outdoor maps used for quests or encounters using `dungeon-generator.cjs` for all indoor maps and `hex-terrain-generator.js` for outdoor maps.
    - Level-up reward
    - DM notes
  - Maintain consistency with the campaign arc, antagonist reveal plan, and existing NPCs
  - Ensure each level feels distinct in theme, terrain, and encounter design
  - The antagonist should be unveiled slowly according to the campaign plan
  - Each level should be roughly 4-8 hours of gameplay
- Update the status field in each level note from "outline" to "detailed"
- Confirm completion and list the 3 levels that were expanded

## Assumptions
- The campaign follows the structure created by the dnd-create-campaign command
- Levels 1-3 are already fully detailed
- The campaign takes place in the world of Toril on the continent of Faerun
- The theme is classic D&D fantasy with a focus on exploration and encounters over role playing

## Agent
- @dnd-campaign-writer

## Skills
- dnd-tools-browser
