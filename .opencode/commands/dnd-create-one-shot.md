---
name: dnd-create-one-shot
description: Create a single-session Dungeons & Dragons adventure and store all generated content inside an Obsidian folder (with optional subfolders).
agent: dnd-campaign-writer
permission:
  skill:
    "obsidian-bases": "allow"
    "obsidian-cli": "allow"
    "obsidian-markdown": "allow"
    "dnd-tools-browser": "allow"
---

## Arguments
- **party_level** (number, required)
- **party_size** (number, required)

## Behavior
- Before writing, use the obsidian-cli skill to read the existing one-shots in "Games/D&D/One Shots" in your default Obsidian vault. Review their themes, settings, hooks, and key NPCs. Ensure the new one-shot has distinct elements (e.g., different location, different primary antagonist type, different core mystery) and is not too similar to what already exists.
- Confirm party level and size.
- Create a 4-hour adventure with:
  - A clear goal
  - Key NPCs with combat stats
  - Main and side quests
  - Level-appropriate encounters (combat, social, skill challenges)
  - Treasure and magic items
- Players do not level during the one-shot.
- Use the obsidian-cli skill to save each adventure component as a note in your default Obsidian vault under "Games/D&D/One Shots/{one-shot-name}/"

## CRITICAL: Truncation Protection
The obsidian-cli create command has a content length limit. For each note:
- For long notes (main adventure file):
  - First, use create to write the frontmatter, hook, and main quest sections
  - Then, use append to add the NPCs and encounters sections
  - Then, use append to add the remaining sections (side quests, treasure, DM notes)
  - After creating each note, use read to verify the full content was written
  - If the read output shows truncation (content cuts off mid-sentence), delete the note and recreate it using create + append in smaller chunks
- For shorter notes (NPCs, locations, artifacts), create should be sufficient, but still verify with read

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
