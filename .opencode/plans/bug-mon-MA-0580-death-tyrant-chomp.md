# BUG MA-0580 — Death Tyrant "Chomp": header-swallow, zero affordance, no two-Bite resolution

**Verdict: FAIL — DATA (§99/§110 header-swallow, MA-0510 precedent).** test-campaign only.

## Expected (manifest MA-0580 + RAW)
Death Tyrant legendary_actions[0] "Chomp" (actionType other): *"The death tyrant makes two Bite attacks."* Should be a spendable legendary row resolving TWO Bite attacks (+9 to hit vs AC, 2d8+4 Piercing each), riding a header counter of **2** total legendary uses per round.

## Disk — public/data/monsters.json death-tyrant.legendary_actions VERBATIM
```json
[
  {
    "name": "Chomp",
    "description": "The death tyrant makes two Bite attacks.",
    "uses": 1
  },
  {
    "name": "Glare",
    "description":
      "The death tyrant uses Eye Rays.",
    "uses": 1
  }
]
```
- **rows[0] is NOT the header dict "Legendary Action Uses: 2"** — Chomp (uses:1) is swallowed as the header (§99). No numeric header exists.
- Chomp carries **no `attack_bonus` / `damage_dice_primary` / `delegates_to:"Bite"`** — prose-only child, no resolvable mechanic.
- Manifest `uses:1` reconciles with Chomp's own child field (derived from child, not a header) — but the RAW total is **2**; the app economy max becomes **1**.

## Actual (live evidence, test-campaign)
- Card renders header row `Chomp (1 left)` — not clickable (`headerClickable:false`), **Chomp has ZERO chips** (`chompChips:0`, `.mc-dice-link` filtered "Chomp").
- Only legendary chip: `Expend Legendary` title "Expend 1 legendary use — Glare" (rows[1]).
- Click #1 (Glare chip, active=AberrantSorcerer, armed=Bandit 1): counter **(1 left) → (0 left)**; log `ability_use` "Death Tyrant 1 expends a legendary use for Glare after AberrantSorcerer's turn — 0 of 1 left"; **zero attack/damage rolls**; console error fired.
- Console (browser_console_messages): `[MonsterCardModal] legendary action "Glare" delegates_to "undefined" — no resolvable mechanic on "Death Tyrant 1"` @ MonsterCardModal.jsx:588 — exact §99 silent-burn fingerprint.
- Click #2: refusal popup "no legendary uses left … Nothing spent, no roll" + `automation / legendary_use_refused (exhausted)`; counter stays (0 left). Economy gate (spend/refuse/regain latch) is LIVE but rides the wrong max.
- Two-Bite proof: `attackRolls:0`, `biteLogs:0` in log; Bandit 1 HP unchanged **999 → 999**. Chomp never fired once, let alone twice.

## Grep evidence (code consumers)
- `src/services/encounters/monsterLegendaryUses.js:153` `legendaryHeaderAction` → `rows[0]?.uses != null ? rows[0]` — Chomp IS the header, `legendaryMaxUses` = 1.
- `src/components/encounter/MonsterCardBody.jsx:54` `actions.slice(1)` — Chomp never reaches MonsterAction; only Glare row renders.
- `src/components/encounter/MonsterAction.jsx:161-171` `LegendarySpendLink` — Glare (no numeric, no check) → generic "Expend Legendary".
- `src/components/encounter/MonsterCardModal.jsx:436` — spends then `console.error … no resolvable mechanic` (delegates_to undefined branch).

## Likely Location
**DATA shape** in `public/data/monsters.json` death-tyrant `legendary_actions` (consumers MonsterCardBody/MonsterAction/MonsterCardModal/monsterLegendaryUses all behave per authored shape). Fix shape (same pass, §46):
```json
[
  { "name": "Legendary Action Uses", "uses": 2 },
  { "name": "Chomp", "description": "The death tyrant makes two Bite attacks.", "delegates_to": "Bite" },
  { "name": "Glare", "description": "The death tyrant uses Eye Rays.", "delegates_to": "Eye Rays" }
]
```

## Notes
- §99/MA-0510 precedent honored: rows[0]-with-uses header-swallow + delegates_to:undefined silent-burn console.error confirmed byte-fingerprint live.
- §110 nuance: Glare rows[1] got its own chip riding the swallowed header counter; max=1 makes RAW 2-uses/round unrepresentable even after fix unless header authored.
- Residual even after delegate fix: delegate seam resolves ONE Bite per click; "two Bite attacks" count enforcement has no per-row repeat producer (§66 multiattack GM-adjudicated analogue).
- §148 noted: activeCreatureName None right after joins; chip fired legitimately off-turn once initiative walked to AberrantSorcerer. cs `activeCreatureName` mirror stayed None while top-level change-data key = truth (§31/§110).
- Manifest uses:1 matches disk child (not drift), but label semantics differ: manifest row-level uses vs economy total 2 — orchestrator owns manifest.
