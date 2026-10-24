/* ===== DATOS (capa intercambiable: fase 2 → GoogleSheetsService) ===== */
const DEFAULT_CATS = () => [['Comida','restaurant','#e8590c'],['Mercado','shopping_cart','#2f9e44'],['Transporte','directions_bus','#1c7ed6'],['Salud','favorite','#e03131'],['Hogar','home','#7048e8'],['Ocio','sports_esports','#f08c00'],['Ropa','checkroom','#d6336c'],['Otros','more_horiz','#868e96']].map(([name, icon, color], i) => ({ id: 'c' + (i + 1), name, icon, color }));
const DEFAULT_STATE = () => ({ updatedAt: 0, categories: DEFAULT_CATS(), transactions: [], goals: [], notes: [], reminders: { on: true, time: '09:00', before: true, same: true }, balance: 0, income: { amount: 0, weekday: 5, mode: 'fixed', daily: 0, usual: 6, lastPaid: '' }, worked: {}, templates: [], payments: [] });
const LocalStorageService = {
  KEY: 'finanzas-v1',
  async load() { try { const r = localStorage.getItem(this.KEY); if (r) return { ...DEFAULT_STATE(), ...JSON.parse(r) }; } catch (e) { console.warn(e); } return DEFAULT_STATE(); },
  async save(s) { try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch (e) { console.warn(e); } }
};
/* Sincronización opcional con Google Sheets (ver Code.gs). El dispositivo siempre guarda también en local. */
const SyncConfig = {
  get() { try { return JSON.parse(localStorage.getItem('alcanza-sync')); } catch { return null; } },
  set(c) { try { localStorage.setItem('alcanza-sync', JSON.stringify(c)); } catch {} },
  clear() { try { localStorage.removeItem('alcanza-sync'); } catch {} }
};
const GoogleSheetsService = {
  async call(action, state) {
    const c = SyncConfig.get(); let j;
    const r = await fetch(c.url, { method: 'POST', body: JSON.stringify({ token: c.token, action, state }) }); // texto plano: sin preflight CORS
    try { j = await r.json(); } catch { throw new Error('Respuesta inválida: revisa que el acceso de la implementación sea "Cualquier usuario"'); }
    this.info = j.info || '';
    if (!j.ok) throw new Error(j.error === 'Clave incorrecta' ? 'La clave no coincide con la de Code.gs (revisa mayúsculas, espacios y que no sea la clave de ejemplo)' : (j.error || 'Error desconocido')); return j.state;
  },
  pull() { return this.call('load'); }, push(s) { return this.call('save', s); }, test(tz) { return this.call('test', tz); }
};
const DataService = {
  onStatus: null,
  mark(ok, e) { const c = SyncConfig.get(); if (!c) return; if (ok) { c.lastSync = Date.now(); delete c.lastError; c.info = GoogleSheetsService.info || c.info; } else c.lastError = e.message || String(e); SyncConfig.set(c); this.onStatus && this.onStatus(); },
  queue(s) { if (!SyncConfig.get()) return; clearTimeout(this.t); this.t = setTimeout(async () => { this.t = null; try { await GoogleSheetsService.push(s); this.mark(true); } catch (e) { this.mark(false, e); } }, 700); },
  async load() {
    const local = await LocalStorageService.load(); if (!SyncConfig.get()) return local;
    try { const r = await GoogleSheetsService.pull(); this.mark(true);
      if (r && (r.updatedAt || 0) > (local.updatedAt || 0)) { await LocalStorageService.save(r); return { ...DEFAULT_STATE(), ...r }; }
      if ((local.updatedAt || 0) > ((r && r.updatedAt) || 0)) this.queue(local);
    } catch (e) { this.mark(false, e); } return local;
  },
  async pullIfNewer(s) { if (!SyncConfig.get() || this.t) return null;
    try { const r = await GoogleSheetsService.pull(); this.mark(true);
      if (r && (r.updatedAt || 0) > (s.updatedAt || 0)) { await LocalStorageService.save(r); return { ...DEFAULT_STATE(), ...r }; }
    } catch (e) { this.mark(false, e); } return null; },
  async save(s) { s.updatedAt = Date.now(); s.reminders = { ...(s.reminders || {}), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }; await LocalStorageService.save(s); this.queue(s); }
};
