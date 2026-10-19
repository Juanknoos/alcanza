/* ===== LÓGICA ===== */
const DAYS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const ym = d => iso(d).slice(0, 7);
const daysTo = s => Math.round((parse(s) - today()) / 864e5);
const sum = a => a.reduce((t, p) => t + p.amount, 0);
const uid = () => Math.random().toString(36).slice(2, 9);
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CO');
const dlabel = s => { const d = parse(s); return `${cap(DAYS[d.getDay()])} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}`; };
const dshort = s => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}`; };
const clampDay = (y, m, day) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
function ensureMonths(S) { // crea el pago del mes actual y del siguiente para cada fijo activo
  const t = today();
  for (let off = 0; off < 2; off++) {
    const m = new Date(t.getFullYear(), t.getMonth() + off, 1), key = ym(m);
    S.templates.filter(x => x.active && key >= x.startMonth).forEach(x => {
      if (S.payments.some(p => p.templateId === x.id && p.month === key)) return;
      S.payments.push({ id: uid(), templateId: x.id, name: x.name, amount: x.amount, month: key, due: iso(clampDay(m.getFullYear(), m.getMonth(), x.day)), status: 'pending', paidAt: null });
    });
  }
}
function nextIncome() { for (let i = 1; i <= 7; i++) { const d = add(today(), i); if (d.getDay() === S.income.weekday) return d; } }
const pending = () => S.payments.filter(p => p.status === 'pending').sort((a, b) => a.due.localeCompare(b.due));
const iconFor = n => { n = n.toLowerCase(); const m = [[/internet|wifi|fibra/,'wifi'],[/arriendo|renta|alquiler|hipoteca|casa/,'home'],[/celular|móvil|movil|plan/,'smartphone'],[/multa|impuesto/,'warning'],[/gym|gimnasio/,'fitness_center'],[/luz|energ/,'bolt'],[/agua/,'water_drop'],[/netflix|spotify|stream/,'play_circle'],[/tarjeta|cr[eé]dito|deuda|cuota/,'credit_card']]; return (m.find(x => x[0].test(n)) || [0,'receipt_long'])[1]; };
const tone = s => { const c = chip(s)[0]; return c === 'late' || c === 'soon' ? c : ''; };
function chip(s) { const n = daysTo(s);
  if (n < 0) return ['late','error',`vencido hace ${-n} d`]; if (n <= 1) return ['soon','schedule', n ? 'vence mañana' : 'vence hoy'];
  if (n <= 7) return ['week','event',`vence el ${DAYS[parse(s).getDay()]}`]; return ['far','calendar_month',`en ${n} días`]; }

/* ===== METAS DE AHORRO ===== */
const goalNet = g => g.contribs.reduce((t, c) => t + (c.type === 'in' ? c.amount : -c.amount), 0);
const goalSaved = g => (g.startSaved || 0) + goalNet(g);
function goalInfo(g) { // progreso, cuota semanal sugerida y ritmo ideal (línea recta desde el inicio hasta la fecha límite)
  const saved = goalSaved(g), left = Math.max(0, g.target - saved), days = daysTo(g.deadline), weeks = Math.max(1, Math.ceil(Math.max(days, 0) / 7));
  const total = Math.max(1, Math.round((parse(g.deadline) - parse(g.start)) / 864e5)), el = Math.min(total, Math.max(0, Math.round((today() - parse(g.start)) / 864e5)));
  const base = g.startSaved || 0, ideal = base + (g.target - base) * el / total, diff = saved - ideal, tol = g.target * 0.01;
  const state = saved >= g.target ? 'done' : days < 0 ? 'late' : diff < -tol ? 'behind' : diff > tol ? 'ahead' : 'ok';
  return { saved, left, days, weeks, quota: left / weeks, pct: Math.min(100, saved / g.target * 100), idealPct: Math.min(100, ideal / g.target * 100), diff, state };
}
