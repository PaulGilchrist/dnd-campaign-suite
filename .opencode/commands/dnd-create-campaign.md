---
name: dnd-create-campaign
description: Create a full end-to-end Dungeons & Dragons campaign and store all generated content inside an Obsidian folder (with optional subfolders).
agent: dnd-campaign-writer
permission:
  skill:
    "*": deny
    "dnd-tools-browser": allow
---

## Arguments
- **campaign_name** string
- **party_stasrting_level** (number, required)
- **party_size** (number, required)

## Behavior
- Before writing, look at all the content from the other campaigns. Review their encounters, factions, NPCs, quests, and notes. Ensure the new one-shot has distinct elements (e.g., different location, different primary antagonist type, different core mystery) and is not too similar to what already exists.
- Confirm a **campaign_name** was given or stop and ask the user to supply the **campaign_name** from the list of current campaign folders located at `public/campaigns`
- Confirm **party_stasrting_level** and **party_size** by looking at the characters in the campaign folder, at `public/campaigns/{campaign_name}` or if no characters exist, ask the user to list **party_size** and **party_stasrting_level**.
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
- One or more indoor and outdoor maps used for quests or encounters using `dungeon-generator.mjs` for all indoor maps and `hex-terrain-generator.mjs` for outdoor maps.
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

## Session Planner (`sessions.json`)
Write `public/campaigns/{{campaign name}}/data/sessions.json` — a JSON array of session plans read by the in-app GM-only **Session Planner**. Each session links content that already exists in the campaign so the DM can pull up the right map, encounter, and NPCs at the table without hunting through each tool.

Create **one session per level** — "Session 1: <episode title>" through "Session 20: <episode title>".

Session schema:
```json
{
  "name": "Session 1: <episode title>",
  "date": "YYYY-MM-DD or empty",
  "status": "planned",
  "playedAt": null,
  "summary": "<short DM storyline notes / loose threads for this session>",
  "links": { "maps": [], "encounters": [], "npcs": [], "quests": [], "settlements": [], "notes": [] },
  "contingencies": [
    { "id": "ctg-<unique>", "ifText": "<if the players…>", "thenText": "<then…>", "branch": "negotiate | alternate | failure" }
  ],
  "checklist": [
    { "id": "<unique>", "label": "<prep step>", "done": false, "auto": true }
  ]
}
```

Rules:
- Every value in `links` MUST reference an object that already exists in the corresponding data file in this campaign — maps/encounters/npcs/quests/settlements by their exact `name`, notes by their `id`. Never invent names or re-enter content.
- Auto-generated checklist: for each linked map add `"{name} set as active map"` and `"Fog of war reset"`; each encounter `"{name} encounter saved and ready"`; each quest `"{name} quest brief ready to share"`; each settlement `"{name} ready to roleplay"`; each NPC `"{name} notes on hand"`; plus always `"Player characters up to date"` and `"Initiative and dice ready"`. Use stable ids `auto-map-<slug>`, `auto-map-<slug>-fog`, `auto-enc-<slug>`, `auto-quest-<slug>`, `auto-settle-<slug>`, `auto-npc-<slug>`, `auto-baseline-chars`, `auto-baseline-init` (slug = name lowercased, non-alphanumeric runs collapsed to `-`). Mark these `auto: true`; DM-added custom items use `auto: false` with a `custom-<unique>` id. (The app regenerates `auto` items from `links` whenever a session opens, preserving `done` state — write them so the file is complete on first load.)
- Contingencies use the structured If → then format, one row per branch, color-coded by `branch`: green = `negotiate`, blue = `alternate`, amber = `failure`.
- All new sessions start `status: "planned"`, `playedAt: null`.
- For Levels 1-3 (fully detailed): populate every link that exists for that level, 2-3 contingencies, and the full auto + a few custom checklist items. For Levels 4-20 (outlines): create the session with a theme summary and link only the objects that actually exist so far; expand it via the update-campaign command when the level is fleshed out.

## NPCs, Locations, Artifacts
- Create individual notes for each key NPC, location, and artifact
- NPCs should include: name, race/class, role, relationship to antagonist, combat stats, personality traits
- Locations should include: name, region, key features, notable NPCs, encounter potential
- Artifacts should include: name, type, properties, current location, significance to the campaign


## Goals
- The subfolders in `public/campaigns` represent a list of campaigns.  Ask the user which campaign you should generate a story for.
- Use the json schema files in `public/campaigns` to understand what content you should populate with your story's content.
- Long form string fields in the json data (such as appearance, description, goals, notes, personality, rewards, secrets, etc) support both markdown and HTML.
- All json files written other than maps go in the `public/campaigns/{{campaign name}}/data` folder.
  - All indoor maps must be generated using ./dungeon-generator.mjs.  You can change the description, or move or place new NPC after map generation to fit the storyline.
  - Map json files goes in the `public/campaigns/{{campaign name}}/maps` folder and map json file names must match the json "name" property within the json map file.
- Monsters placed in the map are just "placedItems" of type `npc` and should default to `visible`: false.
  - Monster names should be named exactly as found in the Monster Manual for their image to be found.
- Maps are the hardest part to design so that the room layout makes sense.  Take your time to put a good floorplan together before writing the map's json.
- Write compelling D&D story arcs, quests, encounters, factions, and worldbuilding indoor and outdoor maps.
- Relavent content that does not fit the above categories can go in notes.
- After creating each level's content, populate that level's session in `sessions.json` (see Session Planner section) — link the maps, encounters, NPCs, quests, and settlements you created for that level, add branch contingencies, and let the auto-checklist capture the prep steps.
- If there is already any content in the campaign folder, tie it into the story you are building, or build upon what has already transpired.
- Create NPCs with depth and long-term relevance.
- Seed foreshadowing and narrative hooks.
- Make the story personal to the party.
- Retrieve monsters, spells, items, and rules using the dnd-tools-browser skill.

## Assumptions
- Unless the user states otherwise, the story will take place in the world of Toril on the continent of Faerun.
    - Use actual city, towns, and other landmarks from this area whenever possible
- Unless the user states otherwise, the theme will be classic D&D fantasy with a focus on exploration and encounters over role playing

## Style
- High fantasy tone.
- Player-centric storytelling.
- Rich sensory detail.
- Strong emotional and thematic cohesion.
