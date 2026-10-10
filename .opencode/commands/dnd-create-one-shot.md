---
name: dnd-create-one-shot
description: Create a single-session Dungeons & Dragons adventure and store all generated content inside an Obsidian folder (with optional subfolders).
agent: dnd-campaign-writer
permission:
  skill:
    "*": deny
    "dnd-tools-browser": allow
---

## Arguments
- **campaign_name** string
- **party_level** (number, required)
- **party_size** (number, required)

## Behavior
- Before writing, look at all the content from the other campaigns. Review their encounters, factions, NPCs, quests, and notes. Ensure the new one-shot has distinct elements (e.g., different location, different primary antagonist type, different core mystery) and is not too similar to what already exists.
- Confirm a **campaign_name** was given or stop and ask the user to supply the **campaign_name** from the list of current campaign folders located at `public/campaigns`
- Confirm **party_level** and **party_size** by looking at the characters in the campaign folder, at `public/campaigns/{campaign_name}` or if no characters exist, ask the user to list **party_size** and **party_level**.
- Create a 4-hour adventure with:
  - A clear goal
  - Key NPCs with combat stats
  - Main and side quests
  - Level-appropriate encounters (combat, social, skill challenges)
  - Treasure and magic items
  - One or more indoor and/or outdoor maps used for quests or encounters using `dungeon-generator.mjs` for all indoor maps and `hex-terrain-generator.mjs` for outdoor maps.
- Players do not level during the one-shot.
- Save each adventure component in the appropriate json files in the campaign's folder using their schema definitions for guidance"
- Write `public/campaigns/{campaign_name}/data/sessions.json` — a JSON array read by the in-app GM-only **Session Planner**. A one-shot is a single session, so create exactly one entry:

```json
{
  "name": "Session 1: <adventure title>",
  "date": "YYYY-MM-DD or empty",
  "status": "planned",
  "playedAt": null,
  "summary": "<short DM storyline notes for the one-shot>",
  "links": { "maps": [], "encounters": [], "npcs": [], "quests": [], "settlements": [], "notes": [] },
  "contingencies": [
    { "id": "ctg-<unique>", "ifText": "<if the players…>", "thenText": "<then…>", "branch": "negotiate | alternate | failure" }
  ],
  "checklist": [
    { "id": "<unique>", "label": "<prep step>", "done": false, "auto": true }
  ]
}
```

- Link every map, encounter, NPC, quest, and settlement you created for the one-shot (by exact `name`; notes by `id`). Reference existing objects only — never invent names or re-enter content.
- Auto-generated checklist: for each linked map add `"{name} set as active map"` and `"Fog of war reset"`; each encounter `"{name} encounter saved and ready"`; each quest `"{name} quest brief ready to share"`; each settlement `"{name} ready to roleplay"`; each NPC `"{name} notes on hand"`; plus `"Player characters up to date"` and `"Initiative and dice ready"`. Use ids `auto-map-<slug>`, `auto-map-<slug>-fog`, `auto-enc-<slug>`, `auto-quest-<slug>`, `auto-settle-<slug>`, `auto-npc-<slug>`, `auto-baseline-chars`, `auto-baseline-init` (slug = name lowercased, non-alphanumeric runs → `-`), `auto: true`; DM custom items use `auto: false`, `custom-<unique>` id.
- Contingencies use the structured If → then format, one row per branch, color-coded by `branch`: green = `negotiate`, blue = `alternate`, amber = `failure`. Include at least 2-3 covering the main decision points.
- Leave `status: "planned"` and `playedAt: null` (the DM marks it played in the app after running it).

## Session Planner
- The Session Planner is the GM's at-a-glance run sheet — this `sessions.json` is what surfaces the right content at the table.

## Assumptions
- Unless the user states otherwise, the story will take place in the world of Toril on the continent of Faerun.
  - Use actual city, towns, and other landmarks from this area whenever possible
- Unless the user states otherwise, the theme will be classic D&D fantasy with a focus on exploration and encounters over role playing

## Agent
- @dnd-campaign-writer

## Skills
- dnd-tools-browser
