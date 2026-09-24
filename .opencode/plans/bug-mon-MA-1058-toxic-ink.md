# MA-1058 — Kraken "Toxic Ink" (legendary_actions[1], uses:1) — FAIL(b) SPEND-BURN / DATA prose-only-DC

- **id:** MA-1058 | **monster:** Kraken (`kraken`) | **row:** legendary_actions[1] | **category:** legendary save
- **actionName:** Toxic Ink | **disk (public/data/monsters.json:37065-37074):** `{name:"Toxic Ink", uses:1, recharge:false, save_type:"Constitution", save_effect:"Failure: The target has the Blinded and Poisoned conditions...", description:"Constitution Saving Throw: DC 23, each creature in a 15-foot Emanation..."}` — **NO numeric `save_dc`, NO `range` field, NO damage dice** (damageless save; "DC 23" is prose-only → MA-0237/0318/0328/0362 prose-DC family)
- **verdict:** FAIL(b) — Expend chip spends the legendary use, then console.error dead-end; save never adjudicated, zero conditions
- **date:** 2026-09-24 | **campaign:** test-campaign (header verified `test-campaign`; localhost:5173 only; rig LIVE Kraken joined, Bandit 1 AC12 819/999)

## Expected (disk/truth)

Con save DC 23, each creature in 15-ft Emanation from kraken. Fail = Blinded + Poisoned until kraken's next turn end. **No damage** (task's "5d8 Poison" guess refuted by disk — zero dice anywhere on the row). Reuse-limit "can't take this action again until start of its next turn" (byte in description → MA-0073 cooldown clause parses).

## Actual (live, chip `span.mc-dice-link-legendary` title "Expend 1 legendary use — Toxic Ink" — the ONE legendary chip per MA-1057, affordance confirmed live)

Press 1 (activeCreatureName=Kraken 1): refusal popup verbatim `"Legendary Action RefusedToxic Ink: Kraken 1 expends legendary uses after ANOTHER creature's turn, not its own. Nothing spent, no roll."` + log `legendary_use_refused (own-turn)` ×2 (presses 1–2). Economy gate LIVE and correct.

Initiative walked ("Next →") to active=Jackalwere 1 (cs mirror lagged `activeCreatureName:"Kraken 1"` across 5 polls — §4 lag confirmed live, synced after further walk).

Press 3 (valid window) — **SPEND LANDED, MECHANIC DIED:**
- log `ability_use`: `"Kraken 1 expends a legendary use for Toxic Ink after Jackalwere 1's turn — 0 of 1 left (regain at the start of Kraken 1's turn; 4 in lair advisory)."`
- stamp `Kraken 1.monsterLegendaryUses = {max:1, used:1}`; header counter `(1 left)` → `(0 left)`
- **Save flow: NONE.** No `.sp-modal` prompt, no SaveAttackAoeModal picker (Emanation never arms — row has no `range` field; MA-0590 seam reads RANGE only, description deliberately unparsed), no Bandit 1 save roll, no `saveResult-Bandit 1` key, no `pendingSavePrompts`.
- `Bandit 1.activeConditions = []` (honest — nothing applied; Blinded/Poisoned never landed), HP 819/999 unchanged → fd==|hpΔ|==0 byte-consistent with disk zero-damage.
- **Console error 1 (not 0):** `[MonsterCardModal] legendary action "Toxic Ink" delegates_to "undefined" — no resolvable mechanic on "Kraken 1"`

## Root cause

`resolveLegendaryRowMechanic` (MonsterCardModal.jsx:565-592) dispatches save ONLY on `action.save_dc != null`; prose "DC 23" has no fallback (§6 — prose fallback exists only for "+N to hit"). Toxic Ink falls through to the else branch: `extractDamageDiceFromDescription` → null (no "Failure: N (dice)" pattern, damageless by design) → `console.error` — **silent burn**: use spent+stamped, adjudication zero. Exact §5 MA-0021 fingerprint ("Expend Legendary chip silently BURNS uses on inert rows, console.error 'no resolvable mechanic'"). Compounds MA-1057: kraken legendary block never received the §99 header/children fix pass.

## Fix (data-shaped, machinery live)

1. Toxic Ink row: add `save_dc: 23` (+ keep save_type/save_effect) → `handleSaveRoll` leg arms; conditions extract from save_effect ("Blinded"/"Poisoned" canonical words byte-present, MV-31 OK).
2. If emanation picker wanted: add `range: "15-foot Emanation"` (MA-0590 seam) — else single-target save degrades honest (MA-0317).
3. Same pass as MA-1057 §99 header insert (header `uses:3`, children drop `uses`) — header+children MUST be fixed together (§5).

## Cleanup / integrity

Card closed (×); overlays 0 / popups 0 / sp 0. Bandit 1 cond-clean GET proof `activeConditions:[]` + `activeConditionMeta:{}` (nothing to remove). Bandit 819/999 untouched; rig intact (round 8, active Jackalwere 1; Kraken uses `{max:1,used:1}` honest burn, regains at own turn-start). No clears, no manifest edit, no git writes. Security: navigate echoes carried off-site aliyuncs rewrite (§9 fingerprint) — rejected; `location.href` self-verified `http://localhost:5173/`; test-campaign only.
