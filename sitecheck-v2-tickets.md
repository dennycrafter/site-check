# SiteCheck v2: Tickets for Cursor

This continues `sitecheck-MASTER.md`. Tickets T0 to T4 are done and the app works. Build T5 to T12 in order.

---

## 0. Rules for the builder

1. The app already exists and was built from `sitecheck-MASTER.md`. Read the current code before changing anything. If the code and the master doc disagree on names or file paths, follow the code.
2. One ticket at a time, in order. After each ticket, run its checks and print the results. Do not start the next ticket until the current one passes.
3. All master doc rules still apply: real data only (no mocked AI results, no fake rows, no hardcoded verdicts), same stack, no auth, no new services, no em dashes in UI or README text, `npx vitest run` stays green.
4. The user is non-technical and on Windows. When you need them to do something (run SQL, add photos), give one short numbered list.
5. **Design rule.** Base follows Apple-style minimalism: one main action per screen, details hidden until asked for, no text that does not earn its place, generous whitespace, the existing colors and system font. If a screen needs explaining, simplify the screen.
6. Commit and push after each ticket passes, with a message like `T5: landing page`.

## Build order

| Ticket | What | Needs |
|---|---|---|
| T5 | Landing page | nothing |
| T6 | Homeowner flow: welcome screen, phases, breaker box question, "what we saw", redo from summary | T5 |
| T7 | Phase checkpoints | T6 |
| T8 | Instant on-phone photo checks | T7, a few real photos |
| T9 | Demo mode: split screen, demo camera, scenarios, outage switch | T8, the full demo photo set |
| T10 | Surveyor page: decision first, correct the AI, labeled data export | T9 |
| T11 | Surveyor asks for one retake (cut this first if short on time) | T10 |
| T12 | README and cleanup | all |

---

## T5: Landing page

Replace `/` with this layout. It overrides the master doc rule about not using Base's brand colors, for this page only. The name SiteCheck and the "Hackathon prototype" footer stay so it never looks like an official Base page.

Laptop layout (768 px and wider): max width 1200 px, centered, with generous side padding. The product name is written **site-check** (all lowercase) everywhere in the app UI, including the browser tab title.

- Top left of the page: small **site-check** name in dark green. No big title, no "Guided site photos for home battery installs." line.
- At least 48 px below the name, full width, on one line: **Guided photo checks for site surveys.** in Base dark green (about `#1D4A2C`), about 60 px with line height about 1.05. No forced line break. If it does not fit on one line at 1280 px, reduce the size until it does.
- Directly under the headline, left aligned, about 20 px, in near black (about `#1A1A1A`): Homeowners take the photos. AI checks each one on the spot. Surveyors get a ready-made verdict.
- About 64 px below that, two equal halves (50/50). The whole block from the headline down is vertically centered in the space below the name, so there is no large empty band at the bottom:
  - Left: two goal blocks stacked, **Immediate impact** on top, **Long-term impact** below. No card: no background, border or shadow. Each is plain text on the page background with a 3 px orange vertical line (about `#EE7733`, used only for these two lines) along its left side.
    - Small label **Immediate impact** (grey). Heading **Get it right the first time.** in dark green. Text in near black: Every homeowner, even the least tech-savvy, is guided shot by shot and told instantly if a photo won't work. Fewer retakes, faster installs, fewer customers lost while they wait.
    - Small label **Long-term impact** (grey). Heading **Every survey makes the next one smarter.** in dark green. Text in near black: Every home is photographed the same way, and every surveyor decision is saved with its photo. That becomes a labeled library of real homes, so the AI gets more accurate and fewer homes need manual review.
  - Right: two buttons stacked, centered horizontally in the right half and centered vertically against the two goal blocks. Each is about 280 px wide, 56 px tall, 18 px semibold text, 10 px corner radius, 12 px gap between them.
    1. **Start demo**: lime fill (about `#B5E07B`), dark green text. For now it links to `/start`. (T9 changes it to `/demo`.)
    2. **Dashboard**: white fill, thin dark green border, dark green text. Links to `/review`.
- Footer: Built for Base Power site surveys. Hackathon prototype.

Page background on every page: about `#EEECE7` (`--brand-bg`).

Phone layout (under 768 px): one column in this order: name, green line, homeowners line, Immediate impact, Long-term impact, then both buttons full width. The green line keeps its smaller size and wraps naturally.

Font: one only, Geist, for everything. Weights: headline and goal headings 750, buttons and labels 600, body text 400. Laptop sizes: headline 60 px, homeowners line 20 px, buttons 18 px, goal headings 22 px, goal body text 18 px, labels 14 px, footer 14 px. Nothing is smaller than 14 px except the footer. Phone sizes are unchanged.

Colors come from `src/styles/brand.css`. Near black for this page is `--brand-ink-strong`.

Remove the QR code and the Surveyor queue link from this page. `/review` still works when typed directly. Keep the `qrcode` package (T9 uses it).

Checks:
- [ ] Page text matches the above exactly.
- [ ] The two buttons sit side by side with the boxes on laptop, and stack in the order above on phone.
- [ ] Looks right at 375 px and 1280 px wide. No console errors.
- [ ] Search `src` for the em dash character: none found.

---

## T6: Homeowner flow

### 6.1 Welcome screen (skip the questions)

In real use, Base already knows the customer and sends them a link. Simulate that link with URL parameters:

`/start?name=Jordan%20Lee&email=jordan@example.com&austin=yes&solar=no`

- If all four parameters are present and valid, `/start` skips the form and shows the welcome screen:
  - **Hi {first name}.**
  - Let's photograph your meter and breaker box. About 5 minutes.
  - Three short lines with small check icons: Go out in daylight. / Unlock any gate near your meter. / Be ready to open your breaker box lid.
  - Above the Begin button, a small grey label **3 short parts** (same style as the landing page goal labels) and the 3 phases in order as a short numbered list: 1. Your meter / 2. The space around it / 3. Your breaker box. Take the titles from the phase titles exported by `src/lib/steps.ts` so the two never drift apart.
  - Button **Begin**: calls the existing `POST /api/homes` with the four values, then goes to `/capture/[homeId]`. Carry any other URL parameters through to the capture URL (T9 adds `demo`).
- If any parameter is missing or invalid, show the existing form (fallback for people trying it without a link).
- The customer has been welcomed already, so the capture page skips its own "Let's check your home" screen: after the map step it goes straight to the safety dialog, then Find your meter. Begin sets a per-tab flag for this; people who arrive without the welcome link keep the capture welcome.

### 6.2 Phases

Add `phase` to every step in `src/lib/steps.ts` and export the phase titles:

| Phase | Title | Steps |
|---|---|---|
| 1 | Your meter | meter_area_wide, meter_closeup |
| 2 | The space around it | left_of_meter, right_of_meter, adjacent_wall, behind_fence (when shown) |
| 3 | Your breaker box | breaker box question (when shown), panel_wide (when shown), panel_open (when shown), main_disconnect_closeup |

Step order does not change. `planSteps` and `nextStep` keep their logic.

Capture page header: replace "Step X of Y" with the phase title and a 3-segment bar (one segment per phase; the current segment fills as its shots finish). The bar never moves backwards when a conditional step appears.

Under the phase title, show two short labels: **Part X of 3** (X is the phase number) and **Photo Y of Z**.

- Z is the number of planned photos in that phase **when the phase starts** (the regular steps `planSteps` returns for that phase at that moment). Freeze it for the phase, and keep it for the tab session so a page reload does not change it. The breaker box question is not a photo and is not counted.
- Y is the position of the current photo among those planned photos.
- A conditional step that was not planned when the phase started (for example `behind_fence` once a fence is first seen in the left or right photo) does **not** change Z. Its title on the capture page reads **One extra photo: {step title}**. Its Y stays at Z, so it never reads higher than Z. A step the whole-site check asks for reads just **One extra photo**. If the conditional step was already planned when the phase started (for example a fence seen in `meter_area_wide`), it is an ordinary photo and counts in Z.
- The breaker box question screen shows the phase title, Part 3 of 3 and the bar, without a Photo label.
- The bar fills the current segment by finished planned photos divided by Z, so an extra photo cannot make it shrink.

### 6.3 Breaker box question

Replace the question 5 screen. Same trigger (setup type `panel_indoors`), same saved field, same endpoint, no database change. It becomes the first screen of phase 3:

- **Where's your breaker box?**
- We couldn't see it next to your meter.
- Three large buttons:
  - Inside, right behind the meter wall (saves `yes`)
  - Inside, somewhere else (saves `no`)
  - Not sure (saves `not_sure`)

### 6.4 "What we saw"

When a photo is accepted, replace "Looks good" with one short line built by code from the analysis. No new AI fields, no extra AI call. Put the mapping in `src/lib/sawLine.ts` with unit tests.

| Step | Line |
|---|---|
| meter_area_wide | Got it: your meter and the wall around it. |
| meter_closeup | Got it: meter numbers are readable. |
| left_of_meter, right_of_meter, adjacent_wall, behind_fence | `room_for_two`: Got it: plenty of clear ground here. `room_for_one`: Got it: some clear ground here. Anything else: Got it. |
| panel_wide | Got it: breaker box outside / in the garage / in a closet / indoors (from `location`). `unknown`: Got it. |
| main_disconnect_closeup | Got it: {amp_rating}A main switch. |

Never show the homeowner a verdict, battery count, hazard, or anything that sounds like pass or fail.

### 6.5 Redo from the summary

On the final summary screen, tapping a photo opens that step again. The new photo is a new attempt with the normal checks and the 3-attempt limit. When it finishes, return to the summary. Hide the redo option on steps that already have 3 attempts.

`POST /api/photos` accepts `redo: true` to take a new attempt on a step that is already finished (only while it has fewer than 3 attempts). Without it, a finished step still returns 409. The redo header shows the step's phase with a full bar.

Checks:
- [ ] `/start` with the four parameters shows the welcome screen and never the form. Without them it shows the form.
- [ ] The welcome screen lists the 3 phases as a numbered list above Begin, in the order Your meter, The space around it, Your breaker box.
- [ ] Every capture screen shows the phase title with "Part X of 3" and "Photo Y of Z" under it. Z does not change during a phase.
- [ ] A conditional step that appears mid-phase is labeled "One extra photo: {step title}" and Z stays the same.
- [ ] A full run on the deployed URL (upload fallback is fine) shows phase titles, a bar that never jumps back, and a "what we saw" line on each accepted photo.
- [ ] The breaker box question appears when setup is `panel_indoors` (test with a meter photo that has no breaker box in view) and saves correctly.
- [ ] Redo from the summary opens the step, returns to the summary, and is hidden on steps with 3 attempts.
- [ ] `npx vitest run` passes, including the new `sawLine`, `phases` and `startLink` tests.

---

## T7: Phase checkpoints

Goal: the homeowner shoots a whole phase without waiting, and checking happens at the end of each phase. 3 waits instead of 8.

### How it works

1. The steps of a phase are the steps `planSteps` returns for that phase at the moment the phase starts.
2. When the shutter is pressed inside a phase, the client sends `POST /api/photos` **without waiting** for the result, shows "Saved" for half a second, and moves to the next step of the phase. Keep the pending requests in page state.
3. After the last step of the phase, show the **checkpoint screen**:
   - Title while checking: **Checking your photos**. When done: **{Phase title}: done**, or **1 quick fix** / **2 quick fixes**.
   - One row per shot in this phase: thumbnail, shot title, and one of: spinner (checking); green check with the "what we saw" line (accepted); amber retake message with a **Retake** button (retake); neutral "A surveyor will check this one." (check_failed or accepted_after_max_attempts).
   - Main button **Continue**, enabled only when nothing is pending and no retakes are left.
4. A retake from the checkpoint opens that step, checks the new photo right away (wait for the result like today), then returns to the checkpoint.
5. When the phase is settled, call `POST /api/homes/[id]/evaluate` (below), then `GET /api/homes/[id]`. If `nextStep` is a step of the current phase with no photo yet (for example `behind_fence`, which only appears once a fence is seen), the button reads **Next: {step title}**, opens that step (checked right away), and returns to the checkpoint. Otherwise **Continue** goes to the next phase.
6. After phase 3's checkpoint, go to the summary screen as today.

### Server changes

- New `POST /api/homes/[id]/evaluate`: reruns the rules engine only (no AI), saves verdict, battery count and reasons, returns them. `maxDuration = 60`.
- Race fix: several photo checks can finish at the same moment and each recomputes the verdict. The recompute must read all photos fresh from the database right before evaluating. The evaluate call at each checkpoint makes sure the stored verdict ends up current.
- `POST /api/photos` stays as it is. The client ignores its `nextStep` while inside a phase.

### Edge cases

- Page reload or phone lock mid-phase: on load, `GET /api/homes/[id]` decides where to resume. A photo whose check never finished has no row, so that step is simply asked again. Acceptable; T12 adds it to Known limitations.
- If a request itself fails (network error, no response), show that row with a **Retake** button. Never show an error screen.
- No client timeout on these requests (a check can take about 95 s in the worst case).

Checks:
- [ ] Full run on a phone on the deployed URL: no waiting between shots inside a phase; each phase ends with a checkpoint.
- [ ] A deliberately bad photo mid-phase shows up at the checkpoint as a quick fix with the right message; the retake works; Continue then enables.
- [ ] With `SIMULATE_AI_FAILURE_RATE=0.3`, a full run completes. Print sample server log lines.
- [ ] After the run, the verdict on `/review` matches a fresh `evaluate` call. Print both.

---

## T8: Instant on-phone checks

Catch obviously dark or blurry photos in the browser before anything is uploaded.

- New `src/lib/quality.ts` (pure functions, no DOM): takes grayscale pixel values of a downscaled copy (256 px on the long edge) and returns `{ brightness, sharpness }`. Brightness = mean luminance, 0 to 255. Sharpness = variance of the Laplacian.
- Starting constants: `MIN_BRIGHTNESS = 40`, `MIN_SHARPNESS = 60`. Tune them with the user's real photos in this ticket and print every photo's scores.
- Run it on every photo (camera, upload, and the demo camera from T9) before sending. If it fails, show the master doc 8.5 message for `too_dark` or `blurry` immediately. Do not upload. Do not count an attempt.
- Safety valve: if the same step fails the instant check twice in a row, the third photo skips it and goes to the AI as normal.
- Browser console log per photo: `[quality] step=<id> brightness=<n> sharpness=<n> pass=<bool>`.
- `src/lib/quality.test.ts` with synthetic pixel arrays: all black fails brightness; flat gray fails sharpness; a checkerboard passes both.

Checks:
- [ ] Tests pass.
- [ ] A dark photo is rejected instantly with no network request (check the Network tab).
- [ ] None of the user's good photos is rejected. Print their scores.

---

## T9: Demo mode

Goal: record the whole product on a laptop in one Loom, homeowner and surveyor side by side, with no phone and no going outside. Everything still runs through the real AI and rules.

### 9.1 Demo photos

Ask the user to put their photos in a folder `demo-photos-raw/` in the project root (add it to `.gitignore`) with these names:

| File | Shot | Needed |
|---|---|---|
| meter-wide.jpg | Meter and wall from about 10 steps back | yes |
| meter-close.jpg | Meter close-up, numbers readable | yes |
| meter-close-dark.jpg | Same shot, too dark or blurry | yes |
| left.jpg | Left of the meter | yes |
| right.jpg | Right of the meter | yes |
| corner.jpg | Around the nearest corner | yes |
| fence.jpg | Behind the fence | only if there is a fence |
| panel-wide.jpg | Breaker box and surroundings | only if separate from the meter |
| main-switch.jpg | Main switch, lid open, amp number readable | yes |
| main-switch-lid-closed.jpg | Main switch with the lid closed | yes |

Optional: a short video with the same name and `.mp4` or `.mov` (for example `left.mp4`).

Add `npm run demo:photos` (`sharp` as a dev dependency). It reads `demo-photos-raw/`, resizes photos to max 2000 px on the long edge, strips **all** metadata (EXIF, GPS), writes JPEGs to `public/demo/photos/`, and copies videos to `public/demo/videos/`. It prints what it wrote. If it finds `.heic` files, it tells the user to set the iPhone camera to Most Compatible (Settings, Camera, Formats) and reshoot or re-export as JPEG. These photos become public in the repo and on the site, so metadata must never be committed.

### 9.2 Scenarios

Create `public/demo/scenarios.json`:

```json
{
  "good": {
    "label": "Good home",
    "customer": { "name": "Jordan Lee", "email": "jordan@example.com", "inAustin": true, "hasSolar": false },
    "steps": {
      "meter_area_wide": ["meter-wide"],
      "meter_closeup": ["meter-close"],
      "left_of_meter": ["left"],
      "right_of_meter": ["right"],
      "adjacent_wall": ["corner"],
      "behind_fence": ["fence"],
      "panel_wide": ["panel-wide"],
      "main_disconnect_closeup": ["main-switch"]
    }
  },
  "retakes": {
    "label": "Needs retakes",
    "customer": { "name": "Sam Ortiz", "email": "sam@example.com", "inAustin": true, "hasSolar": false },
    "steps": {
      "meter_closeup": ["meter-close-dark", "meter-close"],
      "main_disconnect_closeup": ["main-switch-lid-closed", "main-switch"]
    }
  },
  "fail": {
    "label": "Doesn't qualify",
    "customer": { "name": "Riley Chen", "email": "riley@example.com", "inAustin": true, "hasSolar": true },
    "steps": {}
  }
}
```

- Each step maps to a list of files (no extension) used in order: the first shutter press uses the first file, the next press the second, and the last file repeats. Any step a scenario does not list falls back to the `good` scenario's files.
- Leave out `fence` and `panel-wide` entries if the user has no such photo.
- Ask the user for the amp number on their main switch, then set the customers so the results are honest:
  - `good` and `retakes`: `inAustin: true` unless the amp is under 150A, then `false`.
  - `fail`: if the amp is under 200A, `hasSolar: true` fails on `SOLAR_NEEDS_200A`. If it is exactly 200A, ask the user for one photo from a second home (or a space photo with the ground fully blocked) and use it.
- Run every scenario once and print its verdict and reasons. If `good` does not come out PASS with the real photos, tell the user which reason blocks it. Never change rules or data to force a result.

### 9.3 Demo camera

- Capture pages accept `?demo=<scenarioId>`. In demo mode the live camera is replaced by the demo camera: the viewfinder shows the scenario's video (muted, looping) or photo for the current step, with the normal outline on top. "Upload a photo instead" is hidden unless the scenario has no file for this step.
- If a video exists but will not play in the browser, use the photo.
- Shutter: draw the current video frame or the photo to a canvas and continue exactly like a real capture (resize, JPEG, T8 instant check, upload, phase checkpoint).
- Which file to use: count shutter presses on this step in the current page session (not server attempts, because instant-check rejections do not create attempts).

### 9.4 The /demo page

- Laptop layout (900 px and wider). Top bar: scenario pills (Good home, Needs retakes, Doesn't qualify), a **Restart** button, and a **Simulate AI outages** switch. Below: on the left, a phone frame (390 x 844, scaled to fit the window height) containing an iframe; on the right, the surveyor view in a second iframe.
- Choosing a scenario (or Restart) loads the phone iframe with `/start?name=...&email=...&austin=...&solar=...&demo=<id>` from the manifest, so the phone starts on the welcome screen.
- The right side starts on `/review`. When the homeowner taps Begin, the capture page (demo mode only) sends `window.parent.postMessage({ type: "sitecheck-home", homeId }, window.location.origin)`. The demo page then loads `/review/<homeId>?live=1` on the right.
- `?live=1` on review pages: refresh the server data every 2 seconds (`router.refresh()` in a small client component) so the verdict and photos update as the homeowner goes. On the detail page, `?live=1` also shows a collapsed **Engine log** at the bottom: this home's photo rows, newest first, with time, step title, status, AI tries and latency in seconds. Data from the `photos` table only.
- Under 900 px wide, `/demo` redirects to `/start` (real camera, normal form).
- Small link under the phone: **Try it on your own phone**. It opens a QR code of `<origin>/start`.
- Change the landing page **Start demo** button to link to `/demo`.

### 9.5 Outage switch

- The switch stores `sitecheck-demo-failure-rate` in `localStorage` (`0.3` on, `0` off).
- In demo mode, the capture page reads it at each upload and sends `demo: true` and `simulateFailureRate` in the `POST /api/photos` body.
- The server uses `max(env rate, body rate)` only when `demo` is true, and caps the body rate at 0.5.

Checks:
- [ ] `npm run demo:photos` runs. Files in `public/demo/photos/` carry no EXIF or GPS data (print a metadata check).
- [ ] `demo-photos-raw/` is not tracked by git.
- [ ] On `/demo` at 1440 x 900, each scenario runs start to finish and the right side updates without manual refresh.
- [ ] "Needs retakes": the dark close-up is caught instantly; the closed lid gets a lid message from the AI; both retakes pass.
- [ ] "Doesn't qualify" ends in FAIL with the expected reason. Print the reasons.
- [ ] With the outage switch on, the Engine log shows photos with AI tries above 1 and the run still completes.

---

## T10: Surveyor page

### 10.1 Decision first

Redesign `/review/[homeId]` so the top of the page is only:

- Customer name and email, small.
- The verdict word, large, in its color, with the battery count beside it ("2 batteries", or "1 battery, provisional" for REVIEW).
- One sentence: the message of the top reason (first after sorting FAIL, REVIEW, PASS).
- The photo that reason came from (its step's latest photo). If the reason has no step, use `meter_area_wide`.
- Buttons **Approve**, **Reject**, **Site visit**, and a small **Add note** link that opens the note field.

Everything else (all reasons, all photos, AI readouts, previous attempts, Re-run checks) moves under one **Show all photos and details** toggle, closed by default.

After a decision, show it plainly ("Approved") with an **Undo** link. `/api/homes/[id]/decision` accepts `decision: null` to clear it.

### 10.2 Correct the AI

Inside the details, every AI reading shown for a step (the fields that matter per master doc 8.4) is editable: a switch for yes/no fields, a dropdown for choices, a number for `amp_rating`. Setting a value, even the same one, saves it immediately.

Ask the user to run this SQL in Supabase, and append it to `supabase/schema.sql`:

```sql
create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  home_id uuid not null references public.homes(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  step text not null,
  field text not null,
  ai_value jsonb,
  corrected_value jsonb not null
);
create index if not exists corrections_photo_idx on public.corrections(photo_id, field, created_at desc);
alter table public.corrections enable row level security;
grant all on public.corrections to service_role;
```

- New `POST /api/homes/[id]/corrections`, body `{ photoId, field, value }`. Validate with zod: the field must be one of the schema fields and the value must match its type and enum. Save a row with the AI's original value, rerun the rules, return the new verdict.
- New `src/lib/corrections.ts`: pure function `applyCorrections(photos, corrections)` that returns the photos with the latest correction per photo and field applied, and sets `confidence` to 100 on any corrected photo (a person confirmed it, so the low-confidence downgrade no longer applies). Every rules run (after a photo, evaluate, submit, recheck, correction) goes through it. `rules.ts` itself does not change.
- A corrected field shows a small "Corrected" label and the AI's original value in gray.
- Photos with no analysis (`check_failed`) are not editable.
- Unit tests: a 125A reading in Austin corrected to 200A turns FAIL into PASS. A `panel_wide` photo with confidence 60 and `location` set to `closet` by the surveyor ends as FAIL (`PANEL_IN_CLOSET`), not REVIEW.

### 10.3 Labeled data

- `/review` header: next to the verdict counts, add **AI readings corrected: N of M**, over homes with a surveyor decision. M = editable readings on those homes' latest photos. N = how many of those have a correction.
- Footer link on `/review`: **Export labeled data**. `GET /api/export/labels` downloads a JSON file with one entry per latest photo of each decided home: `{ photoId, homeId, step, storagePath, aiAnalysis, finalValues, correctedFields, surveyorDecision, verdict }`. No names or emails.

Checks:
- [ ] The top of the page shows only the decision block; details open and close.
- [ ] Correcting a reading changes the verdict when it should, and the stat on `/review` updates.
- [ ] The export downloads valid JSON with no names or emails. Print one entry.
- [ ] `npx vitest run` passes, including the new tests.

---

## T11: Ask for one retake (cut this first if time is short)

- In the details, each photo card gets **Ask for a retake**. It adds `{ step, requestedAt }` to a new list on the home:

```sql
alter table public.homes add column if not exists retake_requests jsonb not null default '[]'::jsonb;
```

- Real use would email or text the homeowner their link. No email or SMS in this prototype; the link is the same `/capture/[homeId]`.
- `GET /api/homes/[id]` also returns `retakeRequests`.
- Homeowner side: the Thanks screen checks `GET /api/homes/[id]` every 3 seconds. When the list is not empty, show: **One more photo, please.** / Your surveyor asked for a new {step title} photo. / Button **Take photo**. That step is captured and checked right away with the normal retake messages, up to 3 tries counted from `requestedAt`. When it is accepted (or the tries run out), remove the request, rerun the rules, and show the Thanks screen again.
- In `/demo` this shows live: click the button on the right, and the phone on the left changes within a few seconds.

Checks:
- [ ] In `/demo`: submit a home, ask for a retake of the main switch, the phone shows the request, the new photo replaces the old one on the right, and the verdict updates.

---

## T12: README and cleanup

Update `README.md`, keeping the master doc 11.1 section order:

- Pitch: use the landing page text, including both goals.
- New **Demo mode** section: how `/demo` works, the scenarios, `npm run demo:photos`, the outage switch.
- Architecture: add phase checkpoints, instant on-phone checks, corrections and the evaluate endpoint to the Mermaid diagram and the bullet lines.
- How the rules work: surveyor corrections override AI values and count as confirmed.
- Known limitations, add: a photo can be lost if the page closes mid-phase (that step is asked again); instant-check thresholds were tuned on a small set of photos; retake requests are not emailed.
- Next steps, add:
  - **Property preview**: a Google Aerial View API flyover of the address on the surveyor page, for context on yard, fences and access. Display only; the videos cannot be stored.
  - **Immersive site view**: stitch the homeowner's walk-around into a 3D view of the meter wall. Also the base for measuring distances.
  - **Learning from surveyors**: use corrections to measure accuracy per reading, tune confidence thresholds and prompts, then train a specialist model once enough labeled photos exist.
- Data and provenance: demo photos are of the team's own or consenting friends' homes, with metadata stripped.
- `supabase/schema.sql` includes the new table and column.

Checks:
- [ ] Every master doc 11.1 section is present, plus Demo mode.
- [ ] `git ls-files` shows no `.env.local` and nothing from `demo-photos-raw/`. No secrets in git history.
- [ ] No em dash anywhere in README or `src`.
- [ ] The deployed site works in a private browser window: `/`, `/demo`, `/review`.

---

## Out of scope

Email or SMS sending, login, any Google Maps integration (roadmap only), 3D views, distance measuring, the A/C nameplate step, native apps, new pages beyond `/demo`.
