---
name: map-training
description: Train map-making skill through iterative feedback.
permission:
  skill:
    "*": deny
    "map-making": allow
---

## Goal
Generate a new indoor dungeon map adding it to the maps generated from past iterations, to help improve the map-making skill based on user's feedback.

## Process

1. Read the `.opencode/skills/map-making/SKILL.md` skill to understand map making best practices, and read the schema mentioned in the skill following it to the letter.
2. Count the files in `public/campaigns/Map Training/maps/` to determine the new map name as map-(N+1).json, but do not read their content as we want fresh learning not repeated mistakes.
3. Dispatch a sequential pipeline of tasks to subagents. Each dispatched task does exactly one small step, clears its context after completing, and returns only its output. You then pass each output as input to the next dispatched step:
   1. Count existing maps → determine filename `map-(N+1).json`
   2. Choose a dungeon theme
   3. Dispatch task to generate the `walls` array
   4. Dispatch task to generate the `placedItems` array
   5. Dispatch task to generate the `players` array
   6. Dispatch task to generate the `fog` array
   7. Dispatch task to assemble all components into valid JSON and validate against the schema
   8. Save the file to `public/campaigns/Map Training/maps/map-(N+1).json`
4. Ask the user for feedback on the generated map.
5. Update the `map-making` skill's Learned Best Practices section with concise feedback from the user.
