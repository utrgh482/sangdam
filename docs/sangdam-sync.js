/* =====================================================================
 *  상담 수첩 — PC 와 핸드폰 맞추기 · 백업 파일  sangdam-sync.js  v1.0 (2026-10-01)
 *  (이사돔 sync.js 1.2 의 자동 우편함을 수첩에 맞게 다시 짬 — 양쪽이 똑같은 자격(핸드폰 ↔ PC 브라우저), 사진도 양쪽으로)
 *   - 우편함 = 깃허브 비공개 저장소 하나. 각자 "sangdam-phone.isd" / "sangdam-pc.isd" 한 파일씩만 두고, 보낼 때마다 통째로 바꿔 넣음
 *     (부모 없는 commit + ref 강제 이동 → 저장소에 늘 최신 것 하나). 안에는 비밀번호 없이는 못 여는 잠긴 덩어리(crypt.js)만.
 *   - 합치기: 농가·상담은 건마다 고친 시각(u)이 나중인 쪽이 남고, 지운 것은 지운 시각(tomb)이 더 나중이면 상대에게도 지워짐.
 *     사진은 상대가 아직 없는 것만 실어 보냄(상대 파일의 have 목록으로 앎). 농가 이름·전화번호도 그대로 감(이 앱은 수첩이므로).
 *   - 언제: 30초마다 깨어 1분쯤에 한 번. 글쇠를 누른 지 20초 안이면 통째로 쉼. 창·크게 보기가 열려 있거나 글자 칸에 커서가 있으면 "받기"만 미룸.
 *   - 연결 코드: 저장소·토큰·우편함 비밀번호를 한 줄 글자로 — PC 에서 만들어 카톡 "나에게 보내기"로 핸드폰에 붙여 넣으면 끝.
 * ===================================================================== */
(function(){
'use strict';
const A=window.APP, CR=globalThis.ISDCRYPT, ST=window.STORE;
if(!A||!CR||!ST){ console.warn('sync.js: app.js 가 먼저 읽혀야 합니다'); return; }
const SV='v1.0 (2026-10-01)';
const {q,qa,E,iso,fmtT}=A;
const ROLE=A.ROLE, MY_FILE=`sangdam-${ROLE}.isd`, PEER_FILE=`sangdam-${ROLE==='phone'?'pc':'phone'}.isd`;
const MAIL_MIN=1, PHOTO_CAP=20*1024*1024;      /* 한 번에 싣는 사진은 20MB 까지 (나머지는 다음 차례) */
const clone=o=>JSON.parse(JSON.stringify(o));
function hash(str){ let h1=0xdeadbeef^7, h2=0x41c6ce57^7; for(let i=0;i<str.length;i++){ const ch=str.charCodeAt(i); h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677); } h1=Math.imul(h1^(h1>>>16),2246822507); h1^=Math.imul(h2^(h2>>>13),3266489909); h2=Math.imul(h2^(h2>>>16),2246822507); h2^=Math.imul(h1^(h1>>>13),3266489909); return (h2>>>0).toString(36)+(h1>>>0).toString(36); }
const b64Of=blob=>new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(String(fr.result).split(',')[1]||''); fr.onerror=rej; fr.readAsDataURL(blob); });
function b64ToBlob(b64,type){ const bin=atob(b64), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new Blob([u],{type:type||'application/octet-stream'}); }
function b64Chunks(u8){ let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s); }
const b64url={enc:s=>btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),dec:s=>decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4))))};
const SY=()=>A.SY, DB=()=>A.DB, M=()=>(A.SY&&A.SY.mail)||{};
const mailOn=()=>{ const m=M(); return !!(m.on&&m.owner&&m.repo&&m.token&&m.pw); };
const lastX=()=>{ const l=SY().last; return [l.sent,l.recv].filter(Boolean).sort().pop()||''; };

/* ---------- 보낼 덩어리 · 받아서 합치기 ---------- */
function pendingPhotos(){ const have=new Set(SY().peerHave||[]); return DB().photos.filter(p=>!have.has(p.id)).sort((a,b)=>a.added<b.added?-1:1); }
async function photoPayload(list,onProgress){ const out=[]; let total=0, i=0; for(const p of list){ i++; if(onProgress) onProgress(i,list.length); if(total+p.size>PHOTO_CAP&&out.length) break; try{ const rec=await ST.fileGet(p.id); if(!rec||!rec.blob) continue; out.push(Object.assign(clone(p),{data:await b64Of(rec.blob)})); total+=p.size; }catch(e){ console.warn('사진 싣기',p.id,e); } } return {items:out,total,rest:list.length-out.length}; }
async function buildPayload(opt){ opt=opt||{}; const d=DB(); const list=opt.all?d.photos.slice():pendingPhotos(); const ph=await photoPayload(list,opt.onProgress);
  return {app:opt.backup?'sangdam-backup':'sangdam-sync',ver:1,role:ROLE,made:iso(),from:A.ME.name||'',sv:SV,tags:clone(d.tags),farms:clone(d.farms),consults:clone(d.consults),photosMeta:clone(d.photos),tomb:clone(SY().tomb),have:d.photos.map(p=>p.id),photos:ph.items,photosRest:ph.rest}; }
function mergeList(type,incItems,incTomb,lx,noDelete,revive){ const d=DB(); const list=type==='farm'?d.farms:d.consults, mk=type==='farm'?A.mkFarm:A.mkConsult, tomb=SY().tomb[type]; incTomb=incTomb||{};
  const L=new Map(list.map(x=>[x.id,x])), R=new Map((incItems||[]).map(x=>[String(x.id),x])); const out=[], n={added:0,changed:0,removed:0,conflict:0,kept:0}, removed=[];
  for(const [id,l] of L){ const r=R.get(id); const lu=l.u||'';
    if(r){ const ru=r.u||r.made||''; if(ru>lu){ out.push(mk(r)); n.changed++; if(lx&&lu>lx&&ru>lx) n.conflict++; } else { out.push(l); n.kept++; } }
    else { const tu=incTomb[id]; if(!noDelete&&tu&&tu>lu){ n.removed++; tomb[id]=tu; removed.push(l); } else out.push(l); } }
  for(let [id,r] of R){ if(L.has(id)) continue; const tu=tomb[id], ru=r.u||r.made||''; if(tu&&tu>ru){ if(!revive) continue; delete tomb[id]; r=Object.assign(clone(r),{u:iso()}); }   /* 백업 불러오기: 지웠던 것도 되살림(고친 시각을 지금으로 → 상대에게도 다시 감) */
    out.push(mk(r)); n.added++; }
  if(type==='farm') d.farms=out; else d.consults=out; return {n,removed}; }
function unionTags(inc){ const d=DB(); (inc||[]).forEach(t=>{ const x=typeof t==='string'?{n:t,end:t==='완료'}:{n:String(t.n||''),end:!!t.end}; if(x.n&&!d.tags.some(o=>o.n===x.n)) d.tags.push(x); }); }
async function mergeIn(p,opt){ opt=opt||{}; const d=DB(), lx=lastX(); if(!p||!/^sangdam-(sync|backup)$/.test(p.app||'')) throw new Error('상담 수첩 파일이 아닙니다.');
  const noDel=!!opt.noDelete, revive=!!opt.backup; unionTags(p.tags);
  const rf=mergeList('farm',p.farms,p.tomb&&p.tomb.farm,lx,noDel,revive), rc=mergeList('consult',p.consults,p.tomb&&p.tomb.consult,lx,noDel,revive);
  for(const c of rc.removed) for(const ph of d.photos.filter(x=>x.c===c.id)) await A.deletePhoto(ph.id,true);     /* 상대가 지운 상담의 사진도 같이 */
  let delP=0; if(!noDel&&p.tomb&&p.tomb.photo){ for(const id of Object.keys(p.tomb.photo)){ const ph=A.photoOf(id); if(ph&&p.tomb.photo[id]>(ph.u||ph.added||'')){ await A.deletePhoto(id,true); delP++; } } }
  let addP=0, skipP=0; const have=new Set(d.photos.map(x=>x.id)); const ctomb=SY().tomb.consult;
  for(const ph of (p.photos||[])){ if(!ph||!ph.id||!ph.data){ continue; } if(have.has(ph.id)){ skipP++; continue; } const tu=SY().tomb.photo[ph.id]; if(tu&&tu>(ph.u||ph.added||'')){ if(!revive){ skipP++; continue; } delete SY().tomb.photo[ph.id]; ph.u=iso(); } if(!A.consultOf(ph.c)){ skipP++; continue; }
    try{ const meta=A.mkPhoto(ph); delete meta.data; await A.putPhoto(meta,b64ToBlob(ph.data,ph.type)); d.photos.push(meta); have.add(meta.id); addP++; }catch(e){ console.warn('사진 받기',ph.id,e); } }
  if(!opt.backup){ SY().peerHave=Array.isArray(p.have)?p.have.slice():[]; SY().last.recv=iso(); if(SY().mail&&p.from) SY().mail.peerName=p.from; }
  const n={farm:rf.n,consult:rc.n,photos:{added:addP,removed:delP,skipped:skipP,rest:p.photosRest||0}};
  SY().log.unshift({t:iso(),dir:'in',kind:opt.backup?'backup':'mail',from:p.from||'',made:p.made||'',n}); SY().log=SY().log.slice(0,30);
  await A.saveNow(); return n; }
function tellN(n){ const part=(name,x)=>{ if(!x) return ''; const a=[]; if(x.added) a.push(`새로 ${x.added}`); if(x.changed) a.push(`바뀜 ${x.changed}`); if(x.removed) a.push(`지움 ${x.removed}`); return a.length?`${name} ${a.join('·')}`:''; };
  return [part('농가',n.farm),part('상담',n.consult),n.photos&&n.photos.added?`사진 ${n.photos.added}장${n.photos.rest?` (${n.photos.rest}장은 다음에)`:''}`:'',n.photos&&n.photos.removed?`사진 지움 ${n.photos.removed}`:''].filter(Boolean).join(' / ')||'바뀐 것 없음'; }
const conflicts=n=>((n.farm||{}).conflict||0)+((n.consult||{}).conflict||0);
function preSig(){ const d=DB(); return hash(JSON.stringify({f:d.farms.map(x=>[x.id,x.u]),c:d.consults.map(x=>[x.id,x.u]),t:d.tags,tomb:SY().tomb,have:d.photos.map(p=>p.id),pend:pendingPhotos().map(p=>p.id)})); }

/* ---------- 깃허브 (Git 데이터 API) ---------- */
const ghApi=m=>String((m&&m.api)||'https://api.github.com').replace(/\/$/,'');
function ghHeaders(m,raw,json){ const h={'Accept':raw?'application/vnd.github.raw+json':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}; if(m&&m.token) h['Authorization']='Bearer '+m.token; if(json) h['Content-Type']='application/json'; return h; }
async function gh(m,method,path,body,o){ o=o||{}; let r; try{ r=await fetch(ghApi(m)+path,{method,headers:ghHeaders(m,o.raw,!!body),body:body?JSON.stringify(body):undefined,cache:'no-store'}); }
  catch(e){ throw new Error('깃허브에 닿지 못했습니다 (인터넷 확인): '+(e&&e.message||e)); }
  if(r.status===404&&o.allow404) return {status:404};
  if(!r.ok){ let t=''; try{ t=(await r.json()).message||''; }catch(e){} if(r.status===401) t='토큰이 틀리거나 만료됐습니다'; if(r.status===403&&!t) t='권한이 없습니다 (토큰의 Contents 쓰기 권한)'; if(r.status===404) t='저장소를 못 찾았습니다 (이름·토큰 권한 확인)'; throw new Error(`깃허브 ${r.status}${t?' — '+t:''}`); }
  return o.raw?{status:r.status,bytes:new Uint8Array(await r.arrayBuffer())}:{status:r.status,json:await r.json()}; }
const repoPath=m=>`/repos/${encodeURIComponent(m.owner)}/${encodeURIComponent(m.repo)}`;
async function ghTree(m){ const br=m.branch||'main'; const ref=await gh(m,'GET',`${repoPath(m)}/git/ref/heads/${encodeURIComponent(br)}`,null,{allow404:true}); if(ref.status===404) return {commit:null,tree:null,files:{}};
  const cs=ref.json.object.sha, c=await gh(m,'GET',`${repoPath(m)}/git/commits/${cs}`), ts=c.json.tree.sha, t=await gh(m,'GET',`${repoPath(m)}/git/trees/${ts}`), files={};
  (t.json.tree||[]).forEach(e=>{ if(e.type==='blob') files[e.path]={sha:e.sha,size:e.size}; }); return {commit:cs,tree:ts,files}; }
async function ghGetBlob(m,sha){ const r=await gh(m,'GET',`${repoPath(m)}/git/blobs/${sha}`,null,{raw:true}); return r.bytes; }
async function ghPutFile(m,name,u8){ const b=await gh(m,'POST',`${repoPath(m)}/git/blobs`,{content:b64Chunks(u8),encoding:'base64'});
  const cur=await ghTree(m), treeBody={tree:[{path:name,mode:'100644',type:'blob',sha:b.json.sha}]}; if(cur.tree) treeBody.base_tree=cur.tree;
  const t=await gh(m,'POST',`${repoPath(m)}/git/trees`,treeBody); const c=await gh(m,'POST',`${repoPath(m)}/git/commits`,{message:`${name} ${iso()}`,tree:t.json.sha,parents:[]}); const br=m.branch||'main';
  if(cur.commit) await gh(m,'PATCH',`${repoPath(m)}/git/refs/heads/${encodeURIComponent(br)}`,{sha:c.json.sha,force:true}); else await gh(m,'POST',`${repoPath(m)}/git/refs`,{ref:'refs/heads/'+br,sha:c.json.sha});
  return b.json.sha; }
async function mailTest(cfg){ const out=[]; const api=ghApi(cfg);
  try{ const r=await fetch(api+'/rate_limit',{cache:'no-store'}); out.push(r.ok?'① 깃허브 연결 ○':`① 깃허브 응답 ${r.status}`); if(!r.ok) return out; } catch(e){ out.push('① 깃허브에 못 닿음 — 인터넷이 막혀 있을 수 있습니다: '+(e&&e.message||e)); return out; }
  if(!(cfg.owner&&cfg.repo&&cfg.token)){ out.push('② 저장소·토큰을 넣으면 접근도 확인합니다'); return out; }
  try{ const r=await gh(cfg,'GET',repoPath(cfg)); const j=r.json; out.push(`② 우편함 ○ ${j.full_name||cfg.owner+'/'+cfg.repo} · ${j.private?'비공개':'⚠ 공개 저장소입니다 (비공개로 바꾸는 것을 권함)'} · 쓰기 ${(j.permissions&&j.permissions.push)?'○':'✕ — 토큰에 Contents 쓰기(Read and write) 권한이 필요합니다'}`);
    const t=await ghTree(cfg); const fs=Object.keys(t.files).filter(f=>/^sangdam-/.test(f)); out.push(t.commit?`③ 우편함 안: ${fs.join(', ')||'(아직 비어 있음)'}`:'③ 우편함이 비어 있습니다 (첫 보내기 때 채워짐)'); }
  catch(e){ out.push('② 우편함 확인 실패: '+(e&&e.message||e)); }
  return out; }

/* ---------- 자동으로 맞추기 ---------- */
let BUSY=false, WAIT=false, LASTRUN=0, LASTCHECK='', JOB='';
function pullSafe(){ try{ if(A.typing()||A.busyUI()) return false; const a=document.activeElement; if(a&&/^(INPUT|TEXTAREA)$/.test(a.tagName)&&!a.closest('#lock,#modal')&&!/^(date|checkbox|radio|file)$/.test(a.type||'')&&String(a.value||'').trim()) return false; }catch(e){} return true; }
function keepView(){ const y=window.scrollY; return ()=>{ try{ A.render(); window.scrollTo(0,y); }catch(e){} }; }
function mailLog(e){ const m=SY().mail; if(!m) return; m.log=[e].concat(m.log||[]).slice(0,20); }
async function cycle(mode){
  if(!mailOn()||BUSY||JOB) return null; const auto=mode==='auto'; if(auto&&A.typing()) return null; const canPull=!auto||pullSafe();
  BUSY=true; LASTRUN=Date.now(); const out={pulled:null,pushed:false,waited:false,err:''}; const errBefore=M().err||''; paintDot(); const say=t=>{ if(!auto) msg(t); };
  try{
    say('우편함 보는 중…'); const tree=await ghTree(M()); LASTCHECK=iso(); const f=tree.files[PEER_FILE];
    if(f&&f.sha!==M().gotSha){
      if(canPull){ say('받는 중…'); const bytes=await ghGetBlob(M(),f.sha); let p; try{ p=await CR.unlock(bytes,M().pw); }catch(e){ throw new Error('우편함 파일을 못 열었습니다 — 양쪽 연결 코드(비밀번호)가 같은지 확인해 주세요'); }
        const back=keepView(); const n=await mergeIn(p,{}); M().gotSha=f.sha; M().lastPull=iso(); out.pulled=n; WAIT=false; mailLog({t:iso(),dir:'in',n}); back(); }
      else { WAIT=true; out.waited=true; }
    } else WAIT=false;
    const pre=preSig(), mine=tree.files[MY_FILE], need=(pre!==M().pushedSig)||(!!M().mySha&&(!mine||mine.sha!==M().mySha));
    if(need){ say('보내는 중…'); const payload=await buildPayload({onProgress:(i,n)=>say(`사진 싣는 중 ${i}/${n}…`)}); const u8=await CR.lock(payload,M().pw); const sha=await ghPutFile(M(),MY_FILE,u8); M().mySha=sha; M().pushedSig=payload.photosRest?'':pre; M().lastPush=iso(); SY().last.sent=M().lastPush; out.pushed=true; mailLog({t:iso(),dir:'out',size:u8.length,photos:payload.photos.length,rest:payload.photosRest}); }
    M().err=''; M().errAt='';
  }catch(e){ out.err=e&&e.message||String(e); M().err=out.err; M().errAt=iso(); console.warn('맞추기',e); }
  BUSY=false; paintDot(); if(out.pulled||out.pushed||(M().err||'')!==errBefore) A.saveNow();
  if(A.VIEW.v==='sync'){ drawPage(q('#page-sync')); if(!auto) msg(out.err?'안 됐습니다: '+out.err:(out.pulled||out.pushed)?[out.pulled?`받음: ${tellN(out.pulled)}${conflicts(out.pulled)?` · 양쪽이 달라 나중 것으로 맞춘 건 ${conflicts(out.pulled)}개`:''}`:'',out.pushed?'보냄 ○':''].filter(Boolean).join(' / '):'새로 주고받을 것이 없습니다.',!!out.err); }
  return out; }
function paintDot(){ const d=q('#syncDot'); if(!d) return; const m=M(); d.className='dot'+(!mailOn()?'':m.err?' err':BUSY?' wait':' on'); d.title=!mailOn()?'PC 와 핸드폰 맞추기: 아직 연결 안 함':m.err?'맞추기 오류: '+m.err:BUSY?'맞추는 중…':`맞추기 켜짐 · 마지막 확인 ${fmtT(LASTCHECK)}`; }
function start(){ paintDot(); setInterval(()=>{ if(!mailOn()) return; const since=Date.now()-LASTRUN; if(since>=MAIL_MIN*60000||(WAIT&&since>=20000&&pullSafe())) cycle('auto'); },30000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&mailOn()&&Date.now()-LASTRUN>30000) setTimeout(()=>cycle('auto'),2500); });
  setTimeout(()=>{ if(mailOn()) cycle('auto'); },15000); }

/* ---------- 연결 코드 ---------- */
const randPw=()=>{ const u=CR.rnd(12); return [...u].map(b=>'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join(''); };
function makeCode(){ const m=M(); if(!(m.owner&&m.repo&&m.token&&m.pw)) return ''; return 'SDN1.'+b64url.enc(JSON.stringify({o:m.owner,r:m.repo,b:m.branch||'main',t:m.token,p:m.pw,a:m.api||''})); }
function parseCode(s){ s=String(s||'').trim(); if(!/^SDN1\./.test(s)) throw new Error('연결 코드가 아닙니다 (SDN1. 로 시작해야 합니다).'); let o; try{ o=JSON.parse(b64url.dec(s.slice(5))); }catch(e){ throw new Error('연결 코드가 깨졌습니다. 처음부터 끝까지 다 복사했는지 봐 주세요.'); } if(!(o&&o.o&&o.r&&o.t&&o.p)) throw new Error('연결 코드에 빠진 것이 있습니다.'); return {owner:String(o.o),repo:String(o.r),branch:String(o.b||'main'),token:String(o.t),pw:String(o.p),api:String(o.a||'')}; }
function setMail(c){ const cur=M(); const same=cur.owner===c.owner&&cur.repo===c.repo; A.SY.mail=A.normSY({mail:Object.assign({},cur,c,{on:c.on!==false,gotSha:same?cur.gotSha:'',mySha:same?cur.mySha:'',pushedSig:'',err:'',errAt:''})}).mail; return A.SY.mail; }

/* ---------- 백업 파일 ---------- */
let PW_CACHE='';
function askPw(o){ o=o||{}; return new Promise(res=>{ A.modal(`<h1>${E(o.title||'비밀번호')}</h1><p class="desc">${E(o.msg||'')}</p><label class="fld">비밀번호<input id="bp-a" type="password" autocomplete="off" value="${E(PW_CACHE)}"></label>${o.confirm?'<label class="fld">비밀번호 한 번 더<input id="bp-b" type="password" autocomplete="off"></label>':''}<div class="msg bad" id="bp-msg"></div><div class="acts"><button type="button" class="btn primary" id="bp-go">${E(o.button||'확인')}</button><button type="button" class="btn" id="bp-x">취소</button></div>`,{onOpen:w=>q(PW_CACHE&&o.confirm?'#bp-b':'#bp-a',w).focus()});
  const w=q('#modal'); const done=v=>{ A.closeModal(); res(v); };
  w.onclick=e=>{ if(e.target.id==='bp-x'){ done(null); return; } if(e.target.id!=='bp-go') return; const a=q('#bp-a',w).value; if(a.length<4){ q('#bp-msg',w).textContent='비밀번호는 4글자 이상으로 해 주세요.'; return; } if(o.confirm&&a!==q('#bp-b',w).value){ q('#bp-msg',w).textContent='비밀번호 두 개가 다릅니다.'; return; } PW_CACHE=a; done(a); };
  w.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); q('#bp-go',w).click(); } }; }); }
const stampName=()=>{ const d=new Date(), p2=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`; };
async function backup(){ if(JOB) return; const pw=await askPw({title:'백업 파일 잠그기',msg:'수첩 전체(상담·농가·사진)를 이 비밀번호로 잠근 파일 하나로 만듭니다. 불러올 때 같은 비밀번호가 필요합니다. (앱 비밀번호와 같아도 되고 달라도 됩니다)',confirm:!PW_CACHE,button:'파일 만들기'}); if(!pw) return;
  JOB='backup'; drawPage(q('#page-sync')); try{ const p=await buildPayload({backup:true,all:true,onProgress:(i,n)=>msg(`사진 싣는 중 ${i}/${n}…`)}); msg('잠그는 중…'); const u8=await CR.lock(p,pw,f=>msg(`잠그는 중… ${Math.round(f*100)}%`)); const z=CR.zipStore('sangdam.isd',u8); const name=`상담수첩_백업_${stampName()}.zip`; const where=A.giveFile(z,name);
    SY().backupAt=iso(); SY().log.unshift({t:iso(),dir:'out',kind:'backup',note:`농가 ${p.farms.length} · 상담 ${p.consults.length} · 사진 ${p.photos.length}장 · ${Math.round(z.length/1024/1024*10)/10}MB`}); SY().log=SY().log.slice(0,30); await A.saveNow(); JOB=''; drawPage(q('#page-sync')); msg(`${where}에 ${name} 을 만들었습니다 (${Math.round(z.length/1024/1024*10)/10}MB). 카톡 "나에게 보내기"나 USB 로 옮겨 두세요.`); }
  catch(e){ JOB=''; drawPage(q('#page-sync')); msg('만들지 못했습니다: '+(e&&e.message||e),true); } }
async function restore(file){ if(JOB) return; const pw=await askPw({title:'백업 파일 열기',msg:`${file.name} — 만들 때 넣은 비밀번호`,button:'불러오기'}); if(!pw) return;
  JOB='restore'; drawPage(q('#page-sync')); try{ msg('여는 중…'); let u8=new Uint8Array(await file.arrayBuffer()); if(u8.length>4&&u8[0]===0x50&&u8[1]===0x4b){ const z=CR.zipRead(u8); const e=z.entries.find(x=>/\.isd$/i.test(x.name))||z.entries[0]; if(!e) throw new Error('zip 안이 비어 있습니다.'); u8=await z.data(e); }
    let p; try{ p=await CR.unlock(u8,pw,f=>msg(`여는 중… ${Math.round(f*100)}%`)); }catch(e){ throw new Error('비밀번호가 다르거나 상담 수첩 파일이 아닙니다.'); } msg('합치는 중…'); const n=await mergeIn(p,{backup:true,noDelete:true}); JOB=''; A.render(); drawPage(q('#page-sync')); msg(`불러왔습니다 (${E(p.from||'')} · ${fmtT(p.made)} 에 만든 파일). ${tellN(n)}. 지금 있는 것은 그대로 두고 더해졌습니다.`); }
  catch(e){ JOB=''; drawPage(q('#page-sync')); msg('불러오지 못했습니다: '+(e&&e.message||e),true); } }

/* ---------- 화면 ---------- */
const msg=(t,bad)=>{ const el=q('#sy-msg'); if(el){ el.textContent=t; el.classList.toggle('bad',!!bad); } };
function drawPage(pg){ if(!pg) return; const m=SY().mail, on=mailOn(), d=DB(); const pend=pendingPhotos().length; const code=makeCode();
  const st=!m?'아직 연결 안 함':(on?`켜짐 · ${E(m.owner)}/${E(m.repo)}${m.peerName?` · 상대 "${E(m.peerName)}"`:''}`:`꺼짐 · ${E(m.owner||'')}/${E(m.repo||'')} (이 기기는 맞추지 않고 연결 코드만 둠)`);
  pg.innerHTML=`<div class="chead"><button type="button" class="btn sm" data-act="back">← 돌아가기</button></div>
    <div class="lede">PC 와 핸드폰 맞추기</div><div class="lede-sub">핸드폰 앱과 PC 브라우저(같은 주소)가 서로 직접 닿지는 않고, 비밀번호로 잠근 덩어리를 <b>우편함</b>(깃허브 비공개 저장소)에 넣고 꺼내며 1~3분 안에 맞춰져요. 농가·상담·사진이 양쪽으로 갑니다.</div>
    <div class="card"><h2>자동으로 맞추기 ${on?'<span class="pill okp">켜짐</span>':m?'<span class="pill">꺼짐</span>':'<span class="pill">연결 안 함</span>'}</h2>
      <div class="kv"><span>상태</span><b>${st}</b><span>이 기기</span><b>${ROLE==='phone'?'핸드폰':'PC'} · ${E(A.ME.name||'')}</b><span>마지막 확인</span><b>${E(fmtT(LASTCHECK))}${on&&!LASTCHECK?' <small class="hint">(연 지 15초 뒤부터)</small>':''}</b><span>마지막 받음</span><b>${E(fmtT(m&&m.lastPull))}</b><span>마지막 보냄</span><b>${E(fmtT(m&&m.lastPush))}</b><span>보낼 사진</span><b>${pend}장</b>${WAIT?`<span>기다림</span><b>상대가 보낸 것이 있는데 고치는 중이라 미뤄 둠 — 손을 떼면 받습니다</b>`:''}${m&&m.err?`<span>오류</span><b class="bad">${E(m.err)} <small>(${E(fmtT(m.errAt))})</small></b>`:''}</div>
      <div class="row" style="margin-top:10px"><button type="button" class="btn primary" id="sy-now" ${on&&!BUSY&&!JOB?'':'disabled'}>${BUSY?'맞추는 중…':'지금 맞추기'}</button>${m?`<button type="button" class="btn" id="sy-toggle">${m.on?'끄기':'켜기'}</button>`:''}<button type="button" class="btn" id="sy-test" ${m?'':'disabled'}>연결 시험</button></div>
      <div class="msg" id="sy-msg"></div>
      ${m&&m.log&&m.log.length?`<details><summary class="hint" style="cursor:pointer">맞춘 기록 ${m.log.length}건</summary><table class="sylog">${m.log.map(e=>`<tr><td>${E(fmtT(e.t))}</td><td>${e.dir==='in'?'받음':'보냄'}</td><td>${e.dir==='in'?E(tellN(e.n||{})):`${Math.round((e.size||0)/1024)}KB${e.photos?` · 사진 ${e.photos}장`:''}${e.rest?` (${e.rest}장 남음)`:''}`}</td></tr>`).join('')}</table></details>`:''}</div>
    <div class="card"><h2>연결 코드</h2>
      ${code?`<p class="desc">이 기기는 우편함에 연결되어 있습니다. <b>다른 기기(PC 또는 핸드폰)</b>를 같은 수첩으로 맞추려면 아래 코드를 그 기기의 상담 수첩 → [코드 붙여넣기]에 넣으면 됩니다. 카톡 "나에게 보내기"로 옮기면 편해요. <b>코드에는 우편함 열쇠가 들어 있으니 다른 사람에게 보내지 마세요.</b></p>
        <div class="codebox" id="sy-code">${E(code)}</div><div class="row" style="margin-top:8px"><button type="button" class="btn" id="sy-copy">코드 복사</button><button type="button" class="btn" id="sy-paste">코드 붙여넣기 (다른 우편함으로 바꾸기)</button><button type="button" class="btn ghost" id="sy-set">우편함 설정</button></div>`
      :`<p class="desc">다른 기기에서 받은 <b>연결 코드</b>(SDN1. 로 시작하는 긴 글자)를 붙여 넣으면 같은 수첩으로 맞춰집니다. 처음 우편함을 만드는 기기(보통 PC)에서는 [우편함 설정]에서 깃허브 저장소와 토큰을 넣습니다.</p>
        <div class="row"><button type="button" class="btn primary" id="sy-paste">코드 붙여넣기</button><button type="button" class="btn" id="sy-set">우편함 설정 (처음 한 번)</button></div>`}</div>
    <div class="card" id="sy-backup"><h2>백업 파일</h2><p class="desc">기기를 바꾸거나 혹시 모를 때를 위해, 수첩 전체(상담·농가·사진)를 비밀번호로 잠근 파일 하나로 만들어 둡니다. 불러오면 지금 것 위에 합쳐지고(덮어쓰지 않음), 다른 기기로 옮기는 데도 쓸 수 있어요.</p>
      <div class="row"><button type="button" class="btn" id="sy-bk" ${JOB?'disabled':''}>${JOB==='backup'?'만드는 중…':'백업 파일 만들기'}</button><button type="button" class="btn" id="sy-rs" ${JOB?'disabled':''}>${JOB==='restore'?'불러오는 중…':'백업 파일 불러오기'}</button><span class="hint">마지막 백업 ${E(fmtT(SY().backupAt))}</span></div></div>
    <div class="card"><h2>이 ${ROLE==='phone'?'핸드폰':'브라우저'} 안</h2><div class="kv"><span>상담</span><b>${d.consults.length}건</b><span>농가</span><b>${d.farms.length}집</b><span>사진</span><b id="sy-photos">${d.photos.length}장 · ${Math.round(d.photos.reduce((s,p)=>s+(p.size||0),0)/1024/1024*10)/10}MB</b><span>저장 공간</span><b id="sy-usage">재는 중…</b><span>판</span><b>${E(A.VER)} · 맞추기 ${E(SV)}${A.inApp?' · 앱 '+E(SangdamApp.version()):''}</b></div>
      <p class="hint">자료는 이 ${ROLE==='phone'?'핸드폰':'브라우저'} 안에만 있습니다. ${ROLE==='phone'?'앱을 지우면':'브라우저의 "사이트 데이터"를 지우면'} 같이 지워지니, PC 와 맞추기나 백업 파일을 켜 두세요.</p></div>`;
  ST.usage().then(u=>{ const el=q('#sy-usage'); if(el) el.textContent=u.quota?`${Math.round(u.used/1024/1024)}MB 씀 / ${Math.round(u.quota/1024/1024/1024*10)/10}GB 까지`:'—'; });
  pg.onclick=async e=>{ const t=e.target, b=t.closest('button'); if(!b) return; const id=b.id;
    if(b.dataset.act==='back'){ A.goBack(); return; }
    if(id==='sy-now'){ cycle('manual'); return; }
    if(id==='sy-toggle'){ if(!SY().mail) return; SY().mail.on=!SY().mail.on; await A.saveNow(); drawPage(pg); paintDot(); if(mailOn()) setTimeout(()=>cycle('manual'),300); return; }
    if(id==='sy-test'){ msg('시험 중…'); const lines=await mailTest(SY().mail||{}); const el=q('#sy-msg'); if(el){ el.innerHTML=lines.map(E).join('<br>'); el.classList.remove('bad'); } return; }
    if(id==='sy-copy'){ try{ await navigator.clipboard.writeText(code); msg('복사했습니다. 카톡 "나에게 보내기"에 붙여 넣어 다른 기기로 옮기세요.'); }catch(e){ const r=document.createRange(); r.selectNodeContents(q('#sy-code')); const s=getSelection(); s.removeAllRanges(); s.addRange(r); msg('길게 눌러 복사해 주세요.'); } return; }
    if(id==='sy-paste'){ pasteCode(); return; }
    if(id==='sy-set'){ settings(); return; }
    if(id==='sy-bk'){ backup(); return; }
    if(id==='sy-rs'){ const fi=q('#pickFile'); fi.value=''; fi.onchange=()=>{ const f=fi.files[0]; fi.value=''; if(f) restore(f); }; fi.click(); return; } }; }
function pasteCode(){ A.modal(`<h1>연결 코드 붙여넣기</h1><p class="desc">다른 기기의 상담 수첩에서 [코드 복사]한 글자(SDN1. 로 시작)를 여기에 붙여 넣으세요.</p><textarea id="pc-code" placeholder="SDN1.…" style="min-height:110px;font-family:ui-monospace,Consolas,monospace;font-size:12px"></textarea><div class="msg bad" id="pc-msg"></div><div class="acts"><button type="button" class="btn primary" id="pc-go">연결하기</button><button type="button" class="btn" data-close>취소</button></div>`,{onOpen:w=>q('#pc-code',w).focus()});
  q('#modal').onclick=async e=>{ if(e.target.id!=='pc-go') return; const w=q('#modal'); let c; try{ c=parseCode(q('#pc-code',w).value); }catch(err){ q('#pc-msg',w).textContent=err.message; return; } q('#pc-msg',w).textContent=''; e.target.disabled=true; e.target.textContent='확인 중…'; const lines=await mailTest(c); if(!/○/.test(lines[1]||'')){ q('#pc-msg',w).textContent=lines.join('\n'); e.target.disabled=false; e.target.textContent='연결하기'; return; }
    setMail(Object.assign({},c,{on:true})); await A.saveNow(); A.closeModal(); drawPage(q('#page-sync')); paintDot(); msg('연결했습니다. 잠시 뒤 상대가 보낸 것이 있으면 받아 옵니다.'); setTimeout(()=>cycle('manual'),500); }; }
function settings(){ const m=M(); A.modal(`<h1>우편함 설정</h1><p class="desc">깃허브에 만든 <b>비공개 저장소</b>와 <b>토큰</b>을 넣습니다 (처음 한 번, 보통 PC 에서). 저장하면 연결 코드가 만들어지고, 다른 기기는 그 코드만 붙여 넣으면 됩니다.</p>
    <label class="fld">저장소 (아이디/이름)<input id="sm-repo" placeholder="예: utrgh482/sangdam-mailbox" value="${m.owner?E(m.owner+'/'+m.repo):''}"></label><label class="fld">토큰 (github_pat_…)<input id="sm-token" type="password" autocomplete="off" value="${E(m.token||'')}"></label>
    <label class="check" style="margin:4px 0 8px"><input type="checkbox" id="sm-use" ${m.owner&&m.on===false?'':'checked'}> 이 기기도 이 우편함으로 맞추기 <span class="hint">(남의 수첩을 대신 설정해 줄 때는 끄고 연결 코드만 만들어 주세요)</span></label>
    <div class="msg bad" id="sm-msg"></div><div class="acts"><button type="button" class="btn primary" id="sm-save">저장</button><button type="button" class="btn" id="sm-test">연결 시험</button><button type="button" class="btn" data-close>취소</button></div>
    <p class="hint" style="margin-top:12px">토큰 만들기: github.com → 오른쪽 위 사진 → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token → Repository access 에서 우편함 저장소만 고르고 → Permissions › Repository permissions › <b>Contents: Read and write</b> → Generate. 만료일이 있으니 그때 새 토큰으로 바꿔 넣고 연결 코드를 다시 나눠 주세요.</p>`,{onOpen:w=>q(m.owner?'#sm-token':'#sm-repo',w).focus()});
  const read=()=>{ const w=q('#modal'); const rp=q('#sm-repo',w).value.trim().replace(/^https?:\/\/github\.com\//,'').replace(/\.git$/,'').replace(/\/+$/,''); const [owner,repo]=rp.split('/'); return {owner:(owner||'').trim(),repo:(repo||'').trim(),branch:m.branch||'main',token:q('#sm-token',w).value.trim(),api:m.api||''}; };
  q('#modal').onclick=async e=>{ const w=q('#modal'); if(e.target.id==='sm-test'){ const c=read(); q('#sm-msg',w).textContent='시험 중…'; const lines=await mailTest(c); q('#sm-msg',w).innerHTML=lines.map(E).join('<br>'); return; }
    if(e.target.id!=='sm-save') return; const c=read(); const bad=!c.owner||!c.repo?'저장소를 아이디/이름 꼴로 넣어 주세요.':!c.token?'토큰을 넣어 주세요.':''; if(bad){ q('#sm-msg',w).textContent=bad; return; }
    const use=q('#sm-use',w).checked; setMail(Object.assign({},c,{pw:m.pw||randPw(),on:use})); await A.saveNow(); A.closeModal(); drawPage(q('#page-sync')); paintDot(); msg(use?'저장했습니다. 아래 연결 코드를 다른 기기에 붙여 넣으면 같은 수첩이 됩니다.':'저장했습니다 (이 기기는 맞추기 꺼짐). 아래 연결 코드를 쓸 사람의 핸드폰·PC 에 붙여 넣어 주세요.'); if(use) setTimeout(()=>cycle('manual'),500); }; }

window.SYNC={version:SV,start,cycle,drawPage,state:()=>SY(),mailOn,makeCode,parseCode,setMail,test:mailTest,backup,restore,buildPayload,mergeIn,pendingPhotos,pre:preSig,waiting:()=>WAIT,busy:()=>BUSY,lastCheck:()=>LASTCHECK,pullSafe};
})();
