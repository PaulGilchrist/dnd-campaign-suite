# Bug MA-0126 — Adult Red Dragon "Fiery Rays": inert legendary row; no affordance, no cast, no damage, no legendary economy

**Verdict: FAIL** (row renders as inert text with zero clickable affordances; forced clicks zero popup/log/spend; `monsterLegendaryUses` never created; same MA-0124/MA-0114/MA-0094 fingerprint — prose-only legendary row atop header lacking `uses`)

## Row
- MA-0126 · Adult Red Dragon (`adult-red-dragon`) · `legendary_actions[2]` "Fiery Rays" · category: legendary_actions · actionType: other.
- monsters.json (`adult-red-dragon.legendary_actions[2]`, read 2026-09-14): `{name:"Fiery Rays", description:"The dragon uses Spellcasting to cast <em>Scorching Ray</em>. The dragon can't take this action again until the start of its next turn."}` — **prose-only**: no `automation`, no `spell`, no `save_dc`, no `attack_bonus`, no `dice`, no `uses`.
- Header row `legendary_actions[0]` "Legendary Action Uses: 3 (4 in Lair)" also lacks `uses` (MA-0124 already filed) → whole legendary section fallback-renders ungated/inert.

## Expected
Per text: as a legendary action the dragon casts Scorching Ray — **2 rays × 2d6 Fire, +12 to hit with spell attacks (app Spellcasting row: spell DC 20, +12 spell attack; spells.json Scorching Ray 2d6 fire per ray, base 2 rays)** — once, consuming 1 of 3 legendary uses, with `ability_use` spend log and the once-until-next-turn latch enforced.

## Static grep (pre-probe)
- `grep -rn "Fiery Rays|fiery_rays" src/ server/` → **zero hits**. No handler/consumer keyed to this row anywhere — inert by construction.
- `grep -ril "scorching" src/` → only test files; no production legendary→spell bridge.
- Render chain: `monsterLegendaryUses.js:127 legendaryHeaderAction` requires `rows[0].uses != null` → null here → `MonsterCardBody.jsx:54` takes the generic fallback branch (no `legendaryGate` prop) → `MonsterAction.jsx:149 LegendarySpendLink` returns `null`; row has no attack_bonus/save_dc/dice → no `.mc-dice-link`/save/spell affordance either. Fully inert `<div class="mc-action">`.

## Live probe (test-campaign, :5173, 2026-09-14)
- Baseline clean: log `[]`, change-data keys `[]`. EB Join "Adult Red Dragon" → `Adult Red Dragon 1` (npc, init 16, hp 256). Target armed → server-verified `targetName:"DivinationWizard"`. Log after join: 2 entries, zero legendary.
- Card overlay open: NO `.mc-legendary-counter` / `.mc-legendary-header-row`. Fiery Rays row innerHTML = `<strong>Fiery Rays.</strong> <span>The dragon uses Spellcasting to cast Scorching Ray…</span>` — **0 interactive children** (no button/role=button/dice-link/spell-link/select). Zero `mc-dice-link-legendary` anywhere in overlay. Commanding Presence/Pounce rows identically inert.
- Forced click probe (`row.click()` + `strong.click()`): zero overlays (`.sp-overlay,.popup-overlay,.popup` all empty), no spell-cast modal, no roll, no spend, no log.
- Control probe: Rend `.mc-dice-link` "+14" → live popup `✓ HIT (33 vs AC 9)`, Done dismissed, `roll` entry logged (log 2→3) — attack affordance path itself works; only the legendary row lacks one.
- Evidence sweep: change-data keys `[]` for economy — `monsterLegendaryUses` **never created** (only `combat-ui-viewingMonster/legendary_actions` stat-block echo). Log: **zero** entries containing "legendary" or "scorching" — no cast, no `ability_use`, no `legendary_use_refused`, no regain.
- Adjacent-but-not-this-row: Spellcasting **action** row exposes a clickable `mc-dice-link-spell :: Scorching Ray` chip (at-will) — that is the regular-action seam; even casting it consumes zero legendary uses and doesn't satisfy Fiery Rays' once-per-turn economy.

## Root cause / Likely location
1. **DATA (primary):** row is prose-only (`"uses Spellcasting to cast X"` shape = MA-0114 Mind Invasion / MA-0094 Mind Jolt family) — no structured cast payload (`spell`/`automation`), and header `legendary_actions[0]` lacks `uses: 3` so the MA-0021 gate can never arm (`monsterLegendaryUses.js:127/:145`).
2. **Render:** `MonsterCardBody.jsx:54-58` fallback passes no `legendaryGate`; `MonsterAction.jsx:148-159` renders nothing without it and no numeric fields exist → zero affordance.
3. No `fiery_rays`/legendary→spell consumer exists app-wide (grep zero) — even a forced click has nothing to fire.

## Steps to Reproduce
1. test-campaign → Encounters → tick Adult Red Dragon → Join Encounter (lands init 16, hp 256; verified 2026-09-14).
2. Arm target on dragon card; open dragon card overlay: no legendary uses counter; "Fiery Rays." row is inert text, 0 interactive children.
3. Force-click the row: nothing happens. No `monsterLegendaryUses` key ever; zero legendary/scorching log entries ever. Control Rend +14 link rolls+logs normally.

## Notes / fix recipe
- MA-0021 recipe prerequisite: author `uses: 3` on the header row (MA-0124 covers this). Then this row needs either structured `automation:{type:…, spell:'scorching-ray'}` routed to the existing spell-cast pipeline with `legendaryGate` click, or the MA-0021 verbatim-row click-to-spend behavior (expend 1 + `ability_use` log) — but the row currently offers neither, and "can't take again until start of its next turn" maps to the existing one-per-other-turn latch once `uses` is authored.
- Note app Scorching Ray base is 2 rays 2d6 each (+spell attack from Spellcasting +12); no auto-multiray producer for monsters exists (§7-adjacent; MV-28 "reference-only rows FAIL" bar).
- Registry: `docs/test-monster-registry.json` has NO "Adult Red Dragon" entry — fresh join this probe (init 16, hp 256); registry re-entry owed to orchestrator.

## Cleanup
- POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified `{}` + `[]`. Browser closed. Manifest `verified` untouched. Registry/manifest not modified.
