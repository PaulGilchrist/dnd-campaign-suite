# bug-mon-MA-1215-animating-spores

## Title
Myconid Sovereign "Animating Spores" (MA-1215): junk "+0" chip adjudicates a bogus zero-damage to-hit roll AND spends the Recharge-3 economy on it, while the RAW corpse→Spore Servant spawn mechanic has no consumer and no §6 sentinel

## Overview
MA-1215 (myconid-sovereign actions[2], "Animating Spores") is a corpse-animation utility row: zero attack, zero DC, zero damage, `recharge: "3"`, entirely narrative (24-hour delayed summon of a Myconid Spore Servant, animate duration 1d4+1 weeks, no-reanimate flag). Disk authors no automation, no §6 RAW sentinel, no effect key, no structured spawn data. Its ONLY clickable affordance is the junk "+0" attack chip (`attack_bonus: 0` ≠ null, MonsterAction.jsx:338 `actionHasAttack`), which — unlike the MA-1212 Rapport Spores twin — is RECHARGE-GATED (MA-0294 attack-roll seam): every press rolls a bogus bonus-0 to-hit attack against the armed target (silently "hit" with `damageType: null`) AND spends the Recharge-3 economy (`ability_use` + `monsterRecharge{recharged:false, threshold:3}`). Refusal and d6-threshold recovery behave correctly, i.e. a fully-live partial economy adjudicating a RAW-nonexistent attack leg. Meanwhile nothing in the app models a corpse, records the 24-hour animation timer, or spawns a Myconid Spore Servant — the mechanic has zero consumers even though the Servant stat block ships in `public/data/monsters.json`. MA-1212 precedent (same session, same monster family): zero-number narrative row whose sole affordance is a junk "+0" chip → FAIL(b); here the same defect plus a live recharge gate on the junk leg plus a fully-absent corpse model.

## Expected (quote)
Manifest/disk description verbatim (recharge 3, 24h servant):

> "The myconid releases spores at a Medium or Small corpse within 5 feet of it that wasn't a Construct or an Undead. In 24 hours, the corpse rises as a Myconid Spore Servant. The corpse stays animate for 1d4 + 1 weeks or until destroyed, and it can't be animated again in this way."

Row fields: `attackBonus: 0, saveDc: 0, saveType: "", saveEffect: "", reach: "", range: "", recharge: "3"`. There is no attack roll in RAW — the spores target a corpse, not a creature. Per §6, the sanctioned shape for a recharge-gated record-only utility is an authored sentinel/automation producing a recording `ability_use` (like the MA-0006/0300/0305 ever-available family) with the attack leg neutralized; the delayed servant summon either needs a structured spawn consumer (SummonLink family precedent) or stays explicit GM-adjudicated advisory — never a fake to-hit.

## Actual
- Disk `public/data/monsters.json` myconid-sovereign actions[2]: byte-row match to manifest (`attack_bonus: 0`, `recharge: "3"`, no `automation`/`usage`/`save_dc`/damage fields).
- Sentinel grep: `MA-1215` / `animating_spores` / `AnimatingSpores` in src+server = ZERO (rc=1) → no disk sentinel exists, PASS impossible per §6.
- Spawn-consumer grep: `spore_servant`/`sporeServant` = src/server ZERO; `corpse` in src = only `materialComponents.js:10` (Create Undead spell text); `spore` in src = only `MonsterCardModal.jsx:113` comment (MA-1212 DC0-decoy note); `targetEffectDefinitions.js` has no spore/corpse/servant/animation entry. "Myconid Spore Servant" exists ONLY as a stat block in `public/data/monsters.json` (searchable in EB) — no code path creates one from this row. No corpse concept app-wide; no 24h timer; no animate-duration state; no no-reanimate flag.
- Live card census (test-campaign, Myconid Sovereign 1, Bandit armed, cs.targetName server-confirm): Animating Spores row = exactly ONE clickable `span.mc-dice-link` "+0" plus a plain `<em>(3)</em>` RechargeNote; ZERO DC chip, ZERO damage chip (description's "1d4 + 1 weeks" does NOT leak a damage formula — extractor requires `Hit:`/`Failure:`/`Success:` prefix, MonsterCardModal.jsx:684), ZERO record/zone/summon/sentinel affordance.
- Press 1 (real pointer, fresh rect, 1/1 first-click): log-delta 2 — `ability_use` "uses Animating Spores — Recharge 3; unavailable until a d6 3+…" AND `roll/attack name:"Animating Spores" bonus:0` nat17 total:17 vs Bandit AC12 `hit:true damageType:null` (bogus zero-damage hit). change-data `monsterRecharge {Animating Spores:{recharged:false, threshold:3}}`; chip gains `mc-dice-link-spell-spent`.
- Immediate refire press: "Not Recharged" popup ("…Roll a d6 … (3+ to recharge). No save rolled, nothing spent.") + `automation animating_spores_refused` log; zero new roll entry, recharge map unchanged.
- Recovery walk (own-turn seam): Sovereign turn-start R-a `recharge_failed (d6: 1)` (threshold 3 honoured — honest sub-3 fail), turn-start R-b `recharge (d6: 6)` → map `{recharged:true}`; chip de-spents; refire re-spends honestly (second `ability_use` + second bogus attack total:14 hit:true damageType:null).
- Victim Bandit: no te, no conditions, hp 999/11 unclamped untouched whole session (damageless-by-design); change-data servant/corpse state = none.
- Console: 0 errors whole session (3 pre-existing benign warnings).

## Steps
1. `npm run dev` (already running, no restart); open http://localhost:5173, header verified `test-campaign`.
2. Encounters → search "Myconid" → checkbox on exact `td[1]==='Myconid Sovereign'` row (qty 1) → Join Encounter → Initiative shows Myconid Sovereign 1 (init 16, HP 45/45 AC13).
3. +NPC → new-card `.monster-autocomplete-input` (nth=1; first is Sovereign rename, untouched) → type "Bandit" → `li.textContent==='Bandit'` exact → Escape+blur → TRUSTED currentHp 999+Enter (cs unclamped 999/11; UI clamps visually, store keeps 999).
4. Arm Bandit on Sovereign own-card target select; server-confirm `cs.creatures[Myconid Sovereign 1].targetName==='Bandit'`.
5. Open Sovereign card → Animating Spores row: only "+0" chip + plain "(3)" note.
6. Press "+0": bogus `roll/attack bonus:0` (nat17 vs AC12 hit, damageType:null) + `ability_use` Recharge-3 spend + monsterRecharge{false,3} + chip spent class.
7. Refire immediately: "Not Recharged" popup + `animating_spores_refused` zero-spend log.
8. Next → until Sovereign turn-start ×2: `recharge_failed (d6: 1)` then `recharge (d6: 6)`; chip re-arms; refire re-spends honestly.
9. No corpse/servant state, no 24h timer, no no-reanimate flag anywhere.

## Likely Location
- `src/components/encounter/MonsterAction.jsx:338` — `actionHasAttack = action.attack_bonus != null` treats authored `attack_bonus: 0` as a real attack; on this row the junk "+0" chip is additionally recharge-gated via the MA-0294 attack seam (MonsterCardModal.jsx:1875 `handleAttack` → `rechargeRefusalOnSpent` + :1932 `spendMonsterRecharge`), so the bogus leg carries the row's ENTIRE sanctioned economy (spend/refusal/d6 recovery) while adjudicating a nonexistent to-hit.
- `public/data/monsters.json` myconid-sovereign actions[2] — missing the §6 sentinel/automation block (and/or `attack_bonus: null`); no structured spawn payload.
- Consumer absence — no `animating_spores` handler in `src/services/automation/`, no corpse model in the app, no summon/servant consumer wired to this row (SummonLink at MonsterAction.jsx:356 requires `action.automation`; row has none), nothing in `targetEffectDefinitions.js`.

## Notes
- Recharge-gate sub-finding: gate is LIVE on the junk "+0" leg (spend → refusal → own-turn d6≥3 recovery → re-spend, all honest per MA-0294/MA-1211 semantics). The economy plumbing works; it is mounted on a bogus attack leg, so every legitimate "use" also fabricates a `roll/attack` hit record — garbage adjudication family (zero-damage hit, cf. MA-1212).
- Corpse-model gap: RAW is a three-stage delayed effect (release → 24h rise → 1d4+1 weeks animate / no-reanimate). The app has no corpse concept, no delayed-timer primitive for this row, and no consumer that adds the shipped Myconid Spore Servant stat block to the board. Any fix must either author a structured summon/spawn descriptor routed to the existing SummonLink seam with GM-adjudicated 24h advisory, or add a registered advisory te (e.g. `animating_spores_pending`, 24h duration, corpse eligibility clause INT-free: Medium/Small, non-Construct, non-Undead) in `targetEffectDefinitions.js` with a recording `ability_use` — and in both cases suppress the to-hit leg (`attack_bonus: null`).
- Fix must NOT remove the working recharge plumbing — preserve spend/refusal/threshold-3 recovery and move it onto the sanctioned record-only chip.
- Board cleanup done via Admin UI buttons: log=[] cd={} cs value:null, 15s quiet.
- Manifest not edited; no git writes; test-campaign only.
