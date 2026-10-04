import wave, json, re
from pocketsphinx import Decoder
w = wave.open('work/vo16k.wav','rb'); data = w.readframes(w.getnframes())
text = """you have a question that matters a career move a strategy code that has to work so you ask the ais2
gpt says yes claude says no gemini says it depends enough let's debate honestly no names only arguments
this is certamen latin for contest every model answers then challenges the others
an arbiter rules consensus dissent and what to verify no backend no account your browser your key
open source let the models argue get the verdict"""
d = Decoder(samprate=16000, bestpath=False)
d.add_word("gpt","JH IY P IY T IY",False)
d.add_word("certamen","S ER T AA M AH N",False)
d.add_word("ais2","EY AY Z",True)
d.set_align_text(text.replace("\n"," "))
d.start_utt(); d.process_raw(data, full_utt=True); d.end_utt()
out=[]
for sg in d.seg():
    if sg.word in ("<sil>","<s>","</s>","(NULL)"): continue
    out.append({"w":re.sub(r"\(\d+\)","",sg.word).replace("ais2","ais"),"s":round(sg.start_frame/100,2),"e":round((sg.end_frame+1)/100,2)})
json.dump(out, open('work/words_raw.json','w'), indent=0)
print(len(out)); print(" ".join(f"{o['w']}[{o['s']}-{o['e']}]" for o in out))
