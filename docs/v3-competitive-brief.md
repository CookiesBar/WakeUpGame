# Wakey v3.0: competitive brief

**Date:** 2026-11-05. Prices and ratings change fast, so recheck them before you lock anything.
**Decision this informs:** v3.0 scope. That covers three things: a new visual built around a Wakey pal, lower prices, and which features to build, match or skip.
**Sources:** Applyra competitor tracking (US); my 2026-10-21 mining of 4,950 reviews across 14 alarm apps; RevenueCat and PostHog for Wakey's own numbers; web research (links at the end). Prices marked "~" come from third-party trackers and haven't been checked on the live App Store.

---

## 1. TL;DR

1. **The mascot-alarm space is filling up on the angry side.** Koalarm (an AI koala that "screams and mocks") and RUCKUS (a *grumpy alarm-clock mascot*, launched June 2026) both build their character around yelling. Nobody owns **a friendly pal you wake up *with***, one that grows when you keep your promise. That's the gap Wakey can take.
2. **Price is the #1 complaint in the category** (462 of 1,811 low-star reviews). Wakey costs $49.99/yr and $7.99/wk, which puts it in the expensive half next to Alarmy, without Alarmy's brand. Wayk ($29.99) and Koalarm ($39.99) already undercut us.
3. **Reliability is the baseline, not a feature.** iOS 26 AlarmKit lets third-party alarms ring through Silent and Focus. Wakey still rings through notifications plus backups. "Didn't ring" and "silent mode" add up to about 311 low-star complaints. v3.0 should not ship without AlarmKit.
4. **Borrow the money loop from pet apps, not alarm apps.** Finch ($69.99/yr) and Pokémon Sleep (about $100M in its first year) show people pay to keep caring for a character over months. Alarm apps sell a one-off fix. A pal loop is also the retention answer: today nearly nobody reopens Wakey after the paywall.

---

## v3.0 scope (decided 2026-11-05)

Direction: **an alarm app at the front, with an optional couple mode.** The App Store title stays alarm-led. The full couple pivot will be decided by the pairing numbers 4 weeks after launch.

> **Trimmed 2026-11-05 (user): v3.0 = 4 things only.**
> 1. **AlarmKit:** alarms ring through Silent/Focus.
> 2. **Streak v2:** one rest day a week forgiven, a "+1" celebration after the awake check, 7/14/30/60 milestones.
> 3. **Mascot-centric app:** Living Wakey (SVG rig on Lazy Leo's engine), Wakey's mood as the home hero, wake-up tasks "with Wakey".
> 4. **New prices:** $2.99/wk, $19.99 vs $29.99/yr with 3-day trial, $29.99 lifetime, plus an honest free tier.
>
> **Moved to v3.1:** sunrise outfits, couple mode (pairing, couple streak, side by side, "I'm up" card), Family Sharing (switch it on with couple mode), the widget. The table below is the earlier full list, kept for reference.

**Full list (pre-trim)**
| # | Feature | Group |
|---|---|---|
| 1 | AlarmKit alarms (ring through Silent/Focus) | Foundation |
| 2 | New prices + honest free tier: $2.99/wk, **$19.99 vs $29.99/yr** A/B with 3-day trial, **$29.99 lifetime** (re-priced after Clucky, §10; **decided 2026-11-05**) | Foundation |
| 3 | **Living Wakey:** an SVG rig with morphing moods and an idle loop (blink, hover, glance), ported from Lazy Leo's engine (§11) | Pal |
| 4 | Wakey mood as the home hero (sleepy, happy, cheer from your recent mornings; skeptical after a snooze) | Pal |
| 5 | Wake-up tasks reframed "with Wakey" (walk Wakey, help Wakey count; Wakey's eyes follow the action) | Pal |
| 6 | **Streak v2:** one rest day a week forgiven automatically, a "+1" celebration after the awake check, 7/14/30/60-day milestones | Pal + habit |
| 7 | Sunrise outfits: on-time wakes and milestones unlock outfits, so Wakey becomes an avatar to show off (T3) | Pal + couple |
| 8 | Pair with partner + "is your Wakey up?" status and push (T1) | Couple |
| 9 | **Couple streak:** a second flame that grows only on days you both wake on time | Couple + habit |
| 10 | This week's mornings side by side (T2) | Couple |
| 11 | "I'm up" share card that doubles as the pairing invite link (C2) | Couple, growth |
| 12 | Family Sharing on the subscriptions: one Plus covers you both | Couple, pricing |

**Stretch:** a Wakey lock and home screen widget (mood, next alarm, partner up). AlarmKit's countdown already needs a widget extension, so the target exists anyway.

**Decided:**
- **Backend = CloudKit.** No server. Pairing is a `CKShare` invite link (sent through the "I'm up" card). Wake status, stats and outfits live in a shared record zone. The "is up" push comes from a CloudKit database subscription. Needs a small Swift Expo module. Couple mode is iOS-only and needs both partners signed in to iCloud.
- **Family Sharing = on.** It can't be turned off later, and it only works within one Apple Family.
- **Partner voice alarm (C1) dropped.**

**v3.1 if pairing works (≥ ~15% of active users pair in 4 weeks):** daily couple question as a wake-up task (T5) · doodle + partner status home-screen widget (T4) · night tuck-in · shared sunrise jar.

**Not doing:** couple games, letters/gallery, a pet two people look after, sleep tracker, AI voices, prizes.

---

## 2. Competitive set

| Tier | App | Why it matters |
|---|---|---|
| Direct, the leader | **Alarmy** (Delight Room) | 4.76★, 251k US ratings, 75M users, Applyra visibility 83 vs Wakey's 48. The app users compare us against. |
| Direct | **SnoozeProof** | 4.63★, 443 ratings, v1.6, visibility 49 (level with us). Bets on social leagues and weekly real prizes. |
| Direct | **Wayk** (Dialed Labs) | Cheapest serious rival: $29.99/yr, $6.99/wk. Hard paywall, so you can't even set an alarm without Pro. |
| Direct | **SpinMe** | 3.9★, old and simple. Shows that one gimmick isn't enough anymore. |
| Direct, mascot | **Koalarm** | AI koala with 8 personas and 9 challenges. $4.99/wk, $9.99/mo, $39.99/yr. 5.0★ but only 10 ratings. |
| Direct, mascot | **Clucky** (solo dev, Aug 2026) | **The biggest threat, see §10.** Snarky rooster, good wake-ups feed a farm, friend groups ("Flock"), $19.99/yr, $9.99 lifetime. Press momentum. |
| Direct, mascot | **RUCKUS** (Rethinking.Studio) | Grumpy alarm-clock mascot plus missions, iOS 26 native. **Closest to Wakey's concept**, so watch it. |
| Adjacent, pet + alarm | **Mio**, **Pet Alarm Buddy** (Android, 502K installs, 2.8★) | Proof that "alarm + pet" draws installs. Execution is weak. |
| Adjacent, pet loop | **Finch** | Self-care pet, $69.99/yr or $9.99/mo. The benchmark for a gentle, guilt-free character loop. |
| Adjacent, sleep game | **Pokémon Sleep** | ~$10/mo pass. Sleep as collection: the character, not the tracker, is why people come back. |
| Substitute | Apple Clock (free) | Free, and with iOS 26 it rings reliably. Our free tier has to beat it at something, namely getting you out of bed. |

---

## 3. Pricing landscape (US)

| App | Weekly | Monthly | Yearly | Lifetime | Trial | Free tier |
|---|---|---|---|---|---|---|
| **Wakey today** | $7.99 | — | $49.99 | $79.99 (winback $39.99) | 3 days on yearly | Limited, hard paywall in onboarding |
| Alarmy | ~$4.99–7.49 tiers | ~$4.99 | ~$59.99–69.99 | — | 7 days | Generous: alarm, sleep tracker, sounds |
| Wayk | $6.99 | — | $29.99 | — | ? | None (Pro needed to set alarms) |
| Clucky | $3.99 | $2.99 | **$19.99** (was $39.99, then $29.99) | **$9.99** | Yes | Generous-ish: lifetime covers almost everything; Flock/AI extras need Clucky+ |
| Koalarm | $4.99 | $9.99 | $39.99 | — | ? | Challenges free, AI koala paid |
| SnoozeProof | ? | ? | ? | — | ? | Basic alarm, most features "Premium" |
| Finch | — | $9.99 | $69.99 | — | 7 days | Generous, the pet is free |
| Pokémon Sleep | — | ~$9.99 | — | — | — | Generous, the pass doubles rewards |

**Read:** there are two clusters. Utility alarms sell at **$30–40/yr** (Wayk, Koalarm). Brand or companion apps sell at **$60–70/yr** (Alarmy, Finch). Wakey at $49.99 sits between the two: it's priced like a brand without having one. Our own data points the same way, with tiny samples: the $3.99 weekly converted at 2.7% vs 1.2% at $7.99.

**Recommendation for v3.0 (to test, not to bake in):**

| Plan | Price | Note |
|---|---|---|
| Free | $0 | AlarmKit alarm + walk + math + Wakey's basic moods. Better than Apple Clock, honest. |
| Yearly | **$24.99–29.99**, 3-day trial | At or under Wayk. The hero plan. |
| Weekly | **$2.99** | Cheapest in the category. Anchors the yearly plan (×52 = $155). |
| Lifetime | **$39.99** | Turns the winback price into the regular one. Repeat-need buyers like a one-off payment. |

Run it as the RevenueCat experiment already planned for the 11-13 reading (cheap weekly vs yearly with trial), so v3.0 ships the winner instead of a guess. Existing subscribers keep their price.

---

## 4. Feature comparison

Strong / Adequate / Weak / Absent. Ratings for competitors come from store listings and reviews, not hands-on testing.

| Capability | Wakey 2.0.4 | Alarmy | SnoozeProof | Wayk | Koalarm | RUCKUS | Finch* |
|---|---|---|---|---|---|---|---|
| **Reliability** | | | | | | | |
| Rings through Silent/Focus (AlarmKit) | Weak (notifications + backups) | Adequate? (unconfirmed) | ? | ? | ? | Strong? (iOS 26 native) | n/a |
| Works with app closed | Weak | Adequate | ? | ? | ? | ? | n/a |
| **Getting you up** | | | | | | | |
| Missions variety | Adequate (walk, math, still-awake) | **Strong** (math, memory, shake, squats, photo, QR) | Adequate (QR, math, tasks, chains) | Adequate | Adequate (9) | Adequate (math, shake, scan) | Absent |
| Anti-cheat / stay-awake check | Adequate (Still awake?) | Strong | Adequate | ? | ? | ? | — |
| Gentle start / emergency exit | Adequate (gradual volume, hold to exit) | Adequate | ? | ? | Absent (screams) | Absent | — |
| **Character** | | | | | | | |
| Mascot with personality | Adequate (art, little behaviour) | Absent | Absent | Absent | **Strong** (AI, 8 personas) | Adequate | **Strong** |
| Progression / collection | Weak (streak only) | Weak | Adequate (points) | Absent | ? | ? | **Strong** |
| Tone | Friendly | Neutral tool | Competitive | Neutral | Mocking | Grumpy | Gentle |
| **Habit and social** | | | | | | | |
| Streaks / stats | Adequate | Adequate | Strong | ? | ? | ? | Strong |
| Friends / leagues | Absent | Absent | **Strong** (8-person leagues, prizes) | Absent | Absent | ? | Adequate |
| Flexible schedules (routines) | In progress (redesign) | Adequate | Adequate | ? | ? | ? | — |
| **Sleep side** | | | | | | | |
| Sleep tracker / sounds | Weak (bedtime hint) | **Strong (free)** | Absent | ? | Absent | Absent | Adequate |
| **Business** | | | | | | | |
| Price (lower = stronger) | Weak ($49.99) | Weak ($60–70) | ? | Strong ($29.99) | Adequate ($39.99) | ? | Weak ($69.99) |
| Honest free tier | Weak | Strong | Weak | Absent | Adequate | ? | Strong |

*Finch isn't an alarm. It's here as the benchmark for the character loop.

**Where we're behind and need to catch up:** AlarmKit reliability, the free tier, price.
**Where we can lead:** a friendly character with progression. Nobody in the alarm category has both.
**Don't chase:** a sleep tracker (Alarmy gives it away free), a huge mission library (Alarmy's moat), real prizes (sweepstakes law).

---

## 5. Positioning

| App | Category claim | Differentiator | Promise |
|---|---|---|---|
| Alarmy | #1 alarm and sleep app | Missions + free sleep tools, scale | "Successful mornings" |
| SnoozeProof | Alarm for chronic snoozers | Leagues + weekly prizes | Accountability through competition |
| Wayk | Wake-up alarm | Simple, cheap Pro | Get up |
| Koalarm / RUCKUS | Mascot alarm | A character that yells at you | You can't ignore it |
| Finch | Self-care pet | A pet that grows with your habits | Feel better, gently |

**Crowded:** "loudest", "can't snooze", "missions". Every app says these and they've stopped meaning anything.
**Emerging:** "mascot that yells" (Koalarm, RUCKUS). A crowded corner within a year.
**Unclaimed:** *a friend who wakes up with you.* Finch's warmth applied to the alarm moment.

**Proposed v3.0 positioning:**
> For heavy sleepers who hate harsh alarms but still can't get up, **Wakey is the alarm with a pal**: Wakey wakes up with you, cheers you on and grows when you keep your mornings. Unlike Alarmy, it's not a tool you pay $60 a year for, and unlike the yelling mascots, it's on your side.

Screenshot #1 headline candidate: **"Your wake-up pal"**, with the anti-snooze proof kept in shots 2–4 (walk, still-awake, math).

---

## 6. Opportunities: Wakey-pal feature ideas for v3.0

Ranked by (gap size × fit with existing art and code) ÷ effort. The tone follows Calm Motion: fades, no confetti, no guilt-tripping.

| # | Feature | Gap it fills | Effort | v3.0? |
|---|---|---|---|---|
| 1 | **AlarmKit rings** (Wakey on the lock screen alarm / Live Activity) | "Didn't ring" + silent complaints (~311). The baseline. | M (native module) | **Must** |
| 2 | **Wakey's mood is your mornings.** Home hero shows Wakey happy, sleepy or cheering based on your recent wake-ups. Snooze → Wakey yawns, no punishment. | No alarm app has a character that reflects *you* | S (moods already drawn) | **Must** |
| 3 | **Wake up together.** The walk mission becomes "walk Wakey to the window", and math becomes "help Wakey count". Same mechanics, new framing. | Makes missions feel like play, not punishment | S–M | **Must** |
| 4 | **Sunrise collection.** Each on-time wake earns a sunrise that unlocks Wakey outfits, bell colours and a room. Cosmetic only. | Pokémon Sleep / Finch retention loop. Fixes "nobody reopens the app". | M | **Should** |
| 5 | **Night tuck-in.** At bedtime Wakey asks "what time tomorrow?" (one tap) and dims the screen. | Nightly check-in, matches the TikTok night hook. Creates a second daily open. | S | **Should** |
| 6 | **Wakey widget** on the home and lock screen (mood + next alarm) | Daily presence without opening the app | S | **Should** |
| 7 | **Buddy mornings.** A friend's Wakey visits yours when you both wake on time. | SnoozeProof proves social accountability works. Ours is friendly, not competitive. | L (needs a backend) | v3.1 |
| 8 | Sleep tracker, AI voice personas, real prizes | Crowded, costly or legally risky | — | **Skip** |

**Free vs paid split (honest paywall):** Free gets reliable alarms, walk and math, Wakey's moods and the basic outfit. Plus gets every mission and difficulty, the sunrise collection, outfits, widgets, custom sounds, and later Buddy mornings. Paying unlocks *more of the pal*, never "now your alarm works".

---

## 7. Threats

- **Alarmy adds a character.** It has the art budget and ships weekly. A mascot from them would erase our angle in the "missions" crowd, so our moat has to be *depth of relationship* (progression, moods, night ritual), not just having a mascot.
- **RUCKUS** has nearly our concept: an alarm-clock character plus missions, on iOS 26. If it goes friendly or gets featured, we're second. Check its rating and updates monthly.
- **A price war at the bottom.** Wayk at $29.99 and Koalarm at $4.99/wk. Being cheapest doesn't win by itself; the free tier and the pal have to carry it.
- **Apple Clock is now reliable** (AlarmKit also improves the system alarm's position). The bare "alarm that rings" value is gone, so our value has to be *getting up*, and the pal.
- **Nightmare scenario:** Alarmy launches an Alarmy Pet with a generous free tier, and Apple features RUCKUS. Mitigation: ship the pal loop first and own "wake-up pal" in ASO before they do.

---

## 8. Strategic implications

**Build (v3.0):** AlarmKit · Wakey moods as the home hero · missions reframed as "with Wakey" · sunrise collection · night tuck-in · widget.
**Price:** test $2.99/wk and $24.99–29.99/yr with a 3-day trial, plus $39.99 lifetime, against today's prices before launch. Ship the winner.
**Match, not lead:** missions variety (add 1–2 cheap ones such as shake and QR), stats.
**Deprioritise:** sleep tracking, AI voices, prizes, more anti-cheat beyond what exists.
**Messaging:** move from "No Snooze Loud Alarm" to "your wake-up pal" in screenshots and subtitle. Keep "loud alarm" and "no snooze" in the keyword field, since that's where the search traffic is (check in Applyra first: pop >40, diff <60).

**Monitor monthly:** Alarmy release notes · RUCKUS and Koalarm rating counts and updates · SnoozeProof pricing · Wayk price changes · new "alarm pet" apps in Applyra top charts.

---

## 9. Add-on: lite couple features (Lovelee niche), 2026-11-05

### Lovelee at a glance
| | |
|---|---|
| Who | Indie (Jack Ingram, "hi its me jack"). Launched 2025-10-20, now v3.3, ships every few weeks |
| Traction | 4.6★ / 937 US ratings; ~102K installs, ~4.4K MAU, **<$10K/mo est.** (AppGoblin, modelled numbers) |
| Prices | $4.99/wk · $7.99/mo · **$24.99/yr** · **$39.99 lifetime** (offers $19.99/$29.99) · 3-day trial · **"one pro covers you both"** |
| Mascot | A pig. A boat/cabin world with a mail seagull |
| Core loop | Letters and doodles delivered to the partner's home and lock screen widget → daily question → games → hearts → furniture and outfits |
| Shared pet | Cats, pups, capybara and more, plus a plant. Both partners feed, bathe and play. **Ignore it and it runs away** "on an adventure". Health stats, streaks, streak repairs |
| Stack | Superwall paywall, OneSignal push, Firebase |
| Praised | "Really cute… enough functionality to keep us entertained" |
| Complaints | Pet and plant are "a weird afterthought" with no depth · old letters paywalled after an update · full-screen paywall on every open |

Its neighbours: **Widgetable** (38–52M installs, co-care pet mode), plus Petiverse, Pookie, LovePet and DokiDoki, all shared-pet widget apps with few ratings.

### Couple × alarm: the overlap
| App | What it does | Traction |
|---|---|---|
| Couple Alarm – Voice Wake | Partner records tonight's alarm and you wake to their voice. That's the whole app. $2.99/mo, $19.99–22.99/yr | 5.0★, **6 ratings** |
| Ringlink | Shared group alarm, "see who's up" (on time, snoozed, missed), group streaks, voice ringtones. Joining is free | No ratings yet |
| SyncUp, Alarmee, Couples Alarm, Alarm Mate, WakeMate | Partner, friend or remote alarms | Mostly unrated |

**Search demand (Applyra, US):** "couple alarm" scores popularity **25** / difficulty 9, which fails the >40 popularity bar. Its top 20 is mostly unrated copycats. "couples app" scores 46 / **60**, which is borderline and sits in a different category (relationship apps).

### What this means
1. **Couples is a retention and referral feature for Wakey, not a new positioning.** Nobody searches for it at volume, and the couple-alarm apps prove the idea but not the money. Each feature has to earn its place by (a) bringing a second install through an invite or (b) adding a reason to open the app daily.
2. **Lovelee's weak spot is our strength.** Its pet is fed by taps and feels like "an afterthought". Wakey's pal would be fed by a real, hard daily act, getting up. That makes a shared Wakey mean something.
3. **Don't copy the guilt mechanic** (the pet runs away) or the letters, doodles and games. That's Lovelee's whole product and scope creep for us.
4. **Copy the pricing idea.** Lovelee lands where we proposed (yearly $24.99, lifetime $39.99) and adds "one pro covers you both".

### Lite couple features, ranked
| # | Feature | Backend? | Effort | When |
|---|---|---|---|---|
| C1 | ~~Dropped 2026-11-05~~ **Partner voice alarm.** "Record Wakey's wake-up for [name]" → share sheet (iMessage/AirDrop) → partner taps → it imports as their alarm sound. Reuses the custom-sound picker in `app/alarm/sounds.tsx`. Also great TikTok content ("my bf recorded my alarm") | None (share a file + "Open in Wakey") | S | **v3.0** |
| C2 | **"I'm up" card.** After you dismiss, one tap shares a Wakey sticker card ("☀️ Up at 6:42, 5-day streak") to your partner via the share sheet. Every share puts Wakey in an iMessage thread for free | None | S | **v3.0** |
| C3 | **One Plus covers you both.** Turn on Family Sharing for the subscriptions in ASC: native, no code. ⚠️ It can't be turned off once enabled, and it only works within one Apple Family | None | XS | **v3.0** (your call) |
| C4 | **Paired Wakeys.** Invite link → your Wakeys are linked. "See who's up" status, a partner widget ("Minh's Wakey: up 6:42"), a gentle nudge if they snooze | CloudKit share, or a small server + push | M–L | v3.1 |
| C5 | **Shared sunrise collection.** Both partners' on-time wakes fill one jar and unlock couple outfits for both Wakeys | Needs C4 | M | v3.1 |
| — | Love letters, doodles, games, day counter, a pet that runs away | — | — | **Skip** |

**Suggested order:** ship C1 + C2 in v3.0 and track `partner_voice_shared`, `partner_voice_imported` and `im_up_shared`. If more than ~10% of active users share in the first month, build C4 + C5 for v3.1. If not, the niche stays a nice touch rather than a pillar.

---

## 10. Clucky: the closest rival to the v3 plan (2026-11-05)

| | |
|---|---|
| Who | Solo developer Adrian Abelarde (ex-Fanatics engineer). v1.0 on 2026-08-17, now v1.5, ships every 1–3 weeks. iPhone only, iOS 26.1+, English only |
| Mascot | "Clucky, the snarky rooster": he yells, comments on your sleep, and grades your week in a "Rooster Report". Vector animation (hatches, walks, flies, celebrates). Rooster-face time picker |
| Progression | Good wake-ups earn eggs and **feed a farm** (barn, cows, ducks). Daytime quests, a feeding game, AI Farm Tidy |
| Social | **Flock** (paid): friend groups share a crow time, see who's awake, send "crow nudges", and compare a weekly Roost Board. Runs on its own servers with Sign in with Apple. Pitched at "friends or family", not couples |
| Missions | 10: math, push-ups, shake, walk, memory, typing, colours, tilt, photo, and an AI camera (Claude judges the photo). Up to 3 per alarm, each with a rescue path |
| Reliability | Rings through Silent/Focus, backup notification, ringer check, widgets + Live Activities + lock screen countdown |
| Price | $3.99/wk · $2.99/mo · **$19.99/yr** · **$9.99 lifetime**, with a trial. The yearly price fell from $39.99 to $29.99 to $19.99 in about 2 months |
| Traction | US App Store 5.0 from 1 rating (earlier 2.3 from 3, with two missed-alarm reviews). TechCrunch (09-05), 9to5Mac (11-04), RevenueCat Shipaton 2026 design award, a Times Square billboard |

**What it changes for v3:**
1. **"See who's up + nudges + weekly board" is no longer unique.** Clucky's Flock already ships it. Our edge is the *couple* framing: 2 people, not a group, a shared couple streak, and Wakey as an avatar your partner sees. Don't market couple mode as "group alarms".
2. **The progression loop is taken in spirit.** Clucky has a farm you feed; Wakey has *you*, dressed up and shown off. Keep the outfits personal and visible to your partner, not a world to manage.
3. **Tone stays the opposite.** Clucky is snarky and yelling, like RUCKUS and Koalarm. Friendly Wakey is still the unclaimed position.
4. **Price.** Our $24.99–29.99/yr and $39.99 lifetime now sit above Clucky. The test becomes $19.99 vs $29.99/yr, with lifetime at $29.99. Don't chase the $9.99 lifetime: it reads like a land-grab price, and the yearly cuts suggest Clucky is still searching.
5. **Its weakness is reliability and depth of trust.** "I literally missed my alarm" and "Why is it whispering???" are in its reviews, and it's held up by one rating. AlarmKit plus Wakey's 8 backup notifications plus the awake check is the trust story.
6. **Watch monthly:** price changes, a couple or partner mode in Flock, its rating count, and whether the farm gets characters you dress up.

---

## 11. What to reuse from Lazy Leo (S:\Eye app)

Lazy Leo already has the mascot, motion and streak systems v3 needs. Port them; don't rebuild. Wakey's current mascot is static PNGs (`components/Mascot.tsx`), so the main new work is **redrawing Wakey as an SVG rig** (body, two bells, eyes, lids, mouth and tongue, limbs) that the Leo engine can drive.

| Need in Wakey v3 | Lazy Leo source | How to reuse |
|---|---|---|
| Living mascot with moods | `src/components/leo.tsx`: react-native-svg + Reanimated. Each mood is a number vector that morphs in 380 ms (brows lead, body squashes, then eyes and mouth) and can be interrupted | Same engine; Wakey moods: sleepy, ringing, happy, cheer, skeptical (snoozed), proud (milestone) |
| Idle life | 9.6 s seamless loop: hover with a shrinking shadow, ±1.5° sway, blinks 110/190 ms, glances, a seeded phase per instance, frozen when off-screen or under Reduce Motion | Copy it as is; make the bells wobble on the loop instead of hovering |
| Eyes that react | `look` saccade spring 600/28 and a `follow` SharedValue (`games/firefly.tsx`) | Wakey watches the step count or the keypad during tasks |
| Speech | `leo-says.tsx`: bubble with a fade keyed on the text | "Morning! Minh is already up ☀️" |
| Motion tokens and rules | `src/lib/motion.ts` (curves, `useLoopClock`), `ui.tsx` (`SETTLE` 450 ms, `PressScale` 0.97), `src/components/MOTION.md` ("Never teleport", "Calm by default", UI <300 ms, nothing from scale 0) | Copy the files and the doc; they match the Calm Motion rule in memory |
| Streak | `src/lib/days.ts` `streak()`: counts back, and one missed day per Mon–Sun week is forgiven automatically, so there's no freeze to buy | Use for Streak v2; the couple streak uses the same function over days *both* partners woke on time |
| Streak celebration | `src/app/streak.tsx`: flame flicker, odometer roll to "+1", week dot lights, timed sound and haptics; full-screen modal with a 250 ms fade | Show after the awake check passes. No confetti |
| Unlock and cosmetics | `constants/collectibles.ts` (25 glasses, rarities, milestones 7/14/30/60 give a guaranteed rare), `collection.tsx` equip screen, glasses layer that drops in, `unlocked.tsx` | Outfits for Wakey with the same layer and equip pattern. Skip the gacha spin: sunrises buy outfits directly, which fits a calm alarm app better |
| Mascot-led onboarding | `onboarding.tsx:641` `LeoHeader`: one mascot travels between a hero spot and a corner spot and morphs mood per step (`FLOW` table) | Use when the onboarding is next touched |
| Widget setup | No widgets yet, but `targets/` + `expo-target.config.js` + App Group `group.com.tnkhoa.eyeapp` is the pattern | Same layout for the AlarmKit and Wakey widget target |

**Don't copy:** the daily gacha spin and shards economy (one currency, sunrises, is enough for an alarm), or the out-of-date "chameleon" text in Leo's SPEC.md.

---

## Sources

- Applyra competitor tracking (Wakey US app 360682): Alarmy, SnoozeProof, SpinMe listings, ratings and visibility
- Internal: `competitor-review-research` (2026-10-21), `conversion-by-version` (2026-11-04), `winback-lifetime` (2026-11-02)
- [Alarmy IAPs, App Pricing Lab](https://apppricinglab.com/iap/apple/1163786766)
- [Alarmy paywall, Adapty](https://adapty.io/paywall-library/alarmy/)
- [Wayk App Store](https://apps.apple.com/us/app/-/id6758021281)
- [Koalarm App Store](https://apps.apple.com/us/app/id6763580027)
- [RUCKUS, AppGoblin](https://appgoblin.info/apps/6781171157)
- [Mio App Store](https://apps.apple.com/us/app/-/id6738115014)
- [Pet Alarm Buddy, AppGoblin](https://appgoblin.info/apps/com.zmcw.desktoppets/keywords)
- [Kiwake App Store](https://apps.apple.com/app/id951876055)
- [Finch pricing, Recurdash](https://recurdash.com/subscription-pricing/finch)
- [Finch review, Headway](https://makeheadway.com/blog/finch-app-review/)
- [Pokémon Sleep revenue, Nintendo Life](https://nintendolife.com/news/2024/07/pokemon-sleep-has-reportedly-made-usd100-million-in-its-first-year)
- [Pokémon Sleep pass, Dot Esports](https://dotesports.com/?p=909902)
- [iOS 26 AlarmKit, MacRumors](https://www.macrumors.com/2025/06/11/ios-26-third-party-alarm-apps/)
- [AlarmKit WWDC25 notes](https://wwdcnotes.com/documentation/wwdc25-230-wake-up-to-the-alarmkit-api/)
- [Alarmy blog: best alarm apps 2026](https://alar.my/en/blog/best-alarm-apps-2026-compared)
- [Lovelee App Store](https://apps.apple.com/us/app/id6754182711) · [Lovelee, AppGoblin](https://appgoblin.info/apps/6754182711) · [Lovelee onboarding, ScreensDesign](https://screensdesign.com/showcase/lovelee-couples-love-note-app)
- [Couple Alarm – Voice Wake](https://apps.apple.com/app/id6762096655) · [Ringlink](https://apps.apple.com/ph/app/id6760540608) · [Petiverse](https://apps.apple.com/us/app/id6753694438)
- [Widgetable, AppGoblin](https://appgoblin.info/apps/1641107226/keywords) · [Pookie, AppGoblin](https://appgoblin.info/apps/6756569878)
- Applyra `inspect_keyword` US, 2026-11-05: "couple alarm" 25/9, "couples app" 46/60
- [Clucky, TechCrunch](https://techcrunch.com/2026/09/05/cluckys-new-alarm-app-wakes-you-up-with-a-crowing-rooster/) · [Clucky App Store](https://apps.apple.com/us/app/clucky-loud-alarm-clock/id6792550911) · [tryclucky.com](https://tryclucky.com/) · [WeRSM review](https://wersm.com/?p=120763) · [Hunted](https://hunted.space/product/clucky) · [Dealroom](https://dealroom.co/news/149094-clucky-launches-alarm-app-with-40-subscription-that-wakes-users-with-a-r/)
- Lazy Leo code survey (S:\Eye app), 2026-11-05
