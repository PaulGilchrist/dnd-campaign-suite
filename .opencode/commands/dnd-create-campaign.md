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
- Before writing, use the obsidian-cli skill to read the existing campaigns in "Games/D&D/Campaigns" in your default Obsidian vault. Review their themes, settings, hooks, and key NPCs. Ensure the new campaign has distinct elements (e.g., different location, different primary antagonist type, different core mystery) and is not too similar to what already exists.
- Confirm party size.
- Generate a 20-level campaign with sequential story progression.
- Each level should be roughly 4-8 hours of gameplay.
- Unveil the main antagonist slowly. At lower levels, the party should face minor villains, lieutenants, or factions acting on behalf of the true antagonist, allowing the players to sense a growing, unseen force long before they learn the villain's identity.
- Plan the antagonist reveal across the 20 levels (e.g., lieutenants at levels 1-3, name heard at level 5, full reveal at level 7, final confrontation at level 20).

## Required Folder Structure
Create the following structure in your default Obsidian vault under "Games/D&D/Campaigns/{campaign_name}/":

```
Games/D&D/Campaigns/{campaign_name}/
├── Campaign Overview.md      # Full 20-level arc, themes, antagonist reveal plan, shard/key item locations
├── Levels/
│   ├── Level 1.md            # Fully detailed (frontmatter: status: detailed)
│   ├── Level 2.md            # Fully detailed (frontmatter: status: detailed)
│   ├── Level 3.md            # Fully detailed (frontmatter: status: detailed)
│   ├── Level 4.md            # Outline only (frontmatter: status: outline)
│   ├── Level 5.md            # Outline only (frontmatter: status: outline)
│   ├── Level 6.md            # Outline only (frontmatter: status: outline)
│   ├── Level 7.md            # Outline only (frontmatter: status: outline)
│   ├── Level 8.md            # Outline only (frontmatter: status: outline)
│   ├── Level 9.md            # Outline only (frontmatter: status: outline)
│   ├── Level 10.md           # Outline only (frontmatter: status: outline)
│   ├── Level 11.md           # Outline only (frontmatter: status: outline)
│   ├── Level 12.md           # Outline only (frontmatter: status: outline)
│   ├── Level 13.md           # Outline only (frontmatter: status: outline)
│   ├── Level 14.md           # Outline only (frontmatter: status: outline)
│   ├── Level 15.md           # Outline only (frontmatter: status: outline)
│   ├── Level 16.md           # Outline only (frontmatter: status: outline)
│   ├── Level 17.md           # Outline only (frontmatter: status: outline)
│   ├── Level 18.md           # Outline only (frontmatter: status: outline)
│   ├── Level 19.md           # Outline only (frontmatter: status: outline)
│   └── Level 20.md           # Outline only (frontmatter: status: outline)
├── NPCs/                     # One note per key NPC (antagonist, lieutenants, allies, recurring characters)
├── Locations/                # One note per key location (towns, dungeons, landmarks)
└── Artifacts/                # One note per key artifact/item (shards, relics, magic items)
```

## Levels 1-3 (Fully Detailed)
For each of Levels 1-3, create a note with:
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
For each of Levels 4-20, create a note with:
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

## CRITICAL: Truncation Protection
The obsidian-cli create command has a content length limit. For each note:
- For long notes (Campaign Overview, Levels 1-3):
  - First, use create to write the frontmatter, hook, and main quest sections
  - Then, use append to add the NPCs and encounters sections
  - Then, use append to add the remaining sections (side quests, treasure, foreshadowing, DM notes)
  - After creating each note, use read to verify the full content was written
  - If the read output shows truncation (content cuts off mid-sentence), delete the note and recreate it using create + append in smaller chunks
- For shorter notes (outlines, NPCs, locations, artifacts), create should be sufficient, but still verify with read

## Assumptions
- Unless the user states otherwise, the story will take place in the world of Toril on the continent of Faerun.
    - Use actual city, towns, and other landmarks from this area whenever possible
- Unless the user states otherwise, the theme will be classic D&D fantasy with a focus on exploration and encounters over role playing

## Agent
- @dnd-campaign-writer

## Skills
- obsidian-bases
- obsidian-cli
- obsidian-markdown
- dnd-tools-browser
