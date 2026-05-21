---
name: dnd-create-one-shot
description: Create a single-session Dungeons & Dragons adventure and store all generated content inside an Obsidian folder (with optional subfolders).
agent: dnd-campaign-writer
permission:
  skill:
    "dnd-tools-browser": "allow"
---

## Arguments
- **party_level** (number, required)
- **party_size** (number, required)

## Behavior
- Before writing, look at all the content from the other campaigns. Review their encounters, factions, NPCs, quests, and notes. Ensure the new one-shot has distinct elements (e.g., different location, different primary antagonist type, different core mystery) and is not too similar to what already exists.
- Confirm party level and size by looking at the characters in the campaign folder, or if no characters exist, ask the user to list party size and level.
- Create a 4-hour adventure with:
  - A clear goal
  - Key NPCs with combat stats
  - Main and side quests
  - Level-appropriate encounters (combat, social, skill challenges)
  - Treasure and magic items
- Players do not level during the one-shot.
- Save each adventure component in the appropriate json files in the campaign's folder using their schema definitions for guidance"

## Assumptions
- Unless the user states otherwise, the story will take place in the world of Toril on the continent of Faerun.
  - Use actual city, towns, and other landmarks from this area whenever possible
- Unless the user states otherwise, the theme will be classic D&D fantasy with a focus on exploration and encounters over role playing

## Agent
- @dnd-campaign-writer

## Skills
- dnd-tools-browser
