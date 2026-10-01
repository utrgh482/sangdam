/* 더 이상 안 쓰는 서비스 워커입니다 — 상담 수첩은 sangdam-sw.js 를 씁니다 (10/1 이름 바꿈). 혹시 이 파일이 아직 등록돼 있는 기기는 아래 코드로 조용히 물러납니다. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{ for(const k of await caches.keys()) await caches.delete(k); await self.clients.claim(); })()));
