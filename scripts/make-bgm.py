"""Generate an original 96 BPM courtroom loop; no external samples.
Requires Python/numpy and ffmpeg only when regenerating the committed MP3.
"""
from pathlib import Path
import numpy as np
import wave, subprocess
rate=44100
step=60/96/2
length=step*32
track=np.zeros(int(rate*length))
def tone(hz,at,dur,vol,kind='sine',end=None):
 start=int(at*rate); n=min(int(dur*rate),len(track)-start)
 if n<=0:return
 t=np.arange(n)/rate
 if end is None:phase=2*np.pi*hz*t
 else:phase=2*np.pi*(end*t+(hz-end)*.065*(1-np.exp(-t/.065)))
 sig=np.sin(phase)
 if kind=='triangle':sig=(2/np.pi)*np.arcsin(sig)
 env=np.minimum(t/.018,1)*np.exp(-t/(dur*.36))*np.minimum((n/rate-t)/.04,1)
 track[start:start+n]+=sig*env*vol
chords=[[146.83,174.61,220],[116.54,146.83,174.61],[98,116.54,146.83],[110,138.59,164.81]]
for i in range(32):
 local=i%8; chord=chords[i//8]; at=i*step
 if local==0:
  for hz in chord:tone(hz*2,at,step*7.9,.12)
 if local in [0,3,4,7]:tone(105,at,.3,.65 if local==0 else .48,end=45)
 if local%2==0:tone(chord[0],at,.35,.24,'triangle')
 if local in [1,5]:tone(1800,at,.065,.05,end=650)
 if local in [2,5,6]:tone(chord[[0,2,1,2,0,1,2,1][local]]*2,at,.3,.15,'triangle')
track=np.tanh(track)*.85
out=Path(__file__).resolve().parents[1]/'public/audio'
out.mkdir(parents=True,exist_ok=True)
with wave.open('/tmp/courtroom-original.wav','wb') as f:
 f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes((track*32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg','-y','-loglevel','error','-i','/tmp/courtroom-original.wav','-codec:a','libmp3lame','-b:a','128k',str(out/'courtroom-original.mp3')],check=True)
print('Original loop:',length,'seconds')
