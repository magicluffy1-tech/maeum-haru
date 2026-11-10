/* ===================================================================== 교사 화면 */
async function loadTeacher(){
  const [st, en] = await Promise.all([API.students(), API.allEntries()]);
  S.t.students = st; S.t.entries = en; reindex();
}
function reindex(){
  const idx = {};
  S.t.entries.forEach(e => { (idx[e.student_id] ||= {})[e.entry_date] = e; });
  S.t.idx = idx;
}
const tStudents = () => S.t.students.filter(s => S.t.classId === 'all' || s.class_id === S.t.classId);
const sLabel = s => `${classOf(s.class_id)?.name.replace('학년 ','-').replace('반','')} ${s.number}번 ${s.name}`;

function concernsFor(s, D){
  const out = [], m = S.t.idx[s.id] || {}, e = m[D], t = todayKST();
  if(periodDates(classOf(s.class_id)).includes(D) && D <= t && !e?.am_weather) out.push(D === t ? '아침 미기록' : '기록 없음');
  const c = change(e); if(c && c.d <= -30) out.push('크게 가라앉음');
  const last = Object.values(m).filter(x => x.entry_date <= D).sort((a,b) => b.entry_date.localeCompare(a.entry_date)).slice(0,3);
  if(last.length === 3 && last.every(x => (x.pm_weather || x.am_weather) >= 4)) out.push('흐림 3일 연속');
  const txt = [e?.am_reason, e?.pm_reason, e?.reflection].filter(Boolean).join(' ');
  if(CONCERN_WORDS.some(w => txt.includes(w))) out.push('이유 살펴보기');
  return out;
}

function renderTeacher(){
  const tabs = [['today','📊 오늘 한눈에'],['trend','📈 기간 추이'],['missions','🍬 미션'],['settings','⚙️ 학급 설정']];
  const T = S.t;
  app.innerHTML = topbar(DEMO ? '' : '<span class="live" id="live">실시간</span>') + `
    <nav style="border-bottom:1px solid var(--line);background:var(--paper)"><div class="tabs">${tabs.map(([k,v]) => `<button class="${T.tab===k?'on':''}" data-act="tab" data-v="${k}">${v}</button>`).join('')}</div></nav>
    <div class="twrap">
      ${T.tab !== 'settings' ? `<div class="filters">
        <div class="chips">${[['all','전체'], ...S.classes.map(c => [c.id, c.name])].map(([k,v]) => `<button class="chip ${T.classId===k?'on':''}" data-act="cls" data-v="${k}">${v}</button>`).join('')}</div>
        ${T.tab === 'today' ? `<span style="margin-left:auto;display:flex;gap:6px;align-items:center">
          <button class="btn sm" data-act="day" data-v="-1">◀</button><input type="date" class="inp" id="tdate" value="${T.date}"><button class="btn sm" data-act="day" data-v="1">▶</button>
          <button class="btn sm" data-act="day" data-v="0">오늘</button></span>` : ''}
        <button class="btn sm" data-act="refresh" title="새로 불러오기">🔄</button>
      </div>` : ''}
      <div id="tbody">${({today:tToday, trend:tTrend, missions:tMissions, settings:tSettings})[T.tab]()}</div>
    </div>`;
}

function tToday(){
  const D = S.t.date, studs = tStudents();
  const rows = studs.map(s => ({ s, e:S.t.idx[s.id]?.[D] }));
  const N = studs.length;
  const amN = rows.filter(r => r.e?.am_weather).length, pmN = rows.filter(r => r.e?.pm_weather).length;
  const amAvg = avg(rows.map(r => tempOf(r.e,'am')).filter(v => v!=null)), pmAvg = avg(rows.map(r => tempOf(r.e,'pm')).filter(v => v!=null));
  const ch = rows.map(r => change(r.e)).filter(Boolean);
  const cnt = k => ch.filter(c => c.k === k).length;
  const withM = rows.filter(r => r.e?.mission_id), done = withM.filter(r => r.e.mission_result === 'done').length, pledged = withM.filter(r => r.e.pledge).length;
  const dist = k => [1,2,3,4,5].map(i => rows.filter(r => r.e?.[k+'_weather'] === i).length);
  const dA = dist('am'), dP = dist('pm'), mx = Math.max(1, ...dA, ...dP);
  const distRow = (lbl, arr) => `<div class="rl">${lbl}</div>` + arr.map((v,i) => `<div class="col"><span class="n">${v}</span><div class="bar" style="height:${8+v/mx*70}px;background:${WEATHER[i+1].c};border:1px solid rgba(0,0,0,.06)"></div></div>`).join('');
  const concerns = studs.map(s => ({ s, c:concernsFor(s, D) })).filter(x => x.c.length);
  const isPeriod = studs.some(s => periodDates(classOf(s.class_id)).includes(D));
  const dDelta = (amAvg!=null && pmAvg!=null) ? pmAvg - amAvg : null;

  return `${!isPeriod ? '<div class="note" style="margin-top:14px">선택한 날짜는 30일 기간에 포함되지 않는 날이에요.</div>' : ''}
  <div class="kpis">
    <div class="kpi"><div class="k">🌅 아침 기록</div><div class="v">${amN}<span class="muted" style="font-size:16px"> / ${N}명</span></div><div class="s">조회 시간 참여</div></div>
    <div class="kpi"><div class="k">🌇 저녁 기록</div><div class="v">${pmN}<span class="muted" style="font-size:16px"> / ${N}명</span></div><div class="s">종례 시간 참여</div></div>
    <div class="kpi"><div class="k">🌡️ 평균 마음 온도</div><div class="v">${amAvg ?? '–'}° → ${pmAvg ?? '–'}°</div><div class="s">${dDelta!=null ? changeBadge({d:dDelta, k:dDelta>=5?'up':dDelta<=-5?'down':'same'}) + ' 아침 대비 저녁' : '아침 → 저녁'}</div></div>
    <div class="kpi"><div class="k">🍬 미션 성공</div><div class="v">${done}<span class="muted" style="font-size:16px"> / ${withM.length}명</span></div><div class="s">다짐 작성 ${pledged}명</div></div>
  </div>
  <div class="grid2">
    <div class="card"><h2>아침 → 저녁, 마음의 변화</h2>
      ${ch.length ? `<div class="stack">${['up','same','down'].map(k => cnt(k) ? `<div class="${k}" style="width:${cnt(k)/ch.length*100}%">${cnt(k)}</div>` : '').join('')}</div>
      <div class="lg"><span><i style="background:var(--up)"></i>맑아짐 ${cnt('up')}명</span><span><i style="background:#BBAEA3"></i>비슷함 ${cnt('same')}명</span><span><i style="background:var(--down)"></i>무거워짐 ${cnt('down')}명</span></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">아침·저녁을 모두 기록한 ${ch.length}명 기준 · 마음 온도 10° 이상 차이를 변화로 봐요</p>`
      : '<p class="muted">아침과 저녁을 모두 기록한 학생이 아직 없어요.</p>'}
    </div>
    <div class="card"><h2>마음 날씨 분포</h2>
      <div class="dist"><div></div>${[1,2,3,4,5].map(i => `<div class="col"><span class="em">${WEATHER[i].e}</span></div>`).join('')}
        ${distRow('아침', dA)}${distRow('저녁', dP)}</div>
    </div>
  </div>
  <div class="card"><h2>🔎 살펴볼 학생 <span class="muted" style="font-size:14px;font-family:Pretendard">${concerns.length}명</span></h2>
    ${concerns.length ? `<div class="concern">${concerns.map(x => `<button class="cc" data-act="student" data-sid="${x.s.id}"><b>${esc(sLabel(x.s))}</b>${x.c.map(t => `<span class="tag">${t}</span>`).join('')}</button>`).join('')}</div>
    <p class="muted" style="font-size:12px;margin:10px 0 0">'이유 살펴보기'는 특정 단어가 포함된 기록이에요. 자동 판단이니 꼭 직접 읽어 보시고, 필요하면 상담 체계와 연계해 주세요.</p>`
    : '<p class="muted">특별히 살펴볼 학생이 없어요.</p>'}
  </div>
  <div class="card"><h2>학생별 기록 · ${fmtDate(D)}</h2>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>학생</th><th>아침</th><th>저녁</th><th>변화</th><th>왜 그런 마음이었나요?</th><th>오늘의 미션</th></tr></thead><tbody>
    ${rows.map(({s,e}) => { const m = missionOf(e?.mission_id), c = change(e);
      return `<tr class="click" data-act="student" data-sid="${s.id}">
        <td style="white-space:nowrap"><b>${esc(s.name)}</b><div class="muted" style="font-size:12px">${classOf(s.class_id)?.name} ${s.number}번</div></td>
        <td class="w">${e?.am_weather ? WEATHER[e.am_weather].e+`<small>${tempOf(e,'am')}°</small>` : '<span class="muted" style="font-size:14px">–</span>'}</td>
        <td class="w">${e?.pm_weather ? WEATHER[e.pm_weather].e+`<small>${tempOf(e,'pm')}°</small>` : '<span class="muted" style="font-size:14px">–</span>'}</td>
        <td>${changeBadge(c)}</td>
        <td class="why">${e?.am_reason ? `<span class="t">아침</span><div>${esc(e.am_reason)}</div>` : ''}${e?.pm_reason ? `<span class="t">저녁</span><div>${esc(e.pm_reason)}</div>` : ''}${!e?.am_reason && !e?.pm_reason ? '<span class="muted">–</span>' : ''}</td>
        <td>${m ? `<span class="mtag" style="background:${GROUP[m.grp]}" title="${esc(m.text)}">${esc(m.text)}</span><div style="font-size:12px;margin-top:3px">${e.mission_result ? RESULT[e.mission_result].e+' '+RESULT[e.mission_result].n : e.pledge ? '✍️ 다짐함' : '<span class="muted">다짐 전</span>'}</div>` : '<span class="muted">–</span>'}</td>
      </tr>`; }).join('')}
    </tbody></table></div></div>`;
}

function trendDates(){
  const t = todayKST(), set = new Set();
  const ids = S.t.classId === 'all' ? S.classes.map(c => c.id) : [S.t.classId];
  ids.forEach(id => periodDates(classOf(id)).forEach(d => { if(d <= t) set.add(d); }));
  return [...set].sort();
}
function tTrend(){
  const dates = trendDates(), studs = tStudents(), ids = new Set(studs.map(s => s.id));
  const es = S.t.entries.filter(e => ids.has(e.student_id));
  const by = {}; es.forEach(e => (by[e.entry_date] ||= []).push(e));
  const amS = dates.map(d => avg((by[d]||[]).map(e => tempOf(e,'am')).filter(v => v!=null)));
  const pmS = dates.map(d => avg((by[d]||[]).map(e => tempOf(e,'pm')).filter(v => v!=null)));
  const allCh = es.map(change).filter(Boolean);
  const upRate = allCh.length ? Math.round(allCh.filter(c => c.k==='up').length / allCh.length * 100) : null;
  const doneN = es.filter(e => e.mission_result==='done').length, mN = es.filter(e => e.mission_id).length;
  const partN = es.filter(e => e.am_weather).length, possible = studs.length * dates.length;
  const cellBg = e => { const c = change(e); return !e ? '#FBF8F4' : !c ? '#FFFFFF' : c.k==='up' ? 'var(--up-l)' : c.k==='down' ? 'var(--down-l)' : 'var(--same-l)'; };
  return `<div class="kpis">
    <div class="kpi"><div class="k">진행 일수</div><div class="v">${dates.length}일</div><div class="s">30일 중</div></div>
    <div class="kpi"><div class="k">아침 참여율</div><div class="v">${possible ? Math.round(partN/possible*100) : 0}%</div><div class="s">${partN} / ${possible}</div></div>
    <div class="kpi"><div class="k">마음이 맑아진 비율</div><div class="v">${upRate ?? '–'}%</div><div class="s">아침보다 저녁이 맑아진 기록</div></div>
    <div class="kpi"><div class="k">미션 성공률</div><div class="v">${mN ? Math.round(doneN/mN*100) : 0}%</div><div class="s">🍬 ${doneN} / ${mN}</div></div>
  </div>
  <div class="card"><h2>날짜별 평균 마음 온도</h2>${lineChart(dates, [{name:'아침 평균', color:'var(--am)', values:amS},{name:'저녁 평균', color:'var(--pm)', values:pmS}])}</div>
  <div class="card"><h2>학생 × 날짜 마음 지도</h2>
    <p class="muted" style="font-size:13px;margin:-4px 0 10px">칸 = 저녁 마음 날씨(없으면 아침) · 배경 <span class="chg up">맑아짐</span> <span class="chg same">비슷</span> <span class="chg down">무거워짐</span> · 칸을 누르면 그날 기록, 이름을 누르면 학생 전체 기록</p>
    <div class="hm-wrap"><table class="hm"><thead><tr><th class="nm">학생</th>${dates.map(d => `<th>${md(d)}<br><span class="muted" style="font-weight:400">${DOW[dow(d)]}</span></th>`).join('')}</tr></thead><tbody>
    ${studs.map(s => `<tr><th class="nm" data-act="student" data-sid="${s.id}">${esc(sLabel(s))}</th>${dates.map(d => { const e = S.t.idx[s.id]?.[d]; const w = e?.pm_weather || e?.am_weather;
      return `<td style="background:${cellBg(e)}" data-act="cell" data-sid="${s.id}" data-date="${d}" title="${esc(s.name)} ${md(d)}">${w ? WEATHER[w].e : '<span style="color:#D9CCC0">·</span>'}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div></div>`;
}

function tMissions(){
  const ids = new Set(tStudents().map(s => s.id));
  const es = S.t.entries.filter(e => ids.has(e.student_id) && e.mission_id);
  return `<div class="card"><h2>🍬 마음돌봄 미션</h2>
    <p class="muted" style="font-size:13px;margin-top:-4px">학생이 아침 마음을 등록하면 켜져 있는 미션 중 하나가 무작위로 주어져요. (최근에 받은 미션은 피해서 골고루)</p>
    ${S.missions.map(m => { const a = es.filter(e => e.mission_id===m.id), d = a.filter(e => e.mission_result==='done').length;
      return `<div class="mrow ${m.active?'':'off'}" style="background:${GROUP[m.grp]}"><span class="tx">${esc(m.text)}</span>
        <span class="st">배정 ${a.length} · 성공 ${a.length ? Math.round(d/a.length*100) : 0}%</span>
        <label class="switch" title="사용"><input type="checkbox" data-act="mtoggle" data-id="${m.id}" ${m.active?'checked':''}><span></span></label></div>`; }).join('')}
    <form id="mission-form" style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <input class="inp" name="text" required maxlength="80" placeholder="새 미션 추가 (예: 친구에게 먼저 인사하기)" style="flex:1;min-width:220px">
      <select class="inp" name="grp" style="width:auto"><option value="green">초록</option><option value="yellow">노랑</option><option value="purple">보라</option></select>
      <button class="btn primary">추가</button></form></div>`;
}

function tSettings(){
  return `<div class="card"><h2>🔗 학생용 페이지 주소</h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><code class="inp" style="flex:1;min-width:240px;background:#fff">${esc(studentPageURL())}</code>
      <button class="btn sm primary" data-act="copy-url">주소 복사</button></div>
    <p class="muted" style="font-size:13px;margin:8px 0 0">학생들에게는 이 주소만 알려 주세요. 지금 보고 계신 관리 페이지(teacher.html)는 선생님만 쓰세요. 학생 계정은 이 페이지에 로그인할 수 없어요.</p></div>
  <div class="card"><h2>⚙️ 학급별 30일 기간</h2>
    <p class="muted" style="font-size:13px;margin-top:-4px">시작일부터 정한 일수만큼 기록하는 날이 생겨요. 주말을 빼면 학교 오는 날만 셉니다.</p>
    ${S.classes.map(c => { const d = periodDates(c);
      return `<form class="srow" data-cid="${c.id}"><b>${c.name}</b>
        <label class="field" style="margin:0"><span>시작일</span><input type="date" name="start_date" value="${c.start_date}"></label>
        <label class="field" style="margin:0"><span>기록 일수</span><input type="number" name="total_days" min="1" max="120" value="${c.total_days}"></label>
        <label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" name="include_weekend" ${c.include_weekend?'checked':''}> 주말 포함</label>
        <span style="display:flex;gap:8px;align-items:center"><span class="muted" style="font-size:12px">${d.length ? `~ ${md(d[d.length-1])}` : ''}</span><button class="btn sm primary">저장</button></span></form>`; }).join('')}
  </div>
  <div class="card"><h2>👥 등록한 학생 <span class="muted" style="font-size:14px;font-family:Pretendard">${S.t.students.length}명</span></h2>
    <p class="muted" style="font-size:13px;margin-top:-4px">학생은 학생용 페이지의 '처음이에요 → 등록하기'에서 학급, 번호, 이름, 학급 코드, 비밀번호로 직접 등록해요. 비밀번호를 잊은 학생은 이름을 눌러 재설정할 수 있어요.</p>
    ${S.classes.map(c => { const l = S.t.students.filter(s => s.class_id===c.id);
      return `<div style="margin:10px 0"><b>${c.name}</b> <span class="muted">(${l.length}명)</span><div class="chips" style="margin-top:6px">${l.map(s => `<button class="chip" data-act="student" data-sid="${s.id}">${s.number}. ${esc(s.name)}</button>`).join('') || '<span class="muted">아직 없음</span>'}</div></div>`; }).join('')}
  </div>`;
}

function openStudent(sid, sel=null){
  const s = S.t.students.find(x => x.id === sid); if(!s) return;
  const cls = classOf(s.class_id), m = S.t.idx[sid] || {}, t = todayKST();
  const days = periodDates(cls).filter(d => d <= t);
  const es = Object.values(m);
  const chs = es.map(change).filter(Boolean);
  const doneN = es.filter(e => e.mission_result==='done').length;
  const recent = sel || [...days].reverse().find(d => m[d]) || days[days.length-1];
  openModal(`<h3>${esc(s.name)} <span class="muted" style="font-size:16px;font-family:Pretendard">${cls.name} ${s.number}번</span></h3>
    <div class="sd-stats">
      <div class="kpi"><div class="k">기록한 날</div><div class="v">${es.filter(e=>e.am_weather||e.pm_weather).length} / ${days.length}</div></div>
      <div class="kpi"><div class="k">평균 온도 (아침→저녁)</div><div class="v">${avg(es.map(e=>tempOf(e,'am')).filter(v=>v!=null)) ?? '–'}° → ${avg(es.map(e=>tempOf(e,'pm')).filter(v=>v!=null)) ?? '–'}°</div></div>
      <div class="kpi"><div class="k">맑아진 / 무거워진 날</div><div class="v"><span style="color:var(--up)">▲${chs.filter(c=>c.k==='up').length}</span> <span style="color:var(--down)">▼${chs.filter(c=>c.k==='down').length}</span></div></div>
      <div class="kpi"><div class="k">마음사탕</div><div class="v">🍬 ${doneN}</div></div>
    </div>
    ${lineChart(days, [{name:'아침', color:'var(--am)', values:days.map(d=>tempOf(m[d],'am'))},{name:'저녁', color:'var(--pm)', values:days.map(d=>tempOf(m[d],'pm'))}], 180)}
    <div style="margin-top:14px">${calendarHTML(cls, m, {sid, sel:recent})}</div>
    <div id="sd-detail" class="card" style="margin-top:12px">${recent ? entryDetailHTML(m[recent], recent) : ''}</div>
    <details style="margin-top:14px"><summary class="muted" style="cursor:pointer;font-size:13px">🔑 비밀번호 재설정</summary>
      <form id="reset-form" data-sid="${sid}" style="display:flex;gap:8px;margin-top:8px"><input class="inp" name="pin" minlength="6" required placeholder="새 비밀번호 (6자리 이상)" style="flex:1"><button class="btn sm primary">재설정</button></form></details>`, true);
}

let rtTimer = null;
function onRealtime(p){
  const row = p.new && Object.keys(p.new).length ? p.new : null;
  if(p.eventType === 'DELETE'){ S.t.entries = S.t.entries.filter(e => e.id !== p.old.id); }
  else if(row){ const i = S.t.entries.findIndex(e => e.id === row.id); if(i >= 0) S.t.entries[i] = row; else S.t.entries.push(row); }
  reindex();
  const live = $('#live'); if(live){ live.classList.remove('flash'); void live.offsetWidth; live.classList.add('flash'); }
  clearTimeout(rtTimer);
  rtTimer = setTimeout(() => { const body = $('#tbody'); if(body && ['today','trend','missions'].includes(S.t.tab)){ const y = scrollY; renderTeacher(); scrollTo(0, y); } }, 500);
}

/* ===================================================================== 교사 이벤트 */
async function startApp(){ await loadTeacher(); renderTeacher(); API.subscribe(onRealtime); }
const studentPageURL = () => new URL('student.html', location.href).href;

document.addEventListener('click', async ev => {
  const cell = ev.target.closest('.cal-cell.in');
  if(cell){
    const d = cell.dataset.cal, cal = cell.closest('.cal');
    $$('.cal-cell', cal).forEach(c => c.classList.toggle('sel', c===cell));
    $('#sd-detail').innerHTML = entryDetailHTML(S.t.idx[cal.dataset.sid]?.[d], d);
    return;
  }
  const a = ev.target.closest('[data-act]'); if(!a) return;
  const act = a.dataset.act;
  if(act === 'tab'){ S.t.tab = a.dataset.v; return renderTeacher(); }
  if(act === 'cls'){ S.t.classId = a.dataset.v; return renderTeacher(); }
  if(act === 'day'){ const v = +a.dataset.v; S.t.date = v === 0 ? todayKST() : addDays(S.t.date, v); return renderTeacher(); }
  if(act === 'refresh'){ a.disabled = true; await loadTeacher(); S.missions = await API.missions(); renderTeacher(); return toast('새로 불러왔어요'); }
  if(act === 'student') return openStudent(a.dataset.sid);
  if(act === 'copy-url'){ try{ await navigator.clipboard.writeText(studentPageURL()); toast('학생용 주소를 복사했어요'); }catch(e){ toast(studentPageURL()); } return; }
  if(act === 'cell'){ const s = S.t.students.find(x => x.id === a.dataset.sid);
    return openModal(entryDetailHTML(S.t.idx[s.id]?.[a.dataset.date], a.dataset.date, s.name) + `<p style="text-align:right;margin:14px 0 0"><button class="btn sm" data-act="student" data-sid="${s.id}">${esc(s.name)} 전체 기록 보기 →</button></p>`); }
});
document.addEventListener('change', async ev => {
  if(ev.target.id === 'tdate' && ev.target.value){ S.t.date = ev.target.value; renderTeacher(); }
  if(ev.target.dataset.act === 'mtoggle'){
    const id = +ev.target.dataset.id, on = ev.target.checked;
    try{ await API.setMissionActive(id, on); S.missions.find(m => m.id === id).active = on; renderTeacher(); toast(on ? '미션을 켰어요' : '미션을 껐어요'); }
    catch(e){ toast(e.message); ev.target.checked = !on; }
  }
});
document.addEventListener('submit', async ev => {
  const f = ev.target;
  if(!['mission-form','reset-form'].includes(f.id) && !f.classList.contains('srow')) return;
  ev.preventDefault();
  if(f.id === 'mission-form'){
    try{ const m = await API.addMission(f.text.value.trim(), f.grp.value); S.missions.push(m); renderTeacher(); toast('미션을 추가했어요'); }
    catch(e){ toast(e.message); }
    return;
  }
  if(f.classList.contains('srow')){
    const fields = { start_date:f.start_date.value, total_days:+f.total_days.value, include_weekend:f.include_weekend.checked };
    try{ await API.updateClass(f.dataset.cid, fields); Object.assign(classOf(f.dataset.cid), fields); renderTeacher(); toast('저장했어요'); }
    catch(e){ toast(e.message); }
    return;
  }
  if(f.id === 'reset-form'){
    try{ await API.resetPin(f.dataset.sid, f.pin.value); f.reset(); toast('비밀번호를 바꿨어요. 학생에게 알려 주세요.'); }
    catch(e){ toast(e.message); }
  }
});
