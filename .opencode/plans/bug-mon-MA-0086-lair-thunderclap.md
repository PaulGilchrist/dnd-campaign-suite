# Bug mon-MA-0086 — Adult Bronze Dragon · "Unnamed lair actions 2" · lair_actions raw-string thunderclap (MV-24 inert)

## Row
manifest MA-0086 (adult-bronze-dragon|lair_actions|1-index-1). `public/data/monsters.json` lair_actions[1] = raw string:
"A thunderclap originates at a point the dragon can see within 120 feet of it. Each creature within a 20-foot radius centered on that point must make a DC 15 Constitution saving throw or take 5 (1dlO) thunder damage and be deafened until the end of its next turn."

## Defects
1. **MV-24 inert row** — no `name` key → section shows "Unnamed lair actions 2"; row renders as inert `<span>` in `.mc-action` (cursor auto, 0 interactive children). No automation/DC prompt anywhere: `lair_actions` consumers are display-only (`MonsterCardBody.jsx:86-87` getLairActions + `MonsterLairAction` :306; `npcStatBlockUtils.js:80` nulls it). DC 15 CON save / 1d10 thunder / deafened never reachable.
2. **Typo `1dlO`** (letter l + O instead of `1d10`) in damage text — rendered verbatim in overlay.
3. Data split: matching save_dc/dice metadata is misattached to lair_actions[0] (fog cloud entry, see MA-0085); thunderclap clause itself untyped.

## Evidence (E2E 2026-09-13)
- Header test-campaign (MV-18) ✓ → Encounters → tick Adult Bronze Dragon → Join (init 15, HP 212) → card click → `.mc-overlay`.
- Row text matched, `hasTypo:true`, firstChild=SPAN, cursor auto, interactiveKids 0.
- Forced pointer+mouse+dblclick+`.click()` ×2 rounds: 0 modals, 0 DC-15 prompts outside overlay.
- Zero-delta: change-data sha256 `cb84c66c…` identical across forced rounds (9,843 B). Log 2 entries (joined + initiative roll); lair/thunder/deafened hits = 0.

## Suggested fix
Retype lair_actions[1] as `{name:"Thunderclap", description, save_dc:15, save_type:"Constitution", damage_dice_primary:"1d10", damage_type_primary:"Thunder"}`, fix `1dlO`→`1d10`, strip misattached metadata from [0].
