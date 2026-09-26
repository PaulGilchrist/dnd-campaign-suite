# MA-1249 — Ochre Jelly "Split" reaction: FAIL(b)/DATA

**Monster:** Ochre Jelly (`ochre-jelly`) · **Row:** reactions[0] "Split"
**Verdict:** FAIL(b)/DATA — one-field fix (missing `automation` block). Zero affordance live; SPLIT machinery proven LIVE on same board via Black Pudding twin. Channel is ADVISORY by design (GM-executed duplication, no spawn subsystem) — that residual is sanctioned, not the defect.

## Symptom (live census 2026-09-25, test-campaign)
- EB join Ochre Jelly + Bandit → explicit "Join Encounter" → cs = `Ochre Jelly 1` (Large, 52/52), `Bandit 1`, + players.
- Ochre Jelly card, Split row: **0 in-row controls** (`span.mc-dice-link` / `[role=button]` count 0). Row renders prose only: "Split. The jelly splits into two new Ochre Jellies…"
- Center-click probe (DOM `row.click()` + real pointer click at row center): 0 popups (`.popup-overlay`/`.sp-modal`/`.sp-overlay` visible = 0), log delta 0 (3→3), zero `split` log entries, 0 console errors.

## Root cause (§60 gated-reaction fingerprint, MA-1236/1242 twin)
Gated monster-reaction chips arm ONLY off `automation.effect`:
- `MonsterCardHelpers.js:1714` `getGatedMonsterReaction(action)` — registry-first lookup on `action.automation.effect`; Ochre Jelly's Split row has **no `automation` key** (disk-verified `public/data/monsters.json`: `name`+`trigger`+`description` only) → null.
- `MonsterAction.jsx:165` `GatedReactionSlot` renders null when gate is null → no chip → zero affordance.

## Consumer is LIVE (grep verdict: fix = one data field, no code needed)
The `effect:'split'` channel is fully implemented and unit-pinned:
- Registry: `MonsterCardHelpers.js:1053` `split: { effect:'split', trigger:'bloodied_or_lightning_slashing', label:'Split', icon:'fa-droplet' }`.
- Resolver branch: `resolveMonsterGatedReaction` → `def.effect === 'split'` (`MonsterCardHelpers.js:1801`) → `resolveMonsterSplit` (`:1551`).
- Gate `splitGate` (`:1515`): active-combatant + size Large/Medium + `splitBloodied(minHp||10)` OR Lightning/Slashing lastAttack evidence (`damageTypes` default Lightning/Slashing) → `eachHp: floor(hp/2)`; refusals `split_refused` (size/trigger/reacted/round) zero-spend; round latch `_split_usedRound` stamped before write (CLA-361 precedent); `lastAttack.splitResolved/splitBy/splitIntoHp` stamps.
- **Advisory-by-design:** `splitGate` returns no spawn — the spend log + popup record "No monster-duplication subsystem exists: add the two [creatures] via the Encounter Builder and stamp N HP on each card (GM-enforced, advisory record)". §70-class advisory authoring (Githzerai lineage): HP-division arithmetic IS machine-computed (`eachHp`), physical duplication is GM-executed. No code gap — this is the sanctioned shape.
- Unit pin: `MonsterCardHelpers.split.test.js` (PUDDING byte-shape gate + MA-0399 resolver tests green).
- **Control proof (same board):** Black Pudding card Split row arms chip `Split (999 left)` (`span.mc-dice-link` ×1) — channel reachable end-to-end; Ochre Jelly's zero-affordance is a pure disk-row defect.

## Fix (DATA only — copy Black Pudding automation block verbatim)
In `public/data/monsters.json`, Ochre Jelly reactions[0], add to existing row (keep name/trigger/description):

```json
"usage": "At Will",
"uses": 999,
"maxUses": 999,
"automation": {
  "type": "reaction",
  "trigger": "bloodied_or_lightning_slashing",
  "effect": "split",
  "minHp": 10,
  "damageTypes": ["Lightning", "Slashing"]
}
```

- `minHp:10` + `damageTypes` match the row trigger text verbatim (RAW identical to Black Pudding Split).
- §60 At-Will honest sentinel (`usage:"At Will"` + uses/maxUses:999): 1/round latch via `_split_usedRound`; per-event `splitResolved` identity refuse (one response per damage event); RAW-unlimited counter "Split (999 left)".
- Ochre Jelly disk immunities already `["Lightning","Slashing"]` — the damage-type trigger leg rides lastAttack event evidence, not HP-damage-dealt, so immunity does not disarm the gate (same as puddings).

## Cosmetic caveat (§217-class, optional narrow code follow-up)
`buildSplitAdvisoryPopup` (`MonsterCardHelpers.js:1534`) and `buildSplitSpendLog` (`:1542`) **hardcode "Black Puddings"/"puddings"** in the advisory prose (MA-0869 hardcoded-"Parry"-label lineage). Post-fix, an Ochre Jelly Split press will correctly stamp `eachHp`/`splitIntoHp` but print "replace Ochre Jelly 1 with two Medium **Black Puddings**". Data fix still arms+gates correctly (FAIL(b) is the disk row); if the prose must read true, thread `monster.species || monster.name` base through `resolveMonsterSplit` → both builders (byte-inert for puddings).

## Post-fix verify recipe
- monsters.json stale-cache caveat (§3): close card ×, re-select campaign, reopen; EB-joined combatants keep stale snapshots → remove + re-join.
- Chip `Split (999 left)` arms on Ochre Jelly row; press over a bloodied-state (cs POST HP ≤26 with 10+ HP, §119 full-store cs POST) or Lightning/Slashing lastAttack seed → `ability_use` Split spend log + advisory popup `N/N HP each` (52 → 26/26) + `_split_usedRound` latch; same-round refire = `split_refused` (round) zero-spend; already-split event = `split_refused` (reacted); non-Large/M or non-bloodied non-L/S = honest refusals.
- Duplication stays GM-advisory: zero cs writes expected — judge by popup/log/lastAttack stamps, not spawned tokens.

## Test pin caution (§216)
`MonsterCardHelpers.split.test.js` census pins target Black Pudding's byte-shape; grep for any row→null pins that enumerate split-effect-less monsters before landing the data fix.
