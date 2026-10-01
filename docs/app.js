/* =====================================================================
 *  상담 수첩 — 본체 app.js  v1.0 (2026-10-01)
 *  여주시농업기술센터 현장 상담 기록용. 이사돔의 상담(사전 정보 → 현장 답사 → 자료 정리 → 후속 조치)을 따로 떼어 만든 앱입니다.
 *   - 자료(상담·농가·사진)는 이 기기 안(IndexedDB)에만. 서버 없음. 핸드폰 앱(apk)과 PC 브라우저가 같은 파일을 씁니다.
 *   - 핸드폰(390px)은 한 칸 + 아래 탭 줄, PC(900px 넘음)는 두 칸(왼쪽 목록 · 오른쪽 건).
 *   - 비밀번호: 처음 한 번 정하고, 열 때마다(그리고 10분 넘게 다른 앱에 갔다 오면) 넣습니다. 잠근 값만 남고 되찾을 수 없음.
 *   - PC 와 맞추기·백업 파일은 sync.js (이 파일 뒤에 읽힘).
 * ===================================================================== */
(function(){
'use strict';
const APP_VER='v1.0.2 (2026-10-01)';
const q=(s,r)=>(r||document).querySelector(s), qa=(s,r)=>[...(r||document).querySelectorAll(s)];
const E=s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const CR=globalThis.ISDCRYPT, ST=window.STORE;
const inApp=!!(window.SangdamApp&&typeof SangdamApp.version==='function');
const ROLE=inApp?'phone':'pc';                              /* apk 안이면 핸드폰, 브라우저면 PC */
const FLAVOR=(inApp&&typeof SangdamApp.flavor==='function')?String(SangdamApp.flavor()||''):'';   /* 아이콘 맛(apple·chamoe …) — 잠금 화면 그림을 앱 아이콘과 맞춤 */
const ICON=(FLAVOR&&FLAVOR!=='apple')?`icon-${FLAVOR}-192.png`:'icon-192.png';
const isPC=()=>window.matchMedia('(min-width: 900px)').matches;
const iso=()=>new Date().toISOString();
const pad=n=>String(n).padStart(2,'0');
const today=()=>{ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const addDays=(ymd,n)=>{ const d=new Date(ymd+'T00:00:00'); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const uid=()=>(ROLE==='phone'?'p':'c')+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clone=o=>JSON.parse(JSON.stringify(o));
const md=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||''); return m?`${m[2]}.${m[3]}`:''; };
const kd=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||''); return m?`${+m[2]}월 ${+m[3]}일`:''; };
const DAYS=['일','월','화','수','목','금','토'];
const kdw=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||''); if(!m) return ''; const d=new Date(s+'T00:00:00'); return `${+m[2]}월 ${+m[3]}일 (${DAYS[d.getDay()]})`; };
const PARTS={pre:'사전 정보',visit:'현장 답사',ref:'자료 정리',follow:'후속 조치'};
const DEFAULT_TAGS=[{n:'병해충',end:false},{n:'토양',end:false},{n:'과수',end:false},{n:'완료',end:true}];

/* ---------- 자료 ---------- */
let DB=null, ME={name:''}, SY=null, AUTH=null;
function normDB(d){ d=d&&typeof d==='object'?d:{}; const o={v:1,tags:[],farms:[],consults:[],photos:[]};
  o.tags=(Array.isArray(d.tags)&&d.tags.length?d.tags:DEFAULT_TAGS).map(t=>typeof t==='string'?{n:t,end:t==='완료'}:{n:String(t.n||''),end:!!t.end}).filter(t=>t.n);
  o.farms=(d.farms||[]).map(mkFarm); o.consults=(d.consults||[]).map(mkConsult); o.photos=(d.photos||[]).map(mkPhoto); return o; }
function mkFarm(f){ f=f||{}; return {id:f.id||uid(),name:String(f.name||''),tel:String(f.tel||''),addr:String(f.addr||''),crop:String(f.crop||''),memo:String(f.memo||''),made:f.made||iso(),u:f.u||f.made||iso()}; }
function mkRef(r){ r=r||{}; return {id:r.id||uid(),title:String(r.title||''),date:String(r.date||''),memo:String(r.memo||'')}; }
function mkConsult(c){ c=c||{}; return {id:c.id||uid(),fid:c.fid||null,title:String(c.title||''),date:String(c.date||''),crop:String(c.crop||''),issue:String(c.issue||''),memo:String(c.memo||''),tags:Array.isArray(c.tags)?c.tags.slice():[],
  visit:{date:String((c.visit||{}).date||''),memo:String((c.visit||{}).memo||'')},refs:(c.refs||[]).map(mkRef),follow:{date:String((c.follow||{}).date||''),memo:String((c.follow||{}).memo||''),next:String((c.follow||{}).next||'')},made:c.made||iso(),u:c.u||c.made||iso()}; }
function mkPhoto(p){ p=p||{}; return {id:p.id||uid(),c:p.c||null,part:p.part||'pre',r:p.r||null,name:String(p.name||'사진'),type:String(p.type||'image/jpeg'),size:+p.size||0,w:+p.w||0,h:+p.h||0,added:p.added||iso(),u:p.u||p.added||iso()}; }
function normSY(d){ d=d&&typeof d==='object'?d:{}; const o={v:1,tomb:{farm:{},consult:{},photo:{}},peerHave:Array.isArray(d.peerHave)?d.peerHave.slice():[],last:{sent:String((d.last&&d.last.sent)||''),recv:String((d.last&&d.last.recv)||'')},log:Array.isArray(d.log)?d.log.slice(0,30):[],mail:null,backupAt:String(d.backupAt||'')};
  ['farm','consult','photo'].forEach(t=>{ o.tomb[t]=(d.tomb&&d.tomb[t]&&typeof d.tomb[t]==='object')?d.tomb[t]:{}; });
  const m=d.mail; if(m&&typeof m==='object'&&m.owner) o.mail={owner:String(m.owner||''),repo:String(m.repo||''),branch:String(m.branch||'main'),token:String(m.token||''),api:String(m.api||''),pw:String(m.pw||''),on:!!m.on,
    gotSha:String(m.gotSha||''),mySha:String(m.mySha||''),pushedSig:String(m.pushedSig||''),lastPull:String(m.lastPull||''),lastPush:String(m.lastPush||''),err:String(m.err||''),errAt:String(m.errAt||''),peerName:String(m.peerName||''),log:Array.isArray(m.log)?m.log.slice(0,20):[]};
  return o; }
const farmOf=id=>DB.farms.find(f=>f.id===id)||null;
const consultOf=id=>DB.consults.find(c=>c.id===id)||null;
const photoOf=id=>DB.photos.find(p=>p.id===id)||null;
const tagOf=n=>DB.tags.find(t=>t.n===n)||null;
const isEnd=c=>c.tags.some(n=>{ const t=tagOf(n); return t&&t.end; });
const photosOf=(c,part,r)=>DB.photos.filter(p=>p.c===c.id&&(part==null||p.part===part)&&(r==null||p.r===r)).sort((a,b)=>a.added<b.added?-1:1);
const consultsOfFarm=f=>DB.consults.filter(c=>c.fid===f.id).sort(byDate);
function byDate(a,b){ return (b.date>a.date?1:(b.date<a.date?-1:0))||(b.made>a.made?1:(b.made<a.made?-1:0)); }
function prog(c){ return {pre:!!(c.issue.trim()||c.memo.trim()||c.crop.trim()||photosOf(c,'pre').length),visit:!!(c.visit.date||c.visit.memo.trim()||photosOf(c,'visit').length),refs:c.refs.length,follow:!!(c.follow.date||c.follow.memo.trim()||c.follow.next||photosOf(c,'follow').length)}; }
function isEmptyConsult(c){ const p=prog(c); return !c.title.trim()&&!c.fid&&!p.pre&&!p.visit&&!p.refs&&!p.follow&&!c.tags.length&&!photosOf(c).length; }
function textOf(c){ const f=farmOf(c.fid); return [c.title,f&&f.name,f&&f.addr,f&&f.tel,c.crop,c.issue,c.memo,c.tags.join(' '),c.visit.memo,c.follow.memo,...c.refs.map(r=>r.title+' '+r.memo)].filter(Boolean).join('\n').toLowerCase(); }
const touch=o=>{ o.u=iso(); };

/* ---------- 저장 (바뀌면 0.3초 뒤에 한꺼번에) ---------- */
let saveT=null, DIRTY=false;
function save(){ DIRTY=true; clearTimeout(saveT); saveT=setTimeout(saveNow,200); }
async function saveNow(){ clearTimeout(saveT); if(!DB) return; DIRTY=false; try{ await ST.kvSet('db',DB); await ST.kvSet('sy',SY); }catch(e){ console.warn('save',e); toast('저장하지 못했습니다: '+(e&&e.message||e)); } }
window.addEventListener('pagehide',()=>{ if(DIRTY) saveNow(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&DIRTY) saveNow(); });

/* ---------- 화면 틀: 어디를 보고 있나 ---------- */
let TAB='list', VIEW={v:'list',id:null}, LAST_INPUT=0;
const LV={q:'',tag:''}, FV={q:''};                     /* 목록 거르기 */
const leftOf=v=>({list:'list',detail:'list',farms:'farms',farm:'farms',photos:'photos',sync:'list',tags:'list'})[v]||'list';
const isRight=v=>v==='detail'||v==='farm'||v==='sync'||v==='tags';
/* 화면 역사: 왼쪽 탭끼리는 바꿔 치고(replace), 건·농가·맞추기·태그로 들어갈 때만 쌓습니다(push) → 안드로이드 뒤로 가기가 자연스럽게 되돌아가고, 바닥에서는 앱이 닫힙니다 */
let DEPTH=0;
function go(v,id,opt){ opt=opt||{}; const prev=VIEW; VIEW={v,id:id||null};
  const left=(v==='list'||v==='farms'||v==='photos'); if(left) TAB=v;
  if(!opt.noHist){ try{ if(left&&!isRight(prev.v)){ history.replaceState({v,id:null,d:DEPTH},''); } else if(left){ if(DEPTH>0){ DEPTH=0; history.replaceState({v,id:null,d:0},''); } else history.replaceState({v,id:null,d:0},''); } else { DEPTH++; history.pushState({v,id:id||null,d:DEPTH},''); } }catch(e){} }
  if(prev.v==='detail'&&(v!=='detail'||prev.id!==id)) dropEmpty(prev.id);
  render(); if(!opt.keepScroll) window.scrollTo(0,0); }
function goBack(){ if(DEPTH>0) history.back(); else go(leftOf(VIEW.v)); }
window.addEventListener('popstate',e=>{ const s=e.state; if(s&&s.v){ const prev=VIEW; VIEW={v:s.v,id:s.id||null}; DEPTH=Math.max(0,+s.d||0); if(s.v==='list'||s.v==='farms'||s.v==='photos') TAB=s.v; if(prev.v==='detail') dropEmpty(prev.id); render(); } });
function render(){
  if(!DB) return;
  const pc=isPC();
  const pages={list:'page-list',farms:'page-farms',photos:'page-photos',detail:'page-detail',farm:'page-farm',sync:'page-sync',tags:'page-tags'};
  Object.keys(pages).forEach(k=>{ const el=q('#'+pages[k]); if(!el) return; const on=pc?((k===TAB)||(isRight(k)&&VIEW.v===k)):(VIEW.v===k); el.classList.toggle('on',on); });
  const rh=q('#rhint'); if(rh) rh.hidden=!(pc&&!isRight(VIEW.v));
  if(pc){ if(TAB==='list') drawList(); if(TAB==='farms') drawFarms(); if(TAB==='photos') drawPhotos(); }
  const v=VIEW.v;
  if(v==='list'&&!pc) drawList(); if(v==='farms'&&!pc) drawFarms(); if(v==='photos'&&!pc) drawPhotos();
  if(v==='detail') drawDetail(); if(v==='farm') drawFarm(); if(v==='sync'&&window.SYNC) SYNC.drawPage(q('#page-sync')); if(v==='tags') drawTags();
  qa('#pbar [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===(isRight(v)&&v!=='detail'&&v!=='farm'?'more':leftOf(v))));
  qa('#ptabs [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===(isRight(v)&&(v==='sync'||v==='tags')?v:TAB)));
  const nm=q('#meName'); if(nm) nm.textContent=ME.name||'';
}
/* 창 크기가 바뀔 때: 핸드폰 ↔ PC 배치가 바뀌는 경우(900px 경계)에만 다시 그립니다.
 *  ※ 안드로이드는 자판이 올라올 때마다 창 높이가 바뀌어 resize 가 오는데, 그때마다 다시 그리면 글자 칸이 새로 만들어져 커서가 날아가고 자판이 깜빡입니다 (10/1 유진 핸드폰에서 발견) */
let LAST_PC=isPC();
window.addEventListener('resize',()=>{ clearTimeout(window.__rz); window.__rz=setTimeout(()=>{ const pc=isPC(); if(pc!==LAST_PC){ LAST_PC=pc; render(); } },120); });
qa('#pbar [data-tab], #ptabs [data-tab]').forEach(b=>b.addEventListener('click',()=>{ const t=b.dataset.tab; if(t==='more'){ openSheet(); return; } go(t); }));
q('#pcMore').addEventListener('click',openSheet);

/* ---------- 목록 ---------- */
function filteredConsults(){ let L=DB.consults.slice(); const s=LV.q.trim().toLowerCase(); if(s) L=L.filter(c=>textOf(c).includes(s)); if(LV.tag==='__open') L=L.filter(c=>!isEnd(c)); else if(LV.tag) L=L.filter(c=>c.tags.includes(LV.tag)); return L; }
function dueItems(){ const lim=addDays(today(),3); return DB.consults.filter(c=>c.follow.next&&c.follow.next<=lim&&!isEnd(c)).sort((a,b)=>a.follow.next<b.follow.next?-1:1).slice(0,6); }
function rowHTML(c,sel){ const f=farmOf(c.fid), p=prog(c), n=photosOf(c).length, end=isEnd(c);
  return `<div class="nrow ${end?'end':''} ${sel?'sel':''}" data-open="${c.id}"><span class="ttl">${E(c.title)||'<span class="faint">(제목 없음)</span>'}</span><span class="dt">${md(c.date)||'<span class="faint">날짜 없음</span>'}</span>
    <span class="fm">${f?E(f.name):'<span class="faint">농가 없음</span>'}${f&&f.addr?`<small>${E(f.addr)}</small>`:''}${c.crop?`<small>· ${E(c.crop)}</small>`:''}</span>
    <span class="iss">${E(c.issue)||'<span style="opacity:.6">고민 요약 없음</span>'}</span>
    <div class="foot">${c.tags.map(t=>{const x=tagOf(t);return `<span class="stag ${x&&x.end?'end':''}">${E(t)}</span>`;}).join('')}<span class="dots"><span class="${p.pre?'d':''}">사전</span><span class="${p.visit?'d':''}">답사</span><span class="${p.refs?'d':''}">자료${p.refs?' '+p.refs:''}</span><span class="${p.follow?'d':''}">후속</span></span><span class="clip">📎${n}</span></div></div>`; }
function listBodyHTML(){ const L=filteredConsults(); const act=L.filter(c=>!isEnd(c)).sort(byDate), end=L.filter(isEnd).sort(byDate); const due=dueItems(); const sel=VIEW.v==='detail'?VIEW.id:null;
  return `${due.length&&!LV.q&&!LV.tag?`<div class="due"><b class="t">다시 볼 날</b>${due.map(c=>{ const f=farmOf(c.fid), late=c.follow.next<today(), isT=c.follow.next===today(); return `<div class="it" data-open="${c.id}"><span class="d ${late?'late':''}">${late?'지남':isT?'오늘':md(c.follow.next).replace(/^0/,'').replace('.0','.')}</span><span>${f?E(f.name)+' · ':''}${E(c.title)||'(제목 없음)'}${c.follow.memo.trim()?' — '+E(c.follow.memo.trim().split('\n')[0].slice(0,40)):''}</span></div>`; }).join('')}</div>`:''}
    ${DB.consults.length?`<div class="nlist">${act.map(c=>rowHTML(c,c.id===sel)).join('')}${end.length?`<div class="divider">끝난 상담 ${end.length}</div>${end.map(c=>rowHTML(c,c.id===sel)).join('')}`:''}${!act.length&&!end.length?'<div class="empty">조건에 맞는 상담이 없습니다.</div>':''}</div>`:'<div class="empty">아직 상담이 없습니다.<br>[+ 새 상담]으로 첫 상담을 적어 보세요.</div>'}`; }
function chipsHTML(){ const nOpen=DB.consults.filter(c=>!isEnd(c)).length; const cnt=n=>DB.consults.filter(c=>c.tags.includes(n)).length;
  return `<button type="button" class="chip ${!LV.tag?'on':''}" data-ctag="">전부 ${DB.consults.length}</button><button type="button" class="chip ${LV.tag==='__open'?'on':''}" data-ctag="__open">진행중 ${nOpen}</button>${DB.tags.map(t=>`<button type="button" class="chip ${LV.tag===t.n?'on':''}" data-ctag="${E(t.n)}">${E(t.n)} ${cnt(t.n)}</button>`).join('')}`; }
/* 글자를 치는 동안에는 찾기 칸을 절대 새로 만들지 않습니다 (새로 만들면 커서가 날아가고 핸드폰 자판이 깜빡임) — 목록 부분(#lbody)만 바꿉니다 */
function drawListBody(){ const pg=q('#page-list'); const b=q('#lbody',pg); if(!b){ drawList(); return; } b.innerHTML=listBodyHTML(); const ch=q('#lchips',pg); if(ch) ch.innerHTML=chipsHTML(); const x=q('#lqx',pg); if(x) x.hidden=!LV.q; }
function drawList(){ const pg=q('#page-list');
  if(q('#lbody',pg)&&document.activeElement&&document.activeElement.id==='lq'){ drawListBody(); return; }   /* 찾기 칸에 커서가 있으면 틀은 두고 속만 */
  pg.innerHTML=`<div class="srch"><input id="lq" placeholder="농가 · 제목 · 내용으로 찾기" value="${E(LV.q)}" autocomplete="off"><button type="button" class="btn" id="lqx" ${LV.q?'':'hidden'}>지우기</button></div>
    <div class="chips" id="lchips">${chipsHTML()}</div>
    <button type="button" class="fab phoneonly" id="newC">+ 새 상담</button>
    <div id="lbody">${listBodyHTML()}</div>`;
  if(isPC()){ const fab=q('#newC',pg); fab.classList.remove('phoneonly'); pg.insertBefore(fab,q('#lbody',pg)); }
}
q('#page-list').addEventListener('input',e=>{ if(e.target.id==='lq'){ LV.q=e.target.value; clearTimeout(window.__lq); window.__lq=setTimeout(drawListBody,150); } });
q('#page-list').addEventListener('click',e=>{ const t=e.target;
  if(t.id==='lqx'){ LV.q=''; const i=q('#lq'); if(i) i.value=''; drawListBody(); return; }
  if(t.id==='newC'){ newConsult(null); return; }
  const ch=t.closest('[data-ctag]'); if(ch){ LV.tag=ch.dataset.ctag; drawListBody(); return; }
  const op=t.closest('[data-open]'); if(op){ go('detail',op.dataset.open); return; } });
function newConsult(fid){ const c=mkConsult({fid:fid||null,date:today()}); DB.consults.push(c); save(); go('detail',c.id); setTimeout(()=>{ const i=q('#page-detail .ttlin'); if(i) i.focus(); },50); }
function dropEmpty(id){ const c=consultOf(id); if(c&&isEmptyConsult(c)){ DB.consults=DB.consults.filter(x=>x!==c); save(); } }   /* 아무것도 안 적은 새 상담은 나가면 지움 (장부에 안 남김) */

/* ---------- 건 안 ---------- */
function thumbsHTML(c,part,r){ const ps=photosOf(c,part,r); return `<div class="thumbs" data-part="${part}" data-r="${r||''}">${ps.map(p=>`<button type="button" class="thumb" data-view="${p.id}" title="${E(p.name)}"><img data-thumb="${p.id}" alt=""></button>`).join('')}<button type="button" class="thumb add" data-add="${part}" data-radd="${r||''}">+ 사진</button></div>`; }
function drawDetail(){ const pg=q('#page-detail'); const c=consultOf(VIEW.id); if(!c){ pg.innerHTML='<div class="empty">이 상담은 지워졌습니다.</div>'; return; } const f=farmOf(c.fid);
  pg.innerHTML=`<div class="chead"><button type="button" class="btn sm" data-act="back">← 상담 목록</button><span class="faint">상담</span><span class="sp"></span><button type="button" class="btn sm ghost danger" data-act="del">이 상담 지우기</button></div>
    <input class="ttlin" data-k="title" value="${E(c.title)}" placeholder="제목 — 예: 배 잎 가장자리 갈변" maxlength="120">
    <div class="farmline"><button type="button" class="farmbtn ${f?'':'none'}" data-act="farm">${f?E(f.name):'농가 고르기'}</button>${f&&f.tel?`<a class="callbtn" href="tel:${E(f.tel.replace(/[^0-9+]/g,''))}">📞 ${E(f.tel)}</a>`:''}${f?`<button type="button" class="lnk" data-act="farmcard">농가 카드</button>`:''}</div>
    <div class="addr">${f?[f.addr,f.crop].filter(Boolean).map(E).join(' · ')||'<span class="faint">주소·작목은 농가 카드에서</span>':'<span class="faint">농가를 고르면 전화번호·주소가 여기 보입니다</span>'}</div>
    <div class="ctags">태그 ${DB.tags.map(t=>`<button type="button" class="tag ${c.tags.includes(t.n)?'on':''}" data-tog="${E(t.n)}">${E(t.n)}${t.end?' (끝)':''}</button>`).join('')}<button type="button" class="lnk" data-act="tags">태그 고치기</button>${isEnd(c)?'<span class="pill okp">끝난 상담</span>':''}</div>
    <div class="card sec"><h2><span class="no">1</span>사전 정보 <span class="faint">전화나 방문으로 처음 들은 것</span></h2>
      <div class="form"><div class="f s4"><span>고민 한줄 요약 <small class="faint">(목록에 보임)</small></span><input data-k="issue" value="${E(c.issue)}" placeholder="무엇이 문제인지 한 줄로" maxlength="200"></div><div class="f h s1"><span>접수일</span><input type="date" data-k="date" value="${E(c.date)}"></div><div class="f h s1"><span>작목</span><input data-k="crop" value="${E(c.crop)}" placeholder="예: 배" maxlength="60"></div>
        <div class="f"><span>메모</span><textarea data-k="memo" placeholder="언제 · 어떻게 들었나, 재배 상황, 그동안 해 본 것">${E(c.memo)}</textarea></div></div>
      <div class="f secfoot"><span>사진 · 스캔</span>${thumbsHTML(c,'pre')}</div></div>
    <div class="card sec"><h2><span class="no">2</span>현장 답사 <span class="faint">가서 본 것</span></h2>
      <div class="form"><div class="f h s2"><span>답사일</span><input type="date" data-k="visit.date" value="${E(c.visit.date)}"></div><div class="f"><span>메모</span><textarea data-k="visit.memo" placeholder="현장에서 본 것, 잰 것, 가져온 시료. 두 번 이상 갔으면 날짜를 적고 이어서">${E(c.visit.memo)}</textarea></div></div>
      <div class="f secfoot"><span>사진 · 스캔</span>${thumbsHTML(c,'visit')}</div></div>
    <div class="card sec"><h2><span class="no">3</span>자료 정리 <span class="faint">찾아보고 공부한 것 — 여러 개 둘 수 있습니다</span></h2>
      ${c.refs.length?c.refs.map(r=>`<div class="refbox" data-rid="${r.id}"><div class="eh"><input class="t" data-rk="title" value="${E(r.title)}" placeholder="자료 제목 (예: 농사로 검색 결과, 책 ○○쪽)" maxlength="120"><input type="date" data-rk="date" value="${E(r.date)}"><button type="button" class="btn sm ghost danger" data-rdel="${r.id}" title="이 자료 지우기">×</button></div><textarea data-rk="memo" placeholder="정리한 내용">${E(r.memo)}</textarea>${thumbsHTML(c,'ref',r.id)}</div>`).join(''):'<div class="empty" style="padding:12px">아직 자료가 없습니다.</div>'}
      <div class="row secfoot"><button type="button" class="btn sm" data-act="refadd">+ 자료 추가</button><span class="hint">자료마다 제목·날짜·메모·사진. 책이나 화면을 찍어 붙여 두면 다음에 비슷한 상담 때 바로 찾습니다.</span></div></div>
    <div class="card sec"><h2><span class="no">4</span>후속 조치 <span class="faint">안내한 것 · 그 뒤 어떻게 됐나</span></h2>
      <div class="form"><div class="f h s2"><span>조치일</span><input type="date" data-k="follow.date" value="${E(c.follow.date)}"></div><div class="f h s2"><span>다시 볼 날 <small class="faint">(목록 맨 위에 뜸)</small></span><input type="date" data-k="follow.next" value="${E(c.follow.next)}"></div><div class="f"><span>메모</span><textarea data-k="follow.memo" placeholder="안내한 것, 다시 확인할 것">${E(c.follow.memo)}</textarea></div></div>
      <div class="f secfoot"><span>사진 · 스캔</span>${thumbsHTML(c,'follow')}</div></div>
    <p class="hint">고치면 바로 저장됩니다. 붙인 사진은 [사진] 탭에서도 날짜별로 모아 봅니다.</p>`;
  qa('textarea',pg).forEach(autosize); loadThumbs(pg);
}
function autosize(t){ t.style.height='auto'; t.style.height=Math.max(84,t.scrollHeight+2)+'px'; }
function setPath(o,k,v){ const ks=k.split('.'); let x=o; for(let i=0;i<ks.length-1;i++) x=x[ks[i]]; x[ks[ks.length-1]]=v; }
q('#page-detail').addEventListener('input',e=>{ const c=consultOf(VIEW.id); if(!c) return; const t=e.target;
  if(t.dataset.k){ setPath(c,t.dataset.k,t.value); touch(c); save(); if(t.tagName==='TEXTAREA') autosize(t); return; }
  if(t.dataset.rk){ const rb=t.closest('[data-rid]'); const r=c.refs.find(x=>x.id===rb.dataset.rid); if(r){ r[t.dataset.rk]=t.value; touch(c); save(); if(t.tagName==='TEXTAREA') autosize(t); } } });
q('#page-detail').addEventListener('change',e=>{ if(e.target.dataset.k||e.target.dataset.rk){ if(isPC()) drawList(); } });
q('#page-detail').addEventListener('click',async e=>{ const c=consultOf(VIEW.id); if(!c) return; const t=e.target, b=t.closest('button');
  const tg=t.closest('[data-tog]'); if(tg){ const n=tg.dataset.tog; c.tags=c.tags.includes(n)?c.tags.filter(x=>x!==n):c.tags.concat([n]); touch(c); save(); drawDetail(); if(isPC()) drawList(); return; }
  const vw=t.closest('[data-view]'); if(vw){ const box=vw.closest('.thumbs'); const ids=qa('[data-view]',box).map(x=>x.dataset.view); openViewer(ids,ids.indexOf(vw.dataset.view)); return; }
  const ad=t.closest('[data-add]'); if(ad){ pickPhotos({c:c.id,part:ad.dataset.add,r:ad.dataset.radd||null}); return; }
  const rd=t.closest('[data-rdel]'); if(rd){ const r=c.refs.find(x=>x.id===rd.dataset.rdel); if(!r) return; const n=photosOf(c,'ref',r.id).length; if(!confirm(`자료 "${r.title||'(제목 없음)'}"을 지울까요?${n?` 붙인 사진 ${n}장도 같이 지워집니다.`:''}`)) return; for(const p of photosOf(c,'ref',r.id)) await deletePhoto(p.id,true); c.refs=c.refs.filter(x=>x!==r); touch(c); save(); drawDetail(); return; }
  if(!b) return; const act=b.dataset.act;
  if(act==='back'){ goBack(); return; }
  if(act==='tags'){ go('tags'); return; }
  if(act==='farmcard'){ if(c.fid) go('farm',c.fid); return; }
  if(act==='farm'){ pickFarm(c); return; }
  if(act==='refadd'){ c.refs.push(mkRef({date:today()})); touch(c); save(); drawDetail(); const last=qa('.refbox input.t',q('#page-detail')).pop(); if(last) last.focus(); return; }
  if(act==='del'){ const n=photosOf(c).length; if(!confirm(`"${c.title||'(제목 없음)'}" 상담을 지울까요?${n?` 붙인 사진 ${n}장도 같이 지워집니다.`:''}`)) return; await deleteConsult(c.id); go('list'); return; }
});
async function deleteConsult(id){ const c=consultOf(id); if(!c) return; for(const p of photosOf(c)) await deletePhoto(p.id,true); DB.consults=DB.consults.filter(x=>x!==c); SY.tomb.consult[id]=iso(); await saveNow(); }

/* 농가 고르기 창 (상담에서) */
function pickFarm(c){ let step=1, qv='', draft=null;
  const listHTML=()=>{ const s=qv.trim().toLowerCase(); const L=DB.farms.filter(f=>!s||[f.name,f.addr,f.crop,f.tel].join(' ').toLowerCase().includes(s)).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    return L.map(f=>`<button type="button" data-pick="${f.id}"><b>${E(f.name)}</b><small>${[f.addr,f.crop].filter(Boolean).map(E).join(' · ')}</small>${f.tel?`<small>📞 ${E(f.tel)}</small>`:''}</button>`).join('')||'<div class="empty" style="padding:14px">'+(s?'찾는 농가가 없습니다.':'아직 농가가 없습니다.')+'</div>'; };
  const newLabel=()=>`+ 새 농가${qv.trim()?` "${E(qv.trim())}"`:''}`;
  const paint=()=>{
    if(step===1) modal(`<h1>농가 고르기</h1><p class="desc">상담한 농가를 고르거나 새로 만듭니다. 전화번호·주소는 농가 카드에 한 번만 적어 두면 그 농가의 모든 상담에 보입니다.</p>
      <input id="pf-q" placeholder="이름 · 마을 · 작목으로 찾기" value="${E(qv)}" autocomplete="off">
      <div class="plist" id="pf-list">${listHTML()}</div>
      <div class="acts"><button type="button" class="btn primary" id="pf-new">${newLabel()}</button>${c.fid?'<button type="button" class="btn ghost" id="pf-unlink">농가 떼기</button>':''}<span class="sp"></span><button type="button" class="btn" data-close>닫기</button></div>`,{onOpen:w=>{ const i=q('#pf-q',w); i.focus(); try{ i.setSelectionRange(i.value.length,i.value.length); }catch(e){} }});
    else modal(`<h1>새 농가</h1><p class="desc">이름만 있어도 됩니다. 나머지는 나중에 농가 카드에서 채울 수 있어요.</p>
      <label class="fld">이름<input id="nf-name" value="${E(draft.name)}" maxlength="60"></label><label class="fld">전화번호<input id="nf-tel" value="${E(draft.tel)}" inputmode="tel" maxlength="40" placeholder="전화번호"></label>
      <label class="fld">마을 · 주소<input id="nf-addr" value="${E(draft.addr)}" maxlength="200" placeholder="예: 흥천면 효지리"></label><label class="fld">주로 짓는 작목<input id="nf-crop" value="${E(draft.crop)}" maxlength="100" placeholder="예: 배, 고추"></label>
      <div class="acts"><button type="button" class="btn primary" id="nf-save">만들고 이 상담에 붙이기</button><button type="button" class="btn" id="nf-back">← 고르기로</button></div>`,{onOpen:w=>q('#nf-name',w).focus()}); };
  const w=q('#modal'); w.onclick=e=>{ const t=e.target; const pk=t.closest('[data-pick]'); if(pk){ c.fid=pk.dataset.pick; touch(c); save(); closeModal(); drawDetail(); if(isPC()) drawList(); return; }
    if(t.id==='pf-new'){ step=2; draft={name:qv.trim(),tel:'',addr:'',crop:''}; paint(); return; }
    if(t.id==='pf-unlink'){ c.fid=null; touch(c); save(); closeModal(); drawDetail(); if(isPC()) drawList(); return; }
    if(t.id==='nf-back'){ step=1; paint(); return; }
    if(t.id==='nf-save'){ const name=q('#nf-name',w).value.trim(); if(!name){ q('#nf-name',w).focus(); return; } const f=mkFarm({name,tel:q('#nf-tel',w).value.trim(),addr:q('#nf-addr',w).value.trim(),crop:q('#nf-crop',w).value.trim()}); DB.farms.push(f); c.fid=f.id; touch(c); save(); closeModal(); drawDetail(); if(isPC()){ drawList(); } return; } };
  /* 글자를 칠 때는 창을 다시 만들지 않고 목록과 단추 글자만 바꿉니다 (창을 다시 만들면 커서가 날아가 자판이 깜빡임) */
  w.oninput=e=>{ if(e.target.id==='pf-q'){ qv=e.target.value; const l=q('#pf-list',w); if(l) l.innerHTML=listHTML(); const nb=q('#pf-new',w); if(nb) nb.innerHTML=newLabel(); } };
  paint(); }

/* ---------- 농가 ---------- */
function farmStat(f){ const L=consultsOfFarm(f); const last=L[0]; const open=L.filter(c=>!isEnd(c)); const due=open.filter(c=>c.follow.next).sort((a,b)=>a.follow.next<b.follow.next?-1:1)[0]; return {n:L.length,last:last?last.date:'',due:due?due.follow.next:''}; }
function farmsBodyHTML(){ const s=FV.q.trim().toLowerCase(); const L=DB.farms.filter(f=>!s||[f.name,f.addr,f.crop,f.tel,f.memo].join(' ').toLowerCase().includes(s)).sort((a,b)=>{ const sa=farmStat(a), sb=farmStat(b); return (sb.last>sa.last?1:sb.last<sa.last?-1:0)||a.name.localeCompare(b.name,'ko'); }); const sel=VIEW.v==='farm'?VIEW.id:null;
  return DB.farms.length?`<div class="nlist">${L.map(f=>{ const st=farmStat(f); const late=st.due&&st.due<today(), isT=st.due===today(); return `<div class="frow ${f.id===sel?'sel':''}" data-farm="${f.id}"><span class="nm">${E(f.name)}<small>${[f.addr,f.crop].filter(Boolean).map(E).join(' · ')}</small></span>${f.tel?`<a class="callbtn" href="tel:${E(f.tel.replace(/[^0-9+]/g,''))}" data-call>📞 전화</a>`:'<span></span>'}<span class="meta">상담 ${st.n}건${st.last?` · 마지막 ${kd(st.last)}`:''}${st.due?` · <b class="${late?'bad':''}" style="${late?'':'color:#b0541f'}">다시 볼 날 ${late?'지남':isT?'오늘':kd(st.due)}</b>`:''}</span></div>`; }).join('')||'<div class="empty">찾는 농가가 없습니다.</div>'}</div>`:'<div class="empty">아직 농가가 없습니다.<br>상담을 적으면서 [농가 고르기]로 만들거나, [+ 농가]로 먼저 만들어 두세요.</div>'; }
function drawFarmsBody(){ const pg=q('#page-farms'); const b=q('#fbody',pg); if(!b){ drawFarms(); return; } b.innerHTML=farmsBodyHTML(); const x=q('#fqx',pg); if(x) x.hidden=!FV.q; }
function drawFarms(){ const pg=q('#page-farms');
  if(q('#fbody',pg)&&document.activeElement&&document.activeElement.id==='fq'){ drawFarmsBody(); return; }
  pg.innerHTML=`<div class="lede">농가</div><div class="lede-sub">상담했던 농가가 모입니다. 누르면 그 농가의 상담 이력이 보여요.</div>
    <div class="srch"><input id="fq" placeholder="이름 · 마을 · 작목으로 찾기" value="${E(FV.q)}" autocomplete="off"><button type="button" class="btn" id="fqx" ${FV.q?'':'hidden'}>지우기</button></div>
    <button type="button" class="fab phoneonly" id="newF">+ 농가</button>
    <div id="fbody">${farmsBodyHTML()}</div>`;
  if(isPC()){ const fab=q('#newF',pg); fab.classList.remove('phoneonly'); pg.insertBefore(fab,q('#fbody',pg)); } }
q('#page-farms').addEventListener('input',e=>{ if(e.target.id==='fq'){ FV.q=e.target.value; clearTimeout(window.__fq); window.__fq=setTimeout(drawFarmsBody,150); } });
q('#page-farms').addEventListener('click',e=>{ const t=e.target; if(t.closest('[data-call]')) return; if(t.id==='fqx'){ FV.q=''; const i=q('#fq'); if(i) i.value=''; drawFarmsBody(); return; } if(t.id==='newF'){ newFarm(); return; } const fr=t.closest('[data-farm]'); if(fr) go('farm',fr.dataset.farm); });
function newFarm(){ modal(`<h1>새 농가</h1><label class="fld">이름<input id="nf-name" maxlength="60"></label><label class="fld">전화번호<input id="nf-tel" inputmode="tel" maxlength="40" placeholder="전화번호"></label><label class="fld">마을 · 주소<input id="nf-addr" maxlength="200" placeholder="예: 흥천면 효지리"></label><label class="fld">주로 짓는 작목<input id="nf-crop" maxlength="100" placeholder="예: 배, 고추"></label><label class="fld">농가 메모<textarea id="nf-memo" placeholder="예: 과원 동쪽 배수 안 좋음, 저온저장고 있음"></textarea></label>
    <div class="acts"><button type="button" class="btn primary" id="nf-save">만들기</button><button type="button" class="btn" data-close>취소</button></div>`,{onOpen:w=>q('#nf-name',w).focus()});
  q('#modal').onclick=e=>{ if(e.target.id==='nf-save'){ const w=q('#modal'); const name=q('#nf-name',w).value.trim(); if(!name){ q('#nf-name',w).focus(); return; } const f=mkFarm({name,tel:q('#nf-tel',w).value.trim(),addr:q('#nf-addr',w).value.trim(),crop:q('#nf-crop',w).value.trim(),memo:q('#nf-memo',w).value.trim()}); DB.farms.push(f); save(); closeModal(); go('farm',f.id); } }; }
let FEDIT=false;
function drawFarm(){ const pg=q('#page-farm'); const f=farmOf(VIEW.id); if(!f){ pg.innerHTML='<div class="empty">이 농가는 지워졌습니다.</div>'; return; } const L=consultsOfFarm(f);
  pg.innerHTML=`<div class="chead"><button type="button" class="btn sm" data-act="back">← 농가</button><span class="faint">농가 카드</span></div>
    <div class="card">${FEDIT?`<label class="fld">이름<input id="fe-name" value="${E(f.name)}" maxlength="60"></label><label class="fld">전화번호<input id="fe-tel" value="${E(f.tel)}" inputmode="tel" maxlength="40"></label><label class="fld">마을 · 주소<input id="fe-addr" value="${E(f.addr)}" maxlength="200"></label><label class="fld">주로 짓는 작목<input id="fe-crop" value="${E(f.crop)}" maxlength="100"></label><label class="fld">농가 메모<textarea id="fe-memo">${E(f.memo)}</textarea></label>
        <div class="row"><button type="button" class="btn primary" data-act="fsave">저장</button><button type="button" class="btn" data-act="fcancel">취소</button><span class="sp"></span><button type="button" class="btn ghost danger" data-act="fdel" ${L.length?'disabled title="상담이 달린 농가는 지울 수 없습니다"':''}>이 농가 지우기</button></div>`
      :`<div class="farmhead"><div><div class="nm">${E(f.name)}</div><div class="sub">${[f.addr,f.crop].filter(Boolean).map(E).join(' · ')||'<span class="faint">주소·작목 없음</span>'}</div></div><span class="sp"></span>${f.tel?`<a class="callbtn" href="tel:${E(f.tel.replace(/[^0-9+]/g,''))}">📞 ${E(f.tel)}</a>`:'<span class="faint" style="font-size:12.5px">전화번호 없음</span>'}</div>
        <div class="f" style="margin-top:12px"><span>농가 메모</span><div style="white-space:pre-wrap;font-size:14px">${E(f.memo)||'<span class="faint">없음</span>'}</div></div>
        <div class="row" style="margin-top:10px"><button type="button" class="btn sm" data-act="fedit">고치기</button></div>`}</div>
    <div class="card"><h2>상담 이력 <span class="pill">${L.length}건</span></h2>
      <div class="hist">${L.map(c=>{ const p=prog(c); const parts=[p.pre&&'사전',p.visit&&'답사',p.refs&&`자료 ${p.refs}`,p.follow&&'후속'].filter(Boolean); return `<div class="h" data-open="${c.id}"><span class="d">${md(c.date)||'—'}</span><div><b>${E(c.title)||'(제목 없음)'}</b><small>${isEnd(c)?'완료':'진행중'}${parts.length?' · '+parts.join('·')+' 적음':''} · 📎${photosOf(c).length}</small></div></div>`; }).join('')||'<div class="empty" style="padding:12px">아직 상담이 없습니다.</div>'}</div>
      <div class="row" style="margin-top:12px"><button type="button" class="btn primary" data-act="newc">+ 이 농가 새 상담</button></div></div>`; }
q('#page-farm').addEventListener('click',async e=>{ const f=farmOf(VIEW.id); if(!f) return; const t=e.target; const op=t.closest('[data-open]'); if(op){ go('detail',op.dataset.open); return; } const b=t.closest('button'); if(!b) return; const act=b.dataset.act;
  if(act==='back'){ FEDIT=false; goBack(); return; }
  if(act==='fedit'){ FEDIT=true; drawFarm(); q('#fe-name').focus(); return; }
  if(act==='fcancel'){ FEDIT=false; drawFarm(); return; }
  if(act==='fsave'){ const name=q('#fe-name').value.trim(); if(!name){ q('#fe-name').focus(); return; } Object.assign(f,{name,tel:q('#fe-tel').value.trim(),addr:q('#fe-addr').value.trim(),crop:q('#fe-crop').value.trim(),memo:q('#fe-memo').value.trim()}); touch(f); save(); FEDIT=false; drawFarm(); if(isPC()) drawFarms(); return; }
  if(act==='fdel'){ if(consultsOfFarm(f).length) return; if(!confirm(`"${f.name}" 농가를 지울까요?`)) return; DB.farms=DB.farms.filter(x=>x!==f); SY.tomb.farm[f.id]=iso(); FEDIT=false; await saveNow(); go('farms'); return; }
  if(act==='newc'){ newConsult(f.id); return; } });

/* ---------- 사진 ---------- */
const URLS=new Map();   /* id → {thumb,full} object URL (한 번 만든 건 돌려씀) */
async function thumbURL(id){ const k='t:'+id; if(URLS.has(k)) return URLS.get(k); const rec=await ST.fileGet(id); if(!rec) return ''; const u=URL.createObjectURL(rec.thumb||rec.blob); URLS.set(k,u); return u; }
async function fullURL(id){ const k='f:'+id; if(URLS.has(k)) return URLS.get(k); const rec=await ST.fileGet(id); if(!rec) return ''; const u=URL.createObjectURL(rec.blob); URLS.set(k,u); return u; }
function forgetURL(id){ for(const k of ['t:'+id,'f:'+id]){ const u=URLS.get(k); if(u){ URL.revokeObjectURL(u); URLS.delete(k); } } }
function loadThumbs(root){ qa('img[data-thumb]',root).forEach(async img=>{ const u=await thumbURL(img.dataset.thumb); if(u) img.src=u; }); }
let PICK=null;
function pickPhotos(ctx){ PICK=ctx; const i=q('#pick'); i.value=''; i.click(); }
q('#pick').addEventListener('change',async()=>{ const files=[...q('#pick').files]; q('#pick').value=''; if(!files.length||!PICK) return; const ctx=PICK; PICK=null; const c=consultOf(ctx.c); if(!c) return;
  let n=0; toast(`사진 ${files.length}장 넣는 중…`); for(const f of files){ try{ await addPhoto(f,ctx); n++; }catch(e){ console.warn('사진',e); } } touch(c); save(); toast(`사진 ${n}장을 붙였습니다.`); if(VIEW.v==='detail'&&VIEW.id===c.id) drawDetail(); if(isPC()) drawList(); });
async function shrink(blob,max,qlt){ try{ const bm=await createImageBitmap(blob,{imageOrientation:'from-image'}); const mx=Math.max(bm.width,bm.height); const sc=Math.min(1,max/mx); const cv=document.createElement('canvas'); cv.width=Math.max(1,Math.round(bm.width*sc)); cv.height=Math.max(1,Math.round(bm.height*sc)); cv.getContext('2d').drawImage(bm,0,0,cv.width,cv.height); const w=bm.width,h=bm.height; bm.close(); const out=await new Promise(res=>cv.toBlob(res,'image/jpeg',qlt)); return {blob:out,w:cv.width,h:cv.height,ow:w,oh:h}; }catch(e){ return null; } }
async function addPhoto(file,ctx){ const isImg=/^image\//.test(file.type||''); let blob=file, w=0, h=0, type=file.type||'application/octet-stream', name=file.name||'사진';
  if(isImg){ const big=await shrink(file,2400,0.88); if(big&&(big.ow>2400||big.oh>2400||file.size>1500000||!/jpe?g/.test(file.type))){ blob=big.blob; type='image/jpeg'; name=name.replace(/\.[^.]+$/,'')+'.jpg'; } if(big){ w=big.ow>2400||big.oh>2400?big.w:big.ow; h=big.ow>2400||big.oh>2400?big.h:big.oh; } }
  const th=isImg?await shrink(blob,260,0.8):null; const p=mkPhoto({c:ctx.c,part:ctx.part,r:ctx.r||null,name,type,size:blob.size,w,h}); await ST.filePut({id:p.id,blob,thumb:th?th.blob:null}); DB.photos.push(p); return p; }
async function deletePhoto(id,quiet){ const p=photoOf(id); if(!p) return; DB.photos=DB.photos.filter(x=>x!==p); SY.tomb.photo[id]=iso(); try{ await ST.fileDel(id); }catch(e){} forgetURL(id); if(!quiet){ const c=consultOf(p.c); if(c) touch(c); save(); } }
function drawPhotos(){ const pg=q('#page-photos'); const L=DB.photos.slice().sort((a,b)=>a.added<b.added?1:-1); const groups=[]; L.forEach(p=>{ const d=p.added.slice(0,10); let g=groups[groups.length-1]; if(!g||g.d!==d){ g={d,items:[]}; groups.push(g); } g.items.push(p); });
  pg.innerHTML=`<div class="lede">사진</div><div class="lede-sub">상담에 붙인 사진이 날짜별로 모입니다. 누르면 크게 보고, 거기서 그 상담으로 갈 수 있어요.</div>
    ${groups.length?groups.map(g=>`<div class="pdate">${kdw(g.d)} <span class="faint">· ${g.items.length}장</span></div><div class="pgrid">${g.items.map(p=>{ const c=consultOf(p.c), f=c?farmOf(c.fid):null; return `<button type="button" class="p" data-view="${p.id}" data-group="${g.d}"><img data-thumb="${p.id}" alt="" loading="lazy"><span>${c?E(c.title||'(제목 없음)'):'(지워진 상담)'}${f?' · '+E(f.name):''}</span></button>`; }).join('')}</div>`).join(''):'<div class="empty">아직 사진이 없습니다. 상담 안의 [+ 사진]으로 붙입니다.</div>'}`;
  loadThumbs(pg); }
q('#page-photos').addEventListener('click',e=>{ const b=e.target.closest('[data-view]'); if(!b) return; const ids=qa(`[data-view][data-group="${b.dataset.group}"]`,q('#page-photos')).map(x=>x.dataset.view); openViewer(ids,ids.indexOf(b.dataset.view)); });

/* 크게 보기 */
const VW={ids:[],i:0};
async function openViewer(ids,i){ VW.ids=ids.slice(); VW.i=Math.max(0,i|0); q('#viewer').hidden=false; document.body.style.overflow='hidden'; await paintViewer(); }
async function paintViewer(){ const id=VW.ids[VW.i]; const p=photoOf(id); const st=q('#vstage'); st.classList.remove('zoom'); if(!p){ closeViewer(); return; } const c=consultOf(p.c), f=c?farmOf(c.fid):null;
  q('#vcap').innerHTML=`${c?E(c.title||'(제목 없음)'):'(지워진 상담)'}${f?' · '+E(f.name):''} <span class="faint">· ${PARTS[p.part]||''}${c&&VIEW.v!=='detail'?' · <button type="button" class="lnk" id="vgo" style="color:#9fd0ea">상담으로</button>':''}</span>`;
  q('#vpos').textContent=`${VW.i+1} / ${VW.ids.length} · ${md(p.added)} ${p.w?`· ${p.w}×${p.h}`:''}`; q('#vprev').disabled=VW.i<=0; q('#vnext').disabled=VW.i>=VW.ids.length-1;
  const img=q('#vimg'); img.removeAttribute('src'); const u=await fullURL(id); if(u&&VW.ids[VW.i]===id) img.src=u; }
function closeViewer(){ q('#viewer').hidden=true; document.body.style.overflow=''; }
function viewerStep(d){ const n=VW.i+d; if(n<0||n>=VW.ids.length) return; VW.i=n; paintViewer(); }
q('#vclose').addEventListener('click',closeViewer); q('#vprev').addEventListener('click',()=>viewerStep(-1)); q('#vnext').addEventListener('click',()=>viewerStep(1));
q('#vcap').addEventListener('click',e=>{ if(e.target.id==='vgo'){ const p=photoOf(VW.ids[VW.i]); if(p&&p.c){ closeViewer(); go('detail',p.c); } } });
q('#vdel').addEventListener('click',async()=>{ const id=VW.ids[VW.i]; const p=photoOf(id); if(!p) return; if(!confirm('이 사진을 지울까요? (되돌릴 수 없습니다)')) return; await deletePhoto(id); VW.ids.splice(VW.i,1); if(!VW.ids.length){ closeViewer(); } else { if(VW.i>=VW.ids.length) VW.i=VW.ids.length-1; paintViewer(); } render(); });
(function(){ const st=q('#vstage'); let sx=0,sy=0,st0=0,lastTap=0; st.addEventListener('touchstart',e=>{ if(e.touches.length!==1) return; sx=e.touches[0].clientX; sy=e.touches[0].clientY; st0=Date.now(); },{passive:true});
  st.addEventListener('touchend',e=>{ const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy; if(!st.classList.contains('zoom')&&Math.abs(dx)>60&&Math.abs(dy)<80){ viewerStep(dx<0?1:-1); return; } if(Math.abs(dx)<10&&Math.abs(dy)<10){ const now=Date.now(); if(now-lastTap<320){ st.classList.toggle('zoom'); if(st.classList.contains('zoom')) setTimeout(()=>{ st.scrollLeft=(st.scrollWidth-st.clientWidth)/2; st.scrollTop=(st.scrollHeight-st.clientHeight)/2; },30); lastTap=0; } else lastTap=now; } },{passive:true});
  st.addEventListener('dblclick',()=>{ st.classList.toggle('zoom'); }); })();
document.addEventListener('keydown',e=>{ if(q('#viewer').hidden) return; if(e.key==='Escape') closeViewer(); if(e.key==='ArrowLeft') viewerStep(-1); if(e.key==='ArrowRight') viewerStep(1); });

/* ---------- 태그 고치기 ---------- */
function drawTags(){ const pg=q('#page-tags'); const used=n=>DB.consults.filter(c=>c.tags.includes(n)).length;
  pg.innerHTML=`<div class="chead"><button type="button" class="btn sm" data-act="back">← 돌아가기</button></div><div class="lede">태그 고치기</div><div class="lede-sub">주제(병해충·토양·과수…)든 상태(보류…)든 마음대로. 한 상담에 여러 개 달 수 있습니다. "끝난 것"으로 표시한 태그가 달리면 그 상담은 목록 아래(끝난 상담)로 내려갑니다.</div>
    <div class="card">${DB.tags.map((t,i)=>`<div class="tagrow"><input type="text" data-tn="${i}" value="${E(t.n)}" maxlength="30"><label class="check"><input type="checkbox" data-te="${i}" ${t.end?'checked':''}> 끝난 것</label><span class="hint">${used(t.n)}건</span><button type="button" class="btn sm" data-tren="${i}">이름 바꾸기</button><button type="button" class="btn sm ghost danger" data-tdel="${i}" ${used(t.n)?'disabled title="이 태그가 달린 상담이 있어 지울 수 없습니다"':''}>지우기</button></div>`).join('')}
      <div class="tagrow"><input type="text" id="tg-new" placeholder="새 태그 이름 (예: 보류, 시설채소)" maxlength="30"><button type="button" class="btn sm primary" id="tg-add">추가</button></div></div>`; }
q('#page-tags').addEventListener('click',e=>{ const t=e.target, b=t.closest('button'); const pg=q('#page-tags');
  if(t.dataset.te!=null&&t.type==='checkbox'){ DB.tags[+t.dataset.te].end=t.checked; save(); return; }
  if(!b) return; if(b.dataset.act==='back'){ goBack(); return; }
  if(b.id==='tg-add'){ const n=q('#tg-new',pg).value.trim(); if(!n) return; if(tagOf(n)){ toast('이미 있는 태그입니다.'); return; } DB.tags.push({n,end:false}); save(); drawTags(); q('#tg-new',pg).focus(); return; }
  if(b.dataset.tren!=null){ const i=+b.dataset.tren, n=q(`[data-tn="${i}"]`,pg).value.trim(), old=DB.tags[i].n; if(!n||n===old) return; if(tagOf(n)){ toast('이미 있는 태그입니다.'); return; } DB.tags[i].n=n; DB.consults.forEach(c=>{ if(c.tags.includes(old)){ c.tags=c.tags.map(x=>x===old?n:x); touch(c); } }); if(LV.tag===old) LV.tag=n; save(); drawTags(); toast(`"${old}" → "${n}" 으로 바꿨습니다.`); return; }
  if(b.dataset.tdel!=null){ const i=+b.dataset.tdel; const t2=DB.tags[i]; if(DB.consults.some(c=>c.tags.includes(t2.n))) return; if(!confirm(`태그 "${t2.n}"을 지울까요?`)) return; DB.tags.splice(i,1); if(LV.tag===t2.n) LV.tag=''; save(); drawTags(); } });

/* ---------- 더보기 ---------- */
function openSheet(){ const sh=q('#sheet'); const m=SY&&SY.mail; q('#sheetList').innerHTML=`<button type="button" data-go="sync"><b>PC 와 핸드폰 맞추기</b><small>${m&&m.on?'켜짐 · 마지막 받음 '+fmtT(m.lastPull):'아직 연결 안 함 — 연결 코드로 연결'}</small></button>
    <button type="button" data-go="backup"><b>백업 파일 만들기 · 불러오기</b><small>비밀번호로 잠근 파일 하나 ${SY&&SY.backupAt?'· 마지막 백업 '+fmtT(SY.backupAt):''}</small></button>
    <button type="button" data-go="tags"><b>태그 고치기</b><small>${DB.tags.map(t=>t.n).join(' · ')}</small></button>
    <button type="button" data-go="pw"><b>비밀번호 바꾸기</b></button>`;
  q('#sheetWho').textContent=ME.name?`이름: ${ME.name}`:''; q('#sheetVer').textContent=`상담 수첩 ${APP_VER}${inApp?' · 앱 '+SangdamApp.version():' · '+(ROLE==='phone'?'핸드폰':'PC')}`;
  sh.hidden=false; requestAnimationFrame(()=>sh.classList.add('open')); }
function closeSheet(){ const sh=q('#sheet'); sh.classList.remove('open'); setTimeout(()=>{ sh.hidden=true; },180); }
q('#sheet').addEventListener('click',e=>{ const t=e.target; if(t.classList.contains('scrim')){ closeSheet(); return; } const b=t.closest('[data-go]'); if(b){ closeSheet(); const g=b.dataset.go; if(g==='pw') changePw(); else if(g==='backup'){ go('sync'); setTimeout(()=>{ const el=q('#sy-backup'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); },80); } else go(g); return; }
  if(t.id==='sheetName'){ const n=prompt('이 기기에서 쓸 이름',ME.name); if(n==null) return; const name=n.trim(); if(!name) return; ME.name=name; ST.kvSet('me',ME); render(); q('#sheetWho').textContent=`이름: ${name}`; } });

/* ---------- 창 · 알림 ---------- */
function modal(html,opt){ opt=opt||{}; const w=q('#modal'); w.innerHTML=`<div class="modal">${html}</div>`; w.hidden=false; if(opt.onOpen) setTimeout(()=>opt.onOpen(w),30); return w; }   /* onclick/oninput 은 부른 쪽이 걸고, 닫을 때 지움 */
function closeModal(){ const w=q('#modal'); w.hidden=true; w.innerHTML=''; w.onclick=null; w.oninput=null; w.onkeydown=null; }
q('#modal').addEventListener('click',e=>{ if(e.target.closest('[data-close]')) closeModal(); });
function toast(t){ let el=q('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--bar-h) + 20px + env(safe-area-inset-bottom));z-index:120;background:#1b1f24;color:#fff;padding:9px 14px;border-radius:10px;font-size:13.5px;max-width:90vw;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:opacity .2s'; document.body.appendChild(el); } el.textContent=t; el.style.opacity='1'; el.hidden=false; clearTimeout(window.__toast); window.__toast=setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>{ el.hidden=true; },220); },2600); }
const fmtT=s=>{ if(!s) return '—'; const d=new Date(s); return isNaN(d)?String(s):d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}); };

/* ---------- 비밀번호 (잠근 값만 저장 · PBKDF2 3만 회) ---------- */
const PW_MIN=4, PW_ITER=30000, RELOCK_MIN=10;
async function pwHash(pw,saltHex){ const salt=saltHex?hexToBytes(saltHex):CR.rnd(16); const key=await CR.pbkdf2(CR.enc(pw),salt,PW_ITER,32); return {salt:CR.toHex(salt),hash:CR.toHex(key)}; }
function hexToBytes(h){ const u=new Uint8Array(h.length/2); for(let i=0;i<u.length;i++) u[i]=parseInt(h.substr(i*2,2),16); return u; }
async function verifyPw(pw){ if(!AUTH) return false; const r=await pwHash(pw,AUTH.salt); return r.hash===AUTH.hash; }
let LOCKED=true, HIDDEN_AT=0;
function showLock(mode,msg){ const w=q('#lock'); LOCKED=true; w.hidden=false;
  if(mode==='first') w.innerHTML=`<form class="lockbox" id="lockForm" autocomplete="off" novalidate><h1><img src="${ICON}" onerror="this.onerror=null;this.src='icon-192.png'" alt="">상담 수첩<small>여주시농업기술센터 · 현장 상담 기록</small></h1>
      <p class="desc">처음 한 번만 이름과 비밀번호를 정합니다. 수첩은 이 ${ROLE==='phone'?'핸드폰':'PC 브라우저'} 안에만 저장되고, 열 때마다 비밀번호를 넣습니다. <b>비밀번호는 되찾을 수 없으니</b> 잊지 않을 것으로.</p>
      <label class="fld">이름<input id="lk-name" maxlength="20" placeholder="예: 홍길동"></label><label class="fld">비밀번호 (${PW_MIN}글자 이상)<input id="lk-pw" type="password"></label><label class="fld">비밀번호 한 번 더<input id="lk-pw2" type="password"></label>
      <div class="msg bad" id="lk-msg">${E(msg||'')}</div><button class="btn primary block" type="submit">시작하기</button></form>`;
  else w.innerHTML=`<form class="lockbox" id="lockForm" autocomplete="off" novalidate><h1><img src="${ICON}" onerror="this.onerror=null;this.src='icon-192.png'" alt="">상담 수첩<small>${E(ME.name||'')}</small></h1>
      <label class="fld">비밀번호<input id="lk-pw" type="password" autofocus></label><div class="msg bad" id="lk-msg">${E(msg||'')}</div><button class="btn primary block" type="submit">열기</button>
      <button type="button" class="lgback" id="lk-forgot">비밀번호를 잊었어요</button></form>`;
  setTimeout(()=>{ const i=q(mode==='first'?'#lk-name':'#lk-pw',w); if(i) i.focus(); },50);
  q('#lockForm').onsubmit=async e=>{ e.preventDefault(); const msgEl=q('#lk-msg');
    if(mode==='first'){ const name=q('#lk-name').value.trim(), pw=q('#lk-pw').value, pw2=q('#lk-pw2').value; if(!name){ msgEl.textContent='이름을 적어 주세요.'; return; } if(pw.length<PW_MIN){ msgEl.textContent=`비밀번호는 ${PW_MIN}글자 이상으로 해 주세요.`; return; } if(pw!==pw2){ msgEl.textContent='비밀번호 두 개가 다릅니다.'; return; }
      msgEl.textContent=''; AUTH=await pwHash(pw); ME={name}; await ST.kvSet('auth',AUTH); await ST.kvSet('me',ME); ST.persist(); unlock(); return; }
    const pw=q('#lk-pw').value; const b=q('button[type=submit]',w); b.disabled=true; const okk=await verifyPw(pw); b.disabled=false; if(!okk){ msgEl.textContent='비밀번호가 틀립니다.'; q('#lk-pw').value=''; q('#lk-pw').focus(); return; } unlock(); };
  const fg=q('#lk-forgot',w); if(fg) fg.onclick=async()=>{ if(!confirm('비밀번호는 되찾을 수 없습니다.\n\n이 기기의 수첩 자료(상담·농가·사진)를 전부 지우고 처음부터 시작할까요?\n(PC 와 맞춰 두었거나 백업 파일이 있으면 거기서 다시 받을 수 있습니다)')) return; const w2=prompt('정말 지우려면 "지움" 이라고 적어 주세요.'); if(w2!=='지움') return; try{ await ST.wipe(); }catch(e){} location.reload(); }; }
function unlock(){ LOCKED=false; q('#lock').hidden=true; if(!DB) enter(); else render(); }
document.addEventListener('visibilitychange',()=>{ if(document.hidden){ HIDDEN_AT=Date.now(); } else if(!LOCKED&&HIDDEN_AT&&Date.now()-HIDDEN_AT>RELOCK_MIN*60000){ showLock('unlock'); } });
function changePw(){ modal(`<h1>비밀번호 바꾸기</h1><label class="fld">지금 비밀번호<input id="cp-a" type="password"></label><label class="fld">새 비밀번호 (${PW_MIN}글자 이상)<input id="cp-b" type="password"></label><label class="fld">새 비밀번호 한 번 더<input id="cp-c" type="password"></label><div class="msg bad" id="cp-msg"></div><div class="acts"><button type="button" class="btn primary" id="cp-go">바꾸기</button><button type="button" class="btn" data-close>취소</button></div>`,{onOpen:w=>q('#cp-a',w).focus()});
  q('#modal').onclick=async e=>{ if(e.target.id!=='cp-go') return; const w=q('#modal'), m=q('#cp-msg',w); const a=q('#cp-a',w).value, b=q('#cp-b',w).value, c=q('#cp-c',w).value; if(!(await verifyPw(a))){ m.textContent='지금 비밀번호가 틀립니다.'; return; } if(b.length<PW_MIN){ m.textContent=`새 비밀번호는 ${PW_MIN}글자 이상으로.`; return; } if(b!==c){ m.textContent='새 비밀번호 두 개가 다릅니다.'; return; } AUTH=await pwHash(b); await ST.kvSet('auth',AUTH); closeModal(); toast('비밀번호를 바꿨습니다.'); }; }

/* ---------- 시작 ---------- */
document.addEventListener('input',e=>{ if(!e.target.closest('#lock,#modal')) LAST_INPUT=Date.now(); },true);
document.addEventListener('keydown',e=>{ if(!e.target.closest('#lock,#modal')) LAST_INPUT=Date.now(); },true);
async function enter(){ DB=normDB(await ST.kvGet('db')); SY=normSY(await ST.kvGet('sy')); ME=(await ST.kvGet('me'))||ME; try{ history.replaceState({v:'list',id:null,d:0},''); }catch(e){} DEPTH=0; VIEW={v:'list',id:null}; TAB='list'; render(); q('#pbar').hidden=false; if(window.SYNC) SYNC.start(); }
async function boot(){ try{ AUTH=await ST.kvGet('auth'); ME=(await ST.kvGet('me'))||ME; }catch(e){ document.body.innerHTML=`<div class="empty">저장 공간을 열지 못했습니다: ${E(e&&e.message||e)}<br>브라우저가 "사이트 데이터 저장"을 막고 있지 않은지 봐 주세요.</div>`; return; }
  q('#pbar').hidden=true; if(!AUTH) showLock('first'); else showLock('unlock');
  if('serviceWorker' in navigator){ try{ navigator.serviceWorker.register('sw.js'); }catch(e){} } }
if(!window.$) window.$=s=>document.querySelector(s);   /* 시험·디버그 편의 */
window.APP={VER:APP_VER,ROLE,inApp,FLAVOR,ICON,goBack,get DB(){ return DB; },get SY(){ return SY; },set SY(v){ SY=v; },get ME(){ return ME; },get VIEW(){ return VIEW; },normDB,normSY,mkFarm,mkConsult,mkPhoto,mkRef,save,saveNow,render,go,toast,modal,closeModal,fmtT,iso,today,uid,E,q,qa,isPC,farmOf,consultOf,photoOf,photosOf,isEnd,tagOf,touch,deleteConsult,deletePhoto,shrink,thumbURL,fullURL,forgetURL,
  idle:()=>Date.now()-LAST_INPUT>=20000,typing:()=>Date.now()-LAST_INPUT<20000,_touch:t=>{ LAST_INPUT=t==null?Date.now():t; },locked:()=>LOCKED,verifyPw,
  busyUI:()=>!q('#modal').hidden||!q('#viewer').hidden||!q('#sheet').hidden||LOCKED||FEDIT,
  photoRecord:id=>ST.fileGet(id),putPhoto:async(p,blob)=>{ const th=/^image\//.test(p.type)?await shrink(blob,260,0.8):null; await ST.filePut({id:p.id,blob,thumb:th?th.blob:null}); },
  giveFile:(u8,name,mime)=>{ if(inApp){ let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); SangdamApp.saveFile(name,btoa(s),mime||'application/zip'); return '다운로드 폴더'; } const blob=new Blob([u8],{type:mime||'application/zip'}), url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000); return '내려받기 폴더'; }};
boot();
})();
