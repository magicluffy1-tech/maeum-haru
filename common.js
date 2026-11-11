const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

/* ===================================================================== 상수 */
const WEATHER = {
  1:{e:'☀️', n:'맑음',     t:90, c:'#FFE7A0'},
  2:{e:'🌤️', n:'구름 조금', t:70, c:'#FFF3CF'},
  3:{e:'☁️', n:'흐림',     t:50, c:'#ECE8E3'},
  4:{e:'🌧️', n:'비',       t:30, c:'#D4E6F4'},
  5:{e:'⛈️', n:'천둥번개', t:10, c:'#D6D0EE'},
};
const RESULT = { done:{e:'✅', n:'했어요'}, partial:{e:'🔸', n:'조금 했어요'}, not:{e:'⬜', n:'못 했어요'} };
const GROUP  = { green:'#D3EBCB', yellow:'#FFF0B3', purple:'#DCDDF7' };
const CHG_TEXT = { up:'하루 동안 마음이 맑아졌어요 ☀️', same:'비슷한 마음으로 하루를 보냈어요', down:'마음이 조금 무거워졌어요. 오늘 수고 많았어요 🤍' };
const CONCERN_WORDS = ['죽','자해','괴롭','때려','때렸','맞았','왕따','따돌','사라지','혼자','무서','힘들어','외로'];
const DOW = ['일','월','화','수','목','금','토'];
const C_TARGET  = { homeroom:'담임 선생님', counselor:'상담 선생님' };
const C_URGENCY = { today:'오늘 꼭', week:'이번 주 안에', anytime:'편할 때' };
const C_STATUS  = { new:'신청했어요', seen:'선생님이 확인했어요', done:'상담 완료', canceled:'취소했어요' };
const C_CATS    = ['친구 관계','가족','공부·성적','진로','마음·건강','학교생활','기타'];
const C_TIMES   = ['아침 조회 전','쉬는 시간','점심시간','방과 후','언제든 괜찮아요'];
const W_Q = [['best','이번 주, 내 마음이 가장 맑았던 순간은?'],['help','마음이 무거웠을 때 나를 도와준 건 무엇이었나요?'],['next','다음 주의 나에게 한마디']];

/* ===================================================================== 유틸 */
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayKST = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul'}).format(new Date());
const addDays = (s, n) => { const d = new Date(s+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const dow = s => new Date(s+'T00:00:00Z').getUTCDay();
const md  = s => `${+s.slice(5,7)}/${+s.slice(8,10)}`;
const fmtDate = s => `${+s.slice(5,7)}월 ${+s.slice(8,10)}일 (${DOW[dow(s)]})`;
const avg = a => a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length) : null;
const schoolYear = () => { const t = todayKST(), y = +t.slice(0,4), m = +t.slice(5,7); return m >= 3 ? y : y - 1; };
const tempOf = (e, k) => e?.[k+'_weather'] ? (e[k+'_temp'] ?? WEATHER[e[k+'_weather']].t) : null;

function periodDates(c){
  if(!c) return [];
  const out = []; let d = c.start_date, g = 0;
  while(out.length < c.total_days && g < 400){
    const w = dow(d);
    if(c.include_weekend || (w !== 0 && w !== 6)) out.push(d);
    d = addDays(d, 1); g++;
  }
  return out;
}
function change(e){
  const a = tempOf(e,'am'), p = tempOf(e,'pm');
  if(a == null || p == null) return null;
  const d = p - a;
  return { d, k: d >= 10 ? 'up' : d <= -10 ? 'down' : 'same' };
}
function changeBadge(c){
  if(!c) return '<span class="muted">–</span>';
  const sym = c.k==='up' ? '▲' : c.k==='down' ? '▼' : '＝';
  return `<span class="chg ${c.k}">${sym} ${Math.abs(c.d)}</span>`;
}
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('on'),2200); }
function openModal(html, wide=false){ $('#modal-body').innerHTML=html; $('.modal-box').classList.toggle('wide', wide); $('#modal').classList.remove('hidden'); $('#modal').scrollTop=0; }
function closeModal(){ $('#modal').classList.add('hidden'); $('#modal-body').innerHTML=''; }

/* ===================================================================== Supabase API */
let sb = null;
if(!DEMO && window.supabase) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const cleanId = id => String(id || '').trim().toLowerCase();
const ID_RULE = /^[a-z0-9_]{3,20}$/;
const emailFor = (kind, a) => `${kind === 'student' ? 's' : 't'}-${cleanId(a.id)}@${EMAIL_DOMAIN}`;
const chk = ({data, error}) => { if(error) throw new Error(error.message); return data; };

const RealAPI = {
  async session(){ const {data} = await sb.auth.getSession(); return data.session ? this.profile() : null; },
  async profile(){
    const {data:{user}} = await sb.auth.getUser(); if(!user) return null;
    return chk(await sb.from('profiles').select('*').eq('id', user.id).maybeSingle());
  },
  async classes(){ return chk(await sb.from('classes').select('*').order('id')); },
  async signIn(kind, a, pin){
    const {error} = await sb.auth.signInWithPassword({email: emailFor(kind,a), password: pin});
    if(error) throw new Error('아이디 또는 비밀번호가 맞지 않아요.');
    const p = await this.profile(); if(!p) throw new Error('계정 정보를 찾을 수 없어요. 선생님께 문의하세요.'); return p;
  },
  async signUp(kind, a, pin){
    const msg = chk(await sb.rpc('check_signup', {p_role:kind, p_code:a.code, p_class_id:a.classId||null, p_number:a.number||null}));
    if(msg) throw new Error(msg);
    const {data, error} = await sb.auth.signUp({ email: emailFor(kind,a), password: pin,
      options:{ data:{ role:kind, login_id:cleanId(a.id), class_id:a.classId||null, number:a.number||null, name:a.name, join_code:a.code } } });
    if(error) throw new Error(/registered|exists/i.test(error.message) ? '이미 쓰고 있는 아이디예요. 다른 아이디를 정해 주세요.' : '등록하지 못했어요: '+error.message);
    if(!data.session) throw new Error('등록은 되었지만 로그인할 수 없어요. (선생님: Supabase → Authentication → Sign In / Providers → Email → "Confirm email"을 꺼 주세요)');
    return this.profile();
  },
  async signOut(){ await sb.auth.signOut(); },
  async missions(){ return chk(await sb.from('missions').select('*').order('sort').order('id')); },
  async myEntries(uid){ return chk(await sb.from('daily_entries').select('*').eq('student_id', uid).order('entry_date')); },
  submitMorning(w,t,r){ return this._rpc('submit_morning', {p_weather:w, p_temp:t, p_reason:r}); },
  setPledge(p){ return this._rpc('set_pledge', {p_pledge:p}); },
  submitEvening(w,t,r,res,ref){ return this._rpc('submit_evening', {p_weather:w, p_temp:t, p_reason:r, p_result:res, p_reflection:ref}); },
  async _rpc(n, a){ return chk(await sb.rpc(n, a)); },
  async people(){ return chk(await sb.from('profiles').select('*').order('class_id').order('number')); },
  approve(id){ return this._rpc('approve_user', {p_id:id}); },
  reject(id){ return this._rpc('reject_user', {p_id:id}); },
  updateStudent(id, f){ return this._rpc('update_student', {p_id:id, p_class_id:f.class_id, p_number:f.number, p_name:f.name, p_status:f.status}); },
  promote(){ return this._rpc('promote_students', {}); },
  setAdmin(id, v){ return this._rpc('set_admin', {p_id:id, p_admin:v}); },
  async allEntries(){
    const out = []; const size = 1000;
    for(let from = 0; ; from += size){
      const rows = chk(await sb.from('daily_entries').select('*').order('id').range(from, from+size-1));
      out.push(...rows); if(rows.length < size) break;
    }
    return out;
  },
  async addMission(text, grp){ const max = Math.max(0, ...S.missions.map(m=>m.sort||0)); return chk(await sb.from('missions').insert({text, grp, sort:max+1}).select().single()); },
  async setMissionActive(id, active){ chk(await sb.from('missions').update({active}).eq('id', id)); },
  async updateClass(id, f){ chk(await sb.from('classes').update(f).eq('id', id)); },
  resetPin(id, pin){ return this._rpc('teacher_reset_pin', {p_student:id, p_pin:pin}); },
  subscribe(cb, onPeople, onCounsel){
    sb.channel('entries-live')
      .on('postgres_changes', {event:'*', schema:'public', table:'daily_entries'}, p => cb(p))
      .on('postgres_changes', {event:'*', schema:'public', table:'profiles'}, () => onPeople && onPeople())
      .on('postgres_changes', {event:'*', schema:'public', table:'counsel_requests'}, p => onCounsel && onCounsel(p))
      .subscribe();
  },
  async myCounsels(uid){ return chk(await sb.from('counsel_requests').select('*').eq('student_id', uid).order('created_at', {ascending:false})); },
  async allCounsels(){ return chk(await sb.from('counsel_requests').select('*').order('created_at', {ascending:false}).limit(1000)); },
  requestCounsel(f){ return this._rpc('request_counsel', {p_target:f.target, p_category:f.category, p_urgency:f.urgency, p_time:f.time, p_content:f.content}); },
  cancelCounsel(id){ return this._rpc('cancel_counsel', {p_id:id}); },
  updateCounsel(id, status, note){ return this._rpc('update_counsel', {p_id:id, p_status:status, p_note:note}); },
  async myReflections(uid){ return chk(await sb.from('reflections').select('*').eq('student_id', uid).order('ref_key')); },
  async allReflections(){ return chk(await sb.from('reflections').select('*').order('ref_key').limit(5000)); },
  saveReflection(kind, ref, answers){ return this._rpc('save_reflection', {p_kind:kind, p_ref:ref, p_answers:answers}); },
};

/* ===================================================================== 체험 모드(가짜 데이터) */
function pickMissionLocal(list, missions){
  const act = missions.filter(m => m.active);
  const recent = list.filter(e => e.mission_id).sort((a,b) => b.entry_date.localeCompare(a.entry_date))
    .slice(0, Math.floor(act.length/2)).map(e => e.mission_id);
  const pool = act.filter(m => !recent.includes(m.id));
  const p = pool.length ? pool : act;
  return p.length ? p[Math.floor(Math.random()*p.length)].id : null;
}
function buildDemo(){
  const t = todayKST();
  let s = t, n = 0; while(n < 13){ s = addDays(s, -1); const w = dow(s); if(w!==0 && w!==6) n++; }
  const classes = [1,2,3].map(g => ({id:`${g}-1`, grade:g, class_no:1, name:`${g}학년 1반`, start_date:s, total_days:30, include_weekend:false}));
  const missions = [
    ['대화를 할 때 한 학생의 말을 끝까지 들어보기','green'],['"좋아, 같이 해보자!" 하고 답해보기','green'],
    ['누군가를 대신 할 수 있는 일을 찾고 실행하기','green'],['눈길이 가는 학생/선생님에게 안부 건네기','green'],
    ['나와 다른 의견에 "그럴 수도 있겠다"고 말하기','yellow'],['학급의 문제를 함께 해결하는 시간 갖기','yellow'],
    ['"누가" 대신 "무엇을"로 바꾸어 문제 해결하기','yellow'],['"괜찮아, 그럴 때도 있지" 하고 격려하기','yellow'],
    ['누군가의 노력을 구체적으로 칭찬하기','purple'],['오늘 내 마음의 온도를 숫자로 표현하기','purple'],
    ['함께 한 시간에 감사하는 표현하기(전하기)','purple'],['나를 다독이는 짧은 메모로 하루 시작하기','purple'],
  ].map(([text,grp],i) => ({id:i+1, text, grp, active:true, sort:i+1}));
  const names = ['김하늘','이도윤','박서아','최지호','정하린','강시우','윤채원','장민준','임서연','한예준','오지안','서도현',
                 '신유나','권태오','황수아','안건우','송다인','류은호','전나윤','홍지후','고아린','문하준','양서윤','배로운'];
  const profiles = [{id:'t-1', role:'teacher', login_id:'teacher', name:'담임 선생님', status:'approved', is_admin:true}];
  classes.forEach((c, ci) => { for(let k=1; k<=8; k++) profiles.push({id:`s-${c.id}-${k}`, role:'student', login_id:`student${ci*8+k}`, class_id:c.id, number:k, name:names[ci*8+k-1], status:'approved'}); });
  const AMR = {1:['친구랑 등교하면서 웃긴 얘기를 했어요','아침을 맛있게 먹었어요','오늘 체육 시간이 기대돼요'],2:['조금 졸리지만 괜찮아요','숙제를 다 해서 마음이 가벼워요','날씨가 좋아요'],3:['어제 늦게 자서 피곤해요','특별한 일은 없어요','월요일이라 그냥 그래요'],4:['시험 때문에 걱정돼요','아침에 엄마랑 말다툼했어요','버스를 놓쳐서 뛰어왔어요'],5:['친구랑 다퉈서 속상해요','아무것도 하기 싫어요','머리가 아파요']};
  const PMR = {1:['친구에게 칭찬을 들었어요','점심이 맛있었어요','발표를 잘해서 뿌듯해요'],2:['그럭저럭 괜찮은 하루였어요','친구랑 화해했어요','동아리 활동이 재밌었어요'],3:['조금 지쳤어요','수학이 어려웠어요','평범한 하루였어요'],4:['모둠 활동에서 서운했어요','숙제가 너무 많아요','시험을 망친 것 같아요'],5:['친구랑 크게 다퉜어요','하루가 너무 길었어요','혼자 있고 싶어요']};
  const PLG = ['쉬는 시간에 짝꿍에게 먼저 말 걸기','점심시간에 꼭 해볼게요','모둠 활동 때 실천하기','집에 가기 전에 꼭 할게요'];
  const REF = ['생각보다 쉬웠어요','친구가 웃어줘서 좋았어요','조금 쑥스러웠어요','내일 다시 해볼래요','타이밍을 놓쳤어요'];
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const clamp = v => Math.max(1, Math.min(5, v));
  const entries = []; let id = 1;
  const days = periodDates(classes[0]).filter(d => d <= t);
  profiles.filter(p => p.role==='student').forEach(p => {
    let base = 1.6 + Math.random()*2; if(p.id === 's-2-1-3') base = 4.2;
    const list = [];
    days.forEach(d => {
      const isToday = d === t;
      if(p.id === 's-1-1-1' && isToday) return;
      if(Math.random() < (isToday ? .25 : .08)) return;
      const am = clamp(Math.round(base + (Math.random()*2-1)));
      let pm = clamp(am + pick([-2,-1,-1,0,0,0,1]));
      if(p.id === 's-2-1-3') pm = clamp(am + pick([0,0,1]));
      const e = { id:id++, student_id:p.id, class_id:p.class_id, entry_date:d,
        am_weather:am, am_temp:Math.max(0,Math.min(100,WEATHER[am].t + Math.round(Math.random()*16-8))), am_reason:pick(AMR[am]), am_at:d+'T08:40:00+09:00',
        mission_id:pickMissionLocal(list, missions), pledge:null, pm_weather:null, pm_temp:null, pm_reason:null, mission_result:null, reflection:null };
      if(Math.random() < .85) e.pledge = pick(PLG);
      const evening = isToday ? Math.random() < .3 : Math.random() < .9;
      if(evening){
        e.pm_weather = pm; e.pm_temp = Math.max(0,Math.min(100,WEATHER[pm].t + Math.round(Math.random()*16-8))); e.pm_reason = pick(PMR[pm]);
        e.mission_result = e.pledge ? pick(['done','done','done','partial','not']) : pick(['partial','not']);
        if(Math.random() < .7) e.reflection = pick(REF);
      }
      list.push(e); entries.push(e);
    });
  });
  profiles.push({id:'p-1', role:'student', login_id:'newbie1', class_id:'1-1', number:9, name:'남궁별', status:'pending', created_at:new Date().toISOString()},
                {id:'p-2', role:'student', login_id:'newbie2', class_id:'2-1', number:9, name:'제갈솔', status:'pending', created_at:new Date().toISOString()},
                {id:'p-3', role:'teacher', login_id:'coteacher', name:'부담임 선생님', status:'pending', created_at:new Date().toISOString()});
  const ago = h => new Date(Date.now() - h*3600e3).toISOString();
  const counsels = [
    {id:1, student_id:'s-2-1-3', class_id:'2-1', entry_date:t, target:'counselor', category:'친구 관계', urgency:'today', preferred_time:'점심시간', content:'요즘 친구들이 저만 빼고 다니는 것 같아서 이야기하고 싶어요.', status:'new', teacher_note:null, created_at:ago(1)},
    {id:2, student_id:'s-1-1-4', class_id:'1-1', entry_date:t, target:'homeroom', category:'공부·성적', urgency:'week', preferred_time:'방과 후', content:'수학 공부 방법을 여쭤보고 싶어요.', status:'seen', teacher_note:'목요일 방과 후에 교실에서 만나자!', created_at:ago(20)},
    {id:3, student_id:'s-1-1-1', class_id:'1-1', entry_date:addDays(t,-3), target:'homeroom', category:'학교생활', urgency:'anytime', preferred_time:'쉬는 시간', content:'모둠 활동 때 역할 나누기가 어려워요.', status:'done', teacher_note:'이야기 나눠줘서 고마워 😊', created_at:ago(72)},
  ];
  const wk = weekKey(t), pw = addDays(wk, -7);
  const reflections = [
    {id:1, student_id:'s-1-1-1', kind:'letter_start', ref_key:s, answers:{text:'30일 뒤의 하늘아, 친구들한테 먼저 말 거는 사람이 되어 있었으면 좋겠어. 힘든 날도 있겠지만 잘 버텨 줘!'}},
    {id:2, student_id:'s-1-1-1', kind:'weekly', ref_key:pw, answers:{best:'체육 시간에 우리 팀이 이겼을 때', help:'짝꿍이 괜찮냐고 물어봐 준 것', next:'수학 숙제 미루지 말자!'}},
    {id:3, student_id:'s-2-1-3', kind:'weekly', ref_key:pw, answers:{best:'잘 모르겠어요', help:'집에서 강아지랑 놀았던 것', next:'조금만 더 힘내자'}},
  ];
  return { classes, missions, profiles, entries, counsels, reflections, nextId:id };
}
const DemoAPI = (() => {
  let db = null, me = null;
  const init = () => { if(!db) db = buildDemo(); };
  const today = create => {
    const t = todayKST();
    let e = db.entries.find(x => x.student_id===me.id && x.entry_date===t);
    if(!e && create){ e = {id:db.nextId++, student_id:me.id, class_id:me.class_id, entry_date:t}; db.entries.push(e); }
    return e;
  };
  const wait = () => new Promise(r => setTimeout(r, 150));
  return {
    async session(){ init(); return me; },
    async classes(){ init(); return structuredClone(db.classes); },
    async loginAs(role){ init(); me = db.profiles.find(p => role==='teacher' ? p.role==='teacher' : p.id==='s-1-1-1'); return {...me}; },
    async signIn(){ throw new Error('체험 모드에서는 위의 체험 버튼을 눌러 주세요.'); },
    async signUp(){ throw new Error('체험 모드에서는 위의 체험 버튼을 눌러 주세요.'); },
    async signOut(){ me = null; },
    async missions(){ init(); return structuredClone(db.missions); },
    async myEntries(uid){ return structuredClone(db.entries.filter(e => e.student_id===uid)); },
    async submitMorning(w,t,r){ await wait(); const e = today(true);
      if(!e.mission_id) e.mission_id = pickMissionLocal(db.entries.filter(x=>x.student_id===me.id && x!==e), db.missions);
      Object.assign(e, {am_weather:w, am_temp:t, am_reason:r, am_at:e.am_at||new Date().toISOString()}); return {...e}; },
    async setPledge(p){ await wait(); const e = today(false); if(!e?.mission_id) throw new Error('아침 마음을 먼저 등록해 주세요.'); e.pledge = p; return {...e}; },
    async submitEvening(w,t,r,res,ref){ await wait(); const e = today(true);
      Object.assign(e, {pm_weather:w, pm_temp:t, pm_reason:r, mission_result:e.mission_id?res:null, reflection:ref}); return {...e}; },
    async people(){ return structuredClone(db.profiles); },
    async approve(id){ await wait(); const p = db.profiles.find(x => x.id===id); p.status = 'approved'; },
    async reject(id){ await wait(); db.profiles = db.profiles.filter(x => x.id!==id); },
    async updateStudent(id, f){ await wait();
      if(f.status==='approved' && db.profiles.some(x => x.id!==id && x.role==='student' && x.status!=='graduated' && x.class_id===f.class_id && x.number===f.number)) throw new Error('그 반·번호에 이미 다른 학생이 있어요.');
      Object.assign(db.profiles.find(x => x.id===id), f); },
    async setAdmin(id, v){ await wait();
      if(!v && db.profiles.filter(p => p.role==='teacher' && p.status==='approved' && p.is_admin).length <= 1 && db.profiles.find(p => p.id===id).is_admin) throw new Error('관리자는 최소 한 명은 있어야 해요.');
      db.profiles.find(p => p.id===id).is_admin = v; },
    async promote(){ await wait(); const maxg = Math.max(...db.classes.map(c => c.grade)); let up = 0, gr = 0;
      const act = db.profiles.filter(p => p.role==='student' && p.status!=='graduated');
      act.forEach(p => { const c = db.classes.find(x => x.id===p.class_id); if(!c) return;
        if(c.grade===maxg){ p.status = 'graduated'; gr++; }
        else { const n = db.classes.find(x => x.grade===c.grade+1 && x.class_no===c.class_no); if(n){ p.class_id = n.id; up++; } } });
      return `진급 ${up}명, 졸업 ${gr}명`; },
    async allEntries(){ return structuredClone(db.entries); },
    async addMission(text, grp){ const m = {id:Math.max(...db.missions.map(x=>x.id))+1, text, grp, active:true, sort:db.missions.length+1}; db.missions.push(m); return {...m}; },
    async setMissionActive(id, a){ db.missions.find(m => m.id===id).active = a; },
    async updateClass(id, f){ Object.assign(db.classes.find(c => c.id===id), f); },
    async resetPin(){ await wait(); },
    subscribe(){},
    async myReflections(uid){ return structuredClone(db.reflections.filter(r => r.student_id===uid)); },
    async allReflections(){ return structuredClone(db.reflections); },
    async saveReflection(kind, ref, answers){ await wait();
      let r = db.reflections.find(x => x.student_id===me.id && x.kind===kind && x.ref_key===ref);
      if(!r){ r = {id:db.reflections.length+1, student_id:me.id, kind, ref_key:ref}; db.reflections.push(r); }
      r.answers = answers; r.updated_at = new Date().toISOString(); return {...r}; },
    async myCounsels(uid){ return structuredClone(db.counsels.filter(c => c.student_id===uid).sort((a,b) => b.created_at.localeCompare(a.created_at))); },
    async allCounsels(){ return structuredClone(db.counsels.slice().sort((a,b) => b.created_at.localeCompare(a.created_at))); },
    async requestCounsel(f){ await wait(); const c = {id:Math.max(0,...db.counsels.map(x=>x.id))+1, student_id:me.id, class_id:me.class_id, entry_date:todayKST(),
        target:f.target, category:f.category, urgency:f.urgency, preferred_time:f.time, content:f.content, status:'new', teacher_note:null, created_at:new Date().toISOString()};
      db.counsels.push(c); return {...c}; },
    async cancelCounsel(id){ await wait(); const c = db.counsels.find(x => x.id===id); if(c.status!=='new') throw new Error('이미 선생님이 확인한 신청은 취소할 수 없어요.'); c.status = 'canceled'; },
    async updateCounsel(id, status, note){ await wait(); Object.assign(db.counsels.find(x => x.id===id), {status, teacher_note:note, handled_at:new Date().toISOString()}); },
  };
})();
const API = DEMO ? DemoAPI : RealAPI;

/* ===================================================================== 상태 */
const S = {
  me:null, classes:[], missions:[], entries:[],
  ui:{ authKind:APP_ROLE, authMode:'login', editAm:false, openPm:false, pledgeOpen:false, busy:false },
  t:{ students:[], entries:[], idx:{}, tab:'today', classId:'all', date:todayKST() },
};
const app = $('#app');
const classOf = id => S.classes.find(c => c.id === id);
const missionOf = id => S.missions.find(m => m.id === id);

/* ===================================================================== 공통 화면 조각 */
function topbar(extra=''){
  const me = S.me;
  const who = me.role==='student' ? `${classOf(me.class_id)?.name||''} ${me.number}번 ${esc(me.name)}` : `${esc(me.name)} <span class="badge">${me.is_admin ? '관리자' : '교사'}</span>`;
  return `<header class="top"><div class="top-in">
    <div class="brand">🌰 <span><span class="rose">마음</span> 특별한 <span class="rose">하루</span> 30일</span>${APP_ROLE==='teacher' ? '<span class="badge" style="margin-left:4px">관리</span>' : ''}</div>
    <div class="who">${DEMO?'<span class="badge demo">체험 모드</span>':''}${extra}<span class="nm">${who}</span>
      <button class="btn sm" data-act="logout">로그아웃</button></div>
  </div></header>`;
}
function slot(label, w, t, r){
  if(!w) return `<div class="slot empty"><div class="sl">${label}</div><div class="se" style="opacity:.25">○</div><div class="muted" style="font-size:13px">아직 기록하지 않았어요</div></div>`;
  return `<div class="slot" style="background:${WEATHER[w].c}"><div class="sl">${label}</div><div class="se">${WEATHER[w].e}</div>
    <div class="sn">${WEATHER[w].n} · ${t ?? WEATHER[w].t}°</div>${r ? `<div class="sr">“${esc(r)}”</div>` : ''}</div>`;
}
function entryDetailHTML(e, date, title=''){
  const head = `<h3>${title ? esc(title)+' · ' : ''}${fmtDate(date)}</h3>`;
  if(!e) return head + `<p class="muted">이 날은 기록이 없어요.</p>`;
  const c = change(e), m = missionOf(e.mission_id);
  return head + `
    <div class="flow">${slot('🌅 아침 조회', e.am_weather, e.am_temp, e.am_reason)}
      <div class="arrow" style="text-align:center">${c ? changeBadge(c) : '<span class="muted">→</span>'}</div>
      ${slot('🌇 저녁 종례', e.pm_weather, e.pm_temp, e.pm_reason)}</div>
    ${c ? `<p class="chgtext ${c.k}">${CHG_TEXT[c.k]}</p>` : ''}
    ${m ? `<div class="dbox" style="background:${GROUP[m.grp]}">
      <div class="lbl">🍬 오늘의 미션</div><div class="mt">${esc(m.text)}</div>
      <div class="ln">✍️ <b>나의 다짐</b> ${e.pledge ? esc(e.pledge) : '<span class="muted">도전하지 않았어요</span>'}</div>
      ${e.mission_result ? `<div class="ln">${RESULT[e.mission_result].e} <b>${RESULT[e.mission_result].n}</b></div>` : ''}
      ${e.reflection ? `<div class="ln">💬 ${esc(e.reflection)}</div>` : ''}</div>` : ''}`;
}
function calendarHTML(cls, byDate, opt={}){
  const days = periodDates(cls); if(!days.length) return '<p class="muted">기간이 설정되지 않았어요.</p>';
  const idx = Object.fromEntries(days.map((d,i) => [d, i+1]));
  const t = todayKST();
  let d = addDays(days[0], -dow(days[0]));
  const end = addDays(days[days.length-1], 6 - dow(days[days.length-1]));
  let h = `<div class="cal" ${opt.sid ? `data-sid="${opt.sid}"` : ''}>` + ['SUN','MON','TUE','WED','THU','FRI','SAT'].map((x,i) => `<div class="hd ${i===0?'sun':''}">${x}</div>`).join('');
  while(d <= end){
    const inP = !!idx[d], e = byDate[d], c = change(e);
    const label = (+d.slice(8,10) === 1 || d === days[0]) ? md(d) : +d.slice(8,10);
    h += `<div class="cal-cell ${inP?'in':'out'} ${d===t?'today':''} ${opt.sel===d?'sel':''}" ${inP ? `data-cal="${d}"` : ''}>
      <span class="cd">${label}</span>${inP ? `<span class="ci">${idx[d]}일</span>` : ''}
      ${e ? `<div class="cw"><span>${e.am_weather ? WEATHER[e.am_weather].e : '<span class="dim">○</span>'}</span><i>→</i><span>${e.pm_weather ? WEATHER[e.pm_weather].e : '<span class="dim">○</span>'}</span></div>
        ${c ? `<span class="cchg ${c.k}">${c.k==='up'?'▲':c.k==='down'?'▼':'＝'}${Math.abs(c.d)}</span>` : ''}
        ${e.mission_result === 'done' ? '<span class="candy" title="미션 성공 · 마음사탕">🍬</span>' : ''}` : ''}
    </div>`;
    d = addDays(d, 1);
  }
  return h + '</div>';
}
/* ---------- 자기성찰 도우미 ---------- */
const weekKey = d => addDays(d, -((dow(d) + 6) % 7));       // 그 주 월요일
const reflOf = (list, kind, key) => (list || []).find(r => r.kind === kind && r.ref_key === key);
const STOP = new Set(['오늘','그냥','너무','조금','진짜','정말','많이','그래서','때문','그리고','아침','저녁','하루','기분','마음','그런','이런','약간','완전','계속','다시','모두','우리','나는','내가','제가','저는']);
function words(txt){
  return String(txt || '').replace(/[^가-힣a-zA-Z0-9\s]/g, ' ').split(/\s+/)
    .map(w => w.replace(/(에서|에게|한테|이랑|하고|까지|부터|으로|처럼|은|는|이|가|을|를|에|도|랑|와|과|의|로|만|요)$/, ''))
    .filter(w => w.length >= 2 && !STOP.has(w) && !/(어요|아요|해요|했어|었어|았어|웠어|들어|네요|다|고|서|게|지|데|면)$/.test(w));
}
function topWords(list, n=3){
  const c = {}; list.forEach(t => new Set(words(t)).forEach(w => c[w] = (c[w]||0) + 1));
  return Object.entries(c).filter(([,v]) => v >= 2).sort((a,b) => b[1]-a[1]).slice(0, n).map(([w]) => w);
}
// 기록에서 '나의 마음 발견' 문장 만들기 (5일 이상 기록 필요)
function insightsFor(entries, days){
  const set = new Set(days), es = entries.filter(e => set.has(e.entry_date) && (e.am_weather || e.pm_weather));
  if(es.length < 5) return null;
  const out = [];
  const chs = es.map(e => ({e, c:change(e)})).filter(x => x.c);
  if(chs.length >= 3){
    const d = avg(chs.map(x => x.c.d));
    out.push(d >= 3 ? {i:'☀️', t:`하루를 보내고 나면 마음이 평균 <b>${d}° 맑아져요</b>. 학교에서의 하루가 마음을 데워 주고 있어요.`}
      : d <= -3 ? {i:'🌙', t:`하루를 보내고 나면 마음이 평균 <b>${-d}° 무거워지는</b> 편이에요. 저녁엔 나를 위한 쉼을 꼭 챙겨 주세요.`}
      : {i:'⚖️', t:`아침과 저녁 마음이 <b>비슷하게 유지되는</b> 편이에요. 마음이 꽤 단단하네요.`});
  }
  const pmT = x => tempOf(x, 'pm');
  const done = es.filter(e => e.mission_result === 'done' && pmT(e) != null), other = es.filter(e => e.mission_id && e.mission_result !== 'done' && pmT(e) != null);
  if(done.length >= 2 && other.length >= 2){
    const diff = avg(done.map(pmT)) - avg(other.map(pmT));
    out.push(diff >= 3 ? {i:'🍬', t:`미션을 해낸 날, 저녁 마음이 평균 <b>${diff}° 더 맑았어요</b>. 누군가를 위한 작은 행동이 내 마음도 밝혀 주나 봐요.`}
      : diff <= -3 ? {i:'🍬', t:`미션을 해낸 날 저녁이 오히려 <b>${-diff}° 낮았어요</b>. 미션이 부담됐던 건 아닌지 살펴봐요.`}
      : {i:'🍬', t:`미션을 한 날과 안 한 날의 저녁 마음은 <b>비슷했어요</b>.`});
  }
  const byDow = k => { const m = {}; es.forEach(e => { const v = tempOf(e, k); if(v != null) (m[dow(e.entry_date)] ||= []).push(v); });
    return Object.entries(m).filter(([,a]) => a.length >= 2).map(([d,a]) => [+d, avg(a)]); };
  const amD = byDow('am'), pmD = byDow('pm');
  if(amD.length >= 2){ const lo = amD.sort((a,b) => a[1]-b[1])[0]; out.push({i:'📅', t:`<b>${DOW[lo[0]]}요일 아침</b>이 가장 흐린 편이에요 (평균 ${lo[1]}°). 그날 아침엔 나에게 조금 더 다정하게!`}); }
  if(pmD.length >= 2){ const hi = pmD.sort((a,b) => b[1]-a[1])[0]; out.push({i:'🌈', t:`<b>${DOW[hi[0]]}요일 저녁</b>이 가장 맑아요 (평균 ${hi[1]}°).`}); }
  const ups = chs.filter(x => x.c.k === 'up').map(x => x.e), downs = chs.filter(x => x.c.k === 'down').map(x => x.e);
  const uw = topWords(ups.map(e => [e.pm_reason, e.reflection].join(' ')));
  if(uw.length) out.push({i:'💬', t:`마음이 맑아진 날 자주 나온 말: <b>${uw.map(esc).join(', ')}</b>. 나를 맑게 하는 것들이에요.`});
  const dw = topWords(downs.map(e => e.pm_reason));
  if(dw.length) out.push({i:'🌧️', t:`마음이 무거워진 날 자주 나온 말: <b>${dw.map(esc).join(', ')}</b>. 이럴 때 나에게 필요한 건 무엇일까요?`});
  const best = chs.filter(x => x.c.k === 'up').sort((a,b) => b.c.d - a.c.d)[0];
  if(best) out.push({i:'✨', t:`가장 크게 맑아진 날은 <b>${fmtDate(best.e.entry_date)}</b> (▲${best.c.d}°)${best.e.pm_reason ? ` — “${esc(best.e.pm_reason)}”` : ''}`});
  return out;
}
function insightsHTML(list, n){
  if(!list) return `<p class="muted">기록이 <b>5일</b> 이상 쌓이면 내 마음의 패턴을 찾아 드릴게요.</p>`;
  return `<ul class="ins">${list.map(x => `<li><span>${x.i}</span><div>${x.t}</div></li>`).join('')}</ul>`;
}
// 교사 화면·출력용 성찰 기록 모아 보기
function reflectionsHTML(list, cls){
  const key = cls?.start_date;
  const ls = reflOf(list, 'letter_start', key), le = reflOf(list, 'letter_end', key);
  const ws = (list || []).filter(r => r.kind === 'weekly').sort((a,b) => a.ref_key.localeCompare(b.ref_key));
  let h = '';
  if(ls || le) h += `<div class="letter"><div class="lt">📮 30일 뒤의 나에게</div><p>${ls ? esc(ls.answers.text) : '<span class="muted">(쓰지 않았어요)</span>'}</p>
    ${le ? `<div class="lt">📬 30일 전의 나에게</div><p>${esc(le.answers.reply || '')}</p>
      ${(le.answers.warm||[]).filter(Boolean).length ? `<div class="lt">🤍 나에게 들려주고 싶은 따뜻한 말</div><ul class="warm">${le.answers.warm.filter(Boolean).map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}` : ''}</div>`;
  if(ws.length) h += ws.map(w => `<div class="wk"><div class="lt">🗓️ ${md(w.ref_key)} 주 돌아보기</div>${W_Q.map(([k,q]) => w.answers[k] ? `<div class="wq"><span>${q}</span>${esc(w.answers[k])}</div>` : '').join('')}</div>`).join('');
  return h || '<p class="muted">아직 성찰 기록이 없어요.</p>';
}

/* ---------- PDF 저장 / 인쇄용 리포트 ---------- */
function printReport(p, entries, cls, refls=[]){
  const byDate = Object.fromEntries(entries.map(e => [e.entry_date, e]));
  const days = periodDates(cls), t = todayKST(), past = days.filter(d => d <= t);
  const es = days.map(d => byDate[d]).filter(Boolean);
  const chs = es.map(change).filter(Boolean);
  const am = avg(es.map(e => tempOf(e,'am')).filter(v => v!=null)), pm = avg(es.map(e => tempOf(e,'pm')).filter(v => v!=null));
  const rows = days.filter(d => byDate[d]).map(d => { const e = byDate[d], m = missionOf(e.mission_id), c = change(e);
    return `<tr><td class="nw">${md(d)} (${DOW[dow(d)]})</td>
      <td class="em">${e.am_weather ? WEATHER[e.am_weather].e+' '+tempOf(e,'am')+'°' : '–'}</td><td>${esc(e.am_reason||'')}</td>
      <td class="em">${e.pm_weather ? WEATHER[e.pm_weather].e+' '+tempOf(e,'pm')+'°' : '–'}</td><td>${esc(e.pm_reason||'')}</td>
      <td class="nw">${c ? (c.k==='up'?'▲':c.k==='down'?'▼':'＝')+Math.abs(c.d) : ''}</td>
      <td>${m ? esc(m.text) : ''}${e.pledge ? `<div class="sub">다짐: ${esc(e.pledge)}</div>` : ''}${e.mission_result ? `<div class="sub">${RESULT[e.mission_result].e} ${RESULT[e.mission_result].n}${e.reflection ? ' · '+esc(e.reflection) : ''}</div>` : ''}</td></tr>`; }).join('');
  let area = $('#print-area'); if(!area){ area = document.createElement('div'); area.id = 'print-area'; document.body.appendChild(area); }
  area.innerHTML = `<div class="pr-head"><div><div class="pr-title">🌰 마음 특별한 하루 30일</div>
      <div class="pr-who">${cls.name} ${p.number}번 ${esc(p.name)}</div></div>
      <div class="pr-meta">기간 ${md(days[0])} ~ ${md(days[days.length-1])}<br>출력일 ${fmtDate(t)}</div></div>
    <div class="pr-stats">
      <div><b>${es.length}</b> / ${days.length}일<span>기록한 날</span></div>
      <div><b>${am ?? '–'}° → ${pm ?? '–'}°</b><span>평균 마음 온도 (아침→저녁)</span></div>
      <div><b>▲${chs.filter(c=>c.k==='up').length} ▼${chs.filter(c=>c.k==='down').length}</b><span>맑아진 날 / 무거워진 날</span></div>
      <div><b>🍬 ${es.filter(e=>e.mission_result==='done').length}</b><span>마음사탕 (미션 성공)</span></div>
    </div>
    ${calendarHTML(cls, byDate)}
    <div class="pr-chart">${lineChart(past, [{name:'아침', color:'#E39A2D', values:past.map(d=>tempOf(byDate[d],'am'))},{name:'저녁', color:'#6366C1', values:past.map(d=>tempOf(byDate[d],'pm'))}], 170)}</div>
    <h3 class="pr-h">날짜별 기록</h3>
    <table class="pr-tbl"><thead><tr><th>날짜</th><th colspan="2">🌅 아침 · 이유</th><th colspan="2">🌇 저녁 · 이유</th><th>변화</th><th>🍬 미션 · 다짐 · 결과</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" style="text-align:center">기록이 없어요</td></tr>'}</tbody></table>
    <div class="pr-break"></div>
    <h3 class="pr-h">🔍 나의 마음 발견</h3>${insightsHTML(insightsFor(entries, days))}
    <h3 class="pr-h">🪞 나를 돌아본 기록</h3>${reflectionsHTML(refls, cls)}`;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 100);
}

function lineChart(labels, series, H=220){
  const n = labels.length; if(!n) return '<p class="muted">아직 데이터가 없어요.</p>';
  const W = Math.max(860, n*34), L=34, R=14, T=12, B=28, iw=W-L-R, ih=H-T-B;
  const x = i => L + (n<=1 ? iw/2 : i*iw/(n-1)), y = v => T + ih - v/100*ih;
  let g = '';
  [0,25,50,75,100].forEach(v => g += `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#EDE3D9" stroke-width="1"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#A39388">${v}</text>`);
  const step = Math.ceil(n/14);
  labels.forEach((l,i) => { if(i%step===0 || i===n-1) g += `<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="11" fill="#A39388">${md(l)}</text>`; });
  series.forEach(s => {
    let p = '', pen = false;
    s.values.forEach((v,i) => { if(v==null){ pen=false; return; } p += `${pen?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; });
    g += `<path d="${p}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.values.forEach((v,i) => { if(v!=null) g += `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="#fff" stroke="${s.color}" stroke-width="2"><title>${md(labels[i])} ${s.name} ${v}°</title></circle>`; });
  });
  return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:${Math.min(W,560)}px;display:block" role="img" aria-label="마음 온도 추이">${g}</svg></div>
    <div class="lg" style="margin-top:6px">${series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>`;
}

/* ===================================================================== 로그인 (페이지별 역할 고정) */
function renderLogin(err=''){
  const st = APP_ROLE === 'student', su = S.ui.authMode === 'signup';
  app.innerHTML = `<div class="login">
    <div class="hero"><div class="acorn">${st ? '🌰' : '🍎'}</div>
      <h1><span class="rose">마음</span> 특별한<br><span class="rose">하루</span> 30일</h1>
      <p class="muted">${st ? '아침엔 하루를 여는 마음, 저녁엔 하루를 닫는 마음' : '선생님용 관리 페이지'}</p></div>
    ${DEMO ? `<div class="demo-box"><b>🧪 체험 모드</b><br>아직 Supabase가 연결되지 않아 예시 데이터로 보여드려요. (새로고침하면 초기화돼요)
      <div class="btns"><button class="btn primary" data-act="demo">${st ? '학생으로 체험하기' : '교사로 체험하기'}</button></div></div>` : ''}
    <div class="card">
      <h2 style="text-align:center">${su ? (st ? '처음 등록하기' : '선생님 계정 만들기') : (st ? '🎒 들어가기' : '🍎 선생님 로그인')}</h2>
      <form id="auth-form" autocomplete="off">
        <label class="field"><span>아이디 ${su ? '(영어 소문자·숫자 3~20자)' : ''}</span><input name="loginid" required autocapitalize="none" autocomplete="username" placeholder="${st ? '예: haneul15' : '예: kimteacher'}"></label>
        <label class="field"><span>비밀번호 (6자리 이상)</span><input name="pin" type="password" minlength="6" required autocomplete="${su ? 'new-password' : 'current-password'}"></label>
        ${su ? `${st ? `<div class="row2"><label class="field"><span>학급</span><select name="classId">${S.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></label>
          <label class="field"><span>번호</span><input name="number" type="number" min="1" max="60" inputmode="numeric" required placeholder="예: 15"></label></div>` : ''}
          <label class="field"><span>이름</span><input name="name" required maxlength="20"></label>
          <label class="field"><span>가입 코드 (올해 학년도 숫자)</span><input name="code" required inputmode="numeric" placeholder="예: ${schoolYear()}"></label>
          <p class="muted" style="font-size:12px;margin:-4px 0 6px">신청하면 ${st ? '선생님' : '관리자'}이 승인한 뒤에 사용할 수 있어요.</p>` : ''}
        <div class="err">${esc(err)}</div>
        <button class="btn primary big" type="submit">${su ? '가입 신청하기' : '들어가기'}</button>
      </form>
      <p style="text-align:center;margin:12px 0 0"><button class="btn ghost sm" data-act="auth-mode">${su ? '이미 등록했어요 → 로그인' : '처음이에요 → 등록하기'}</button></p>
    </div></div>`;
}
async function onAuthSubmit(f){
  const el = f.elements;
  const a = { classId:el.classId?.value, number:el.number ? +el.number.value : null, id:el.loginid?.value.trim(), name:el.name?.value.trim(), code:el.code?.value.trim() };
  const pin = el.pin.value;
  if(S.ui.authMode === 'signup' && !ID_RULE.test(cleanId(a.id))) return renderLogin('아이디는 영어 소문자·숫자·_ 로 3~20자로 정해 주세요.');
  f.querySelector('button[type=submit]').disabled = true;
  try{
    const me = S.ui.authMode === 'signup' ? await API.signUp(APP_ROLE, a, pin) : await API.signIn(APP_ROLE, a, pin);
    await enter(me);
  }catch(e){ renderLogin(e.message); }
}

/* ===================================================================== 공통 이벤트 */
document.addEventListener('click', async ev => {
  if(ev.target === $('#modal')) return closeModal();
  const a = ev.target.closest('[data-act]'); if(!a) return;
  const act = a.dataset.act;
  if(act === 'close-modal') return closeModal();
  if(act === 'demo'){ const me = await DemoAPI.loginAs(APP_ROLE); return enter(me); }
  if(act === 'recheck'){ const me = await API.session(); if(me && me.status === 'approved') return enter(me); return toast('아직 승인 전이에요. 조금만 기다려 주세요.'); }
  if(act === 'auth-mode'){ S.ui.authMode = S.ui.authMode === 'login' ? 'signup' : 'login'; return renderLogin(); }
  if(act === 'logout'){ await API.signOut(); S.me = null; S.ui = {...S.ui, editAm:false, openPm:false, pledgeOpen:false}; closeModal(); return renderLogin(); }
});
document.addEventListener('submit', ev => { if(ev.target.getAttribute('id') === 'auth-form'){ ev.preventDefault(); onAuthSubmit(ev.target); } });
document.addEventListener('keydown', ev => { if(ev.key === 'Escape') closeModal(); });

/* ===================================================================== 시작 */
async function enter(me){
  if(me.role !== APP_ROLE){
    // 다른 역할 계정으로 들어온 경우: 이 페이지에서는 로그아웃
    await API.signOut(); S.me = null;
    return renderLogin(APP_ROLE === 'teacher' ? '학생 계정은 선생님 페이지에 들어올 수 없어요.' : '선생님 계정이에요. 선생님용 페이지(teacher.html)에서 로그인해 주세요.');
  }
  S.me = me;
  if(me.status !== 'approved') return renderWaiting(me);
  try{
    S.missions = await API.missions();
    await startApp();   // student.js / teacher.js 에서 정의
  }catch(e){ fatal(e); }
}
function renderWaiting(me){
  const grad = me.status === 'graduated';
  app.innerHTML = `<div class="login"><div class="hero"><div class="acorn">${grad ? '🎓' : '⏳'}</div></div>
    <div class="card" style="text-align:center"><h2>${grad ? '졸업을 축하해요!' : '가입 신청이 접수됐어요'}</h2>
    <p>${grad ? '졸업한 계정이라 더 이상 기록할 수 없어요.' : `<b>${esc(me.name)}</b>님, ${me.role==='student' ? '선생님' : '관리자'}이 승인하면 바로 사용할 수 있어요.`}</p>
    ${!grad ? `<p class="muted" style="font-size:13px">아이디: <b>${esc(me.login_id||'')}</b>${me.role==='student' ? ` · ${classOf(me.class_id)?.name||''} ${me.number}번` : ''}</p>` : ''}
    <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
      ${!grad ? '<button class="btn primary" data-act="recheck">승인됐는지 확인</button>' : ''}<button class="btn" data-act="logout">로그아웃</button></div></div></div>`;
}
function fatal(e){
  app.innerHTML = `<div class="login"><div class="card"><h2>앗, 연결에 문제가 있어요</h2><p>${esc(e.message)}</p>
    <p class="muted" style="font-size:13px">선생님: Supabase SQL Editor에서 schema.sql을 실행했는지, config.js의 SUPABASE_URL과 키가 맞는지 확인해 주세요.</p>
    <button class="btn" onclick="location.reload()">다시 시도</button></div></div>`;
}
async function boot(){
  if(!DEMO && !sb) return fatal(new Error('Supabase 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
  try{
    S.classes = await API.classes();
    const me = await API.session();
    if(me) await enter(me); else renderLogin();
  }catch(e){ fatal(e); }
}
