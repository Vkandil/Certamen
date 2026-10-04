# Certamen promo video

A 47 s, 1920×1080 at 60 fps motion-design promo for Certamen. Everything is generated from code: the visuals are HTML/CSS/SVG rendered by headless Chromium, and the music and sound design are synthesized in Python. Every cut is timed to the narrator's words.

## Pipeline

```
audio/vo.mp3 ──► scripts/align.py ──► data/words.json ──► scripts/timeline.mjs ──► data/timeline.json
                 (PocketSphinx forced alignment)              (SFX cues, typing, chaos spawns)
                                                         │
             src/ (index.html, style.css, main.js) ◄─────┤  visuals + dynamic captions, pure f(t)
             audio/build_audio.py ◄──────────────────────┘  score + SFX + VO mix
```

## Rebuild

```bash
cd video
npm install
pip install numpy scipy soundfile pocketsphinx

mkdir -p work out
ffmpeg -i audio/vo.mp3 -ar 16000 -ac 1 work/vo16k.wav
ffmpeg -i audio/vo.mp3 -ar 48000 -ac 1 -c:a pcm_f32le work/vo48.wav
python3 scripts/align.py            # word timings (then words.json is built from work/words_raw.json)
node scripts/timeline.mjs           # shared timeline
python3 audio/build_audio.py        # out/mix.wav
node render.mjs --stills 9.9,23.9   # quick look at chosen timestamps (out/stills/a)
node render.mjs --fps 60            # out/video.mp4 (silent)
ffmpeg -i out/video.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 256k -movflags +faststart out/certamen-promo.mp4
```

`render.mjs` uses the Chromium build at `/opt/pw-browsers`. Set `CHROME=/path/to/chrome` to use another one.

## Story

| Time | Act | VO |
|---|---|---|
| 0–8.7 | The question | You have a question that matters… So you ask the AIs. |
| 9.2–16.4 | The noise | GPT says yes. Claude says no. Gemini says… it depends. |
| 16.4–17.6 | Enough. | Hard freeze, cut line |
| 17.6–22.6 | Honest debate | Logos flip to anonymous Contendens A–D and shuffle |
| 22.6–26.7 | Certamen | Cards fold into the logo; the wordmark is chiseled |
| 26.7–34.3 | Protocol | Stream, then challenge arcs, then the arbiter, then the verdict |
| 34.3–40.6 | Trust | No backend / no account (slashed), browser + key, open source |
| 40.6–47 | Finale | Petals argue, snap into the logo, end card |

Third-party model logos come from `@lobehub/icons-static-svg`, shown in monochrome only before the anonymization flip. The end card carries a trademark disclaimer.

## X cut (1:1, 31.5 s)

`x-cut/` holds a square, loopable cut for X: a cold open (frame 0 is the thumbnail), the price fight, "Enough.", an arena debate with anonymous gladiators, a verdict and a reply-bait ending that loops back to frame 0. Plan and prompts: `x-cut/SCRIPT.md`.

```bash
python3 scripts/align_x.py            # run from x-cut/ (word timings)
python3 scripts/prep_x_assets.py      # run from x-cut/ (keys the generated images)
node x-cut/timeline.mjs
python3 x-cut/audio.py                # x-cut/out/mix.wav
node render.mjs --page x-cut/src/index.html --w 1080 --h 1080 --out x-cut/out --fps 60
```
