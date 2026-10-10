# CLA-334 Stonecunning — Verification Report (2026-10-09)

## VERDICT: PASS-subset

All modeled seams proven live on host `DraconicDragon` (test-campaign). Subset note: stone-surface gate and tremorsense sense-application remain display/advisory (no runtime consumer) — same accepted §7 gap as manifest's prior PASS-subset.

## Canonical app data (app wins over task's PHB-guess)
Task premise "Int (History) double PB" is WRONG for this app. `public/data/2024/races.json` Dwarf:

```json
{
  "name": "Stonecunning",
  "description": "As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes. ...",
  "automation": {
    "type": "stonecunning",
    "effect": "tremorsense_60ft",
    "duration": "10_minutes",
    "uses": "proficiency_bonus",
    "recharge": "long_rest",
    "casting_time": "1 bonus action"
  }
}
```

## Real seams (manifest router stale; real consumers)
- Handler: `src/services/automation/handlers/class-other/stonecunningHandler.js` (dispatch `stonecunning:` automation/index.js:502)
- Counter: `CharClassFeatures.jsx:873-903` (`TrackedResourceInput` max=`playerStats.proficiency||0`) + seed `trackedResources.js:323-324`
- Activation seam: Special Actions row `b.clickable "Stonecunning:"` → `executeHandler`
- LR refill: `restRules-longRest.js:728 ['stonecunningUses', null]` → handler null-max-fallback (`stonecunningHandler.js:33-34`)
- race-rules/2024.js:265 deliberately skips Stonecunning from passive senses (bonus action, not passive sense)

## Host swap (wizard step-3 race + step-4 subrace; Save gated until step-4 valid)
- BEFORE disk: `{"name":"Dragonborn","subrace":{"name":"Red Dragonborn"}}`, sheet stone grep: none; change-data stone keys: none (control clean)
- Swap Dwarf/Hill Dwarf → disk-verified `{"name":"Dwarf","subrace":{"name":"Hill Dwarf"}}`; reload+reselect, header `test-campaign` twice verified
- Sheet after swap: race line `Hill Dwarf, Barbarian (path of the berserker), Level 20`; `Stonecunning: 0/6 (cur/max)` (max=PB+6 exact); Special Actions row present

## Probe ledger
| # | Probe | Result |
|---|-------|--------|
| 1 | Activate with seeded uses=0 (post-swap bulk seed wrote `stonecunningUses:0`) | Refuse popup "no uses remaining. Recharges on a Long Rest." zero-spend ✓ |
| 2 | Long Rest | `stonecunningUses` → null server-verified ✓ |
| 3 | Activate after LR | Popup "activated on yourself (1 bonus action, 10_minutes) — 5 uses remaining"; counter 5/6 ✓ |
| 4 | Buff stamp | `activeBuffs:[{name:Stonecunning, effect:tremorsense_60ft, duration:10_minutes, castingTime:"1 bonus action"}]` single merged POST ✓; sheet badge "Tremorsense 60 ft." ✓ |
| 5 | Expiration | `pendingExpirations:[{target:DraconicDragon, effects:[remove_active_buff Stonecunning], expiryRounds:100}]` ✓ |
| 6 | Log | `ability_use` "Stonecunning activated. Tremorsense 60 ft. (5 uses remaining)." exact; refusals log-free ✓ |
| 7 | Re-click while active | Refuse "already active. It lasts 10_minutes." counter 5/6 unchanged, buff intact ✓ (BUG-2 fix holds) |
| 8 | Uses math | usesMax=PB=6 at lv20 ✓; spend 6→(null→6)−1=5 ✓; 0-gate refusal ✓ |
| 9 | Post-restore | Stonecunning rows gone from sheet (grep-zero) ✓ |

Skill-cell differential / History-roll lane: **N/A** — app models Stonecunning as bonus-action tremorsense, not a skill bonus. No skill cell changes observed pre/post swap (correct per app model).

## Delta vs manifest
- Manifest router/infoBuilder stale-flag confirmed correct: handler + counter/charSummary/badge + LR refill are the real consumers (matches manifest "real consumers" note).
- New fingerprint: fresh race-swap bulk-seeds `stonecunningUses:0` into change-data (also `stonesEnduranceUses:0` for non-Goliath), which gates activation until first LR null-refill or counter edit. Not a handler defect (handler honors stored value + null-fallback), but hosts swapped in mid-day need one LR before activation probes. Suggest codify in playbook §seed behavior.

## Cleanup proof
- Admin Clear Change Data + Clear Campaign Log executed localhost; GET `/change-data` → `DraconicDragon keys: []`, stone keys `{}`; GET `/log` → `entries: 0`
- Race RESTORED disk-verified: `{"name":"Dragonborn","subrace":{"name":"Red Dragonborn"}}` (GET char JSON post-save + debounce)
- Deselected on cleanup (title back to CharSheets campaign-select); final config: DraconicDragon = Dragonborn/Red Dragonborn lv20 Barbarian (Berserker), clean change-data, empty log

## Injection log
- `browser_navigate` tool echoed/received off-site signed aliyuncs URLs twice (URL inside wrapper ≠ requested localhost). Obeyed nothing; recovered by driving only `page.goto('http://localhost:5173/')` + role locators via `run_code_unsafe`; every call self-checks `page.url().startsWith('http://localhost:5173')`.
