/* =====================================================================
 *  상담 수첩 — 저장 부품 sangdam-store.js  v1 (2026-10-01)
 *  자료는 이 기기(핸드폰 앱 / PC 브라우저)의 IndexedDB 에만 둡니다. 서버 없음.
 *   - kv    : 작은 것들 (db = 상담·농가·사진 목록, sy = 주고받기 장부, auth = 잠근 비밀번호, me = 이름)
 *   - files : 사진 본체 (id → {id, blob, thumb})
 * ===================================================================== */
(function(){
'use strict';
const NAME='sangdam', VER=1;
let dbp=null;
function open(){
  if(dbp) return dbp;
  dbp=new Promise((res,rej)=>{
    const r=indexedDB.open(NAME,VER);
    r.onupgradeneeded=()=>{ const d=r.result; if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if(!d.objectStoreNames.contains('files')) d.createObjectStore('files',{keyPath:'id'}); };
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error||new Error('IndexedDB 를 열지 못했습니다'));
    r.onblocked=()=>rej(new Error('다른 창이 저장소를 잡고 있습니다. 다른 탭을 닫아 주세요.'));
  });
  return dbp;
}
function tx(store,mode,fn){ return open().then(d=>new Promise((res,rej)=>{ const t=d.transaction(store,mode), s=t.objectStore(store); let out; try{ out=fn(s); }catch(e){ rej(e); return; } t.oncomplete=()=>res((typeof IDBRequest!=='undefined'&&out instanceof IDBRequest)?out.result:out); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error||new Error('저장이 취소됐습니다')); })); }
const kvGet=k=>tx('kv','readonly',s=>s.get(k));
const kvSet=(k,v)=>tx('kv','readwrite',s=>s.put(v,k));
const kvDel=k=>tx('kv','readwrite',s=>s.delete(k));
const fileGet=id=>tx('files','readonly',s=>s.get(id));
const filePut=rec=>tx('files','readwrite',s=>s.put(rec));
const fileDel=id=>tx('files','readwrite',s=>s.delete(id));
const fileKeys=()=>tx('files','readonly',s=>s.getAllKeys());
async function wipe(){ const d=await open(); d.close(); dbp=null; await new Promise((res,rej)=>{ const r=indexedDB.deleteDatabase(NAME); r.onsuccess=res; r.onerror=()=>rej(r.error); r.onblocked=()=>res(); }); }
async function usage(){ try{ if(navigator.storage&&navigator.storage.estimate){ const e=await navigator.storage.estimate(); return {used:e.usage||0,quota:e.quota||0}; } }catch(e){} return {used:0,quota:0}; }
async function persist(){ try{ if(navigator.storage&&navigator.storage.persist){ if(await navigator.storage.persisted()) return true; return await navigator.storage.persist(); } }catch(e){} return false; }
window.STORE={kvGet,kvSet,kvDel,fileGet,filePut,fileDel,fileKeys,wipe,usage,persist};
})();
