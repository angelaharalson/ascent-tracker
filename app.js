/* Ascent Tracker — single-file app logic. No build step, no dependencies. */
(() => {
  'use strict';

  // ---------- event configuration ----------
  const EVENT = {
    ascents: 17,
    milesPerAscent: 1.4,
    feetPerAscent: 1750,
    limitHours: 36,
  };

  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;

  const MILESTONES = [
    { peak: 'Kosciuszko',  feet: 7310,  msg: 'Congrats on summiting Kosciuszko!' },
    { peak: 'Vinson',      feet: 16050, msg: 'Congrats on summiting Vinson!' },
    { peak: 'Elbrus',      feet: 18510, msg: 'Congrats on summiting Elbrus!' },
    { peak: 'Kilimanjaro', feet: 19341, msg: 'Congrats on summiting Kilimanjaro!' },
    { peak: 'Denali',      feet: 20310, msg: 'Congrats on summiting Denali!' },
    { peak: 'Aconcagua',   feet: 22841, msg: 'Congrats on summiting Aconcagua!' },
    { peak: 'Everest',     feet: 29029, msg: 'Congrats on summiting Everest!' },
  ];
  // The ascent on which each peak is reached (first ascent whose cumulative gain >= peak height).
  // Everest is always reached on the last ascent.
  for (const m of MILESTONES) {
    m.ascent = m.peak === 'Everest'
      ? EVENT.ascents
      : Math.min(EVENT.ascents, Math.ceil(m.feet / EVENT.feetPerAscent));
  }

  // ---------- goal scenarios ----------
  const GOALS = {
    redhat: {
      id: 'redhat', name: 'Red Hat Goal',
      desc: '1h 30m per ascent, 30 min breaks. Extra 30 min after ascents 4, 6, 12 and 15 for meals and rest.',
      ascentMin: () => 90, breakMin: 30, extras: [4, 6, 12, 15], extraMin: 30,
    },
    main: {
      id: 'main', name: 'Main Goal',
      desc: '1h per ascent, 30 min breaks. Extra 30 min after ascents 6, 9, 12 and 15 for meals and rest.',
      ascentMin: () => 60, breakMin: 30, extras: [6, 9, 12, 15], extraMin: 30,
    },
    stretch: {
      id: 'stretch', name: 'Stretch Goal',
      desc: '50 min for ascents 1–2, +5 min every 2 ascents (55, 60 … 90). 15 min breaks. Extra 30 min after ascents 4, 6, 12 and 15.',
      ascentMin: (n) => 50 + 5 * Math.floor((n - 1) / 2), breakMin: 15, extras: [4, 6, 12, 15], extraMin: 30,
    },
  };

  function goalBreakMin(goal, n) {
    if (n >= EVENT.ascents) return 0;
    return goal.breakMin + (goal.extras.includes(n) ? goal.extraMin : 0);
  }

  /** Planned schedule as offsets (ms) from event start. */
  function goalPlan(goal) {
    const rows = [];
    let t = 0;
    for (let n = 1; n <= EVENT.ascents; n++) {
      const dur = goal.ascentMin(n) * MIN;
      const brk = goalBreakMin(goal, n) * MIN;
      rows.push({ n, start: t, end: t + dur, dur, brk, extra: goal.extras.includes(n) && n < EVENT.ascents });
      t += dur + brk;
    }
    return rows;
  }

  // ---------- state ----------
  const KEY = 'ascent-tracker-v1';

  function defaultEventStart() {
    const d = new Date();
    d.setHours(6, 0, 0, 0);
    return d.getTime();
  }

  function freshState() {
    return {
      eventStart: defaultEventStart(),
      goalId: 'main',
      ascents: Array.from({ length: EVENT.ascents }, () => ({ start: null, end: null })),
      shown: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return sanitize(s);
    } catch { return null; }
  }

  function sanitize(s) {
    const base = freshState();
    if (!s || typeof s !== 'object') return base;
    const out = {
      eventStart: Number.isFinite(s.eventStart) ? s.eventStart : base.eventStart,
      goalId: GOALS[s.goalId] ? s.goalId : 'main',
      ascents: base.ascents.map((_, i) => {
        const a = Array.isArray(s.ascents) && s.ascents[i] ? s.ascents[i] : {};
        return {
          start: Number.isFinite(a.start) ? a.start : null,
          end: Number.isFinite(a.end) ? a.end : null,
        };
      }),
      shown: Array.isArray(s.shown) ? s.shown.filter((x) => typeof x === 'string') : [],
    };
    return out;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save — storage unavailable.'); }
  }

  let state = load() || freshState();

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');

  const fmtTime = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const fmtTimeLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fmtClockOnly = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  function fmtDur(ms) {
    if (ms == null || !Number.isFinite(ms)) return '—';
    const neg = ms < 0;
    ms = Math.abs(ms);
    const totalMin = Math.round(ms / MIN);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const s = h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
    return (neg ? '−' : '') + s;
  }

  function fmtDelta(ms) {
    if (ms == null || !Number.isFinite(ms)) return '—';
    const totalMin = Math.round(ms / MIN);
    if (totalMin === 0) return 'even';
    const sign = totalMin < 0 ? '−' : '+';
    const abs = Math.abs(totalMin);
    const h = Math.floor(abs / 60), m = abs % 60;
    return sign + (h > 0 ? `${h}h ${pad(m)}m` : `${m}m`);
  }

  function deltaClass(ms) {
    if (ms == null) return 'even';
    const m = Math.round(ms / MIN);
    return m < 0 ? 'ahead' : m > 0 ? 'behind' : 'even';
  }

  function fmtStopwatch(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h}:${pad(m)}:${pad(sec)}`;
  }

  function toLocalInput(ms) {
    if (ms == null) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function fromLocalInput(str) {
    if (!str) return null;
    const t = new Date(str).getTime();
    return Number.isFinite(t) ? t : null;
  }

  function toast(msg, ms = 2600) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, ms);
  }

  // ---------- derived data ----------
  function derive(now) {
    const goal = GOALS[state.goalId];
    const plan = goalPlan(goal);
    const a = state.ascents;

    const rows = a.map((x, i) => {
      const next = a[i + 1];
      const dur = x.start != null && x.end != null ? x.end - x.start : null;
      const brk = x.end != null && next && next.start != null ? next.start - x.end : null;
      const p = plan[i];
      return {
        i, n: i + 1, start: x.start, end: x.end, dur, brk,
        goalStart: state.eventStart + p.start,
        goalEnd: state.eventStart + p.end,
        goalDur: p.dur, goalBrk: p.brk, goalExtra: p.extra,
        done: x.start != null && x.end != null,
        active: x.start != null && x.end == null,
      };
    });

    const completed = rows.filter((r) => r.done);
    const activeRow = rows.find((r) => r.active) || null;
    const lastDone = [...rows].reverse().find((r) => r.end != null) || null;
    const firstOpen = rows.find((r) => r.start == null) || null;

    // A break that is still running (last finished ascent, next one not started yet).
    const inBreak = !activeRow && lastDone && firstOpen && lastDone.n < EVENT.ascents;
    if (inBreak) { lastDone.liveBrk = Math.max(0, now - lastDone.end); }

    const breaks = rows.filter((r) => r.brk != null);
    const ascentTime = completed.reduce((s, r) => s + r.dur, 0) + (activeRow ? Math.max(0, now - activeRow.start) : 0);
    const breakTime = breaks.reduce((s, r) => s + r.brk, 0) + (inBreak ? lastDone.liveBrk : 0);

    // Averages of the previous two ascents / breaks (in chronological order).
    const durs = completed.map((r) => r.dur);
    const last2Asc = durs.slice(-2);
    const avgAsc = last2Asc.length ? last2Asc.reduce((s, v) => s + v, 0) / last2Asc.length : null;
    const brks = breaks.map((r) => r.brk);
    const last2Brk = brks.slice(-2);
    const avgBrk = last2Brk.length ? last2Brk.reduce((s, v) => s + v, 0) / last2Brk.length : null;

    const projection = project(rows, activeRow, lastDone, avgAsc, avgBrk, goal, now);
    const goalFinish = state.eventStart + plan[plan.length - 1].end;
    const cutoff = state.eventStart + EVENT.limitHours * HOUR;

    // Live status vs goal: compare the latest actual timestamp with its planned counterpart.
    // While climbing or resting, the deficit keeps growing once the planned end/start has passed.
    let vsGoal = null;
    if (activeRow) vsGoal = Math.max(activeRow.start - activeRow.goalStart, now - activeRow.goalEnd);
    else if (inBreak) vsGoal = Math.max(lastDone.end - lastDone.goalEnd, now - firstOpen.goalStart);
    else if (lastDone) vsGoal = lastDone.end - lastDone.goalEnd;

    return {
      goal, plan, rows, completed, activeRow, lastDone,
      ascentTime, breakTime, avgAsc, avgBrk,
      miles: completed.length * EVENT.milesPerAscent,
      feet: completed.length * EVENT.feetPerAscent,
      projection, goalFinish, cutoff, vsGoal,
    };
  }

  /**
   * Predict the finish of the last ascent. Remaining ascents use the average of the
   * previous two ascents; remaining breaks use the average of the previous two breaks.
   * Where no actual data exists yet, the selected goal's plan values are used instead.
   */
  function project(rows, activeRow, lastDone, avgAsc, avgBrk, goal, now) {
    const N = EVENT.ascents;
    const ascFor = (n) => (avgAsc != null ? avgAsc : goal.ascentMin(n) * MIN);
    const brkFor = (n) => (avgBrk != null ? avgBrk : goalBreakMin(goal, n) * MIN);

    const finished = rows.filter((r) => r.end != null).length;
    const allDone = rows[N - 1].end != null;
    if (allDone) return { finish: rows[N - 1].end, basis: 'done', avgAsc, avgBrk };

    let t;
    let nextN; // the first ascent not yet accounted for in t
    if (activeRow) {
      t = Math.max(now, activeRow.start + ascFor(activeRow.n));
      nextN = activeRow.n + 1;
    } else if (lastDone) {
      const n = lastDone.n + 1;
      t = Math.max(now, lastDone.end + brkFor(lastDone.n)) + ascFor(n);
      nextN = n + 1;
    } else {
      // Nothing recorded yet: the goal plan from the event start.
      const plan = goalPlan(goal);
      return { finish: state.eventStart + plan[N - 1].end, basis: 'plan', avgAsc, avgBrk };
    }
    for (let n = nextN; n <= N; n++) t += brkFor(n - 1) + ascFor(n);
    return { finish: t, basis: finished || activeRow ? (avgAsc != null ? 'actual' : 'mixed') : 'plan', avgAsc, avgBrk };
  }

  // ---------- rendering ----------
  let tick = null;

  function render() {
    const now = Date.now();
    const d = derive(now);
    renderTopbar(now);
    renderHero(d, now);
    renderGoal(d);
    renderStats(d, now);
    renderLog(d);
    renderSummits(d);
  }

  function renderTopbar(now) {
    $('topbar-clock').textContent = fmtClockOnly.format(now);
    const el = $('topbar-event');
    const elapsed = now - state.eventStart;
    const left = state.eventStart + EVENT.limitHours * HOUR - now;
    if (elapsed < 0) el.textContent = `Starts in ${fmtDur(-elapsed)}`;
    else if (left > 0) el.textContent = `Elapsed ${fmtStopwatch(elapsed)} · ${fmtDur(left)} left`;
    else el.textContent = `Time limit reached`;
  }

  function renderHero(d, now) {
    const hero = $('hero');
    const btn = $('btn-record');
    const N = EVENT.ascents;
    hero.classList.remove('is-climbing', 'is-break', 'is-done', 'is-ready');

    const firstOpen = d.rows.find((r) => r.start == null);
    if (d.activeRow) {
      hero.classList.add('is-climbing');
      $('hero-eyebrow').textContent = 'Climbing';
      $('hero-title').textContent = `Ascent ${d.activeRow.n}`;
      $('hero-timer').textContent = fmtStopwatch(now - d.activeRow.start);
      const goalDur = d.activeRow.goalDur;
      $('hero-note').textContent = `Started ${fmtTime.format(d.activeRow.start)} · goal ${fmtDur(goalDur)} · ${d.activeRow.n === N ? 'the last one' : `${N - d.activeRow.n} to go after this`}`;
      btn.textContent = `Finish Ascent ${d.activeRow.n}`;
      btn.disabled = false;
      btn.dataset.action = 'end';
      btn.dataset.index = d.activeRow.i;
    } else if (d.rows[N - 1].end != null) {
      hero.classList.add('is-done');
      $('hero-eyebrow').textContent = 'Complete';
      $('hero-title').textContent = '29,029 ft';
      $('hero-timer').textContent = fmtDur(d.rows[N - 1].end - state.eventStart);
      $('hero-note').textContent = `Finished ${fmtTimeLong.format(d.rows[N - 1].end)}. Total event time.`;
      btn.textContent = 'Event complete';
      btn.disabled = true;
      delete btn.dataset.action;
    } else if (d.lastDone && firstOpen) {
      hero.classList.add('is-break');
      $('hero-eyebrow').textContent = 'Break';
      $('hero-title').textContent = `After Ascent ${d.lastDone.n}`;
      $('hero-timer').textContent = fmtStopwatch(now - d.lastDone.end);
      const goalNext = firstOpen.goalStart;
      const rel = goalNext - now;
      $('hero-note').textContent = `Goal start for ascent ${firstOpen.n}: ${fmtTime.format(goalNext)} (${rel >= 0 ? `in ${fmtDur(rel)}` : `${fmtDur(-rel)} ago`}) · goal break ${fmtDur(d.lastDone.goalBrk)}`;
      btn.textContent = `Start Ascent ${firstOpen.n}`;
      btn.disabled = false;
      btn.dataset.action = 'start';
      btn.dataset.index = firstOpen.i;
    } else {
      hero.classList.add('is-ready');
      const target = firstOpen || d.rows[0];
      $('hero-eyebrow').textContent = 'Ready';
      $('hero-title').textContent = `Ascent ${target.n}`;
      const untilStart = state.eventStart - now;
      $('hero-timer').textContent = untilStart > 0 ? fmtStopwatch(untilStart) : fmtStopwatch(now - state.eventStart);
      $('hero-note').textContent = untilStart > 0
        ? `Event starts ${fmtTimeLong.format(state.eventStart)}. Tap the button when you start climbing.`
        : `Event clock running since ${fmtTime.format(state.eventStart)}. Tap the button when you start climbing.`;
      btn.textContent = `Start Ascent ${target.n}`;
      btn.disabled = false;
      btn.dataset.action = 'start';
      btn.dataset.index = target.i;
    }

    const hasAny = d.rows.some((r) => r.start != null || r.end != null);
    $('btn-undo').hidden = !hasAny;
  }

  function renderGoal(d) {
    document.querySelectorAll('#goal-switch button').forEach((b) => {
      b.setAttribute('aria-selected', b.dataset.goal === state.goalId ? 'true' : 'false');
    });
    $('goal-desc').textContent = d.goal.desc;
    const gs = $('goal-status');
    if (d.vsGoal == null) {
      gs.textContent = `${d.goal.name}: finish ${fmtTime.format(d.goalFinish)}`;
      gs.className = 'goal-status even';
    } else {
      const m = Math.round(d.vsGoal / MIN);
      gs.textContent = m === 0 ? 'On pace' : `${fmtDur(Math.abs(d.vsGoal))} ${m < 0 ? 'ahead' : 'behind'}`;
      gs.className = `goal-status ${deltaClass(d.vsGoal)}`;
    }
  }

  function renderStats(d, now) {
    $('st-done').textContent = `${d.completed.length} / ${EVENT.ascents}`;
    $('st-ascent').textContent = fmtDur(d.ascentTime);
    $('st-break').textContent = fmtDur(d.breakTime);
    $('st-avg').textContent = d.completed.length ? fmtDur(d.ascentTime / d.completed.length) : '—';
    $('st-miles').textContent = d.miles.toFixed(1);
    $('st-elev').textContent = `${d.feet.toLocaleString()} ft`;

    const p = d.projection;
    const projEl = $('st-proj');
    const projSub = $('st-proj-sub');
    projEl.textContent = fmtTimeLong.format(p.finish);
    const vsCut = d.cutoff - p.finish;
    const cutTxt = vsCut >= 0 ? `${fmtDur(vsCut)} inside the 36h cutoff` : `${fmtDur(-vsCut)} past the 36h cutoff`;
    let basis;
    if (p.basis === 'done') basis = 'Actual finish.';
    else if (p.basis === 'plan') basis = `${d.goal.name} plan (no ascents recorded yet).`;
    else if (p.basis === 'mixed') basis = `Goal pace until an ascent is completed.`;
    else basis = `Avg of last 2 ascents ${fmtDur(p.avgAsc)}` + (p.avgBrk != null ? `, last 2 breaks ${fmtDur(p.avgBrk)}.` : `, goal breaks.`);
    projSub.textContent = `${cutTxt}. ${basis}`;
    projEl.className = 'stat-value ' + (vsCut < 0 ? 'behind' : '');

    $('st-goal-label').textContent = `${d.goal.name} finish`;
    $('st-goal').textContent = fmtTimeLong.format(d.goalFinish);
    const diff = p.finish - d.goalFinish;
    $('st-goal-sub').textContent = p.basis === 'plan'
      ? `Total ${fmtDur(d.goalFinish - state.eventStart)} · cutoff ${fmtTimeLong.format(d.cutoff)}`
      : `Projected ${fmtDur(Math.abs(diff))} ${diff <= 0 ? 'ahead of' : 'behind'} goal · cutoff ${fmtTimeLong.format(d.cutoff)}`;
  }

  function renderLog(d) {
    const body = $('log-body');
    const frag = document.createDocumentFragment();
    for (const r of d.rows) {
      const tr = document.createElement('tr');
      tr.dataset.index = r.i;
      if (r.active) tr.classList.add('is-active');
      if (r.done) tr.classList.add('is-done');

      const cells = [];
      cells.push(td(String(r.n)));
      cells.push(r.start != null ? td(fmtTime.format(r.start)) : td(fmtTime.format(r.goalStart), 'plan'));
      cells.push(r.end != null ? td(fmtTime.format(r.end)) : td(fmtTime.format(r.goalEnd), 'plan'));
      if (r.dur != null) cells.push(td(fmtDur(r.dur)));
      else if (r.active) cells.push(td(fmtStopwatch(Math.max(0, Date.now() - r.start)), 'live'));
      else cells.push(td(fmtDur(r.goalDur), 'plan'));
      if (r.n === EVENT.ascents) cells.push(td('—', 'dash'));
      else if (r.brk != null) cells.push(td(fmtDur(r.brk)));
      else if (r.liveBrk != null) cells.push(td(fmtStopwatch(r.liveBrk), 'live'));
      else cells.push(td(fmtDur(r.goalBrk), 'plan' + (r.goalExtra ? ' extra' : '')));
      cells.push(td(`${fmtDur(r.goalDur)} · ${fmtTime.format(r.goalEnd)}`, 'goal-cell'));
      const delta = r.end != null ? r.end - r.goalEnd : null;
      const dtd = td(fmtDelta(delta), deltaClass(delta));
      if (delta == null) dtd.className = 'dash';
      cells.push(dtd);

      cells.forEach((c) => tr.appendChild(c));
      frag.appendChild(tr);
    }
    body.replaceChildren(frag);
  }

  function td(text, cls) {
    const el = document.createElement('td');
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  function renderSummits(d) {
    const ul = $('summits');
    const frag = document.createDocumentFragment();
    for (const m of MILESTONES) {
      const li = document.createElement('li');
      const reached = d.rows[m.ascent - 1].end != null;
      li.className = 'summit' + (reached ? ' reached' : '');
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = reached ? '✓' : '';
      const peak = document.createElement('span');
      peak.className = 'peak';
      peak.textContent = m.peak;
      const info = document.createElement('span');
      info.textContent = `${m.feet.toLocaleString()} ft · ascent ${m.ascent}`;
      li.append(mark, peak, info);
      frag.appendChild(li);
    }
    ul.replaceChildren(frag);
  }

  // ---------- milestones ----------
  const summitQueue = [];

  let milestoneFromTap = false;

  function checkMilestones() {
    // Forget milestones for ascents whose end time was cleared, so they can fire again.
    state.shown = state.shown.filter((peak) => {
      const m = MILESTONES.find((x) => x.peak === peak);
      return m && state.ascents[m.ascent - 1].end != null;
    });
    for (const m of MILESTONES) {
      if (state.ascents[m.ascent - 1].end != null && !state.shown.includes(m.peak)) {
        state.shown.push(m.peak);
        summitQueue.push(m);
      }
    }
    save();
    showNextSummit();
  }

  function showNextSummit() {
    const modal = $('modal-summit');
    if (!modal.hidden) return;
    const m = summitQueue.shift();
    if (!m) return;
    $('summit-msg').textContent = m.msg;
    $('summit-eyebrow').textContent = m.peak === 'Everest' ? 'Event complete' : 'Summit reached';
    $('summit-sub').textContent = `${(m.ascent * EVENT.feetPerAscent).toLocaleString()} ft climbed after ascent ${m.ascent} — ${m.peak} stands ${m.feet.toLocaleString()} ft.`;
    $('summit-ok').textContent = m.peak === 'Everest' ? 'Done!' : summitQueue.length ? 'Next' : 'Keep climbing';
    modal.hidden = false;
    if (milestoneFromTap && navigator.vibrate) { try { navigator.vibrate([120, 60, 120]); } catch {} }
  }

  $('summit-ok').addEventListener('click', () => {
    $('modal-summit').hidden = true;
    showNextSummit();
  });

  // ---------- recording ----------
  function commitChange() {
    save();
    render();
    milestoneFromTap = true;
    checkMilestones();
    milestoneFromTap = false;
  }

  $('btn-record').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const i = Number(btn.dataset.index);
    if (!action || !Number.isInteger(i)) return;
    const now = Date.now();
    if (action === 'start') {
      state.ascents[i].start = now;
      toast(`Ascent ${i + 1} started ${fmtTime.format(now)}`);
    } else {
      if (state.ascents[i].start != null && now <= state.ascents[i].start) {
        toast(`Ascent ${i + 1} has a start time in the future — fix it first.`, 4000);
        openEdit(i);
        return;
      }
      state.ascents[i].end = now;
      toast(`Ascent ${i + 1} finished ${fmtTime.format(now)}`);
    }
    commitChange();
  });

  $('btn-undo').addEventListener('click', () => {
    // Clear the most recent recorded timestamp.
    let best = null;
    state.ascents.forEach((a, i) => {
      if (a.end != null && (!best || a.end > best.t)) best = { i, field: 'end', t: a.end };
      if (a.start != null && (!best || a.start > best.t)) best = { i, field: 'start', t: a.start };
    });
    if (!best) return;
    const what = `${best.field === 'start' ? 'start' : 'end'} of ascent ${best.i + 1} (${fmtTime.format(best.t)})`;
    if (!confirm(`Remove the ${what}?`)) return;
    state.ascents[best.i][best.field] = null;
    toast(`Removed ${what}`);
    commitChange();
  });

  // ---------- edit modal ----------
  let editIndex = null;

  function openEdit(i) {
    editIndex = i;
    const a = state.ascents[i];
    $('edit-title').textContent = `Ascent ${i + 1}`;
    $('edit-start').value = toLocalInput(a.start);
    $('edit-end').value = toLocalInput(a.end);
    $('edit-error').hidden = true;
    $('modal-edit').hidden = false;
  }

  $('btn-manual').addEventListener('click', () => {
    const d = derive(Date.now());
    const target = d.activeRow || d.rows.find((r) => r.start == null) || d.rows[EVENT.ascents - 1];
    openEdit(target.i);
  });

  $('log-body').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-index]');
    if (tr) openEdit(Number(tr.dataset.index));
  });

  document.querySelectorAll('[data-now]').forEach((b) => {
    b.addEventListener('click', () => { $(b.dataset.now).value = toLocalInput(Date.now()); });
  });
  document.querySelectorAll('[data-clear]').forEach((b) => {
    b.addEventListener('click', () => { $(b.dataset.clear).value = ''; });
  });

  $('edit-cancel').addEventListener('click', () => { $('modal-edit').hidden = true; });

  $('edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const start = fromLocalInput($('edit-start').value);
    const end = fromLocalInput($('edit-end').value);
    const err = $('edit-error');
    if (start != null && end != null && end <= start) {
      err.textContent = 'End must be after start.';
      err.hidden = false;
      return;
    }
    if (start == null && end != null) {
      err.textContent = 'Enter a start time before an end time.';
      err.hidden = false;
      return;
    }
    state.ascents[editIndex] = { start, end };
    $('modal-edit').hidden = true;
    toast(`Ascent ${editIndex + 1} updated`);
    commitChange();
  });

  // ---------- goal switch ----------
  $('goal-switch').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-goal]');
    if (!b) return;
    state.goalId = b.dataset.goal;
    save();
    render();
  });

  // ---------- settings ----------
  $('btn-settings').addEventListener('click', () => {
    $('set-start').value = toLocalInput(state.eventStart).slice(0, 16);
    updateCutoffHint();
    $('modal-settings').hidden = false;
  });
  function updateCutoffHint() {
    const t = fromLocalInput($('set-start').value);
    $('set-cutoff').textContent = t != null
      ? `36-hour cutoff: ${fmtTimeLong.format(t + EVENT.limitHours * HOUR)}`
      : '';
  }
  $('set-start').addEventListener('input', updateCutoffHint);
  $('settings-cancel').addEventListener('click', () => { $('modal-settings').hidden = true; });
  $('settings-save').addEventListener('click', () => {
    const t = fromLocalInput($('set-start').value);
    if (t == null) { toast('Enter a valid event start.'); return; }
    state.eventStart = t;
    save();
    $('modal-settings').hidden = true;
    render();
  });

  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Reset ALL recorded times? This cannot be undone.')) return;
    if (!confirm('Really reset? Consider exporting a backup first.')) return;
    const keepStart = state.eventStart, keepGoal = state.goalId;
    state = freshState();
    state.eventStart = keepStart;
    state.goalId = keepGoal;
    save();
    $('modal-settings').hidden = true;
    render();
    toast('All times cleared.');
  });

  $('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `ascent-tracker-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('file-import').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!confirm('Replace the current data with this backup?')) return;
      state = sanitize(parsed);
      save();
      $('modal-settings').hidden = true;
      render();
      toast('Backup imported.');
    } catch {
      toast('That file is not a valid backup.');
    }
  });

  // Close modals on backdrop click (not the summit popup — it has its own button).
  for (const id of ['modal-edit', 'modal-settings']) {
    $(id).addEventListener('click', (e) => { if (e.target.id === id) $(id).hidden = true; });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { $('modal-edit').hidden = true; $('modal-settings').hidden = true; }
  });

  // ---------- boot ----------
  render();
  checkMilestones();
  tick = setInterval(render, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
