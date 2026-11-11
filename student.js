/* ===================================================================== 학생 화면 */
function renderStudent(){
  const me = S.me, cls = classOf(me.class_id), days = periodDates(cls), t = todayKST();
  const byDate = Object.fromEntries(S.entries.map(e => [e.entry_date, e]));
  const di = days.indexOf(t), todayE = byDate[t];
  const candies = S.entries.filter(e => e.mission_result === 'done').length;
  const recorded = S.entries.filter(e => days.includes(e.entry_date)).length;
  const ups = S.entries.filter(e => change(e)?.k === 'up').length;
  app.innerHTML = topbar() + `<main class="wrap">
    <div class="s-hero">
      <div class="stat"><div class="k">오늘은</div><div class="v">${di>=0 ? `${di+1}일째` : '–'}</div><div class="progress"><i style="width:${days.length ? recorded/days.length*100 : 0}%"></i></div><div class="k" style="margin-top:4px">${recorded} / ${days.length}일 기록</div></div>
      <div class="stat"><div class="k">모은 마음사탕</div><div class="v">🍬 ${candies}</div><div class="k">미션 성공한 날</div></div>
      <div class="stat"><div class="k">마음이 맑아진 날</div><div class="v">☀️ ${ups}</div><div class="k">아침보다 저녁이 더 맑았던 날</div></div>
    </div>
    ${letterHTML(cls, days, t)}
    <section class="card"><h2>${fmtDate(t)} · 오늘의 마음</h2>${todayHTML(todayE, di >= 0)}</section>
    ${weeklyHTML(days, t, byDate)}
    <section class="card" id="counsel-card"><h2>💬 상담 신청</h2>${counselHTML(todayE)}</section>
    <section class="card"><h2>🔍 나의 마음 발견</h2>
      <p class="muted" style="font-size:13px;margin:-4px 0 8px">지금까지의 기록에서 찾은 내 마음의 패턴이에요. 맞는 것 같나요? 나는 어떤 사람인지 한번 생각해 봐요.</p>
      ${insightsHTML(insightsFor(S.entries, days))}</section>
    <section class="card"><h2 style="display:flex;align-items:center;gap:8px">나의 마음 하루 30일 <button class="btn sm" data-act="print" style="margin-left:auto;font-family:Pretendard">📄 PDF 저장·인쇄</button></h2>
      ${calendarHTML(cls, byDate)}
      <div class="legend"><span>칸 = 아침 → 저녁 마음 날씨</span><span>▲▼ 마음 온도 변화</span><span>🍬 미션 성공</span><span>날짜를 누르면 자세히 볼 수 있어요</span></div>
    </section></main>`;
}
function todayHTML(e, inPeriod){
  if(!inPeriod) return `<div class="note">오늘은 기록하는 날이 아니에요. 달력에서 지난 기록을 살펴보세요 🌰</div>`;
  const u = S.ui, hasAm = !!e?.am_weather, hasPm = !!e?.pm_weather, hasPledge = !!e?.pledge;
  const steps = `<div class="steps">
    <div class="${hasAm?'done':'now'}">🌅 아침 마음</div>
    <div class="${hasPledge||hasPm?'done':hasAm?'now':''}">🍬 미션 다짐</div>
    <div class="${hasPm?'done':(hasAm&&hasPledge)?'now':''}">🌇 저녁 마음</div></div>`;
  let h = steps;
  // 아침
  h += `<div class="block">`;
  if(!hasAm || u.editAm) h += weatherForm('am', e);
  else h += `<div class="summary" style="background:${WEATHER[e.am_weather].c}"><span class="e">${WEATHER[e.am_weather].e}</span>
      <div class="t"><b>🌅 아침 · ${WEATHER[e.am_weather].n} ${tempOf(e,'am')}°</b>${e.am_reason ? `<span>“${esc(e.am_reason)}”</span>` : ''}</div>
      ${!hasPm ? '<button class="btn sm" data-act="edit-am">고치기</button>' : ''}</div>
      ${e.am_weather >= 4 && !(S.counsels||[]).some(c => c.entry_date === todayKST() && c.status !== 'canceled')
        ? `<div class="note" style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="flex:1">마음이 무거운 아침이네요. 선생님과 이야기 나누고 싶다면 상담을 신청할 수 있어요.</span><button class="btn sm primary" data-act="counsel-open">💬 상담 신청</button></div>` : ''}`;
  h += `</div>`;
  // 미션
  if(hasAm && e.mission_id && !u.editAm){
    const m = missionOf(e.mission_id);
    h += `<div class="block"><div class="mission" style="background:${GROUP[m?.grp||'green']}">
      <div class="lbl">🍬 오늘의 마음돌봄 미션</div><div class="mt">${esc(m?.text || '미션')}</div>
      ${hasPledge && !u.pledgeOpen ? `<div class="pledge">✍️ <b>나의 다짐</b> ${esc(e.pledge)} ${!hasPm ? '<button class="btn ghost sm" data-act="pledge-open">고치기</button>' : ''}</div>`
        : u.pledgeOpen ? `<form id="pledge-form"><div class="q" style="font-size:14px">이 미션을 오늘 언제, 누구에게, 어떻게 해볼까요?</div>
            <textarea name="pledge" maxlength="300" required placeholder="예: 점심시간에 짝꿍이 발표 준비한 걸 구체적으로 칭찬할게요">${esc(e.pledge||'')}</textarea>
            <button class="btn primary big" type="submit">다짐 저장하기</button></form>`
        : `<button class="btn primary big" data-act="pledge-open">💪 미션 도전!</button>`}
    </div></div>`;
  }
  // 저녁
  h += `<div class="block">`;
  if(hasPm && !u.openPm){
    const c = change(e);
    h += `<div class="result-box">
      <div style="text-align:center"><div class="big">${e.am_weather ? WEATHER[e.am_weather].e : '○'}</div><div class="muted" style="font-size:12px">아침 ${tempOf(e,'am') ?? '–'}°</div></div>
      <div class="arr">→</div>
      <div style="text-align:center"><div class="big">${WEATHER[e.pm_weather].e}</div><div class="muted" style="font-size:12px">저녁 ${tempOf(e,'pm')}°</div></div>
      ${c ? `<div>${changeBadge(c)}</div>` : ''}</div>
      ${c ? `<p class="chgtext ${c.k}">${CHG_TEXT[c.k]}</p>` : ''}
      ${e.pm_reason ? `<p style="text-align:center;margin:6px 0 0">“${esc(e.pm_reason)}”</p>` : ''}
      ${e.mission_result ? `<p style="text-align:center;margin:6px 0 0">${RESULT[e.mission_result].e} 미션 ${RESULT[e.mission_result].n}${e.mission_result==='done' ? ' · 마음사탕 획득! 🍬' : ''}</p>` : ''}
      <p style="text-align:center;margin:8px 0 0"><button class="btn ghost sm" data-act="open-pm">저녁 기록 고치기</button></p>`;
  } else if(u.openPm || hasPm){
    h += weatherForm('pm', e);
  } else {
    h += `<div class="note" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="flex:1">🌇 저녁 종례 시간에 하루를 마무리하는 마음을 기록해요.</span>
      <button class="btn primary" data-act="open-pm">저녁 마음 기록하기</button></div>`;
  }
  return h + `</div>`;
}
function weatherForm(k, e){
  const am = k === 'am', w = e?.[k+'_weather'] || 0, t = e?.[k+'_temp'] ?? 50, r = e?.[k+'_reason'] || '';
  const hasMission = !am && e?.mission_id, m = hasMission && missionOf(e.mission_id);
  return `<form class="wform" data-kind="${k}">
    <div class="q">${am ? '🌅 아침 조회 · 오늘 하루를 시작하는 내 마음 날씨는?' : '🌇 저녁 종례 · 하루를 마무리하는 지금 내 마음 날씨는?'}</div>
    <div class="wpick">${[1,2,3,4,5].map(i => `<button type="button" class="wbtn ${w==i?'on':''}" data-w="${i}" aria-pressed="${w==i}"><span>${WEATHER[i].e}</span><small>${WEATHER[i].n}</small></button>`).join('')}</div>
    <input type="hidden" name="weather" value="${w||''}">
    <label class="temp">🌡️ 마음 온도 <input type="range" name="temp" min="0" max="100" value="${t}"><b>${t}°</b></label>
    <textarea name="reason" maxlength="300" placeholder="${am ? '왜 이런 마음이 들었나요? (쓰고 싶은 만큼만)' : '오늘 하루, 마음이 왜 이렇게 되었나요?'}">${esc(r)}</textarea>
    ${hasMission ? `<div class="dbox" style="background:${GROUP[m.grp]};margin:0 0 10px">
      <div class="lbl">🍬 오늘의 미션 확인</div><div class="mt">${esc(m.text)}</div>
      ${e.pledge ? `<div class="ln">✍️ 나의 다짐: ${esc(e.pledge)}</div>` : ''}
      <div class="rpick">${Object.entries(RESULT).map(([key,v]) => `<button type="button" class="rbtn ${e.mission_result===key?'on':''}" data-r="${key}">${v.e} ${v.n}</button>`).join('')}</div>
      <input type="hidden" name="result" value="${e.mission_result||''}">
      <textarea name="reflection" maxlength="300" placeholder="미션을 하면서 어땠나요? (선택)" style="min-height:56px;margin:0">${esc(e.reflection||'')}</textarea></div>` : ''}
    <div class="err"></div>
    <button class="btn primary big" type="submit">${am ? '아침 마음 등록하기' : '저녁 마음 등록하기'}</button>
  </form>`;
}
async function onWeatherSubmit(f){
  const k = f.dataset.kind, w = +f.weather.value, t = +f.temp.value, r = f.reason.value.trim();
  const err = $('.err', f);
  if(!w){ err.textContent = '마음 날씨를 하나 골라 주세요.'; return; }
  if(f.result && !f.result.value){ err.textContent = '오늘의 미션을 했는지 골라 주세요.'; return; }
  const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
  try{
    if(k === 'am'){ await API.submitMorning(w, t, r); S.ui.editAm = false; toast('아침 마음을 등록했어요! 오늘의 미션을 확인해 보세요 🍬'); }
    else { await API.submitEvening(w, t, r, f.result?.value || null, f.reflection?.value.trim() || null); S.ui.openPm = false; toast(f.result?.value === 'done' ? '마음사탕을 받았어요! 🍬' : '오늘 하루도 수고했어요 🌙'); }
    S.entries = await API.myEntries(S.me.id); renderStudent();
  }catch(e){ err.textContent = e.message; btn.disabled = false; }
}

/* ===================================================================== 학생 이벤트 */
async function startApp(){ [S.entries, S.counsels, S.refls] = await Promise.all([API.myEntries(S.me.id), API.myCounsels(S.me.id).catch(() => []), API.myReflections(S.me.id).catch(() => [])]); renderStudent(); }

document.addEventListener('click', ev => {
  const wb = ev.target.closest('.wbtn');
  if(wb){ const f = wb.closest('form'); $$('.wbtn', f).forEach(b => { b.classList.toggle('on', b===wb); b.setAttribute('aria-pressed', b===wb); });
    f.weather.value = wb.dataset.w; f.temp.value = WEATHER[wb.dataset.w].t; $('.temp b', f).textContent = f.temp.value + '°'; return; }
  const rb = ev.target.closest('.rbtn');
  if(rb){ const f = rb.closest('form'); $$('.rbtn', f).forEach(b => b.classList.toggle('on', b===rb)); f.result.value = rb.dataset.r; return; }
  const cell = ev.target.closest('.cal-cell.in');
  if(cell){ const d = cell.dataset.cal; return openModal(entryDetailHTML(S.entries.find(x => x.entry_date === d), d)); }
  const a = ev.target.closest('[data-act]'); if(!a) return;
  const act = a.dataset.act;
  if(act === 'edit-am'){ S.ui.editAm = true; return renderStudent(); }
  if(act === 'open-pm'){ S.ui.openPm = true; renderStudent(); return $('form[data-kind=pm]')?.scrollIntoView({behavior:'smooth', block:'center'}); }
  if(act === 'pledge-open'){ S.ui.pledgeOpen = true; renderStudent(); return $('#pledge-form textarea')?.focus(); }
});
document.addEventListener('input', ev => {
  if(ev.target.name === 'temp'){ const b = ev.target.parentElement.querySelector('b'); if(b) b.textContent = ev.target.value + '°'; }
});
document.addEventListener('submit', async ev => {
  const f = ev.target;
  if(f.classList.contains('wform')){ ev.preventDefault(); return onWeatherSubmit(f); }
  if(f.getAttribute('id') === 'pledge-form'){
    ev.preventDefault();
    try{ await API.setPledge(f.pledge.value.trim()); S.ui.pledgeOpen = false; S.entries = await API.myEntries(S.me.id); renderStudent(); toast('다짐을 저장했어요! 종례 시간에 확인해요 💪'); }
    catch(e){ toast(e.message); }
  }
});

/* ===================================================================== 상담 신청 */
function counselHTML(){
  const u = S.ui, f = u.cf || (u.cf = {target:'homeroom', urgency:'week', category:'', time:''});
  const opt = (k, v, label) => `<button type="button" class="opt ${f[k]===v?'on':''}" data-opt="${k}" data-v="${esc(v)}">${label}</button>`;
  const list = (S.counsels || []).filter(c => ['new','seen'].includes(c.status)).slice(0, 6);
  const form = u.counselOpen ? `<form id="counsel-form">
      <div class="olbl">누구와 이야기하고 싶나요?</div><div class="optrow">${Object.entries(C_TARGET).map(([k,v]) => opt('target', k, v)).join('')}</div>
      <div class="olbl">어떤 이야기인가요?</div><div class="optrow">${C_CATS.map(c => opt('category', c, c)).join('')}</div>
      <div class="olbl">언제 만나고 싶나요?</div><div class="optrow">${Object.entries(C_URGENCY).map(([k,v]) => opt('urgency', k, v)).join('')}</div>
      <div class="olbl">편한 시간</div><div class="optrow">${C_TIMES.map(c => opt('time', c, c)).join('')}</div>
      <textarea name="content" maxlength="500" placeholder="선생님께 미리 전하고 싶은 말이 있으면 적어 주세요. (비워 둬도 괜찮아요)"></textarea>
      <p class="muted" style="font-size:12px;margin:-4px 0 8px">🔒 신청 내용은 선생님들만 볼 수 있고, <b>선생님이 확인하면 안전하게 지워져요.</b> 지금 많이 힘들다면 바로 선생님께 직접 말하거나 청소년상담전화 <b>1388</b>에 연락할 수 있어요.</p>
      <div class="err"></div>
      <div style="display:flex;gap:8px"><button class="btn primary" style="flex:1">상담 신청하기</button><button type="button" class="btn" data-act="counsel-close">닫기</button></div>
    </form>`
    : `<button class="btn primary big" data-act="counsel-open">💬 선생님과 이야기하고 싶어요</button>`;
  return form + (list.length ? `<div style="margin-top:14px;display:flex;align-items:center"><b style="font-size:14px">선생님 확인을 기다리는 신청</b>
      <button class="btn ghost sm" data-act="counsel-refresh" style="margin-left:auto">🔄 새로고침</button></div>
    ${list.map(c => `<div class="creq">
      <div class="hd"><span class="cst ${c.status}">${C_STATUS[c.status]}</span><b>${C_TARGET[c.target]}</b><span class="muted">${esc(c.category)} · ${C_URGENCY[c.urgency]}${c.preferred_time ? ' · '+esc(c.preferred_time) : ''}</span>
        <span class="muted" style="margin-left:auto">${md(c.entry_date)}</span></div>
      ${c.content ? `<p class="ct">${esc(c.content)}</p>` : ''}
      ${c.teacher_note ? `<div class="reply">💌 선생님: ${esc(c.teacher_note)}</div>` : ''}
      <div style="text-align:right;margin-top:6px"><button class="btn ghost sm" data-act="counsel-cancel" data-id="${c.id}">신청 취소</button></div>
    </div>`).join('')}
    <p class="muted" style="font-size:12px;margin:8px 0 0">선생님이 확인하면 이 목록에서 사라지고, 선생님이 따로 불러 주실 거예요.</p>`
    : (S.ui.hadCounsel ? '<p class="muted" style="font-size:13px;margin:10px 0 0">✅ 선생님이 신청을 확인했어요. 곧 이야기 나눠요!</p>' : ''));
}
function rerenderCounsel(){ const el = $('#counsel-card'); if(el) el.innerHTML = '<h2>💬 상담 신청</h2>' + counselHTML(); }

document.addEventListener('click', async ev => {
  const o = ev.target.closest('.opt[data-opt]');
  if(o){ const k = o.dataset.opt; S.ui.cf[k] = o.dataset.v; $$(`.opt[data-opt="${k}"]`).forEach(b => b.classList.toggle('on', b === o)); return; }
  const a = ev.target.closest('[data-act]'); if(!a) return;
  const act = a.dataset.act;
  if(act === 'counsel-open'){ S.ui.counselOpen = true; S.ui.cf = null; rerenderCounsel(); return $('#counsel-card').scrollIntoView({behavior:'smooth', block:'start'}); }
  if(act === 'counsel-close'){ S.ui.counselOpen = false; return rerenderCounsel(); }
  if(act === 'counsel-refresh'){ const before = (S.counsels||[]).length; S.counsels = await API.myCounsels(S.me.id); if(S.counsels.length < before) S.ui.hadCounsel = true; rerenderCounsel(); return toast('새로 불러왔어요'); }
  if(act === 'counsel-cancel'){ if(!confirm('상담 신청을 취소할까요?')) return; try{ await API.cancelCounsel(+a.dataset.id); S.counsels = await API.myCounsels(S.me.id); rerenderCounsel(); toast('신청을 취소했어요'); }catch(e){ toast(e.message); } return; }
  if(act === 'print') return printReport(S.me, S.entries, classOf(S.me.class_id), S.refls);
});
document.addEventListener('submit', async ev => {
  const f = ev.target; if(f.getAttribute('id') !== 'counsel-form') return;
  ev.preventDefault();
  const c = S.ui.cf, err = $('.err', f);
  if(!c.category){ err.textContent = '어떤 이야기인지 하나 골라 주세요.'; return; }
  const btn = f.querySelector('button.primary'); btn.disabled = true;
  try{
    await API.requestCounsel({target:c.target, category:c.category, urgency:c.urgency, time:c.time || null, content:f.elements.content.value.trim() || null});
    S.ui.counselOpen = false; S.counsels = await API.myCounsels(S.me.id); renderStudent();
    toast(`${C_TARGET[c.target]}께 상담을 신청했어요 💌`);
  }catch(e){ err.textContent = e.message; btn.disabled = false; }
});

/* ===================================================================== 자기성찰 : 편지 · 주간 돌아보기 */
function letterHTML(cls, days, t){
  if(!days.length || t < days[0]) return '';
  const key = cls.start_date, last = days[days.length-1], isEnd = t >= last;
  const ls = reflOf(S.refls, 'letter_start', key), le = reflOf(S.refls, 'letter_end', key), u = S.ui;
  const note = '<p class="muted" style="font-size:12px;margin:0 0 8px">✉️ 이 편지는 담임 선생님도 읽을 수 있어요.</p>';
  if(!isEnd){
    if(ls && !u.editLetter){
      const left = days.filter(d => d > t).length;
      return `<section class="card" style="padding:12px 14px"><div class="sealed"><span class="env">📮</span>
        <div style="flex:1"><b>30일 뒤의 나에게 보낸 편지</b><div class="muted" style="font-size:13px">${md(last)} (30일째)에 열 수 있어요 · D-${left}</div></div>
        <button class="btn ghost sm" data-act="letter-edit">고쳐 쓰기</button></div></section>`;
    }
    if(!u.letterOpen && !u.editLetter) return `<section class="card" style="padding:12px 14px"><div class="sealed"><span class="env">✉️</span>
      <div style="flex:1"><b>30일 뒤의 나에게 편지를 써 볼까요?</b><div class="muted" style="font-size:13px">30일 동안 어떤 내가 되고 싶은지, 지금의 마음을 담아 보세요. 30일째에 열려요.</div></div>
      <button class="btn primary sm" data-act="letter-open">편지 쓰기</button></div></section>`;
    return `<section class="card"><form id="letter-start-form" class="letter"><div class="lt">📮 30일 뒤의 나에게</div>
      <p class="muted" style="font-size:13px;margin:0 0 8px">30일 뒤의 나는 어떤 모습이면 좋을까요? 지금의 고민, 바라는 것, 응원의 말을 자유롭게 적어요.</p>
      <textarea name="text" maxlength="1000" required style="min-height:120px" placeholder="30일 뒤의 ○○에게,">${esc(ls?.answers.text || '')}</textarea>${note}
      <div style="display:flex;gap:8px"><button class="btn primary" style="flex:1">편지 봉인하기 📮</button><button type="button" class="btn" data-act="letter-cancel">닫기</button></div></form></section>`;
  }
  // 30일째 이후 : 편지 열기 + 답장 + 따뜻한 말
  const warm = le?.answers.warm || ['', '', '', ''];
  const head = `<div class="lt">📬 30일 전의 내가 보낸 편지</div><p>${ls ? esc(ls.answers.text) : '<span class="muted">30일 전에는 편지를 쓰지 않았어요. 대신 지금의 나에게 말을 걸어 봐요.</span>'}</p>`;
  if(le && !u.editLetter) return `<section class="card"><h2>🎉 30일을 마쳤어요!</h2><div class="letter">${head}
    <div class="lt">💌 30일 전의 나에게</div><p>${esc(le.answers.reply || '')}</p>
    ${warm.filter(Boolean).length ? `<div class="lt">🤍 나에게 들려주고 싶은 따뜻한 말</div><ul class="warm">${warm.filter(Boolean).map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
    <p style="text-align:right;margin:8px 0 0"><button class="btn ghost sm" data-act="letter-edit">고쳐 쓰기</button></p></div></section>`;
  return `<section class="card"><h2>🎉 30일을 마쳤어요! 편지가 열렸어요</h2><form id="letter-end-form" class="letter">${head}
    <p class="muted" style="font-size:13px;margin:0 0 8px">아래 달력과 '나의 마음 발견'을 함께 보면서, 30일 동안의 나를 돌아봐요.</p>
    <div class="lt">💌 30일 전의 나에게 답장</div>
    <textarea name="reply" maxlength="1000" required style="min-height:110px" placeholder="30일 전의 나에게, 30일 동안 나는…">${esc(le?.answers.reply || '')}</textarea>
    <div class="lt">🤍 나에게 들려주고 싶은 따뜻한 말</div>
    ${[0,1,2,3].map(i => `<input class="inp" name="warm${i}" maxlength="80" value="${esc(warm[i]||'')}" placeholder="☐ 예: 넌 생각보다 훨씬 다정한 사람이야" style="margin-bottom:6px">`).join('')}
    ${note}<button class="btn primary big">저장하기</button></form></section>`;
}

function weeklyHTML(days, t, byDate){
  const wk = weekKey(t), u = S.ui;
  const wDays = days.filter(d => d >= wk && d <= addDays(wk, 6) && d <= t);
  const mine = reflOf(S.refls, 'weekly', wk);
  const isTime = [5, 6, 0].includes(dow(t)) || t === days[days.length-1];
  const past = (S.refls || []).filter(r => r.kind === 'weekly' && r.ref_key !== wk).sort((a,b) => b.ref_key.localeCompare(a.ref_key));
  const pastHTML = past.length ? `<details style="margin-top:10px"><summary class="muted" style="cursor:pointer;font-size:13px">지난 돌아보기 ${past.length}개</summary>
    ${past.map(w => `<div class="wk"><div class="lt">🗓️ ${md(w.ref_key)} 주</div>${W_Q.map(([k,q]) => w.answers[k] ? `<div class="wq"><span>${q}</span>${esc(w.answers[k])}</div>` : '').join('')}</div>`).join('')}</details>` : '';
  if(!wDays.length && !past.length) return '';
  let body;
  if(mine && !u.editWeekly){
    body = `<div class="wk" style="margin-top:0">${W_Q.map(([k,q]) => mine.answers[k] ? `<div class="wq"><span>${q}</span>${esc(mine.answers[k])}</div>` : '').join('')}
      <p style="text-align:right;margin:4px 0 0"><button class="btn ghost sm" data-act="weekly-edit">고쳐 쓰기</button></p></div>`;
  } else if(isTime && wDays.length){
    const es = wDays.map(d => byDate[d]).filter(Boolean), chs = es.map(change).filter(Boolean);
    body = `<p class="muted" style="font-size:13px;margin:-4px 0 6px">한 주를 마무리하며 이번 주의 나를 돌아봐요.</p>
      ${lineChart(wDays, [{name:'아침', color:'var(--am)', values:wDays.map(d => tempOf(byDate[d],'am'))},{name:'저녁', color:'var(--pm)', values:wDays.map(d => tempOf(byDate[d],'pm'))}], 150)}
      <div class="wstats"><span>기록 ${es.length}일</span><span>☀️ 맑아진 날 ${chs.filter(c => c.k==='up').length}</span><span>🌧️ 무거워진 날 ${chs.filter(c => c.k==='down').length}</span><span>🍬 미션 성공 ${es.filter(e => e.mission_result==='done').length}</span></div>
      <form id="weekly-form" data-wk="${wk}">${W_Q.map(([k,q]) => `<div class="wq-in"><label>${q}</label><textarea name="${k}" maxlength="300">${esc(mine?.answers[k] || '')}</textarea></div>`).join('')}
      <button class="btn primary big">이번 주 돌아보기 저장</button></form>`;
  } else {
    body = `<div class="note">🗓️ <b>금요일 종례</b> 때 이번 주의 나를 돌아보는 시간을 가져요.</div>`;
  }
  return `<section class="card"><h2>🗓️ 이번 주 돌아보기</h2>${body}${pastHTML}</section>`;
}

document.addEventListener('click', ev => {
  const a = ev.target.closest('[data-act]'); if(!a) return;
  const act = a.dataset.act;
  if(act === 'letter-open'){ S.ui.letterOpen = true; return renderStudent(); }
  if(act === 'letter-cancel'){ S.ui.letterOpen = false; S.ui.editLetter = false; return renderStudent(); }
  if(act === 'letter-edit'){ S.ui.editLetter = true; return renderStudent(); }
  if(act === 'weekly-edit'){ S.ui.editWeekly = true; return renderStudent(); }
});
document.addEventListener('submit', async ev => {
  const f = ev.target, id = f.getAttribute('id');
  if(!['letter-start-form','letter-end-form','weekly-form'].includes(id)) return;
  ev.preventDefault();
  const el = f.elements, key = classOf(S.me.class_id).start_date;
  const btn = f.querySelector('button.primary'); btn.disabled = true;
  try{
    if(id === 'letter-start-form') await API.saveReflection('letter_start', key, {text:el.text.value.trim()});
    if(id === 'letter-end-form') await API.saveReflection('letter_end', key, {reply:el.reply.value.trim(), warm:[0,1,2,3].map(i => el['warm'+i].value.trim())});
    if(id === 'weekly-form') await API.saveReflection('weekly', f.dataset.wk, Object.fromEntries(W_Q.map(([k]) => [k, el[k].value.trim()])));
    S.refls = await API.myReflections(S.me.id);
    Object.assign(S.ui, {letterOpen:false, editLetter:false, editWeekly:false});
    renderStudent();
    toast(id === 'letter-start-form' ? '편지를 봉인했어요 📮 30일째에 만나요!' : id === 'weekly-form' ? '이번 주 돌아보기를 저장했어요 🗓️' : '30일의 기록을 마무리했어요 🎉');
  }catch(e){ toast(e.message); btn.disabled = false; }
});
