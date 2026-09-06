import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { getAsrInfo, transcribeWavBase64 } from '../services/asr.js';

const router = Router();

router.get('/status', authRequired, (req, res) => {
  res.json(getAsrInfo());
});

router.post('/transcribe', authRequired, async (req, res) => {
  try {
    const { audioBase64 } = req.body || {};
    const transcript = await transcribeWavBase64(audioBase64);
    res.json({ ok: true, transcript });
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    const status = /too large/i.test(msg) ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

export default router;