const TARGET_RATE = 16000;

export function supportsVoiceCapture() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    && (window.AudioContext || window.webkitAudioContext));
}

function requestMic() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: TARGET_RATE,
    },
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result || '');
      resolve(s.indexOf(',') >= 0 ? s.slice(s.indexOf(',') + 1) : s);
    };
    fr.onerror = () => reject(new Error('Could not read recorded audio.'));
    fr.readAsDataURL(blob);
  });
}

function resampleTo(input, fromRate) {
  if (fromRate === TARGET_RATE) return input;
  const ratio = fromRate / TARGET_RATE;
  const outLen = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const pos = i * ratio;
    let i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    if (i0 < 0) i0 = 0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function buildWav(samples, rate) {
  const pcm = resampleTo(samples, rate);
  const n = pcm.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);

  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, n * 2, true);

  let offset = 44;
  for (let i = 0; i < n; i += 1) {
    let s = pcm[i];
    if (s > 1) s = 1;
    if (s < -1) s = -1;
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

// startVoice() -> { active, stop() -> Promise<{ blob, base64 }> }
// Records the microphone into a mono 16 kHz 16-bit WAV blob (no server round-trip
// needed for capture; transcription happens server-side via /api/asr/transcribe).
export async function startVoice() {
  if (!supportsVoiceCapture()) throw new Error('Voice recording is not supported in this browser.');
  const stream = await requestMic();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  processor.channelCount = 1;
  processor.channelCountMode = 'explicit';
  const chunks = [];
  let stopped = false;

  processor.onaudioprocess = (e) => {
    if (!stopped) chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };

  const silentSink = ctx.createMediaStreamDestination();
  source.connect(processor);
  processor.connect(silentSink);

  const stop = async () => {
    if (stopped) return null;
    stopped = true;
    try { processor.disconnect(); } catch (e) { /* ignore */ }
    try { source.disconnect(); } catch (e) { /* ignore */ }
    stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* ignore */ } });
    const rate = ctx.sampleRate || TARGET_RATE;
    try { await ctx.close(); } catch (e) { /* ignore */ }
    const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    chunks.forEach((c) => { all.set(c, o); o += c.length; });
    const blob = buildWav(all, rate);
    const base64 = await blobToBase64(blob);
    return { blob, base64 };
  };

  return {
    get active() { return !stopped; },
    stop,
  };
}