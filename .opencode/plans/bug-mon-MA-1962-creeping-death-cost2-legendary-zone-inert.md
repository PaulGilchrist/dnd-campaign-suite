# BUG MA-1962 — Orcus "Creeping Death (Costs 2 Actions)": legendary press honestly spends 2 uses, delivers zero zone/vulnerability (FAIL(b) — MA-1944 twin)

**Verdict: FAIL(b)** — the economy half is LIVE (MA-1883 parses "Costs 2 Actions" from the row NAME and spends exactly 2 of 3 with an honest `ability_use` spend log), but the entire described core effect — a 60-ft-tall, 10-ft-radius necrotic Cylinder granting Vulnerability to Necrotic damage until the end of Orcus's next turn — has NO producer and NO consumer anywhere in the app. Press falls through `resolveLegendaryRowMechanic` to the MA-0510 console dead-end: 2 uses paid, 0% of the effect delivered. Exact Ladon MA-1944 fingerprint.

## Row (disk-truth, byte-confirmed 2026-10-12)
- id `MA-1962` · `orcus|legendary_actions|2` · manifest actionType `aoe-save` (disk carries NO te/zone/save fields — pure prose child row)
- actionName: `Creeping Death (Costs 2 Actions)` · NO `delegates_to`, NO `automation`
- description (verbatim):
  `"Area Effect: a 60-foot-tall, 10-foot-radius Cylinder of swirling necrotic energy rises from a point it can see within 100 ft. and lasts until the end of Orcus's next turn. Creatures in the area have Vulnerability to Necrotic damage. No saving throw, no damage."`
- No `id`/`delegates_to` keys exist on the child object (monsters.json:25438-25441) — differs from sibling `legendary_actions[1]` "Attack" which carries `delegates_to: "Necrotic Bolt"`.

## Expected Behavior (RAW)
1. Chip press at a legal after-another-creature's-turn boundary spends 2 uses (LIVE — happens).
2. A point-targeted 100-ft cylinder zone is created/tracked, lasting until end of Orcus's next turn.
3. Creatures in the area have Vulnerability to Necrotic damage (needs a necrotic-vulnerability te on each creature, or a zone-membership model + damage-tick multiplier consumer).
4. No save, no damage at creation (correctly zero — but nothing else lands either).

## Actual Behavior (live evidence, test-campaign, dev :5173, 2026-10-12)
- Fresh EB exact-"Orcus" join + exact-"Bandit" join → cs: Bandit 1 idx0 init 16 (11/11, AC12 statics), Orcus 1 init 5 (405/405). Header==test-campaign every step. (cs is initiative-sorted: Orcus lands idx1, not idx0 — cosmetic ordering only, both monsters on board.)
- **Chip renders**: `.mc-action` row 12 `strong` "Creeping Death (Costs 2 Actions)." + `span.mc-dice-link.mc-dice-link-legendary` text "Expend Legendary", enabled — children auto-render chips (MA-1944 fingerprint part 1). Cosmetic title defect repeats: chip title says **"Expend 1 legendary use"** while the press spends 2 (MonsterAction.jsx:221 hardcoded, same note as MA-1944).
- **Fresh-boundary press** (boundary after Bandit 1's turn, tracker active=AberrantSorcerer): `cd['Orcus 1'].monsterLegendaryUses {max:3, used:2}` — spends exactly 2. ONE spend log `ability_use`: **"Orcus 1 spends 2 legendary uses for Creeping Death (Costs 2 Actions) after AasimarTest's turn — 1 of 3 left (regain at the start of Orcus 1's turn; 4 in lair advisory)."** Economy byte-honest.
- **ZERO core effect**:
  - NO popup / zone-placement chooser / instructions on the spending press (popups[] empty).
  - `cd` zone/area/vulnerability/cylinder/te key grep: **0** store keys (`zoneKeys: []`); full-cd text grep hits only the description prose echoes inside combatSummary + static `vulnerabilities` array fields.
  - Bandit 1 (armed target via own-card `[data-testid="target-select"]`, armedVal "Bandit 1"): **cd store ABSENT**, activeConditions delta **zero**, `vulnerabilities: []` unchanged, hp 11/11 (row says no damage — correct, but vacuous).
  - Top-level `targetEffects`: **ABSENT**.
  - Log after press: type census `{encounter:2, roll:2, ability_use:1}` — ZERO te/zone/area entries; zone|area|vulnerab|targetEffect log grep: **0 hits**.
  - **Console error (MA-0510 silent-burn signature, the ONLY session error):** `[MonsterCardModal] legendary action "Creeping Death (Costs 2 Actions)" delegates_to "undefined" — no resolvable mechanic on "Orcus 1"`.
- **Press #2 same boundary**: honest refusal popup `.popup-modal .mc-prerequisite-refusal` **"Legendary Action Refused — Creeping Death (Costs 2 Actions): Only one legendary action can be expended immediately after each creature's turn. Nothing spent, no roll."**; `used` stays 2 — economy gate alive, no double-burn. (Refusal popup is dismissed by its `Done` button — Escape does NOT clear `.popup-overlay`, which then intercepts all clicks; playbook.)

## App-wide grep evidence (2026-10-12, non-test)
- `grep -rn -i "creeping" src/ server/` → **ZERO consumers** — the row name is consumed by nothing outside generic legendary-economy text plumbing.
- `targetEffectDefinitions.js` vuln grep → only `'Globe of Invulnerability'` label (line 940); **no necrotic-vulnerability te exists** — cannot even be granted by manual add (EffectAdder reads solely this registry).
- Cylinder-zone consumers: all `cylinder` hits are spell-overlay/3D lanes (`SpellOverlay.js`, `map3dSpellOverlays.js`, `SpellOverlayControls.jsx`, etc.) — no legendary/monster-action zone producer; §70 wall-objects/zone-dict unbuilt.

## Likely Location
- **Data layer (primary): `public/data/monsters.json` `orcus.legendary_actions[2]` child-row data gap.** To be buildable the row needs: (1) a structured zone dict (MA-0043/MA-378 shape: `zone {shape:"cylinder", radius_ft:10, height_ft:60, range_ft:100, duration:"end_of_my_next_turn"}`), (2) a registered **necrotic-vulnerability te** in `targetEffectDefinitions.js` (does not exist app-wide), and (3) a recurring tick/expiry consumer (§87 template) to area-apply and expire it. None of the three exist.
- `src/components/encounter/MonsterCardModal.jsx` `resolveLegendaryRowMechanic` — attack/save/advisory/self-buff/damage branches all miss a zone-child row; dies at the `console.error` dead-end (MA-0510).
- `src/services/encounters/monsterLegendaryUses.js` `legendaryActionCost` — the LIVE half: parses "Costs 2 Actions" from the name (MA-1883), so the spend engages a row with no payload.

## Notes
- **Advisory-precedent options (orchestrator call, MA-1060 Kraken saveless-vulnerability family):**
  - (A) *Data-only advisory lock*: `advisory:"creeping_death"` + `advisory_message` carrying RAW numerics (cylinder dims, range, duration, "Vulnerability to Necrotic — GM-enforced"). If the press then logs actionable instructions, re-adjudication per MA-1060 could reach PASS-subset; today's log carries only economy facts + generic lair-uses advisory, no effect instructions → stays FAIL(b).
  - (B) *Full build*: structured zone dict consumer + necrotic-vulnerability te registration + §87 recurring tick/area-membership + expiry — exceeds one-field fix; new machinery (no cylinder te consumer outside spell overlays app-wide).
- Negative-economy row: takes 2-use payment (of max 3 — half the pool) and delivers zero of the described effect; 4-in-lair regain text in the spend log is inert advisory (§70).
- Cleanup verified: refusal popup + card closed → Admin Clear Change Data + Clear Campaign Log (confirms accepted) → cd `{}` / log `[]` quiet 15s. No summons/zone residue (none created). Manifest untouched, no git writes.
- Verified 2026-10-12, :5173, test-campaign, Orcus 1 (405/405, init 5, leg 3/3→1 left) + Bandit 1 (11/11 AC12) armed target.
