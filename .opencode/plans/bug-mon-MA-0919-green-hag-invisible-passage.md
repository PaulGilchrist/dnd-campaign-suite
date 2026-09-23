# BUG MA-0919 — Green Hag / Invisible Passage (FAIL(b))

- **Row:** MA-0919 · monsterIndex `green-hag` · actionIndex 2 · category condition · manifest `conditions:[invisible]`
- **Date:** 2026-09-23 · campaign test-campaign · dev :5173 · verdict **FAIL(b)** (zero-affordance inert row; consumer machine exists but unarmed — DATA fix)

## Expected
RAW semantics: "The hag magically turns invisible until she attacks or casts a spell, or until her concentration ends (as if concentrating on a spell). While invisible, she leaves no physical evidence of her passage, so she can be tracked only by magic. Any equipment she wears or carries is invisible with her." — self-invisibility condition grant:
1. Row must arm an affordance (chip) that, on press, registers te `invisible` (registered at targetEffectDefinitions.js:743) on the hag with the RAW ender clause (attack / cast / concentration-break).
2. Invisible condition state must land in hag cs activeConditions / campaign targetEffects and be logged.

## Actual (live-confirmed 2026-09-23)
- Disk: actions[2] keys = `[description, name]` ONLY — zero structured fields (no automation/save_dc/recharge/maxUses).
- Live row byte-shape: `<div class="mc-action "><strong>Invisible Passage.</strong> <span>The hag magically turns invisible…</span></div>` — interactive `a/button/[role=button]/input/select/mc-dice-link` = **0** (§60 chip gate MonsterAction.jsx:224 never arms; §117 save-shell/channels absent).
- Whole-card scan: 13 interactive elements on the open card; invisibility-keyed interactive = **0**.
- Real-pointer click at row center: **zero delta** — popup 0, log 3→3 (no `invisible_granted`), hag cs activeConditions `None`, targetEffects null, card stays open, console 0 errors.
- grep `invisible_passage` across src/+server/+public/data → **0** (no name-keyed consumer, none expected — §60 keys off `automation.effect`, not prose).

## Machine audit: EXISTS-UNARMED → data-fix, NOT code-gap
- Self-invisibility stack is fully LIVE (MA-0658 seam): `monsterSelfBuff.js` `isMonsterSelfBuffRow`/`resolveMonsterSelfBuffRow` (registers te on self, ONE merged clock, `endSelfBuffOnTrigger` attack/cast enders with `invisible_ended` logs), wired at `MonsterCardModal.jsx:533`; `MonsterAction.jsx:224` arms the clickable chip exactly when `automation:{type:"monster_self_buff", effect:"invisible", rounds:N}` is authored.
- **Authored twin (test 4):** **Duergar actions[3] "Invisibility"** carries `automation={"type":"monster_self_buff","effect":"invisible","rounds":600}` — byte-shape proof the fix is a data patch. Same-family UNARMED siblings (separate rows, same defect family): Imp[1], Quasit[1], Sprite[3], Will-o'-Wisp[1] — all invisibility prose rows with `automation=None`.

## Likely Location
- **Fix = data:** add to `public/data/monsters.json` green-hag actions[2]: `automation:{type:"monster_self_buff", effect:"invisible", rounds:<clock>}` — reuse Duergar MA-0658 twin shape verbatim. No new consumer, te, or UI code required (§36 te `invisible` already registered; §224 seam live).

## Notes
- RAW enders: attack/cancel enders are LIVE in the seam (`endSelfBuffOnTrigger`, attack/cast triggers in MonsterCardModal); **concentration-cancel-on-attack ender is unexpressible today** if the row never arms — post-patch, attack/cast enders fire with `${effectKey}_ended` logs, but "as if concentrating" concentration-break remains §70 GM-advisory (same residual the Duergar twin carries; grant log copy at monsterSelfBuff.js:68 says so explicitly).
- "No physical evidence / tracked only by magic" clause is flavor — §70 advisory, no consumer needed.
- Fix rounds-value decision: RAW Invisible Passage has NO listed duration ("until…" only) — Duergar twin pins rounds:600 (1-hour Invisibility-spell clock); hag patch should pick the clock convention deliberately, since the round-clock only backstops the enders.
- Rig: EB exact "Green Hag" + "Bandit" join; Bandit 999 four-key full-store cs POST; reload-after-stamp; header byte-match `test-campaign`; clean: admin-clear cd+log 200/200, quiet-recheck cd`{}` log`[]`, single tab, dev :5173 up. Registry additive: Green Hag verifiedRows MA-0917→MA-0919 (2→3), json.load disk-verified. Manifest NEVER touched.
