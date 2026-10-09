"""Forced alignment of the X-cut CTA line (x-cut/work/cta16k.wav) -> x-cut/data/cta_words.json"""
import wave, json, re
from pocketsphinx import Decoder
w = wave.open('work/cta16k.wav', 'rb'); data = w.readframes(w.getnframes())
d = Decoder(samprate=16000, bestpath=False)
for wd, ph in [('certamens', 'S ER T AA M AH N Z'), ('github', 'G IH T HH AH B')]:
    if d.lookup_word(wd) is None:
        d.add_word(wd, ph, False)
for text in ["certamens price zero its open source star it on github", "certamens price zero open source star it on github"]:
    try:
        d.set_align_text(text)
        d.start_utt(); d.process_raw(data, full_utt=True); d.end_utt()
        out = [{"k": re.sub(r"\(\d+\)", "", s.word), "s": round(s.start_frame / 100, 2), "e": round((s.end_frame + 1) / 100, 2)}
               for s in d.seg() if s.word not in ("<sil>", "<s>", "</s>", "(NULL)")]
        if out:
            print(text); print(out); break
    except Exception as e:
        print('fail', text, e)
json.dump(out, open('data/cta_words.json', 'w'))
