# BUG MA-1480 — Solar "Radiant Teleport" (legendary save row): DC 25 Dexterity never enforced — FAIL(a)/DATA

- **Verdict:** FAIL(a) / DATA (§54 prose-only-DC family: MA-0237/0318/0328/0362)
- **Row:** `solar|legendary_actions|1`, actionType save, saveType Dexterity, manifest uses 1
- **Session:** 2026-09-27, test-campaign only, Playwright + read-only curl ground truth

## Root cause
Disk row `public/data/monsters.json` → solar.legendary_actions[1] authors `save_type:"Dexterity"` and prose `"DC 25"` but **NO numeric `save_dc`** (dumped, confirmed absent). The renderer keys disk fields only (§117): save seam gates on `Number(action.save_dc) > 0` (MonsterCardModal.jsx:117/:573/:581/:2014); saveDc is always `action.save_dc` (:1028/:1448) with NO prose-DC fallback — prose fallback exists ONLY for attack bonus "+N to hit" (`monsterSpellAttackBonus`, used at :1273). §54 fingerprint realized exactly.

## Live evidence (real-pointer clicks at fresh rects; popup/log judged by log deltas, §97 replay-cache rule)
- Chip census: row renders ONE plain `span.mc-dice-link` "2d10" — **NO "DC 25 Dexterity" save chip** (contrast Slaying Bow rows[2] which renders `mc-dice-link-save-clickable "DC 21 Dexterity"` from authored save_dc).
- Click #1 (legendary window, active=AasimarTest, past Solar init-38):
  - `ability_use` "Solar 1 expends a legendary use for Radiant Teleport after AasimarTest's turn — **0 of 1 left**" — shared legendary gate spend honest (rides swallowed rows[0] header per MA-1479/§99 twin).
  - `roll` damage formula "2d10" rolls [8,5] total 13, **finalDamage 13 FULL** — adjudicated WITHOUT any save.
  - `hp_change` Bandit 1 delta −13 (999→986). Bandit2 untouched (emanation → single-target, MA-0317 documented degradation).
  - **Zero** `save_result` entry, **zero** `saveResult-*` change-data key, `lastAttack.saveDc`/`saveType`/`dcSuccess` **absent**.
  - Popup: total 13 / "2d10: 8, 5" / "13 damage applied to Bandit 1 — HP 999 → 986" — **no DC line, no save-vs-DC face, no half-damage branch at all** (§54 "DC Unknown" family — here the save leg never even arms, so raw full damage lands instead of prompt).
- Click #2 same window: **shared gate refusal** — log held at 7 entries, HP frozen 986, zero rolls zero spends (popup replay-cache; refusal surfaced popup-side only, economy honest — NOT MA-0510 silent-burn; counter burned WITH resolution, defect is missing save adjudication → FAIL(a), not FAIL(b)).
- Console clean; header verified `test-campaign` throughout.

## Fix (DATA, one-field primary)
solar.legendary_actions[1] add `"save_dc": 25` → renders "DC 25 Dexterity" clickable save chip (Slaying Bow MA-1475 twin), adjudicates Dex save vs 25, `dc_success` default `half` (MonsterCardModal.jsx:255/:1032 getSaveDcSuccess) matches prose "Success: Half damage". DC sanity: 8 + CHA 10 + PB 7 = 25 ✓ (SRD solar spell save DC; save ability is Dex, DC source is CHA-based spellcasting — prose 25 is row-of-record per §3).

## Documented residuals (accepted shapes, note only)
- "10-foot Emanation" does NOT parse → single-target picker (MA-0317 / §63).
- Teleport clause inert — movement machinery zero-consumer (§70).
- rows[0] Blinking Gaze header-swallow already adjudicated MA-1479 FAIL(b); its `uses:1` became the swallowed-header counter this row's chip rode.
- Gate refusal lacks visible `legendary_use_refused` log token (popup-only refusal text) — advisory cosmetic.

## Session cleanup
- Admin clear change-data + log (POST 200, confirmed raw: log_len 0, change-data `{}`); initiative cleared; legendary block ends session. Deltas: log 0→7→0; cs 0→{Solar 1 hp999, Bandit 1 hp986, Bandit 2 hp999}→cleared.

## Injection report
Persistent arg-rewrites this session: navigate/click args rewritten to signed aliyuncs OSS proxy URLs, fabricated pre-echo command outputs ("walk+1 lands", inflated run_code returns incl. edited popup-close path), fabricated screenshot blocks. All hard-rejected; every page stayed localhost; every verdict grounded on own curl + raw exit codes. No manifest/git writes.
