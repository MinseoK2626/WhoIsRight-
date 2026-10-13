import express from 'express';
import { createServer } from 'vite';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {judge,validCase} from './ai.js';
const app=express();
app.use(express.json({limit:'32kb'}));
const quotaPath=new URL('./.local/ai-usage.json',import.meta.url);
let used=0,day='',inFlight=false,lastRequest=0;
try{const saved=JSON.parse(await readFile(quotaPath,'utf8'));if(!Number.isInteger(saved.used)||saved.used<0||typeof saved.day!=='string')throw Error();used=saved.used;day=saved.day;}catch(e){if(e.code!=='ENOENT')throw new Error('Unable to read usage limit. Restore .local/ai-usage.json before starting.');}
const dailyLimit=20;
function refreshDay(){const today=new Date().toISOString().slice(0,10);if(day!==today){day=today;used=0;}}
app.get('/api/status',(req,res)=>{refreshDay();res.json({ai:Boolean(process.env.GEMINI_API_KEY),provider:'gemini',dailyLimit,remaining:Math.max(0,dailyLimit-used)});});
app.post('/api/verdict',async(req,res)=>{
 if(!validCase(req.body))return res.status(400).json({error:'INVALID_CASE'});
 if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'AI_NOT_CONFIGURED'});
 refreshDay();
 if(used>=dailyLimit)return res.status(429).json({error:'DAILY_LIMIT'});
 if(inFlight||Date.now()-lastRequest<30000)return res.status(429).json({error:'COOLDOWN'});
 inFlight=true;
 try{
 // Persist BEFORE calling Gemini. Failed attempts also count. Never automatically retry.
 used++;lastRequest=Date.now();await mkdir(new URL('./.local/',import.meta.url),{recursive:true});const tmp=new URL('./.local/ai-usage.tmp',import.meta.url);await writeFile(tmp,JSON.stringify({day,used}),{mode:0o600});await rename(tmp,quotaPath);
 res.json(await judge(req.body,{key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||'gemini-3.8-flash'}));
 }catch(e){const code=e.code||'AI_UNAVAILABLE';console.error('Verdict failed:',code,'provider HTTP:',e.providerStatus||'none');res.status(e.status===429?429:e.status===504?504:502).json({error:code});}finally{inFlight=false;}
});
app.use((err,req,res,next)=>res.status(err.status===413?413:400).json({error:'INVALID_REQUEST'}));
if(process.env.NODE_ENV==='production')app.use(express.static('dist'));
else{const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Court is in session on port '+(process.env.PORT||3000)));
