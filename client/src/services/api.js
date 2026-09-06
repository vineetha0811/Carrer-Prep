const BASE = import.meta.env.VITE_API_URL || '/api';

let token = localStorage.getItem('cr_token') || '';

export function setToken(t) {
  token = t || '';
  if (t) localStorage.setItem('cr_token', t);
  else localStorage.removeItem('cr_token');
}

export function getToken() {
  return token;
}

export function isLoggedIn() {
  return Boolean(token);
}

export async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('cr:unauthorized'));
  }

  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function upload(basePath, files, fields = {}) {
  const fd = new FormData();
  if (Array.isArray(files)) files.forEach((f) => fd.append('files', f));
  else fd.append(files.field || 'photo', files.file || files);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${BASE}${basePath}`, { method: 'POST', headers, body: fd }).then(async (res) => {
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    return data;
  });
}