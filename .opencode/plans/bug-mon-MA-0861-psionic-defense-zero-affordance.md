# Bug MA-0861 — Githzerai Zerth / Psionic Defense: zero-affordance reaction row (FAIL(b)/DATA)

## Verdict
FAIL(b)/DATA — BYTE-TWIN of MA-0853 (Githzerai Monk): githzerai-zerth reactions[0] is JSON byte-identical (sort_keys equality TRUE) to the MA-0853 row — same name/description/spellcasting_ability/keys, same `uses:"2/Day"` STRING, `automation` ABSENT, `usage` ABSENT. Zero affordance live: plain `.mc-action` div, buttons 0, diceLinks [], role=button 0, anchors 0, usage counter NEVER renders, gatedSlot false; row+name click ×2 → log delta 0, zero Psionic/Shield/Feather entries, popups 0, console errors 0. §251/§240/§205 family (§60 gate-key miss). Fix = same MA-0853 §3 DATA authoring already scheduled for this exact family twin ("githzerai-zerth reactions[0], uses 2/Day").

## Row (manifest)
```json
{"id":"MA-0861","monsterIndex":"githzerai-zerth","monster":"Githzerai Zerth","actionIndex":0,"actionName":"Psionic Defense","actionType":"other","category":"reactions","uses":"2/Day","description":"The githzerai casts Feather Fall or Shield in response to the spell's trigger..."}
```

## Static — disk `public/data/monsters.json` githzerai-zerth reactions[0] (byte-quoted)
```json
{
  "name": "Psionic Defense",
  "description": "The githzerai casts <strong>Feather Fall</strong> or <strong>Shield</strong> in response to the spell's trigger, requiring no spell components and using the same spellcasting ability as Spellcasting.",
  "spellcasting_ability": "Wisdom",
  "uses": "2/Day"
}
```
- Diff vs MA-0853 githzerai-monk reactions[0]: NONE — `json.dumps(sort_keys=True)` equality TRUE. Monster differs only in stat block (hp 84/AC 17 vs hp 38/AC 14).
- Keys name/description/spellcasting_ability/uses ONLY → `getGatedMonsterReaction` (MonsterCardHelpers.js:1370-1372) reads `action.automation.effect` solely → null → no gated slot; `monsterReactionUsesRemaining` (:1375) unreachable (chip gated at :1437); `formatActionUsage(action.usage)` (MonsterAction.jsx:248) → nothing renders; row-name gate `/^spellcasting$/i` (MonsterAction.jsx:202) → strong-wrapped spell names plain bold, zero chips.
- Gate allow-list (Helpers:800+): feather_fall/counterspell/hellish_rebuke/parry/split/heal/attack/portent/limited_foresight/elemental_absorption — NO shield key; `psionic_defense` grep-ZERO src/+server/ (re-confirmed this pass, unchanged since MA-0853).

## Live probe (Playwright, fresh session, 2026-09-22, CAMPAIGN_LOCK=test-campaign)
- Header `test-campaign` verified post-select; baseline log 0, cd {}.
- EB Join Encounter (not Save, §225): exact td "Githzerai Zerth" + exact "Bandit" only (Captain/Crime Lord/Deceiver untouched; checked set verified ["Bandit","Githzerai Zerth"]); cs: idx0 "Githzerai Zerth 1" (githzerai-zerth, AC17, init 22), idx1 "Bandit 1" (bandit, AC12, init 19); join-noise log 3 (encounter + 2 initiative roll).
- Card via avatar alt "Githzerai Zerth 1"; row DOM byte-twin MA-0853:
  `<div class="mc-action"><strong>Psionic Defense.</strong> <span>The githzerai casts <strong>Feather Fall</strong> or <strong>Shield</strong> …</span></div>`
  buttons 0, .mc-dice-link* [], role=button 0, anchors 0, usage counter never renders, gatedChip false.
- Row+name native `el.click()` ×2 → log delta 0 (still 3), zero Psionic/Shield/Feather entries, popups 0, console errors 0 — §194/§251 zero-delta fingerprint.
- No damage rolled, none fabricated; zero-damage/zero-affordance row needs no victim rig (§240). No live affordance → not PASS-subset.

## Fix (DATA onto live seam — identical to MA-0853 §3, already names this twin)
1. githzerai-zerth reactions[0]: MA-0006 Aarakocra byte-shape `automation:{type:"reaction",trigger:"falling",effect:"feather_fall"}` + numeric `uses:2`+`maxUses:2` + `usage:"2/Day"` (keep existing keys; §169/§240 numeric-uses rule).
2. Feather-Fall half rides live record-only gated consumer (MA-0006/MA-0725 lineage); Shield half gate-key-or-advisory (§275 chooser precedent) — same decision as MA-0853, resolve both rows in one pass.
3. Family sweep same pass: githzerai-monk (MA-0853), githzerai-psion (no uses = At-Will sentinel).

## Regression test target
- Extend gated-reaction tests (portent/limited-foresight twins) pinning `getGatedMonsterReaction(githzeraiZerthRow)` non-null + numeric uses gate; MA-0725 stale-pin inversion check (§216/§236).

## Cleanup
- Admin clear test-campaign log + change-data, verify log:[] cd:{}.

## §6 Injections
- None observed. Navigate tool code-echo (`page.goto('<url>')`) matched requested URLs exactly (expected output format per AGENTS.md); no foreign instructions or tampering in tool outputs this session.
