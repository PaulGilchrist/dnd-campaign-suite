---
name: dnd-create-campaign
description: Create a full end-to-end Dungeons & Dragons campaign and store all generated content inside an Obsidian folder (with optional subfolders).
agent: dnd-campaign-writer
permission:
  skill:
    "obsidian-bases": "allow"
    "obsidian-cli": "allow"
    "obsidian-markdown": "allow"
    "dnd-tools-browser": "allow"
---

## Arguments
- **party_size** (number, required)

## Behavior
- Before writing, look at all the content from the other campaigns. Review their encounters, factions, NPCs, quests, and notes. Ensure the new one-shot has distinct elements (e.g., different location, different primary antagonist type, different core mystery) and is not too similar to what already exists.
- Confirm party level and size by looking at the characters in the campaign folder, or if no characters exist, ask the user to list party size and level.
- Generate a 20-level campaign with sequential story progression.
- Each level should be roughly 4-8 hours of gameplay.
- Unveil the main antagonist slowly. At lower levels, the party should face minor villains, lieutenants, or factions acting on behalf of the true antagonist, allowing the players to sense a growing, unseen force long before they learn the villain's identity.
- Plan the antagonist reveal across the 20 levels (e.g., lieutenants at levels 1-3, name heard at level 5, full reveal at level 7, final confrontation at level 20).

## Levels 1-3 (Fully Detailed)
For each of Levels 1-3, update the data files with:
- Frontmatter with: title, level, status (set to "detailed"), tags
- Hook: A compelling opening scene to draw the party in
- Main Quest: The primary objective with investigation steps
- NPCs: Short-term and long-term characters with full combat stats (AC, HP, attacks, abilities)
- Encounters: Combat, social, and skill challenges with tactics
- Side Quests: Optional adventures with rewards
- Treasure: Gold and magic items appropriate to the current player level
- Foreshadowing: Hints of the greater story and antagonist
- Level-Up Reward: What the party gains upon completion
- DM Notes: Tips for running the level

## Levels 4-20 (Outlines Only)
For each of Levels 4-20, update the data files with:
- Frontmatter with: title, level, status (set to "outline"), tags
- Brief theme/setting description
- Main quest summary (1-2 sentences)
- Key NPCs involved
- Antagonist reveal progress (what the party learns at this level)
- Terrain and encounter types
- Status: "outline" (to be expanded later using the flesh-out-levels command)

## NPCs, Locations, Artifacts
- Create individual notes for each key NPC, location, and artifact
- NPCs should include: name, race/class, role, relationship to antagonist, combat stats, personality traits
- Locations should include: name, region, key features, notable NPCs, encounter potential
- Artifacts should include: name, type, properties, current location, significance to the campaign

## Assumptions
- Unless the user states otherwise, the story will take place in the world of Toril on the continent of Faerun.
    - Use actual city, towns, and other landmarks from this area whenever possible
- Unless the user states otherwise, the theme will be classic D&D fantasy with a focus on exploration and encounters over role playing

## Agent
- @dnd-campaign-writer

## Skills
- dnd-tools-browser
