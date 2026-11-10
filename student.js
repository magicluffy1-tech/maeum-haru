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
    <section class="card"><h2>${fmtDate(t)} · 오늘의 마음</h2>${todayHTML(todayE, di >= 0)}</section>
    <section class="card"><h2>나의 마음 하루 30일</h2>
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
      ${!hasPm ? '<button class="btn sm" data-act="edit-am">고치기</button>' : ''}</div>`;
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
async function startApp(){ S.entries = await API.myEntries(S.me.id); renderStudent(); }

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
  if(f.id === 'pledge-form'){
    ev.preventDefault();
    try{ await API.setPledge(f.pledge.value.trim()); S.ui.pledgeOpen = false; S.entries = await API.myEntries(S.me.id); renderStudent(); toast('다짐을 저장했어요! 종례 시간에 확인해요 💪'); }
    catch(e){ toast(e.message); }
  }
});
