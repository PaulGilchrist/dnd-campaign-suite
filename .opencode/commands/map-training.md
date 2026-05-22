---
name: map-training
description: Train map-making skill through iterative feedback.
permission:
  skill:
    "*": deny
    "map-making": allow
---

## Goal
Generate indoor dungeon maps to improve the map-making skill based on user's feedback.

## Orchestrator vs Executor — Critical Rule
You are the **orchestrator**, NOT the executor. This is the most important rule in this command.

**Your job (orchestrator):**
- Define a **high-level concept** for each map (theme, atmosphere, general layout flow).
- Set **constraints** (grid size, entrance direction, approximate room count).
- Dispatch each pass to a subagent with only the concept + constraints.
- **Pass each subagent's output** as input to the next subagent.
- Assemble and save the final map JSON.

**The subagent's job (executor):**
- **Design** the actual layout — rooms, corridors, wall coordinates, item positions.
- **Figure out** all coordinate-level details yourself.
- **Make creative decisions** within the given constraints.

**NEVER prescribe specific wall coordinates, item positions, or room layouts.** That is the subagent's creative work.

**Bad prompt to subagent:** "Draw walls at x=10, y=10 through x=30, y=10 for the north wall."
**Good prompt to subagent:** "Design a tavern with a large main hall, a kitchen in the northwest, and a cellar in the southeast. Entrance from the south. Grid is 40x40."

## Process

1. Read the `.opencode/skills/map-making/SKILL.md` skill to understand the required subagent pipeline.
2. Read the indoor map schema (`public/campaigns/maps-indoor.schema.json`) to understand the data structure.
3. Check existing maps in `public/campaigns/Map Training/maps/` to determine the next map number.
4. Define a **high-level concept** for the new map (theme, atmosphere, general layout).
5. Extract the pipeline passes from the skill, then dispatch each pass sequentially to a subagent, passing the output of each pass as input to the next.
6. Save the final map JSON to `public/campaigns/Map Training/maps/map-(N+1).json`.
7. Improve the `map-making` skill based on lessons learned.

## Important
- Use ONLY the map-making skill. Never load, call, or reference any other skill.
- Do NOT read, open, parse, or reference any existing maps. Create new maps only.
- **Orchestrator rule:** Provide creative direction, not coordinate-level instructions. Let subagents do the design work.
