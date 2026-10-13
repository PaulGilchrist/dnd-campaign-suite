# MA-2002 — Smaug the Golden, Legendary "Detection" (legendary_actions[4]) — ACTIVE TRAP

## Verdict
**FAIL (b) / DATA** — MA-1974 ACTIVE-TRAP family: the press silently burns a legendary use and resolves nothing. Strictly worse than inert.

## Overview
`public/data/monsters.json` → Smaug the Golden `legendary_actions[4]` =
`{name:"Detection", description:"Smaug makes one Perception check."}` — **no `ability_check` field**, no numeric fields.
Without `ability_check`, `legendaryCheckRow()` (monsterLegendaryUses.js:210-213) returns null, so the row renders the **generic Expend chip** (MonsterAction.jsx:221, `mc-dice-link-legendary`, no `mc-dice-link-check`, no "+N" bonus) instead of the live check chip (MonsterAction.jsx:203).

On press, `legendaryGate` (MonsterCardModal.jsx ~:920) calls `expendLegendaryUse()` **unconditionally** — no check-bonus pre-gate can refuse because `checkBonus` stays null — the use is spent, then `resolveLegendaryRowMechanic` finds no damage formula in the prose and hits the **console.error dead-end** at MonsterCardModal.jsx:776:
`[MonsterCardModal] legendary action "Detection" delegates_to "undefined" — no resolvable mechanic on "Smaug the Golden 1"`.
Net effect: 1 legendary use silently destroyed, zero Perception check, zero popup, zero roll log.

## Expected (per row description)
"Smaug makes one Perception check." → a live check chip `Wisdom (Perception) +N` that spends 1 legendary use **then rolls d20 + bonus** with a check popup + roll log entry (MA-0051 / MA-1910 Garuda / MA-1974 Quetzalcoatl lanes).

## Actual (live evidence, 2026-10-12, test-campaign round 4, active=Bandit 2)
1. **Census:** Detection row chip = `mc-dice-link mc-dice-link-legendary`, text "Expend Legendary", title "Expend 1 legendary use — Detection" — NO `mc-dice-link-check`, NO "+N" (trap renders zero bonus; RAW would be ~+11 proficient, stat-block wis mod +3).
2. **Control probe at legal fresh boundary (pool=1, used=2/3):** native `el.click`, fresh rect, 1 press (no absorb):
   - `monsterLegendaryUses.used` **2→3**, header flips "(1 left)"→"(0 left)" — use SPENT.
   - Console error captured: `[MonsterCardModal] legendary action "Detection" delegates_to "undefined" — no resolvable mechanic on "Smaug the Golden 1"` (:776 dead-end).
   - **ZERO popup, ZERO `type:"roll"` / check entries** — fresh log = ONE bookkeeping `ability_use` entry only ({characterName:"Smaug the Golden 1", abilityName:"Detection"}).
3. **Economy gates honest (payload dead, gates intact):** re-press at same boundary → `automation`/`legendary_use_refused` log "Detection legendary action refused (exhausted) — zero spend, no roll"; `used` stays 3. Same-boundary "turn"-vocabulary refusals confirmed live earlier same-session (MA-2001 Flame Lash own-turn refusal) — gate machinery sound; only the Detection payload is dead.

## Steps to Reproduce
1. :5173 → `test-campaign` → Initiative (board: Smaug the Golden 1 + Bandits; pool 1 at fresh boundary).
2. Open Smaug card (`img[alt="Smaug the Golden 1"]` avatar → `.mc-overlay`).
3. Census Detection row: generic Expend chip, no check chip.
4. Native-click the chip at a legal boundary → use spent 2→3, "(0 left)", console error "no resolvable mechanic", no popup, no roll logged.

## Likely Location
**monsters.json data drift** (authoring omission), NOT engine code. Consumers are all present and correct:
- `MonsterAction.jsx:203` (check chip lane) — unreachable without `ability_check`.
- `MonsterCardModal.jsx:912-919` (check-bonus pre-gate, zero-spend refusal) + `:920` unconditional `expendLegendaryUse` + `:776` dead-end console.error.
- `monsterLegendaryUses.js:210-227` (`legendaryCheckRow` / `legendaryCheckBonus` / `legendaryCheckLabel`).

## Fix (one field — MA-1910 Garuda / MA-1974 Quetzalcoatl byte-twin)
Add to `legendary_actions[4]` (key order name → ability_check → description):
```json
{ "name": "Detection", "ability_check": { "ability": "wisdom", "skill": "perception" }, "description": "Smaug makes one Perception check." }
```
Bonus lane: `monster.skills` miss → `ability_score_modifiers.wis` fallback → live chip "Wisdom (Perception) +3"; spends-then-rolls honestly via `rollSkillCheck` seam.

## Notes / Pitfalls
- Flagged in advance by MA-1998 registry ("Detection prose child renders 3rd generic Expend chip (MA-1974 trap) on smaug card too") — now live-confirmed.
- Detection's same-boundary repress reported `(exhausted)` not `(turn)` because pool hit 0 — MA-1883 floor-vs-latch ordering; both refusal vocabularies are honest zero-spend refusals.
- Refusal popup was not visible via `.popup-overlay` selector on exhausted presses; refusal truth = `legendary_use_refused` log entries (log oracle).
- Post-fix verification note: stale check popups can survive and absorb the next chip press — flush inner `popup-close-btn` before re-press probes (MA-1974 pitfall).
- Cleanup done: `.mc-close` overlay → admin-clear change-data + log via curl :80 → GET-verified `cd {}` + `log []`. App RUNNING; legendary pool reset by clear.
