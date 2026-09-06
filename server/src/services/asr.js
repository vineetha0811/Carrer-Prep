import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ASR_DIR = path.join(__dirname, '..', '..', 'asr');
const PYTHON_BIN = process.platform === 'win32'
  ? path.join(__dirname, '..', '..', 'asr-venv', 'Scripts', 'python.exe')
  : path.join(__dirname, '..', '..', 'asr-venv', 'bin', 'python');
const MODEL_DIR = path.join(ASR_DIR, 'vosk-model-small-en-us-0.15');
const SCRIPT = path.join(ASR_DIR, 'transcribe_wav.py');

let cachedAvailable = null;

export function isAsrAvailable() {
  if (cachedAvailable == null) {
    cachedAvailable = fs.existsSync(PYTHON_BIN) && fs.existsSync(MODEL_DIR) && fs.existsSync(SCRIPT);
  }
  return cachedAvailable;
}

export function getAsrInfo() {
  return { available: isAsrAvailable(), engine: 'vosk-small-en-us', model: 'vosk-model-small-en-us-0.15' };
}

// Transcribes a raw 16 kHz mono 16-bit WAV (base64 payload) to plain text.
export async function transcribeWavBase64(audioBase64) {
  if (!isAsrAvailable()) throw new Error('Speech engine is not installed on the server.');
  if (!audioBase64 || typeof audioBase64 !== 'string') throw new Error('Audio data is required.');

  const buf = Buffer.from(audioBase64, 'base64');
  if (buf.length > 20 * 1024 * 1024) throw new Error('Audio is too large (max ~10 minutes).');

  const tmpName = `asr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`;
  const tmpPath = path.join(os.tmpdir(), tmpName);
  fs.writeFileSync(tmpPath, buf);

  try {
    const text = await new Promise((resolve, reject) => {
      const child = spawn(PYTHON_BIN, [SCRIPT, '--input', tmpPath], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.stderr.on('data', (d) => { err += d.toString(); });
      child.on('error', (e) => reject(e));
      child.on('close', (code) => {
        if (code !== 0) {
          const msg = err.trim() || 'Speech engine exited with an error.';
          reject(new Error(msg));
        } else {
          resolve(out.trim());
        }
      });
    });
    return text;
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}