# BUG MA-0300 — Arcanaloth "Counterspell" reaction: prose-only inert

**VERDICT: FAIL (expected-shape, prose-only inert)**

## Row
Arcanaloth (arcanaloth), LIVE cs idx8, init 11, HP 175/175 — `reactions[0]` "Counterspell", actionType other.

## Classification: PROSE-ONLY INERT (not consumer-exists-but-dead)

The gated-reaction counterspell seam **exists and is live**, but is keyed solely off row metadata the Arcanaloth row lacks.

### Grep evidence
- `MonsterCardHelpers.js:486` — `GATED_MONSTER_REACTIONS.counterspell` registered (effect `counterspell`, trigger `enemy_spell_cast`). NOT in `targetEffectDefinitions.js` (grep zero — it's a gated-reaction effect, not a targetEffect).
- `MonsterCardHelpers.js:539-541` — `getGatedMonsterReaction(action)` reads **only `action.automation.effect`**. No name/prose matching.
- `MonsterAction.jsx:125-128` — `GatedReactionSlot` renders clickable chip only when a def is returned; else null.
- `MonsterCardModal.jsx:1231-1233` — `handleGatedReaction` → `resolveMonsterGatedReaction` (full gate/spend/log economy, MA-0013) is **only reachable via chip click** — no SSE/auto-prompt producer exists; no subsystem auto-offers monster reactions on PC casts.

### Data evidence (curl GET)
- `GET /data/monsters.json` → arcanaloth `reactions[0]` = `{name:"Counterspell", description:"The arcanaloth casts Counterspell…"}` — **no `automation`, no `usage/uses/maxUses`** → `getGatedMonsterReaction` = null → zero affordance.
- Contrast (consumer proven live): Aberrant Cultist Counterspell row carries `usage:"2/Day", uses:2, maxUses:2, automation{effect:'counterspell'}` (playbook §334 template) — same seam, metadata-bearing, works.

### Live evidence (Playwright + curl)
- Arcanaloth modal Reactions section: **1 row, text-only** — DOM enumeration found zero `.mc-dice-link*`/role=button elements, `hasGateChip:false`, no gate badge.
- PC cast probe: DivinationWizard → Fire Bolt → "Cast Spell". Executor threw pre-existing defect (`activeConditions must be an array for caster` — MA-0276c-lineage noise); no spell-origin lastAttack produced (lastAttack still Arcanaloth melee). Zero further casts per budget.
- `GET /log` (500 entries): **0 counterspell/reaction-type entries app-wide**; no `counterspell_refused`/`counterspell` ability_use ever recorded for Arcanaloth.
- `GET /change-data`: `Arcanaloth 1` runtime key has **no `monsterReactionUses`**, no counterspell keys — reaction economy never engaged.

### Environmental caveat
Pre-existing invisible `sp-overlay` (ElderPaladin INT DC 17 stale save prompt, pendingSavePrompts predates session) intercepted all real pointer clicks; forced `el.click()` used per playbook §MV-6 recipe. No mutating POSTs performed by this probe; no data edits.

## Fix shape (reference only — not applied)
Playbook §334 / MA-0013 template: add `usage:"1/Day", uses:1, maxUses:1` + `automation:{type:'reaction', trigger:'enemy_spell_cast', effect:'counterspell'}` to arcanaloth monsters.json reactions[0]. Seam, gate, dispel-check (d20+INT mod vs 10+level, auto <3), uses-spend, and refusal logs all already implemented.
