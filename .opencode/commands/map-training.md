---
name: map-training
description: Learn improved map making through interactive feedback.
agent: dnd-campaign-writer
permission:
  skill:
    "dnd-tools-browser": allow
    "map-making": allow
---

## Goal

Build the best possible Dungeons & Dragons fantasy-themed indoor dungeon maps through an iterative training loop.

## Process

You will achieve your goal through the following deterministic steps:

1. **Load schema and skill**
   - Read the latest indoor dungeon map schema:
     - `public/campaigns/maps-indoor.schema.json`
   - Read the latest version of the `map-making` skill.

2. **Determine next map file**
   - Read the map index file:
     - `public/campaigns/Map Training/maps/index.json`
   - Use the `nextMapId` value `N` to name the new map:
     - `public/campaigns/Map Training/maps/map-N.json`
   - After successfully writing the map, increment `nextMapId` in `index.json` by 1.

3. **Generate a new map**
   - Create a valid JSON map file that:
     - Conforms exactly to `maps-indoor.schema.json`.
     - Follows all applicable rules in the `map-making` skill.
   - Save it as `map-N.json` in:
     - `public/campaigns/Map Training/maps`.

4. **Request structured feedback from the user**
   Ask the user for **both positive and negative but constructive feedback**, using a structured format such as:

   - What worked well in this map?
   - What felt weak, confusing, or unrealistic?
   - Were there any issues with:
     - Layout / flow
     - Features (traps, secrets, points of interest)
     - Theme / fantasy flavor
     - Difficulty / balance
   - Any specific suggestions for improvement?

5. **Integrate feedback into the map-making skill**
   - Compare the user’s feedback with the current `map-making` skill, especially:
     - `## Evaluation Criteria`
     - `## Learned Best Practices`
     - `## Feedback Integration Rules`
   - Update only the allowed sections of the `map-making` skill according to its own **Feedback Integration Rules**.
   - Increment the `version` field in the `map-making` skill by 1 after applying changes.

6. **Summarize changes**
   - Provide a short summary to the user that includes:
     - The map file created (e.g., `map-N.json`).
     - Key feedback received.
     - Specific changes made to the `map-making` skill (bullets added, updated, or removed).
     - The new `version` number of the `map-making` skill.

## Session reset

When the user indicates they want to **reset training** (e.g., “reset training” or similar clear intent):

- Clear conversation context.
- Reload the latest `map-making` skill from disk.
- Do **not** modify the skill during reset.
- Begin again from **Step 1** of the Process for the next training cycle.

## Agent

- @dnd-campaign-writer

## Skills

- dnd-tools-browser
- map-making
