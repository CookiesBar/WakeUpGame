# MOTION.md: living illustrations in WakeUpGame

> The `rossark-motion-skill` reads this file first. Part 1 is the skill's method, copied as it is. **Part 2 is Wakey's own and overrides Part 1** wherever they disagree.

---

## Part 1. The method

**The goal:** anything drawn (a character, a plant, a flame, a street, a logo, a chart) feels alive and calm. Nothing teleports, nothing bounces, nothing shouts.

### Principles
1. **Never teleport:** interpolate everything; never swap drawings.
2. **Calm by default:** strong curves, no bouncy overshoot.
3. **Small amplitudes:** when unsure, halve it.
4. **Arcs and pivots:** each moving part is a layer rotating around its joint (stem base, hinge, neck, hook).
5. **Overlap and follow-through:** tips and trailing parts move later and further; give each part the same wave with a growing phase delay.
6. **Variety without chaos:**
   - repeated items get a seeded phase, speed and size;
   - nothing moves in sync, and there's no random value per frame.
7. **One main action per scene, plus two or three idle loops.** Side things stay quiet.
8. **Opacity only to appear or disappear.**
9. **The layout never moves:** motion lives inside the drawing.
10. **Reduced motion:** loops freeze on a good frame 0, and one-shots show their final frame.
11. **Nothing runs unseen:** pause off screen, when hidden and in the background.
12. **Enough frames:** anything under ~100 ms flickers at 30 fps; render and export at 60 when you can. Blinks close in ~110 ms and reopen in ~190 ms.
13. **Interface rules:**
    - frequency decides how much (often seen = barely moves; rare moments get the delight);
    - every motion has a purpose;
    - shared elements travel, never teleport;
    - interface moves stay under 300 ms;
    - exits are faster than entrances;
    - nothing appears from scale 0;
    - interruptions continue from the current value.

### The engine
- **Clocks:** a loop clock for idle life, a one-shot clock for a scene that tells an action. One per character, group or scene.
- **Tracks:** keyframes `[ms, value, 'out'?]` read with `track(t, keys)`. The last key equals the first. `track` stops at every key, so use it for one move (a blink, a lid). For acting (a chain of poses), use `flow(t, keys)`, which passes through the keys without stopping and never overshoots.
- **Helpers:**
  - `wave` (−1 to 1), for sway and breathing;
  - `loop` (0 to 1), for drift and falling;
  - `bell`, to fade in and out;
  - `seg`, for one beat of a one-shot;
  - `seeded(i)`, for per-item variety.
- **Curves:**
  - travel uses ease-in-out `(0.77, 0, 0.175, 1)`;
  - open and arrive use ease-out `(0.23, 1, 0.32, 1)`;
  - leaving uses ease-in;
  - endless loops are linear.

### Quick recipes
| Subject | Recipe |
|---|---|
| Character | breathing 1–2 units over 3–5 s; a blink every 3–4 s; pupils glide; head tilt 3–6° |
| Waiting to be tapped | a jiggle every ~270 ms: squash 2%, widen 2%, the bulge trading sides |
| Floating figure | rises in from 30% of its height below, drifts 5% down and up, leaves rising |
| Tail, hair, ears | rotation around the root, phase delayed along the chain, 4–10° |
| Plant | sway 1.5–4° around the base over 3–6 s; leaves on seeded phases |
| Cloth, flag | a wave that travels along the length, growing away from the fixed edge |
| Fire | a lean of 2–4° and a 3–6% stretch on two waves of different periods |
| Smoke, steam | rises 8–14 units and fades in and out with `bell` |
| Water | ripples grow and fade; floating things bob 1–2 units and rock 2° |
| Rain, snow | seeded `loop`s; snow sways sideways |
| Sky | clouds drift over 20–60 s with parallax; sun rays take 30–60 s per turn |
| Lights | a glow of 2–5% over 2–4 s; stars twinkle at seeded times |
| Machines | gears turn linearly by ratio; a clock hand steps with ease-out |
| Phone | ±3° bursts, then a pause |
| Icon, logo | plays once on appear, then rests |
| Chart | a one-shot draw-on, with bars staggered 40–80 ms |

### Acting (a whole character)
- **Every channel:** key pose (`flow`) + idle (`wave`s, never off while on stage) + follow-through (the parent read 90–140 ms earlier) + accents (a `wave` inside a `seg` window).
- **Arms:** an upper arm and a forearm share a round elbow; the forearm points at shoulder angle + elbow bend.
- **Head turns:** slide the face toward the turn (eyes 10, nose 13 in a 100-wide head) and the ears the other way. Blink on the turn.
- **Weight:** the hips shift and carry the upper body, and the legs angle to keep the feet under it.
- **Landing:** hover, then fall with gravity and stretch; squash hard (0.8) on contact and keep the volume (`width = 1 / height^0.6`).
- **In the air:** limp feet (toes down, one knee folded, trading slowly). The shadow stays on the floor and scales with the height.
- **Props:** enter from off screen already moving and roll by distance / radius. The eyes follow them. A kick hits at the middle of the swing; the prop leaves as a throw, spinning, with a short squash.
- **Asymmetry:** the arms never mirror each other.
- **Camera:** a view from a little above is a whole build, not a tweak: the head is 40–50% of the height, the torso is short and narrower than the head, the legs are short, the feet are round from above, and the shadow is a wide oval with the feet in its lower half. Keep it in one `build` object. A flat view keeps a thin pill shadow.
- **Framing:** on a phone, as big as the screen allows, with the feet low.

### From a reference video
- Contact sheets at the full frame rate (`tools/sheet.sh`).
- Measure motion with numbers (`tools/track_edges.py`): a 2% jiggle or a 5% float doesn't show to the eye.
- Sample colors from pixels (`tools/sample_colors.py`).
- Go part by part: feet, shadow, hands, head.
- Compare proportions as ratios of one unit (head widths). "Stretched" means a ratio is far off.
- Compare your render with the reference at the same moments.
- Don't publish a copy of someone else's art.

### Performance
- Everything is a function of one clock's time.
- Draw many items in one SVG or `Canvas`.
- Reset repeating animations to 0 before starting, and cancel them on cleanup.
- Declare curves at the top of the module.

### Workflow
1. Read Part 2 and the art file's header comments.
2. List what could live in the drawing.
3. Pick one main action and two or three idle loops.
4. Split the art into layers at their pivots.
5. Put the numbers in tokens.
6. Check frame 0, the final frames and the loop seams. For a character, look at a contact sheet of every 4th frame of your own render.
7. Run the checks.
8. Hand off: what moves, and what hasn't been seen on a real device.

---

## Part 2. This project (Wakey)

### Where the code is
- **Platform:** React Native with Expo 58, Reanimated 4.7 and react-native-svg 15.16. Design canvases on claude.ai are web: CSS animations inside SVG.
- **Motion engine:** `utils/motion.ts`. It is the skill's template with one change: clocks pass `ReduceMotion.Never`, because the caller decides about reduced motion through `live`. Keep it in sync with Lazy Leo's `src/lib/motion.ts`.
- **Animated pieces to copy from:** `components/Wakey.tsx` (the rig in the app: static layers at pivots, limbs as nested views, morphing face canvases, the walk from `components/wakey/walk.ts`), `components/LetterMascot.tsx`.
- **Art, in one coordinate system** (`assets/mascots/face-rig/`, viewBox 0 0 326 326, face centre and hub at (150, 184)):
  - `face-rig.svg` / `face-rig.json`: the head. Pivots: bell-left (79.44, 84.4), bell-right (248.59, 90.31), both hands and the hub (150, 184). Anchors: eyes (115, 158) and (185, 158), mouth (150, 218).
  - `walk-cycle.svg` / `walk-cycle.json`: the whole body walking, in the same units, built on the Good morning pose (pic5.svg).
  - `preview.html`: switches expressions. It embeds a copy of the SVG, so rebuild it whenever the rig changes.
- **Mascot sheet:** https://claude.ai/artifact/9WT6tAWhucezKvPdugNHvQ (boards: Main, Walk).
- **Generators:** the SVGs are generated, so change the numbers in the scripts, not the paths in the output. Both run from the repo root with no arguments:
  - `node assets/mascots/face-rig/tools/build.mjs` rebuilds `face-rig.svg`, `face-rig.json` and `preview.html` from the source art in `src/` (copies of pic 1, Group-1, pic 4, Group, Group 7524 and pic5).
  - `node assets/mascots/face-rig/tools/walk.mjs` rebuilds `walk-cycle.svg` and `walk-cycle.json` from the rig. Every walk and face number is in its `T` and `K` tokens at the top. Pass a sheet project folder to also write the mascot sheet's Walk board (`walk.tpl.html`).
  - Both stop with an error if a rule breaks: `build.mjs` if a morph family loses its matching path commands, `walk.mjs` if a planted foot would leave the ground.
  - Run `walk.mjs` after `build.mjs`, since the walk reads the rig.
  - `node assets/mascots/face-rig/tools/rn.mjs` then writes `components/wakey/rig.ts`, the app's copy (static art, expression numbers, walk tokens). Run it after both; never edit `rig.ts` by hand.
  - `node assets/mascots/face-rig/tools/rn-check.mjs` checks the app's walk port against `walk-cycle.svg` (every joint, 40 samples) and that the solved ankles stay on target.

### The owner's rules
These override Part 1.
- **2026-10-13:** "reduce the motion and bouncing, make it less obnoxious." So:
  - short fades with a small lift (about 250 ms and 8 px);
  - timing curves, not springs;
  - no endless wobble or bob loops;
  - no confetti for routine moments;
  - haptics only on direct taps.
- **2026-10-26:** "high end motion, transition too" means precise, not playful:
  - page changes exit in 180 ms and enter in 280 ms with ease-out and a blur;
  - titles rise 8 px;
  - lists stagger 40 ms;
  - presses scale to 0.97;
  - springs only for drags.
- **From Part 1, never use these here:**
  - the landing squash and overshoot;
  - the "waiting to be tapped" jiggle;
  - idle sway layered on top of an action that already moves (the walk).
- **Bells:** ring in one short burst, then rest.
- **Labels inside motion pieces:** Plus Jakarta Sans only.

### Rig limits
- **The head is the body.**
  - There is no neck: no separate head turn or tilt. A turn is the whole body leaning.
  - The face can't slide sideways for a 2.5D turn, because the dial would distort.
  - The pupils lead instead.
- **Expressions morph point by point, never swap.**
  - Each family keeps one command signature: white, pupil and lid clip `MCCCCZ`; lid `MLLCZMLLCZ`; lash and brow `MCCCC`; mouth `MCCCCCCZ`; tongue `MCCCCZ`.
  - Morphs take 380 ms with `EASE_IN_OUT`.
  - Opacity rises over the last 40% of a morph and falls over the first 40%.
- **Eyes:** pupils are clipped to the white. Lids are face colour #E1F5FF, clipped to the white grown by 2.
- **Clock hands:** drawn pointing up, so the group's `rotate(angle 150 184)` is the time. They rest at 8:00.
- **Limbs:**
  - round-capped noodles: arms #BCE5FE, 20 wide; legs #54A8FF, 24 wide;
  - two equal segments sharing a round joint;
  - a foot is a short bend (22 in the walk), never a hand or foot shape;
  - in the walk, both legs and the far (left) arm sit behind the body; the near (right) arm starts on the back plate, in front of the body.
- **Walk (from the Good morning pose; owner's changes on 2026-11-06: no purple letter, no watch, walk to the left, arms "less stiff and sway like he walking", back "less scroutch"):**
  - strides to the LEFT in place, the way the face turns, leaning only 6° (12° read as hunched); clock at 8:00, the rig's rest, because any lower-left hour cuts through the open mouth;
  - two steps in 1000 ms; each foot is down for 580 ms, landing heel first, and slides right like a treadmill; the standing leg is nearly straight as the other foot passes;
  - knees bend left and are solved every frame, so a planted foot never slides off the ground;
  - both arms swing against the legs (far arm 44°, near arm 42°), elbows bend on the forward swing, forearms trail by 100 ms. The near arm stays on the ring so it never covers the face. Nothing in the hands;
  - plays only while steps are counted, then finishes the step and rests. Reduce Motion holds the 625 ms frame, which is pic 5's stride, with a still face.
- **Live face on the walk (owner, 2026-11-06: "random express between neutral eyes and happy close expression, neutral eye look at random direction and mouth happy and mouth close"):**
  - eyes and mouth run on their own 23.4 s clock, separate from the walk and from each other;
  - eyes: neutral or happy closed; neutral eyes glance somewhere new every 1.1–2.4 s (450 ms glide) and blink at most every 2.6 s;
  - mouth: the closed smile or the open happy mouth (open-shout);
  - every change morphs point by point in 380 ms with the rig's fade rule. The SVG uses SMIL for this (CSS can't animate path shapes everywhere) and hides it under Reduce Motion; in the app, use fresh random numbers with the rules in `walk-cycle.json`.
- **Reduce Motion is on on the owner's computer** (seen 2026-11-06): anything that respects it looks still to them. A demo copy on a sheet may ignore it; shipped code must not.

### How changes are checked
- **Motion:** there is no Mac or simulator here. Use headless Chromium (Playwright's `chrome-headless-shell`) and Claude's browser pane:
  - pause with `document.getAnimations()` and read positions with `getScreenCTM()`;
  - look at a contact sheet of every 4th frame;
  - zoom on joints, lids and seams.
- **Code:** `npx tsc --noEmit`. `package.json` has no lint or test scripts.
- **Device:** builds go to TestFlight (EAS, or GitHub Actions when EAS credits run out). Motion hasn't been seen on a device until it has been checked there.
