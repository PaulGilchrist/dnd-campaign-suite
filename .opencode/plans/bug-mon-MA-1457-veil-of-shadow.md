# BUG MA-1457 — Shadow Dragon Veil of Shadow (legendary_actions|1) — FAIL(b)/DATA (silent-burn, MA-0510)

**Verdict: FAIL(b)** — the lone `.mc-dice-link-legendary` chip IS this row's affordance, and clicking it burns the shared legendary use with **ZERO damage, ZERO stealth posture, ZERO popup** — pure MA-0510 silent-burn, console.error confirmed live. The row authors nothing the resolver can consume: no `delegates_to`, no automation, no numeric attack/save/dice fields, and prose "10 (3d6)" lacks the `Hit/Failure/Success:` anchor the dice extractor requires.

## Row
```json
{"id":"MA-1457","stableKey":"shadow-dragon|legendary_actions|1","monster":"Shadow Dragon","actionName":"Veil of Shadow","actionType":"other","category":"legendary_actions","uses":1,"recharge":false,"description":"The dragon uses Shadow Stealth, and one creature of its choice that it can see within 10 feet of it takes 10 (3d6) Necrotic damage. The dragon can't take this action again until the start of its next turn."}
```

## Static proof
- Disk `public/data/monsters.json` shadow-dragon.legendary_actions[1]: fields = `name/description/uses:1/recharge:false` ONLY. No `delegates_to`, no `automation`, no `attack_bonus`/`save_dc`/`damage_dice_primary`.
- App grep: `veil_of_shadow` / "Veil of Shadow" / `shadow_stealth` = **zero consumers** (sole hit npcGenerator.js:54 flavor trait, unrelated). No stealth/hide te producer for monsters.
- Handler path (`src/components/encounter/MonsterCardModal.jsx`):
  - `resolveLegendaryRow` :671 — **`expendLegendaryUse` runs BEFORE `resolveLegendaryRowMechanic` (:677)** ⇒ spend precedes any mechanic attempt ⇒ burn is structural.
  - `legendaryRowHasNumericMechanic` :571 false; `delegates_to` undefined ⇒ delegate leg skipped (:646).
  - `resolveLegendaryRowMechanic` final else :600-603: `extractDamageDiceFromDescription` (:685-690) requires `/Hit|Failure|Success:\s*\d+\s*\((\d+d\d+...)\)/i` — row description has "takes 10 (3d6)" with NO anchor ⇒ null ⇒ **console.error "delegates_to undefined — no resolvable mechanic"** (:603, MA-0510 fingerprint).

## Live evidence (test-campaign; Shadow Dragon 1 AC16 init32 cs idx0 + Bandit 1 AC12 hp11; header verified test-campaign; EB join "Shadow Dragon"+"Bandit", cs re-verified)
| Probe | Result |
|---|---|
| Card audit | exactly 1 `.mc-dice-link-legendary` = "Expend Legendary", title "Expend 1 legendary use — Veil of Shadow"; Pounce renders header text "Pounce (1 left)" (MA-1456 header-swallow persists) |
| 1st click @ uses=1, active=AasimarTest r1 | spend log `ability_use` "expends a legendary use for Veil of Shadow after AasimarTest's turn — 0 of 1 left"; `monsterLegendaryUses {max:1, used:1}`; latch `veil_of_shadow {round:1}` stamped; **popup: none**; **log delta: spend entry ONLY — zero `roll damage`, zero `hp_change`, zero `condition applied`**; Bandit hp 11 (full) — promised 3d6 necrotic NEVER rolled; dragon: no te, no activeConditions, no stealth badge; console ERROR: `[MonsterCardModal] legendary action "Veil of Shadow" delegates_to "undefined" — no resolvable mechanic on "Shadow Dragon 1"` = MA-0510 live |
| 2nd click same round | refusal popup "has no legendary uses left — they regain at the start of Shadow Dragon 1's turn. Nothing spent, no roll." + `automation/legendary_use_refused (exhausted)`; counter held — **gate LIVE** |
| Turn-start regain (next-click walk to gate `2:Shadow Dragon 1`) | `ability_use` "regains all expended legendary action uses at the start of its turn — 1 available"; `{max:1, used:0}`; `monsterLegendaryActionCooldowns` cleared — **economy LIVE** |

## Judgment (row half vs economy half)
- Economy half (counter/spend/refusal/regain): PASS via the Pounce-swallowed header counter (§99, shared with MA-1456).
- **Row half: FAIL(b)** — the chip IS reachable (unlike §199 harder-zero) yet resolves NOTHING: spends 1, rolls no 3d6, damages nobody, grants no stealth/hidden state. "Shadow Stealth" clause = even post-fix would need a self-invisibility consumer (MA-0658/§69 advisory class; Cloaked Flight CLA-325 precedent).

## Likely Location / fix (DATA-first, same-pass with MA-1456 root)
1. **Shared root (MA-1456 file):** header-swallow — rows[0] Pounce has `uses:1`, no header row; prepend canonical `{name:"Legendary Action Uses: N", uses:N}` header, drop child `uses` (§46/§165/§168).
2. **This row (DATA):** needs numeric/damage transport — minimal: `damage_dice_primary:"3d6"` + `damage_type_primary:"Necrotic"` (handleDamage leg :602 rolls 3d6 vs armed target) — or numeric spell fields; the 10-ft "one creature of its choice it can see" + "until start of next turn" clauses ride the legendary gate/latch (live). Shadow Stealth posture = separate self-te gap (§69/MA-0658 advisory unless a self_condition seam lands).

## Notes
- §98 honored: counter+log diffed per click; expend chip landed first click (MA-231 twin).
- No API mutation POSTs; only sanctioned admin clears at cleanup.
- Injection: none observed this session beyond known echo noise; page stayed localhost, URL values self-verified.
