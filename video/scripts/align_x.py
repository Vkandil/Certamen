"""Forced alignment of the X-cut voice-over (x-cut/work/vo16k.wav) -> x-cut/work/words_raw.json"""
import wave, json, re
from pocketsphinx import Decoder
w = wave.open('work/vo16k.wav', 'rb'); data = w.readframes(w.getnframes())
text = ("i asked four ais2 what to charge for my saas gpt nine dollars claude ninety nine gemini it depends grok free "
        "four ais2 four answers zero clue enough so i made them debate names hidden only arguments "
        "they tear each others logic apart and an arbiter rules twenty nine a month one plan raise it after ten customers "
        "this is certamen open source what would you charge let them argue")
d = Decoder(samprate=16000, bestpath=False)
for wd, ph in [("gpt", "JH IY P IY T IY"), ("certamen", "S ER T AA M AH N"), ("ais2", "EY AY Z"), ("saas", "S AE S"), ("grok", "G R AA K"), ("others", "AH DH ER Z")]:
    if d.lookup_word(wd) is None or wd == "ais2":
        d.add_word(wd, ph, wd == "ais2")
d.set_align_text(text)
d.start_utt(); d.process_raw(data, full_utt=True); d.end_utt()
out = [{"w": re.sub(r"\(\d+\)", "", s.word).replace("ais2", "ais"), "s": round(s.start_frame / 100, 2), "e": round((s.end_frame + 1) / 100, 2)}
       for s in d.seg() if s.word not in ("<sil>", "<s>", "</s>", "(NULL)")]
json.dump(out, open('work/words_raw.json', 'w'))
print(len(out)); print(" ".join(f"{o['w']}[{o['s']}]" for o in out))
