---
name: map-training
description: Train map-making skill through iterative feedback.
agent: dnd-campaign-writer
permission:
  skill:
    "dnd-tools-browser": allow
    "map-making": allow
---

## Goal
Generate indoor dungeon maps and improve the map-making skill based on user feedback.

## Process

1. Load:
   - `public/campaigns/maps-indoor.schema.json`
   - The current `map-making` skill.

2. Determine next map number by scanning:
   `public/campaigns/Map Training/maps`
   - Find highest `map-N.json`
   - Next file is `map-(N+1).json`

3. Generate a valid map following:
   - The schema
   - The map-making skill

4. Save the map to:
   `public/campaigns/Map Training/maps/map-(N+1).json`

5. Ask the user for:
   - What worked
   - What didn’t
   - What to improve

6. Update only the **Learned Best Practices** section of the skill based on feedback.

7. Summarize:
   - Map created
   - Feedback received
   - Skill changes made

## Reset
When the user says “reset training”, clear context and start again at step 1.
