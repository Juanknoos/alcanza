/* ===== INTERFAZ ===== */
let S, tab = 'pagos', pv = 'pend', sim = null;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ic = (n, c = '') => `<span class="material-symbols-outlined ${c}">${n}</span>`;
const save = () => DataService.save(S);
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 2400); };
const TABS = [['pagos','Pagos','check_circle'],['gastos','Gastos','donut_large'],['metas','Metas','flag'],['proyeccion','Proyección','trending_up'],['libreta','Libreta','sticky_note_2'],['ajustes','Ajustes','tune']];

let gp = 'mes', goff = 0, qa = null, openRow = null, collapsed = {};
const isCol = (k, n) => k in collapsed ? collapsed[k] : (k === 'paid' || (k === 'later' && n > 3));
const ICONS = [['label','Etiqueta'],['restaurant','Comida'],['shopping_cart','Compras'],['directions_bus','Transporte'],['home','Hogar'],['favorite','Salud'],['sports_esports','Ocio'],['checkroom','Ropa'],['school','Estudio'],['pets','Mascotas'],['local_gas_station','Gasolina'],['redeem','Regalos'],['more_horiz','Otros']];
const catInfo = id => id === 'pagos' ? { name: 'Pagos', icon: 'receipt_long', color: '#0f7b5f' } : id === 'ingreso' ? { name: 'Ingreso', icon: 'payments', color: '#2f9e44' } : S.categories.find(c => c.id === id) || { name: 'Otros', icon: 'more_horiz', color: '#868e96' };
function evalExpr(t) { t = String(t).replace(/[+\-*/.]+$/, '').replace(/(^|[+\-*/])0+(?=\d)/g, '$1'); if (!t || !/^[\d+\-*/.]+$/.test(t)) return NaN;
  try { const v = Function('"use strict";return (' + t + ')')(); return isFinite(v) ? v : NaN; } catch { return NaN; } }
function gRange() { const t = today(); let a, b, label;
  if (gp === 'dia') { a = b = add(t, goff); label = goff === 0 ? 'Hoy' : goff === -1 ? 'Ayer' : dlabel(iso(a)); }
  else if (gp === 'semana') { a = add(t, -((t.getDay() + 6) % 7) + 7 * goff); b = add(a, 6); label = `${dshort(iso(a))} – ${dshort(iso(b))}`; }
  else { a = new Date(t.getFullYear(), t.getMonth() + goff, 1); b = new Date(t.getFullYear(), t.getMonth() + goff + 1, 0); label = cap(MONTHS[a.getMonth()]) + ' ' + a.getFullYear(); }
  return [iso(a), iso(b), label]; }
function gItems(from, to) { const inr = d => d >= from && d <= to;
  const tx = S.transactions.filter(x => inr(x.date)).map(x => ({ kind: 'tx', id: x.id, date: x.date, type: x.type, amount: x.amount, cat: x.cat, note: x.note }));
  const pays = S.payments.filter(p => p.status === 'paid' && p.paidAt && inr(p.paidAt)).map(p => ({ kind: 'pay', id: p.id, date: p.paidAt, type: 'expense', amount: p.amount, cat: 'pagos', note: p.name }));
  return tx.concat(pays).sort((a, b) => b.date.localeCompare(a.date)); }
const rowTx = i => { const c = catInfo(i.cat), inc = i.type === 'income';
  return `<div class="mvr"><div class="ci" style="background:${c.color}">${ic(c.icon)}</div><div style="flex:1;min-width:0"><b>${esc(i.note || c.name)}</b><div class="sub">${esc(c.name)}${i.kind === 'pay' ? ' · pago' : ''}</div></div>
  <b class="${inc ? 'pos' : 'neg'}">${inc ? '+' : '-'}${money(i.amount)}</b>${i.kind === 'tx' ? `<button class="soft" data-act="deltx" data-id="${i.id}" aria-label="Eliminar">${ic('delete')}</button>` : ''}</div>`; };
const VIEWS = {
  pagos() {
    const seg = `<div class="seg2 s1">${[['pend', 'Pendientes'], ['fijos', 'Fijos']].map(([k, t]) => `<button class="${k === pv ? 'on' : ''}" data-act="pvset" data-v="${k}">${t}</button>`).join('')}</div>`;
    if (pv === 'fijos') return seg + VIEWS.fijos();
    const pend = pending(), ni = S.income.amount > 0 ? nextIncome() : null, due = ni ? pend.filter(p => p.due < iso(ni)) : pend, avail = S.balance - sum(due);
    const paid = S.payments.filter(p => p.status === 'paid' && p.month === ym(today())).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    const g = { late: [], week: [], later: [] }; pend.forEach(p => { const n = daysTo(p.due); (n < 0 ? g.late : n <= 7 ? g.week : g.later).push(p); });
    const rw = p => { const [c, , t] = chip(p.due), late = c === 'late';
      return `<div class="li2"><div class="lr" data-act="rowtog" data-id="${p.id}"><div class="ico ${late ? 'err' : ''}">${ic(iconFor(p.name))}</div>
        <div class="mid"><b class="n">${esc(p.name)}${p.templateId ? ' <span title="Pago fijo">' + ic('autorenew') + '</span>' : ''}</b><div class="sub"><span class="${tone(p.due)}">${late ? 'hace ' + (-daysTo(p.due)) + ' d' : t}</span> · ${dshort(p.due)}</div></div>
        <b class="amt">${money(p.amount)}</b><button class="chk" data-act="pay" data-id="${p.id}" aria-label="Marcar ${esc(p.name)} como pagado">${ic('check')}</button></div>
        ${openRow === p.id ? `<div class="rx">${p.templateId ? '<span class="sub">Pago fijo: edítalo o páusalo en la pestaña Fijos.</span>' : `<button class="soft" data-act="delpay" data-id="${p.id}">${ic('delete')} Eliminar</button>`}</div>` : ''}</div>`; };
    const sec = (k, title, list, row) => { if (!list.length) return ''; const col = isCol(k, list.length);
      return `<button class="gh" data-act="coltog" data-k="${k}" data-n="${list.length}" aria-expanded="${!col}"><b>${title}</b><span class="sub">${list.length} · ${money(sum(list))}</span>${ic(col ? 'expand_more' : 'expand_less')}</button>${col ? '' : `<div class="card lst">${list.map(row).join('')}</div>`}`; };
    const prow = p => `<div class="li2"><div class="lr"><div class="ico ok">${ic('check_circle')}</div><div class="mid"><b class="n paid-n">${esc(p.name)}</b><div class="sub">Pagado el ${dshort(p.paidAt)}${p.templateId ? ' · fijo' : ''}</div></div><b class="amt">${money(p.amount)}</b>
      <button class="chk" data-act="undo" data-id="${p.id}" aria-label="Deshacer pago de ${esc(p.name)}">${ic('undo')}</button></div></div>`;
    const gm = (() => { const g = S.goals.map(x => [x, goalInfo(x)]).filter(([, i]) => i.state !== 'done').sort((a, b) => a[0].deadline.localeCompare(b[0].deadline))[0]; if (!g) return ''; const [x, i] = g;
      return `<div class="card gm"><div class="top"><b>${esc(x.name)}</b><span class="sub">${Math.round(i.pct)}% · ${money(i.saved)} de ${money(x.target)}</span></div><div class="gbar"><i style="width:${i.pct}%"></i><u style="left:${i.idealPct}%"></u></div>
        <div class="top" style="margin-top:10px"><span class="sub">Cuota de la semana: <b>${money(i.quota)}</b></span><button class="go" style="padding:8px 16px" data-act="gap" data-id="${x.id}">${ic('savings')}Apartar</button></div></div>`; })();
    return seg + `<div class="hero"><div class="top"><p>Disponible hasta tu próximo cobro</p><span class="pill ${avail < 0 ? 'bad' : ''}">${avail < 0 ? 'Déficit' : 'Al día'}</span></div>
      <div class="big ${avail < 0 ? 'neg' : ''}">${money(avail)}</div><p>Saldo <b>${money(S.balance)}</b>, menos <b class="warn">${money(sum(due))}</b> por pagar${ni ? ' antes del ' + dlabel(iso(ni)).toLowerCase() : ''}</p>
      ${S.income.amount > 0 ? `<button class="btn-w" data-act="income">${ic('add_circle')}Recibí mi ingreso (${money(S.income.amount)})</button>` : `<button class="btn-w" data-go="ajustes">${ic('tune')}Configura tu ingreso semanal</button>`}</div>
      ${gm}
      ${pend.length ? sec('late', '⚠️ Vencidos', g.late, rw) + sec('week', 'Próximos 7 días', g.week, rw) + sec('later', 'Más adelante', g.later, rw) : '<div class="card dim sub" style="margin-top:16px">No tienes pagos pendientes. ¡Todo al día!</div>'}
      ${paid.length ? sec('paid', 'Pagados este mes', paid, prow) : ''}`;
  },
  proyeccion() {
    let bal = S.balance, min = bal, negMsg = ''; const t = today(), ev = {}, pend = pending();
    const push = (d, x) => (ev[d] = ev[d] || []).push(x);
    pend.forEach(p => push(p.due < iso(t) ? iso(t) : p.due, { t: p.name, v: -p.amount, k: p.templateId ? 'Gasto fijo' : 'Pago único' }));
    const horizon = Math.min(70, Math.max(35, ...pend.map(p => daysTo(p.due))));
    if (S.income.amount > 0) for (let i = 1; i <= horizon; i++) { const d = add(t, i); if (d.getDay() === S.income.weekday) push(iso(d), { t: 'Ingreso semanal', v: S.income.amount, inc: true }); }
    if (sim) push(sim.date, { t: 'Pago simulado', v: -sim.amount, sim: true });
    const cards = Object.keys(ev).sort().map(d => { const before = bal; ev[d].forEach(x => bal += x.v); min = Math.min(min, bal);
      const neg = bal < 0, hasInc = ev[d].some(x => x.inc), hasSim = ev[d].some(x => x.sim);
      if (neg && !negMsg) { const c = ev[d].filter(x => x.v < 0).pop(); negMsg = `El <b>${dlabel(d)}</b> tras pagar <b>${esc(c ? c.t : 'un pago')}</b>, el saldo proyectado bajaría a <b>${money(bal)}</b>${sim && hasSim ? ' con la simulación' : ''}.`; }
      return `<div class="card ${neg ? 'neg' : hasInc ? 'in' : ''}"><div class="hd"><div><span class="l">${dlabel(d)}</span>${hasInc ? '<span class="badge">Día de cobro</span>' : ''}${hasSim ? '<span class="badge s">Simulación</span>' : ''}</div>
        <div class="res"><small>Saldo resultante</small><b class="${neg ? 'neg' : hasInc ? 'pos' : ''}">${money(bal)}</b></div></div>
        ${ev[d].map(x => `<div class="mv ${x.inc ? 'in' : x.sim ? 'sim' : ''}">${ic(x.inc ? 'add_circle' : 'remove_circle')}<span>${esc(x.t)}${x.k ? `<small class="sub"> · ${x.k}</small>` : ''}</span><span class="v">${x.v > 0 ? '+' : '-'}${money(Math.abs(x.v))}</span></div>`).join('')}</div>`; }).join('');
    return `<div class="hero"><div class="top"><p class="eyebrow" style="color:#c9d6d0">Proyección de liquidez</p><span class="pill ${min < 0 ? 'bad' : ''}">${min < 0 ? 'Déficit proyectado' : 'Flujo al día'}</span></div>
      <p style="margin-top:14px">Saldo disponible hoy</p><div class="big">${money(S.balance)}</div></div>
      ${negMsg ? `<div class="alert"><div class="ico">${ic('warning')}</div><div><b>Alerta de saldo proyectado</b><p>${negMsg}</p></div></div>` : ''}
      <div class="top" style="margin:22px 4px 10px"><div><h3 style="margin:0">Línea de tiempo</h3><span class="sub">Saldo tras cada movimiento</span></div>${sim ? '<button class="soft" data-act="hidesim">Ocultar simulación</button>' : ''}</div>
      <div class="tl">${cards || '<div class="card dim sub">No hay movimientos por proyectar.</div>'}</div>
      <form class="sim-box" data-form="sim"><b>${ic('tune')} Simular nuevo gasto</b><div class="f"><input name="amount" type="number" min="1" step="any" inputmode="decimal" placeholder="Ej: 150000" required><input name="date" type="date" value="${iso(add(t, 1))}" required></div>
      <button class="go" style="margin-top:10px;width:100%;justify-content:center">${ic('add')}Proyectar</button></form>`;
  },
  gastos() {
    const [from, to, label] = gRange(), items = gItems(from, to), exp = items.filter(i => i.type === 'expense'), inc = items.filter(i => i.type === 'income'), total = sum(exp);
    const by = {}; exp.forEach(i => by[i.cat] = (by[i.cat] || 0) + i.amount);
    const parts = Object.entries(by).sort((a, b) => b[1] - a[1]); let acc = 0;
    const segs = parts.map(([c, v]) => { const p = v / total * 100, x = `<circle cx="18" cy="18" r="15.9155" fill="none" stroke="${catInfo(c).color}" stroke-width="5" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${25 - acc}"/>`; acc += p; return x; }).join('');
    const dayTot = {}; exp.forEach(i => dayTot[i.date] = (dayTot[i.date] || 0) + i.amount);
    let last = ''; const list = items.map(i => { let h = ''; if (i.date !== last) { last = i.date; h = `<div class="top" style="margin:16px 4px 8px"><b>${dlabel(i.date)}</b><span class="sub">${dayTot[i.date] ? '-' + money(dayTot[i.date]) : ''}</span></div>`; } return h + rowTx(i); }).join('');
    return `<div class="seg2">${[['dia','Día'],['semana','Semana'],['mes','Mes']].map(([k, t]) => `<button class="${k === gp ? 'on' : ''}" data-act="gper" data-p="${k}">${t}</button>`).join('')}</div>
      <div class="top" style="margin:12px 4px"><button class="soft" data-act="gnav" data-n="-1" aria-label="Anterior">${ic('chevron_left')}</button><b>${label}</b><button class="soft" data-act="gnav" data-n="1" ${goff >= 0 ? 'disabled style="opacity:.35"' : ''} aria-label="Siguiente">${ic('chevron_right')}</button></div>
      <div class="card"><div class="dwrap"><svg viewBox="-1 -1 38 38" class="donut" role="img" aria-label="Gastos por categoría"><circle cx="18" cy="18" r="15.9155" fill="none" stroke="#ebefed" stroke-width="5"/>${segs}</svg><div class="dc"><small>Gastos</small><b>${money(total)}</b></div></div>
      ${parts.map(([c, v]) => { const k = catInfo(c); return `<div class="lg"><span class="ci sm" style="background:${k.color}">${ic(k.icon)}</span><span style="flex:1">${esc(k.name)}</span><span class="sub">${Math.round(v / total * 100)}%</span><b>${money(v)}</b></div>`; }).join('') || '<p class="sub" style="text-align:center;margin:8px 0">Sin gastos en este período.</p>'}</div>
      <div class="grid2"><div class="card"><span class="sub">Ingresos</span><b class="pos" style="display:block;font-size:1.3rem">${money(sum(inc))}</b></div><div class="card"><span class="sub">Gastos</span><b class="neg" style="display:block;font-size:1.3rem">${money(total)}</b></div></div>
      ${list || '<div class="card dim sub">Aún no hay movimientos en este período.</div>'}`;
  },
  libreta() { return `<h1>Libreta</h1>` + libretaHTML(); },
  metas() {
    const lab = { done: ['¡Meta lograda!', 'ok'], ahead: ['Vas adelantado', 'ok'], ok: ['Vas al día', 'ok'], behind: ['Vas atrasado', 'warn'], late: ['Fecha vencida', 'bad'] };
    const cards = S.goals.map(g => { const i = goalInfo(g), [t, k] = lab[i.state];
      return `<div class="card"><div class="top"><div><b style="font-size:1.15rem">${esc(g.name)}</b><div class="sub">${dlabel(g.deadline)} · ${i.days >= 0 ? 'faltan ' + i.days + ' días' : 'venció hace ' + (-i.days) + ' días'}</div></div><span class="gb ${k}">${t}</span></div>
        <div class="gnum"><b>${money(i.saved)}</b><span class="sub"> de ${money(g.target)} · ${Math.round(i.pct)}%</span></div>
        <div class="gbar" role="img" aria-label="Llevas ${Math.round(i.pct)}% de la meta"><i style="width:${i.pct}%"></i>${i.state !== 'done' ? `<u style="left:${i.idealPct}%" title="Dónde deberías ir hoy"></u>` : ''}</div>
        ${i.state === 'done' ? '<p class="sub">🎉 ¡Lo lograste! Puedes retirar el dinero o crear otra meta.</p>' : `<p class="sub" style="margin:10px 0 0">Te faltan <b>${money(i.left)}</b>. Cuota sugerida: <b class="pos">${money(i.quota)}</b> por semana (${i.weeks} ${i.weeks === 1 ? 'semana' : 'semanas'}).${i.diff < -1 ? ` Vas ${money(-i.diff)} por debajo del ritmo ideal.` : i.diff > 1 ? ` Vas ${money(i.diff)} por encima del ritmo ideal.` : ''}</p>`}
        <div class="acts2"><button class="go" data-act="gap" data-id="${g.id}">${ic('savings')}Apartar</button><button class="soft" data-act="gret" data-id="${g.id}">Retirar</button><button class="soft" data-act="gdel" data-id="${g.id}" aria-label="Eliminar meta">${ic('delete')}</button></div>
        ${g.contribs.length ? `<details class="gh2"><summary>Movimientos (${g.contribs.length})</summary>${g.contribs.slice().reverse().slice(0, 10).map(c => `<div class="mv"><span>${c.type === 'in' ? 'Apartado' : 'Retirado'} · ${dshort(c.date)}</span><span class="v ${c.type === 'in' ? 'pos' : 'neg'}">${c.type === 'in' ? '+' : '-'}${money(c.amount)}</span></div>`).join('')}</details>` : ''}</div>`; }).join('');
    return `<h1>Metas de ahorro</h1><p class="sub" style="margin:-6px 4px 12px">El dinero que apartas sale de tu saldo.</p>${cards || '<div class="card dim sub">Aún no tienes metas. Crea la primera: por ejemplo, "Ahorro diciembre" con $2.000.000.</div>'}
      <button class="big-btn" style="margin-top:6px" data-act="gnew">${ic('add')}Nueva meta</button>`;
  },
  fijos() {
    const act = S.templates.filter(x => x.active), total = sum(act), mi = S.income.amount * 52 / 12, pct = mi > 0 ? Math.min(100, total / mi * 100) : 0;
    return `<div class="card"><span class="sub">${ic('lock_clock')} Total mensual comprometido</span><div class="top"><div style="font-size:2rem;font-weight:700">${money(total)}<small class="sub"> al mes</small></div><span class="badge">${act.length} activos · ${S.templates.length - act.length} pausados</span></div>
      ${mi > 0 ? `<div class="bar" role="img" aria-label="${Math.round(pct)}% de tu ingreso mensual estimado"><i style="width:${pct}%"></i></div><div class="sub" style="margin-top:6px">${Math.round(pct)}% de tu ingreso mensual estimado</div>` : ''}</div>
      <div class="top" style="margin:20px 4px 10px"><b>Tus suscripciones y servicios</b><span class="sub">${S.templates.length} registros</span></div>
      ${S.templates.map(x => `<div class="card fx" style="${x.active ? '' : 'opacity:.75'}"><div class="ico">${ic(iconFor(x.name))}</div><div><b class="n" style="font-size:1.1rem">${esc(x.name)}</b><span class="badge ${x.active ? '' : 'pause'}">${x.active ? 'Activo' : 'En pausa'}</span><div class="sub">${ic('event_repeat')} Día ${x.day} de cada mes</div></div><div class="amt">${money(x.amount)}<div class="sub">mensual</div></div>
      <div class="acts">${x.active ? `<button data-act="tamount" data-id="${x.id}">${ic('edit')}Cambiar monto</button><button data-act="ttoggle" data-id="${x.id}">${ic('pause_circle')}Pausar</button>` : `<button style="color:var(--p)" data-act="ttoggle" data-id="${x.id}">${ic('play_circle')}Reanudar</button>`}<button class="x" data-act="tdel" data-id="${x.id}">${ic('delete')}Eliminar</button></div></div>`).join('') || '<div class="card dim sub">Aún no tienes pagos fijos. Añade el primero.</div>'}
      <button class="big-btn" style="margin:14px 0" data-act="addf">${ic('add')}Añadir fijo</button>`;
  },
  ajustes() {
    const order = [[1,'L'],[2,'M'],[3,'M'],[4,'J'],[5,'V'],[6,'S'],[0,'D']];
    return `<div class="sec">${ic('payments')}Ingreso semanal <em>Activo</em></div><form class="card" data-form="income">
      <div class="lbl">Monto regular esperado</div><div class="field">$<input name="amount" type="number" min="0" step="any" inputmode="decimal" value="${S.income.amount || ''}" placeholder="0" aria-label="Monto de ingreso"></div>
      <div class="top"><span class="lbl">Día habitual de cobro</span><b class="sub" style="color:var(--p)">${cap(DAYS[S.income.weekday])}</b></div>
      <div class="seg" style="margin:10px 0 18px">${order.map(([i, l]) => `<button type="button" class="${i === S.income.weekday ? 'on' : ''}" data-act="wd" data-i="${i}" aria-label="${DAYS[i]}">${l}</button>`).join('')}</div>
      <button class="big-btn">${ic('save')}Guardar cambios</button></form>
      <div class="sec">${ic('account_balance_wallet')}Saldo real actual</div><form class="card" data-form="balance"><div class="lbl">Tu saldo en cuenta ahora mismo</div><div class="field">$<input name="b" type="number" step="any" inputmode="decimal" value="${S.balance}" aria-label="Saldo real"></div>
      <p class="sub" style="margin:0 0 12px">Actualízalo cuando no coincida con tu dinero real.</p><button class="big-btn dark">${ic('sync')}Actualizar saldo</button></form>
      ${catSection()}${syncSection()}<div class="sec">${ic('shield')}Copia de seguridad y privacidad</div><div class="card"><p class="sub" style="margin:0">Tus datos viven solo en este dispositivo. Puedes exportarlos o restaurarlos cuando quieras.</p>
      <button class="li" data-act="export"><span class="ico">${ic('download')}</span><div><b>Exportar datos</b><small>Descarga JSON local</small></div>${ic('chevron_right')}</button>
      <label class="li" style="cursor:pointer"><span class="ico">${ic('upload')}</span><div><b>Importar respaldo</b><small>Restaurar historial previo</small></div>${ic('chevron_right')}<input type="file" id="imp" accept=".json" hidden></label>
      <button class="li danger" data-act="reset"><span class="ico">${ic('delete_forever')}</span><div><b>Borrar todos los datos</b><small style="color:var(--err)">Reiniciar base local de Alcanza</small></div>${ic('warning')}</button></div>
      <p class="sub" style="text-align:center;margin-top:22px">Alcanza v1.0</p>`;
  }
};
const NOTE_KINDS = { me: ['Me deben', 'arrow_downward', '#2f9e44'], yo: ['Debo', 'arrow_upward', '#e03131'], nota: ['Nota', 'sticky_note_2', '#868e96'] };
function libretaHTML() {
  const open = S.notes.filter(n => !n.done), fin = S.notes.filter(n => n.done);
  const me = sum(open.filter(n => n.kind === 'me' && n.amount > 0)), yo = sum(open.filter(n => n.kind === 'yo' && n.amount > 0));
  const row = n => { const k = NOTE_KINDS[n.kind];
    return `<div class="nrow ${n.done ? 'fin' : ''}"><div class="ci sm" style="background:${k[2]}">${ic(k[1])}</div><div class="mid"><b class="n">${esc(n.who)}</b><div class="sub">${esc(n.note || k[0])}</div></div>${n.amount > 0 ? `<b class="amt">${money(n.amount)}</b>` : ''}
      ${n.done ? '' : `<button class="chk sm" data-act="ndone" data-id="${n.id}" aria-label="Marcar como hecho">${ic('check')}</button>`}<button class="chk sm" data-act="ndel" data-id="${n.id}" aria-label="Eliminar">${ic('close')}</button></div>`; };
  return `${me || yo ? `<div class="grid2" style="margin-bottom:12px"><div class="card" style="margin:0"><span class="sub">Me deben</span><b class="pos" style="display:block;font-size:1.15rem">${money(me)}</b></div><div class="card" style="margin:0"><span class="sub">Debo</span><b class="neg" style="display:block;font-size:1.15rem">${money(yo)}</b></div></div>` : ''}
    <form class="nform" data-form="note"><select name="kind" aria-label="Tipo">${Object.entries(NOTE_KINDS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select><input name="who" placeholder="¿Quién o qué?" required maxlength="40">
      <div style="display:flex;gap:8px"><input name="amount" type="number" min="0" step="any" inputmode="decimal" placeholder="Monto (opcional)"><input name="note" placeholder="Nota" maxlength="60"></div><button class="go" style="justify-content:center">${ic('add')}Anotar</button></form>
    <div>${open.map(row).join('') || '<p class="sub">Anota aquí quién te debe, lo que debes u otras cosas.</p>'}</div>
    ${fin.length ? `<details class="gh2"><summary>Hechas (${fin.length})</summary>${fin.map(row).join('')}</details>` : ''}`;
}
function catSection() {
  return `<div class="sec">${ic('category')}Categorías de gasto</div><div class="card">${S.categories.map(c => `<div class="mvr" style="background:var(--low)"><div class="ci" style="background:${c.color}">${ic(c.icon)}</div><b style="flex:1">${esc(c.name)}</b>
    <button class="soft" data-act="catren" data-id="${c.id}" aria-label="Renombrar">${ic('edit')}</button><button class="soft" data-act="catdel" data-id="${c.id}" aria-label="Eliminar">${ic('delete')}</button></div>`).join('')}
    <form data-form="newcat"><div class="lbl" style="margin-top:14px">Nueva categoría</div><div class="field sm"><input name="name" placeholder="Ej: Mascotas" required maxlength="20" aria-label="Nombre"></div>
    <div style="display:flex;gap:10px;align-items:center"><select name="icon" aria-label="Icono">${ICONS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select><input type="color" name="color" value="#1c7ed6" aria-label="Color" style="width:56px;height:46px;border:0;padding:0;background:none"></div>
    <button class="big-btn" style="margin-top:12px">${ic('add')}Agregar categoría</button></form></div>`;
}
function syncSection() {
  const c = SyncConfig.get(), hora = c && c.lastSync ? new Date(c.lastSync).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
  return `<div class="sec">${ic('cloud_sync')}Sincronización <em>${c ? 'Conectado' : 'Sin conectar'}</em></div><form class="card" data-form="sync">
    <div class="note">${ic('cloud')}Guarda tus datos en tu propia hoja de Google para ver lo mismo en el PC y en el celular.</div>
    <div class="lbl">URL de la aplicación web</div><div class="field sm"><input name="url" value="${esc(c ? c.url : '')}" placeholder="https://script.google.com/macros/s/…/exec" required aria-label="URL" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    <div class="lbl">Clave <span class="sub">(idéntica a la de Code.gs, con mayúsculas)</span></div><div class="field sm"><input name="token" type="text" value="${esc(c ? c.token : '')}" required aria-label="Clave" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    ${c ? `<p class="sub" style="margin:0 0 12px">${c.lastError ? '⚠️ ' + esc(c.lastError) : hora ? 'Última sincronización: ' + hora : 'Sincronizando…'}</p>` : ''}
    <button class="big-btn">${ic('sync')}${c ? 'Guardar y sincronizar' : 'Conectar y sincronizar'}</button>
    ${c ? `<button type="button" class="li danger" data-act="syncoff"><span class="ico">${ic('cloud_off')}</span><div><b>Desconectar</b><small style="color:var(--err)">Tus datos locales se conservan</small></div></button>` : ''}</form>`;
}
async function connect(url, token) {
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) return toast('La URL debe terminar en /exec');
  SyncConfig.set({ url, token }); toast('Conectando…');
  try {
    const r = await GoogleSheetsService.pull(), hasLocal = S.payments.length || S.templates.length || S.balance || S.income.amount;
    if (r && (r.payments || r.updatedAt) && (!hasLocal || confirm('Ya hay datos en tu hoja de Google.\n\nAceptar: usar los de la hoja (reemplaza los de este dispositivo).\nCancelar: reemplazar la hoja con los de este dispositivo.'))) S = { ...DEFAULT_STATE(), ...r };
    ensureMonths(S); await done('Sincronización conectada');
  } catch (e) { SyncConfig.clear(); toast('No se pudo conectar: ' + e.message); render(); }
}
function render() {
  const wide = matchMedia('(min-width:1100px)').matches; if (wide && tab === 'libreta') tab = 'pagos';
  const t = TABS.find(x => x[0] === tab);
  $('#sect').textContent = t[1];
  $('#tabs').innerHTML = TABS.filter(x => !(wide && x[0] === 'libreta')).map(x => `<button data-go="${x[0]}" class="${x[0] === tab ? 'on' : ''}">${ic(x[2])}${x[1]}</button>`).join('');
  $('#fab').style.display = (tab === 'pagos' && pv === 'pend') || tab === 'gastos' ? 'flex' : 'none';
  $('#libreta').innerHTML = wide ? '<h2>Libreta</h2>' + libretaHTML() : '';
  $('#view').innerHTML = VIEWS[tab]();
}
function openAdd(mode, fijo) {
  const pago = mode === 'pago', inc = mode === 'ingreso';
  if (!pago) qa = { type: inc ? 'income' : 'expense', expr: '', cat: (S.categories[0] || {}).id || 'otros' };
  const seg = fijo ? '' : `<div class="seg2" style="margin:0 0 12px">${[['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['pago', 'Pago por vencer']].map(([m, t]) => `<button type="button" class="${m === mode ? 'on' : ''}" data-act="addm" data-m="${m}">${t}</button>`).join('')}</div>`;
  const body = pago ? `<p class="sub" style="margin:0 0 10px">${fijo ? 'Se creará solo cada mes.' : 'Para algo que aún no pagas y vence en una fecha.'}</p>
    <form data-form="newpay"><label>Nombre<input name="name" required maxlength="40" autofocus></label><label>Monto<input name="amount" type="number" min="1" step="any" inputmode="decimal" required></label>
    <label>${fijo ? 'Primer vencimiento' : 'Fecha de vencimiento'}<input name="due" type="date" value="${iso(today())}" required></label>
    ${fijo ? '<input type="hidden" name="repeat" value="on">' : '<label class="chk"><input type="checkbox" name="repeat"> Se repite cada mes (pago fijo)</label>'}<button class="big-btn">${ic('check')}Guardar</button></form>`
  : `<div class="qd" id="qdisp">0</div><div class="qs" id="qres"></div>
    ${inc ? '' : `<div class="cg" style="margin-top:10px">${S.categories.map(c => `<button type="button" class="qc ${c.id === qa.cat ? 'on' : ''}" data-act="qcat" data-id="${c.id}"><span class="ci" style="background:${c.color}">${ic(c.icon)}</span>${esc(c.name)}</button>`).join('')}</div>`}
    <div class="kp">${['7','8','9','/','4','5','6','*','1','2','3','-','.','0','bk','+'].map(k => `<button type="button" class="${'+-*/'.includes(k) ? 'op' : ''}" data-act="key" data-k="${k}" aria-label="${k === 'bk' ? 'Borrar' : k}">${k === 'bk' ? ic('backspace') : k === '/' ? '÷' : k === '*' ? '×' : k === '-' ? '−' : k === '.' ? ',' : k}</button>`).join('')}</div>
    <div style="display:flex;gap:10px"><input id="qnote" placeholder="Nota (opcional)" maxlength="40" style="flex:1"><input id="qdate" type="date" value="${iso(today())}" style="width:auto"></div>
    <button class="big-btn" style="margin-top:12px" data-act="qsave">${ic('check')}Guardar</button>`;
  $('#sheet').innerHTML = `<div class="panel" role="dialog" aria-label="Registrar"><div class="top" style="margin-bottom:10px"><h2>${fijo ? 'Añadir pago fijo' : 'Registrar'}</h2><button class="soft" data-act="close" aria-label="Cerrar">${ic('close')}</button></div>${seg}${body}</div>`;
  $('#sheet').classList.add('open'); if (!pago) updQA();
}
function updQA() { const e = qa.expr, v = evalExpr(e);
  $('#qdisp').textContent = e.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−') || '0'; $('#qres').textContent = e && isFinite(v) ? '= ' + money(v) : ''; }
function openGoalSheet() { const dec = `${today().getFullYear()}-12-31`, tomorrow = iso(add(today(), 1));
  $('#sheet').innerHTML = `<div class="panel" role="dialog" aria-label="Nueva meta"><div class="top" style="margin-bottom:12px"><h2>Nueva meta</h2><button class="soft" data-act="close" aria-label="Cerrar">${ic('close')}</button></div>
    <form data-form="newgoal"><label>Nombre<input name="name" required maxlength="40" placeholder="Ahorro diciembre"></label><label>Monto que quieres lograr<input name="target" type="number" min="1" step="any" inputmode="decimal" required placeholder="2000000"></label>
    <label>Fecha límite<input name="deadline" type="date" value="${dec >= tomorrow ? dec : iso(add(today(), 90))}" min="${tomorrow}" required></label>
    <label>Ya llevo ahorrado (opcional; no se descuenta del saldo)<input name="start" type="number" min="0" step="any" inputmode="decimal" placeholder="0"></label><button class="big-btn">${ic('flag')}Crear meta</button></form></div>`;
  $('#sheet').classList.add('open'); }
function openContrib(id, mode) { const g = S.goals.find(x => x.id === id), i = goalInfo(g), inn = mode === 'in', def = inn ? Math.max(0, Math.min(Math.ceil(i.quota), Math.floor(S.balance))) : '';
  $('#sheet').innerHTML = `<div class="panel" role="dialog" aria-label="${inn ? 'Apartar' : 'Retirar'}"><div class="top" style="margin-bottom:6px"><h2>${inn ? 'Apartar a' : 'Retirar de'} ${esc(g.name)}</h2><button class="soft" data-act="close" aria-label="Cerrar">${ic('close')}</button></div>
    <p class="sub">${inn ? `Saldo disponible: ${money(S.balance)}. Cuota sugerida: ${money(i.quota)}.` : `En la meta: ${money(i.saved)}. Al retirar, vuelve a tu saldo.`}</p>
    <form data-form="contrib" data-gid="${id}" data-mode="${mode}"><label>Monto<input name="amount" type="number" min="1" step="any" inputmode="decimal" value="${def || ''}" required autofocus></label><button class="big-btn">${ic('check')}${inn ? 'Apartar' : 'Retirar'}</button></form></div>`;
  $('#sheet').classList.add('open'); }
const closeSheet = () => $('#sheet').classList.remove('open');
const byId = id => S.payments.find(p => p.id === id), tpl = id => S.templates.find(x => x.id === id);
const done = async msg => { await save(); if (msg) toast(msg); render(); };
const actions = {
  pay: d => { const p = byId(d.id); p.status = 'paid'; p.paidAt = iso(today()); S.balance -= p.amount; done('Pago registrado'); },
  undo: d => { const p = byId(d.id); p.status = 'pending'; p.paidAt = null; S.balance += p.amount; done('Pago deshecho'); },
  delpay: d => { if (confirm('¿Eliminar este pago?')) { S.payments = S.payments.filter(p => p.id !== d.id); done(); } },
  income: () => { S.balance += S.income.amount; S.transactions.push({ id: uid(), type: 'income', amount: S.income.amount, cat: 'ingreso', date: iso(today()), note: 'Ingreso semanal' }); done('Ingreso sumado al saldo'); },
  close: closeSheet, hidesim: () => { sim = null; render(); },
  wd: d => { S.income.weekday = +d.i; const f = document.querySelector('[data-form=income] [name=amount]'); S.income.amount = parseFloat(f.value) || S.income.amount; render(); },
  tamount: d => { const x = tpl(d.id), v = parseFloat(prompt('Nuevo monto para ' + x.name, x.amount)); if (!(v > 0)) return; x.amount = v; S.payments.filter(p => p.templateId === x.id && p.status === 'pending').forEach(p => p.amount = v); done('Monto actualizado'); },
  ttoggle: d => { const x = tpl(d.id); x.active = !x.active; if (x.active) ensureMonths(S); done(); },
  tdel: d => { const x = tpl(d.id); if (!confirm(`¿Eliminar "${x.name}" y sus pagos pendientes? Los ya pagados se conservan.`)) return; S.templates = S.templates.filter(t => t !== x); S.payments = S.payments.filter(p => !(p.templateId === x.id && p.status === 'pending')); done(); },
  export: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })); a.download = 'alcanza-' + iso(today()) + '.json'; a.click(); },
  add: () => openAdd(tab === 'gastos' ? 'gasto' : 'pago'), addm: d => openAdd(d.m), addf: () => openAdd('pago', true), pvset: d => { pv = d.v; render(); },
  qcat: d => { qa.cat = d.id; document.querySelectorAll('.qc').forEach(b => b.classList.toggle('on', b.dataset.id === d.id)); },
  key: d => { let e = qa.expr; const k = d.k;
    if (k === 'bk') e = e.slice(0, -1);
    else if ('+-*/'.includes(k)) { if (!e) return; e = /[+\-*/]$/.test(e) ? e.slice(0, -1) + k : e + k; }
    else if (k === '.') { const l = e.split(/[+\-*/]/).pop(); if (l.includes('.')) return; e += l ? '.' : '0.'; }
    else e += k;
    qa.expr = e.slice(0, 40); updQA(); },
  qsave: () => { const v = evalExpr(qa.expr); if (!(v > 0)) return toast('Ingresa un monto');
    const amount = Math.round(v * 100) / 100, inc = qa.type === 'income';
    S.transactions.push({ id: uid(), type: qa.type, amount, cat: inc ? 'ingreso' : qa.cat, date: $('#qdate').value || iso(today()), note: $('#qnote').value.trim() });
    S.balance += inc ? amount : -amount; closeSheet(); done(inc ? 'Ingreso registrado' : 'Gasto registrado'); },
  deltx: d => { const x = S.transactions.find(t => t.id === d.id); if (!confirm('¿Eliminar este movimiento? El saldo se ajustará.')) return;
    S.balance += x.type === 'income' ? -x.amount : x.amount; S.transactions = S.transactions.filter(t => t !== x); done(); },
  gper: d => { gp = d.p; goff = 0; render(); }, gnav: d => { goff = Math.min(0, goff + +d.n); render(); },
  catren: d => { const c = S.categories.find(x => x.id === d.id), n = prompt('Nuevo nombre', c.name); if (n && n.trim()) { c.name = n.trim(); done(); } },
  catdel: d => { const c = S.categories.find(x => x.id === d.id); if (confirm(`¿Eliminar la categoría "${c.name}"? Sus movimientos pasarán a "Otros".`)) { S.categories = S.categories.filter(x => x !== c); done(); } },
  rowtog: d => { openRow = openRow === d.id ? null : d.id; render(); },
  coltog: d => { collapsed[d.k] = !isCol(d.k, +d.n); render(); },
  gnew: () => openGoalSheet(), gap: d => openContrib(d.id, 'in'), gret: d => openContrib(d.id, 'out'),
  gdel: d => { const g = S.goals.find(x => x.id === d.id), net = goalNet(g);
    if (!confirm(`¿Eliminar la meta "${g.name}"?` + (net > 0 ? ` Los ${money(net)} que apartaste volverán a tu saldo.` : ''))) return;
    if (net > 0) S.balance += net; S.goals = S.goals.filter(x => x !== g); done('Meta eliminada'); },
  ndone: d => { const n = S.notes.find(x => x.id === d.id); n.done = true;
    if (n.amount > 0 && n.kind === 'me' && confirm(`¿Sumar ${money(n.amount)} a tu saldo?`)) { S.balance += n.amount; S.transactions.push({ id: uid(), type: 'income', amount: n.amount, cat: 'ingreso', date: iso(today()), note: 'Cobro: ' + n.who }); }
    else if (n.amount > 0 && n.kind === 'yo' && confirm(`¿Descontar ${money(n.amount)} de tu saldo?`)) { S.balance -= n.amount; S.transactions.push({ id: uid(), type: 'expense', amount: n.amount, cat: (S.categories.find(c => c.name === 'Otros') || S.categories[0] || {}).id || 'otros', date: iso(today()), note: 'Pago: ' + n.who }); }
    done('Listo'); },
  ndel: d => { if (confirm('¿Eliminar esta anotación?')) { S.notes = S.notes.filter(x => x.id !== d.id); done(); } },
  syncoff: () => { SyncConfig.clear(); render(); toast('Desconectado'); },
  reset: () => { if (confirm('Se borrará todo' + (SyncConfig.get() ? ', también en tu hoja de Google' : '') + '. ¿Continuar?')) { S = DEFAULT_STATE(); done('Datos borrados'); } }
};
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { location.hash = g.dataset.go; return; }
  const b = e.target.closest('[data-act]'); if (b) actions[b.dataset.act](b.dataset); else if (e.target.id === 'sheet') closeSheet();
});
document.addEventListener('change', async e => { if (e.target.id !== 'imp') return;
  try { S = { ...DEFAULT_STATE(), ...JSON.parse(await e.target.files[0].text()) }; ensureMonths(S); done('Copia importada'); } catch { toast('Archivo no válido'); } });
document.addEventListener('submit', e => {
  e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)), k = e.target.dataset.form;
  if (k === 'newpay') { const amount = parseFloat(v.amount), d = parse(v.due), name = v.name.trim(); closeSheet();
    if (v.repeat) { S.templates.push({ id: uid(), name, amount, day: d.getDate(), startMonth: ym(d), active: true }); ensureMonths(S); }
    else S.payments.push({ id: uid(), templateId: null, name, amount, month: ym(d), due: v.due, status: 'pending', paidAt: null });
    done('Pago agregado'); }
  else if (k === 'income') { S.income.amount = parseFloat(v.amount) || 0; done('Ingreso guardado'); }
  else if (k === 'newcat') { S.categories.push({ id: 'c' + uid(), name: v.name.trim(), icon: v.icon, color: v.color }); done('Categoría agregada'); }
  else if (k === 'newgoal') { S.goals.push({ id: uid(), name: v.name.trim(), target: parseFloat(v.target), deadline: v.deadline, start: iso(today()), startSaved: parseFloat(v.start) || 0, contribs: [] }); closeSheet(); done('Meta creada'); }
  else if (k === 'contrib') { const g = S.goals.find(x => x.id === e.target.dataset.gid), inn = e.target.dataset.mode === 'in', a = parseFloat(v.amount); if (!(a > 0)) return;
    if (inn && a > S.balance) return toast('No tienes saldo suficiente'); if (!inn && a > goalSaved(g)) return toast('La meta no tiene tanto dinero');
    g.contribs.push({ id: uid(), type: inn ? 'in' : 'out', amount: a, date: iso(today()) }); S.balance += inn ? -a : a; closeSheet();
    done(inn && goalSaved(g) >= g.target ? '🎉 ¡Meta lograda!' : inn ? 'Dinero apartado' : 'Dinero retirado'); }
  else if (k === 'note') { S.notes.push({ id: uid(), kind: v.kind, who: v.who.trim(), amount: parseFloat(v.amount) || 0, note: (v.note || '').trim(), date: iso(today()), done: false }); done('Anotado'); }
  else if (k === 'sync') connect(v.url.trim(), v.token.trim());
  else if (k === 'balance') { S.balance = parseFloat(v.b) || 0; done('Saldo actualizado'); }
  else if (k === 'sim') { sim = { amount: parseFloat(v.amount), date: v.date < iso(today()) ? iso(today()) : v.date }; render(); }
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h === 'fijos') { pv = 'fijos'; tab = 'pagos'; } else tab = TABS.some(t => t[0] === h) ? h : 'pagos'; scrollTo(0, 0); render(); });
matchMedia('(min-width:1100px)').addEventListener('change', () => { if (S) render(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
document.addEventListener('visibilitychange', async () => { if (document.hidden || !S) return;
  const r = await DataService.pullIfNewer(S); if (r) S = r;
  const n = S.payments.length; ensureMonths(S); if (S.payments.length !== n) await save(); render(); });
window.onerror = (m, u, l) => { $('#view').innerHTML = `<p style="color:#ba1a1a">Error: ${m} (línea ${l})</p>`; };
(async () => { S = await DataService.load(); const n0 = S.payments.length; ensureMonths(S); if (S.payments.length !== n0) await save();
  DataService.onStatus = () => { if (tab === 'ajustes' && !document.activeElement.matches('input')) render(); }; window.dispatchEvent(new Event('hashchange')); })();
