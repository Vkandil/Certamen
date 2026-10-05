# Certamen: X cut (1:1, ~30 s)

## Decisions

- **Format:** 1080×1080 at 60 fps. Square shows uncropped and large on X mobile and desktop, and it is the safest framing for both.
- **Question:** "What should I charge for my SaaS?" (see the reasoning below)
- **Hook:** the fight is already running at frame 0 (4 AIs, 4 prices), and the "Enough." break lands at ~6 s.
- **Ending:** a reply-bait question ("What would you charge?"), and the last frame matches the first frame so the video loops.
- **Honesty:** the answers are a dramatization. The end card says so, next to the trademark disclaimer.

## Why this question

| Question | Who on X it speaks to | Visual contrast | Reply bait | Risk |
|---|---|---|---|---|
| **What should I charge for my SaaS?** | Founders, indie hackers, build-in-public: the most active resharing crowd on tech X | **Numbers**: $9 vs $99 vs FREE is absurd and readable in 0.3 s | Very high: everyone has a price opinion | Low |
| Should I quit my job to build my startup? | Very broad | YES / NO only | High | Reads as life advice and feels heavy |
| VC or bootstrap? | Founders | YES / NO | High, but tribal | Turns into flame wars and shuts out non-founders |
| React or Vue? / Tabs or spaces? | Developers | Words | High | Meme-tier, so it undersells Certamen's real use |
| Will AI take my job? | Everyone | Weak (answers sound alike) | Medium | Doom fatigue and predictable answers |

**Choice: SaaS pricing.** It is the only question where the disagreement is *numbers*: a 10× spread that looks funny with the sound off. The stakes are real money, and it hits the audience that reposts tools. The verdict can also be concrete and smart, which proves the product works. "What would you charge?" turns viewers into repliers.

## Voice-over (ElevenLabs v4, bracket audio tags)

```
[urgent, punchy] I asked four AIs what to charge for my SaaS.
[fast, incredulous] GPT: nine dollars. [short pause] Claude: ninety-nine. [short pause] Gemini... [sighs] it depends. [short pause] Grok: free.
[overwhelmed, quicker] Four AIs. Four answers. Zero clue.

[pause] [firm, authoritative] Enough.

[calm, confident] So I made them debate. [short pause] Names hidden. Only arguments.
[brisk] They tear each other's logic apart... and an arbiter rules.
[measured, satisfied] Twenty-nine a month. One plan. Raise it after ten customers.

[warm] This is Certamen. Open source.
[playful, inviting] What would you charge? [short pause] Let them argue.
```

About 77 words, which should run roughly 28–32 s. Recording tips:
- If the take runs over 32 s, raise the speed to about 1.1 rather than cutting lines.
- The first sentence must start on the very first syllable. Trim any leading silence before sending the file.
- "Enough." is the hardest, loudest word in the take. "So I made them debate" comes right after it, calm.

## Storyboard (1:1)

| Time | Beat | On screen |
|---|---|---|
| **Frame 0** | Thumbnail | Four chat windows are already on screen and slamming prices: **$9 · $99 · IT DEPENDS · FREE**. Top bar: "What should I charge for my SaaS?" Title: **"4 AIs. 1 question. 4 prices."** |
| 0–4 s | GPT / Claude / Gemini / Grok | Each AI's answer gets its own punch-in, with camera snaps, price-tag slams and sub hits |
| 4–6 s | Zero clue | Swarm: 10+ windows and flying price tags ($0, $19, $499, "per seat?") with glitch and shake ramping up |
| ~6 s | **Enough.** | Hard freeze, silence and a cut line |
| 6–10 s | Debate, names hidden | The stone world floods in. Logos flip into gladiator helmets marked A/B/C/D, and the arena appears from above |
| 10–14 s | Tear apart, arbiter | Arguments cross the arena, prices get struck through, everything converges on the arbiter |
| 14–19 s | Verdict | A verdict card under a laurel wreath: **$29/mo · 1 plan · raise after 10 customers** |
| 19–24 s | Certamen. Open source. | Petals snap into the logo and the wordmark is carved into a stone tablet |
| 24–30 s | What would you charge? | Big question with a blinking reply cursor, then a cut straight back to the frame-0 composition (loop) |

Rules: something changes on screen at least every 1.5 s. Captions are large and centered and readable muted, and they are the primary channel.

## Image assets to generate

All images: **no text, no letters, no logos, no watermark.** Use exactly the size and background color given; I key out the flat backgrounds in code.

Palette reference: stone #F4EEE3 · ink #1B1A17 · terracotta #A8452F · ochre #BF8526 · olive #5F6B3E · blue #2F4E7E

### 1. `arena.png` — Roman arena from above (2048×2048, square)
> Perfectly top-down aerial view of an empty ancient Roman amphitheater, exactly centered and symmetrical, oval arena floor of smooth pale sand occupying the central 45% of the image, concentric rings of weathered warm limestone seating tiers around it, soft even late-afternoon light with gentle shadows, minimalist architectural illustration with subtle film grain, muted warm palette of beige #F4EEE3, sand, light ochre and faint terracotta, calm and elegant, no people, no animals, no text, no logos, no watermark

### 2. `stone.png` — seamless stone texture (2048×2048, square)
> Seamless tileable texture of smooth pale travertine limestone, very subtle pores and faint veins, warm beige #F4EEE3 overall tone, perfectly flat and evenly lit, no shadows, no vignette, no cracks, no objects, low contrast, photographic, no text, no watermark

### 3. `tablet.png` — blank stone tablet (2048×1152, 16:9)
> Front-facing orthographic view of a blank rectangular Roman marble tablet with a thin carved inner border, perfectly centered, occupying 80% of the width, slightly weathered edges, soft directional light from the top-left, subtle shadow under it, placed on a flat plain background of exactly #F4EEE3, completely blank surface with no inscriptions, no letters, no text, no logos

### 4. `laurel.png` — laurel wreath (2048×2048, square)
> Roman laurel wreath, symmetrical, open at the top, two branches meeting at the bottom, elegant engraving-style line art with fine hatching, single color dark ink #1B1A17, on a perfectly flat pure white #FFFFFF background, centered, no ribbon text, no letters, no shadow, no gradient background

### 5. `helmet.png` — gladiator helmet (2048×2048, square)
> Flat minimalist silhouette icon of an ancient Roman gladiator helmet (murmillo style with a crest and a grilled visor hiding the face), three-quarter front view, solid single color pure black #000000 shape with the visor grille cut out as negative space, on a perfectly flat pure white #FFFFFF background, centered, bold geometric shapes, no outline stroke, no shading, no gradient, no text

## Call to action (added after the first render)

A 4.2 s segment is inserted after "Open source." (the voice-over is split there; see `timeline.mjs`, `GAP`):

| Time in segment | On screen |
|---|---|
| 0.0–0.75 s | "Certamen's price?", then $9 / $99 / $29 each pop in and get slashed |
| 0.85 s | **$0** slams inside the laurel, stamped "100% FREE · OPEN SOURCE" |
| 2.0–2.5 s | The laurel shrinks to the top. Buttons: **Try it free →** (vkandil.github.io/Certamen) and **☆ Star it on GitHub** (github.com/Vkandil/Certamen) |
| 2.6 s | "No account. No paywall. Bring your own OpenRouter key." (the app is free; model usage is billed by OpenRouter) |
| 2.65–3.3 s | A cursor clicks the star, which fills with a "+1 ★" burst |

Optional voice line for the gap (≤ 3.8 s), to record with the same voice:

```
[playful, confident] Certamen's price? [short pause] Zero. [warm] Open source. [inviting] Star it on GitHub.
```
