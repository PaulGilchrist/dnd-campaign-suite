# MA-1975 — Quetzalcoatl "Wind Step (Costs 2 Actions)": generic Expend chip SPENDS 2 legendary uses, no teleport, no Talon attack (FAIL(b), DATA — active trap)

- **Row**: `MA-1975` · Quetzalcoatl (`quetzalcoatl`) · `legendary_actions[3]` · "Wind Step (Costs 2 Actions)"
- **Description verbatim**: `"Quetzalcoatl rides a sudden gale, teleporting 60 ft. to an unoccupied space he can see, then making one Talon attack."`
- **Row keys on disk** (`public/data/monsters.json`): `{name, description}` only — NO `delegates_to`, NO `advisory`, NO automation, no `attack_bonus`/dice.
- **Verdict**: **FAIL(b)** — DATA class, active trap. Press **spends TWO legendary uses and resolves NOTHING**: no movement/teleport record, no Talon attack, popup null, console MA-0510 dead-end. Strictly worse than the Detection twin (MA-1974, same card, filed minutes earlier) — Detection costs 1 and promises only a check; Wind Step costs 2 and promises an entire teleport-then-Talon sequence that never happens.

## Expected
Pressing Wind Step at a legal boundary spends 2 of 3 legendary uses (MA-1883 name-cost parse — live, works) and then resolves the row's authored mechanic per the description:
1. a teleport/relocation of 60 ft (at minimum an advisory record: gridless move consumer is unbuilt, §70/CLA-320), AND
2. **one Talon attack** — resolvable TODAY via `delegates_to: "Talon"` (regular twin `actions[2]`: +16, `4d8 + 8` Slashing), exactly as the legendary Talon child MA-1973 does.
Zero-effect after a 2-use spend is the worst possible outcome in the MA-0510 spend-no-effect family.

## Actual — TWO-RUN EVIDENCE (identical outcome, independent boards)

### Run A (crashed prior run — log recovered via GET :80/api/campaigns/test-campaign/log)
- `ability_use`: `"Quetzalcoatl 1 spends 2 legendary uses for Wind Step (Costs 2 Actions) after AasimarTest's turn — 1 of 3 left (regain at the start of Quetzalcoatl 1's turn; 4 in lair advisory)."` — LEGIT 2-use spend (MA-1883 parse live).
- `automation` `legendary_use_refused`: `"Quetzalcoatl 1 Wind Step (Costs 2 Actions) legendary action refused (turn) — zero spend, no roll."` — economy gate alive.
- **ZERO roll / damage / teleport / hp_change entries in the entire log** — spend produced no Talon attack, no movement. Trap confirmed at log level.

### Run B (this run — fresh session, Playwright strict E2E, dev :5173, header==test-campaign every step)
Pre: fresh tab → select test-campaign → EB exact-filter join **Quetzalcoatl + Bandit** (board absent after crash: combatSummary GET null) → cs r1 `Bandit 1` init 17 AC12 HP11→**rigged 999** via tracker current-HP spin fill+Enter (cd-verified 999) + `Quetzalcoatl 1` init 16 AC22 HP594; armed `Bandit 1` via `.creature-card:has(img[alt="Quetzalcoatl 1"]) select`; cd `Quetzalcoatl 1` block ABSENT (fresh 0/3); console 0 errors; log baseline 10.
Walk: Next x13 → round-wrap r1→r2, fresh boundary stamped **after Wild_Sage_Druid's turn** (MA-1973).
- **Press #1** (`.mc-overlay .mc-action:has(strong ^ 'Wind Step') .mc-dice-link`, chip = generic `mc-dice-link mc-dice-link-legendary` "⚡ Expend Legendary"):
  - cd oracle: `Quetzalcoatl 1.monsterLegendaryUses {max:3, used:2}` — **2 uses spent**, stamp `_legendaryUses_usedRound {round:2, activeCreature:"Wild_Sage_Druid"}`; header flips "(3 left)"→"(1 left)".
  - log +1 ONLY: `ability_use` `"Quetzalcoatl 1 spends 2 legendary uses for Wind Step (Costs 2 Actions) after Wild_Sage_Druid's turn — 1 of 3 left (regain at the start of Quetzalcoatl 1's turn; 4 in lair advisory)."`
  - **+0 attack rolls, +0 damage, +0 hp_change, +0 movement/teleport entries** (both runs); Bandit cd HP frozen at 999; popup `null`.
  - console x1, the MA-0510 signature verbatim: `[MonsterCardModal] legendary action "Wind Step (Costs 2 Actions)" delegates_to "undefined" — no resolvable mechanic on "Quetzalcoatl 1"`.
- **Press #2 same boundary**: `legendary_use_refused (turn)` log + in-card popup `"Wind Step (Costs 2 Actions): Only one legendary action can be expended immediately after each creature's turn. Nothing spent, no roll."` + Done closes popup (overlay persists → `.mc-close`). Economy gate correct; does not mitigate the trap.

Description chip row census: byte-verbatim description, counters [], NO check chip (`mc-dice-link-check` absent), NO spell/numeric chips — just the bare MA-0021 generic expend fallback armed on a 2-cost prose row.

## Steps (repro)
1. test-campaign, EB exact join Quetzalcoatl + Bandit; rig Bandit HP 999; arm Bandit 1 on Quetzalcoatl's card target select.
2. Open Quetzalcoatl card; walk Next to a fresh boundary (round-wrap stamp, MA-1973).
3. Press Wind Step's generic "Expend Legendary" chip → 2 uses spent, log spend-only, console MA-0510 error, no roll/popup/move.
4. Re-press same boundary → "(turn)" refusal popup (Done), zero spend.

## Likely Location
- `public/data/monsters.json` `quetzalcoatl.legendary_actions[3]` = `{name, description}` only → at press time: `MonsterAction.jsx:217-224` numericAffordance false → generic `LegendarySpendLink` chip; `MonsterCardModal.jsx:895` delegate lane requires `delegates_to` → SKIPPED (no key, MA-1944/1952 precedent); `:912` `legendaryCheckRow` null (no `ability_check`, MA-1974 twin); `:920` `expendLegendaryUse` **spends unconditionally** (MA-1883 `monsterLegendaryUses.js:180` name parse → cost 2, :305 "spends 2" log shape); `:926` → `resolveLegendaryRowMechanic` final `else` `:773-776` → **console.error dead-end AFTER the 2-use spend** (`:776`).
- **Teleport leg**: no consumer exists anywhere on the monster legendary lane — app-wide `teleport` hits are player-class automations (`psychicTeleportationHandler.js`, giantAncestry/Cloud's Jaunt log-only) or the advisory-record lane (`monsterActionAdvisory.js`, MA-1223). `monsterLegendaryUses.js:275` states it: *"sphinx teleport has no position consumer"* — grid token move §70 unbuilt (CLA-320).

## Fix options
- **Full RAW** (teleport 60 ft THEN one Talon attack) needs CODE: a gridless movement/token-relocation consumer (§70) — out of DATA scope.
- **Interim honest DATA fixes** (pick one):
  1. **Advisory-record row** (CLA-320 sibling, androsphinx exact twin on disk): add `"advisory": "sphinx_teleport"`-style key (e.g. reuse MA-1223 `monster_teleport` or MA-1581 `sphinx_teleport` precedent key) + `advisory_message` covering BOTH legs (relocation GM-enforced; Talon strike to be resolved by pressing legendary Talon separately) — lands popup + adjudication log after the 2-use spend via `MonsterCardModal.jsx:755-761` instead of the console dead-end.
  2. **Ability delegation**: add `"delegates_to": "Talon"` — attack leg resolves TODAY (MA-1973-verified twin, +16 `4d8 + 8`), spend stays 2 via MA-1883 name parse; teleport leg must then be worded advisory in the row or a known-gap note — delegation alone silently drops the movement promise, so option 1 (or 1+2 shape where advisory text carries the relocation) is the honest recommendation.
- Do NOT leave as-is: a silent 2-use burn is strictly worse than the MA-1974 1-use burn.

## Notes
- **Same-card twin axis**: Detection `legendary_actions[2]` filed FAIL(b) MA-1974 (spend 1, zero check, same :776 dead-end). Wind Step is the **strictly-worse** sibling: cost 2 AND promises a multi-part mechanic (move + attack) that is wholly inert.
- NEW this run: generic chip title reads `"Expend 1 legendary use — Wind Step (Costs 2 Actions)"` — **title/cost mismatch on Costs-N rows** (click spends 2 per MA-1883, title still says 1, `MonsterAction.jsx:221`).
- NEW this run: boundary stamp `_legendaryUses_usedRound.activeCreature` keys the JUST-ENDED turn (Wild_Sage_Druid) while `cd.activeCreatureName` already shows the NEXT active (AasimarTest) — audit boundary by the stamp, not by active.
- Quirk re-confirmed: open `.mc-overlay` intercepts tracker "Next →" clicks — close `.mc-close` to walk, reopen after (extends MA-1968 hp-inline note).
- Run A foreign log noise ("FeyRanger Ambusher's Leap", prior session) ignored; both cleared by admin clears.
- Cleanup: refusal popup Done → `.mc-close` → Admin Clear Change Data + Clear Campaign Log (both `window.confirm`, both landed first click — no silent-no-op retry needed) → two-pass GET ~18s: cd `{}` + log `[]`. Manifest untouched; no git writes.
