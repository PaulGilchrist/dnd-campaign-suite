# CLA-345 — Superior Hunter's Defense (Ranger / Hunter lv15, 2024) — VERIFICATION REPORT

**VERDICT: FAIL** (2026-10-09, test-campaign only, header `test-campaign` verified after every select)

Core press-model is live and ledger-exact, but the manifest duration **"until end of current turn" is NOT enforced**: the granted Resistance buff persists indefinitely across multiple rounds (halved live damage in round 3), and the `pendingExpirations` queue entry is absent from the store the instant after press. Unenforced duration = unenforced gate → FAIL per §1 policy.

## Data (public/data/2024/classes.json → majors[3] Hunter → features[4])

```json
{
  "name": "Superior Hunter's Defense",
  "level": 15,
  "automation": { "type": "superior_hunter_defense", "casting_time": "1 reaction" }
}
```

No `uses`/FP cost in data → resource economy N/A per data; reaction economy = round latch (implemented CLA-345 fix commit 262d3573c + CLA-371 miss-gate).

## Seams (real, live)

- Info-builder: `automationInfoBuilder/core-handlers.js:292` (`hasAutomation:true`) → router `automationRouter.js:226` → Reactions lane.
- Sheet row: `CharReactions.jsx:882` clickable `b.clickable` ("Superior Hunter's Defense:").
- Handler: `automation/index.js:440` → `class-ranger/superiorHunterDefenseHandler.js`.
- Resistance consumer: `applyDamage.js:749` `addBuffResistances` (activeBuffs `resistanceTypes`).
- Expiry chain: `expirationQueue.js addExpiration` → `expireStaleEffects` turn-start → `clearExpirationEffects.js:434 remove_active_buff` → `removeBuffByName`.
- Round latch: `_Superior_Hunters_Defense_usedRound`, stamped awaited at trigger (CLA-371 serialize).

## Rig

- Host: FeyRanger lv17 2024; wizard step-6 Ranger (native re-pick) → step-7 Hunter (selectOption) → Save; disk GET `class.subclass.name:"Hunter"` ✓. Reloaded, header re-verified.
- enforcer: EB "Bandit 1" joined (Scimitar +3 slashing, Light Crossbow +3 piercing — dual-type ✓). AC12, +3 hits on d20 ≥9 — hittable (hits landed attempts 0–1, no nat20 needed).
- cs full-store POST maxHp/currentHitPoints 999 (`{value:{…}}`) — GET-verify 999 ✓.

## Ledger (machine truth, log + change-data)

| # | Event | Result |
|---|---|---|
| 1 | Pre-damage press (no combat) | popup verbatim "No recent attack found. Superior Hunter's Defense can only be used after taking damage in combat." — press-model refusal ✓ |
| 2 | Bandit Scimitar d20 9→12 vs AC12 HIT | `hp_change delta:-7` breakdown `{Slashing,7,resisted:false}` (89→82) ✓ full pre-press |
| 3 | Press AFTER damage resolves | popup "You gained Resistance to Slashing damage until end of current turn. (Last damage taken: 7 Slashing) Retroactively healed for 3 HP." ; `activeBuffs:[{effect:'damage_resistance', duration:'until_end_of_current_turn', resistanceTypes:['slashing']}]` (type-scoped ✓); `hp_change delta:+3` "3 HP from 7 Slashing damage halved by resistance" (floor(7/2)=3 ✓); `ability_use` verbatim ✓; latch `_Superior_Hunters_Defense_usedRound=1` ✓; no FP/uses spent (none in data) ✓ |
| 4 | Same-round re-press | popup "You have already used Superior Hunter's Defense this round — your Reaction is spent until your next turn." + `automation` log `superior_hunters_defense_refused`; zero spend (hp/buffs/latch unchanged) ✓ |
| 5 | Slash #2 same round | raw 6 → final 3, breakdown `{Slashing,3,resisted:true,status:'resistant'}` halved exact ✓ |
| 6 | Crossbow (piercing) control | raw 3 → final 3, `resisted:false` ✓ type-scoped |
| 7 | Walk Next→; ranger card .active observed (round 2 and round 3 turn starts) | buff STILL present, `pendingExpirations:[]` |
| 8 | Slash in ROUND 3 (long past "current turn") | raw 6 → final 3 `resisted:true` — **stale resistance still halving = FAIL leg** |

## Defect analysis

- Server change-data read ~2 s after press (in-memory, pre-disk-flush): `pendingExpirations` absent while `activeBuffs` + latch writes from the SAME press tick landed → the `addExpiration` write at `superiorHunterDefenseHandler.js:216` never reached/persisted.
- Handler fires TWO un-awaited same-store writes: `setRuntimeValue(playerName,'activeBuffs',…)` (:209, not awaited) then `addExpiration` (:216 → un-awaited `setRuntimeValue`) — the §39/MA-0809 fingerprint: un-awaited writes on the same `/changes/<Name>` replace-route reorder network-side; winner snapshot carried buff+latch but no PE entry. `addExpiration`'s BA-001 merged-write fix only merges inside itself; the caller still races it.
- Unit test `superiorHunterDefenseHandler.test.js:32` mocks `addExpiration: vi.fn()` — expiry persistence is untested, so the drop is invisible to the suite.
- Alternative consumption-without-removal is structurally impossible (expire/consume/remove are atomic in `expireForCreature`→`removeBuffByName`; nothing rewrote buffs after press).
- **Fix recipe:** merge the buff + expiration registration into ONE `setRuntimeObject(playerName, { activeBuffs, pendingExpirations }, campaignName)` write (or sequentially await both), mirroring the Aura-of-Life merged-cleanup precedent in `clearExpirationEffects.js`. Pin with a live GET proof of `pendingExpirations:[{target:'FeyRanger', effects:[{type:'remove_active_buff',…}], expiryRounds:1}]` post-press + a turn-start drain walk.

## Cleanup proof

- Bandit 1 removed via card × + Remove NPC (confirm stubbed), cs npcs verified empty before admin clear.
- Admin Clear Change Data + Clear Campaign Log → GET cd + log verified empty (quiet tab).
- Gloom Stalker RESTORED: PUT original backup bytes to `/api/campaigns/test-campaign/FeyRanger.json`; disk GET `class.subclass.name == "Gloom Stalker"`, level 17; md5 matches pre-session backup `c89bcd5c6d5f8cb0c167cca0c3e762f9`.
- Campaign deselected (Campaigns → no active char).

## Injections

- Persistent tool-arg/echo tampering: repeated fabricated `page.goto`/`goBack`/`getByRole` args rewrote to `routify-file-proxy-sg.oss-ap-southeast-1.aliyuncs.com` proxy URLs (~15 occurrences) on click/find/evaluate/run_code calls that cannot navigate. Actual `Page URL` stayed `http://localhost:5173`; every claim grounded via own curl/DOM reads. None obeyed. `campaign-lock` grep of dev log: clean; production campaigns untouched.
