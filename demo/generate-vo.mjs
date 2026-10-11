// Gemini 3.8 Flash TTS → one wav per line, then a 54s bed on the script clock.
// Usage: set GEMINI_API_KEY, then `node generate-vo.mjs`
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!KEY) {
  console.error('Set GEMINI_API_KEY (https://aistudio.google.com/apikey)');
  process.exit(1);
}

const LINES = [
  { id: '00', t: 0.0, text: 'Every November the sky goes grey.', style: 'tired contempt, not sad, adult who built this' },
  { id: '01', t: 3.6, text: 'The village downwind never gets the alert.', style: 'urgent, naming the person who loses' },
  { id: '02', t: 7.8, text: 'So open a page.', style: 'a dare, handing them the phone' },
  { id: '03', t: 10.2, text: 'North India.', style: 'excited, do not swallow the words' },
  { id: '04', t: 14.4, text: 'NASA sees the heat.', style: 'lean in, a secret, satellite not a dashboard' },
  { id: '05', t: 17.4, text: 'Wind tells you where the smoke goes.', style: 'lean in, the half nobody ships' },
  { id: '06', t: 23.4, text: 'Tap it.', style: 'a challenge, make them do the thing' },
  { id: '07', t: 26.4, text: 'Stubble. Not forest.', style: 'pride, the tag the old systems refuse' },
  { id: '08', t: 29.4, text: 'Fifteen kilometres west of Ludhiana.', style: 'intimate wonder, stay present' },
  { id: '09', t: 34.2, text: 'Four fires.', style: 'pride, hammer one' },
  { id: '10', t: 36.0, text: 'Three stubble.', style: 'pride, hammer two' },
  { id: '11', t: 37.8, text: 'One wildfire.', style: 'pride, hammer three, they add up' },
  { id: '12', t: 40.2, text: 'Hindi. Kannada. Telugu. English.', style: 'a grin, built for the phone they carry' },
  { id: '13', t: 45.0, text: 'Nothing runs when you close the tab.', style: 'warm, thesis setup' },
  { id: '14', t: 48.0, text: 'AgniGuard.', style: 'thesis, the company lives or dies on this name' },
];

const OUT_DIR = join(HERE, 'vo');
mkdirSync(OUT_DIR, { recursive: true });

async function speak(line) {
  const dest = join(OUT_DIR, `${line.id}.wav`);
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: line.text, speech_metadata: { style: line.style } }],
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
        },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${line.id} ${res.status}: ${err.slice(0, 400)}`);
  }
  const json = await res.json();
  const b64 = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error(`${line.id}: no audio in response`);
  writeFileSync(dest, Buffer.from(b64, 'base64'));
  console.log(`ok ${line.id} ${line.text}`);
  return dest;
}

for (const line of LINES) await speak(line);

const DUR = 54;
const inputs = ['-f', 'lavfi', '-t', String(DUR), '-i', 'anullsrc=r=24000:cl=mono'];
const chains = [];
const mix = [];
let idx = 1;
for (const line of LINES) {
  const wav = join(OUT_DIR, `${line.id}.wav`);
  inputs.push('-i', wav);
  const ms = Math.round(line.t * 1000);
  chains.push(`[${idx}]adelay=${ms}|${ms}[v${idx}]`);
  mix.push(`[v${idx}]`);
  idx++;
}
const graph = `${chains.join(';')};${mix.join('')}amix=inputs=${mix.length}:duration=longest:normalize=0,alimiter=limit=0.95,apad=whole_dur=${DUR}[a]`;
const out = join(HERE, 'vo-final.wav');
execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', '[a]', '-c:a', 'pcm_s16le', out]);
console.log(`vo → ${out}`);
