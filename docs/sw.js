/* 상담 수첩 — 서비스 워커 sw.js v1 (2026-10-01)
 *  하는 일: 화면 파일을 기기에 담아 두어 인터넷이 없어도 열리게 합니다. 자료는 여기 없고(IndexedDB), 이 파일은 화면만 다룹니다.
 *  열 때는 먼저 서버(깃허브 페이지)에서 새 파일이 있는지 보고(no-cache), 안 되면 담아 둔 것을 씁니다. */
const VER='sangdam-2026-10-01b';
const SHELL=['./','./index.html','./app.css','./app.js','./sync.js','./store.js','./crypt.js','./manifest.webmanifest','./icon-64.png','./icon-192.png','./icon-512.png','./icon-chamoe-192.png','./fonts/Pretendard-Regular.woff2','./fonts/Pretendard-Bold.woff2','./fonts/yeoju-ceramic.woff'];
self.addEventListener('install',e=>{ e.waitUntil((async()=>{ const c=await caches.open(VER); for(const u of SHELL){ try{ await c.add(new Request(u,{cache:'reload'})); }catch(err){} } self.skipWaiting(); })()); });
self.addEventListener('activate',e=>{ e.waitUntil((async()=>{ for(const k of await caches.keys()) if(k!==VER) await caches.delete(k); await self.clients.claim(); })()); });
self.addEventListener('fetch',e=>{ const req=e.request; if(req.method!=='GET') return; const url=new URL(req.url); if(url.origin!==self.location.origin) return;
  e.respondWith((async()=>{ const c=await caches.open(VER); const key=new Request(url.pathname.endsWith('/')?url.origin+url.pathname:req.url.split('?')[0]);
    try{ const net=await fetch(req.url,{cache:'no-cache',credentials:'same-origin'}); if(net&&net.ok){ c.put(key,net.clone()); } return net; }
    catch(err){ const hit=await c.match(key)||await c.match(req,{ignoreSearch:true}); if(hit) return hit; if(req.mode==='navigate'){ const idx=await c.match('./index.html'); if(idx) return idx; } throw err; } })()); });
