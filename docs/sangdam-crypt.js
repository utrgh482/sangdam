/* =====================================================================
 *  상담 수첩 — 잠금 부품 sangdam-crypt.js (이사돔 sync.js 의 ISDCRYPT 그대로, 2026-10-01)
 *  SHA-256 · HMAC · PBKDF2 · 흐름 잠금(ISD2) · ZIP 담기 — 순수 자바스크립트. 이사돔과 같은 파일 꼴이라 서로 열 수 있습니다.
 * ===================================================================== */

/* ---------- 1) 잠금 부품 ---------- */
(function(){
'use strict';
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const H0=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
/* SHA-256 압축 함수 — 상태 H(32비트 8개)에 64바이트 블록 하나를 넣습니다. 스크래치 W 는 하나를 돌려 씁니다 */
const W=new Uint32Array(64);
function compress(H,d,o){
  for(let i=0;i<16;i++,o+=4) W[i]=(d[o]<<24)|(d[o+1]<<16)|(d[o+2]<<8)|d[o+3];
  for(let i=16;i<64;i++){ const a=W[i-15],b=W[i-2]; const s0=((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3); const s1=((b>>>17)|(b<<15))^((b>>>19)|(b<<13))^(b>>>10); W[i]=(W[i-16]+s0+W[i-7]+s1)|0; }
  let a=H[0]|0,b=H[1]|0,c=H[2]|0,dd=H[3]|0,e=H[4]|0,f=H[5]|0,g=H[6]|0,h=H[7]|0;
  for(let i=0;i<64;i++){
    const S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)), ch=(e&f)^(~e&g), t1=(h+S1+ch+K[i]+W[i])|0;
    const S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)), mj=(a&b)^(a&c)^(b&c), t2=(S0+mj)|0;
    h=g; g=f; f=e; e=(dd+t1)|0; dd=c; c=b; b=a; a=(t1+t2)|0;
  }
  H[0]+=a; H[1]+=b; H[2]+=c; H[3]+=dd; H[4]+=e; H[5]+=f; H[6]+=g; H[7]+=h;
}
/* SHA-256 — 조각을 이어 넣을 수 있고(update), 중간 상태를 복사(clone)할 수 있습니다 */
class Sha256{
  constructor(){ this.h=new Uint32Array(H0); this.buf=new Uint8Array(64); this.blen=0; this.len=0; }
  clone(){ const c=new Sha256(); c.h.set(this.h); c.buf.set(this.buf); c.blen=this.blen; c.len=this.len; return c; }
  update(d){
    let i=0; this.len+=d.length;
    if(this.blen){ const n=Math.min(64-this.blen,d.length); this.buf.set(d.subarray(0,n),this.blen); this.blen+=n; i=n; if(this.blen<64) return this; compress(this.h,this.buf,0); this.blen=0; }
    for(;i+64<=d.length;i+=64) compress(this.h,d,i);
    if(i<d.length){ this.buf.set(d.subarray(i)); this.blen=d.length-i; }
    return this;
  }
  digest(){
    const bits=this.len*8, padLen=(this.blen<56?56-this.blen:120-this.blen), pad=new Uint8Array(padLen+8); pad[0]=0x80;
    const hi=Math.floor(bits/4294967296), lo=bits>>>0, p=padLen;
    pad[p]=hi>>>24; pad[p+1]=hi>>>16; pad[p+2]=hi>>>8; pad[p+3]=hi; pad[p+4]=lo>>>24; pad[p+5]=lo>>>16; pad[p+6]=lo>>>8; pad[p+7]=lo;
    this.update(pad);
    const out=new Uint8Array(32); for(let i=0;i<8;i++){ const v=this.h[i]; out[i*4]=v>>>24; out[i*4+1]=v>>>16; out[i*4+2]=v>>>8; out[i*4+3]=v; } return out;
  }
}
const sha256=d=>new Sha256().update(d).digest();
/* HMAC 열쇠 준비 — 안쪽·바깥쪽 상태를 미리 만들어 둡니다 */
function hmacPads(key){
  if(key.length>64) key=sha256(key);
  const ip=new Uint8Array(64), op=new Uint8Array(64); for(let i=0;i<64;i++){ const k=key[i]||0; ip[i]=k^0x36; op[i]=k^0x5c; }
  const Hi=new Uint32Array(H0); compress(Hi,ip,0); const Ho=new Uint32Array(H0); compress(Ho,op,0); return {Hi,Ho};
}
/* 긴 글의 HMAC (스트리밍) */
function hmacKeyed(key){
  const {Hi,Ho}=hmacPads(key);
  return msg=>{ const inner=new Sha256(); inner.h.set(Hi); inner.len=64; const ih=inner.update(msg).digest(); const outer=new Sha256(); outer.h.set(Ho); outer.len=64; return outer.update(ih).digest(); };
}
const hmac=(key,msg)=>hmacKeyed(key)(msg);
/* 짧은 글(55바이트 이하)의 HMAC — 블록 두 번으로 끝. 할당 없이 돌려 쓰는 버퍼로 (PBKDF2·열쇠 흐름용). 결과는 32바이트 out 에 */
function hmacShort(key){
  const {Hi,Ho}=hmacPads(key), b1=new Uint8Array(64), b2=new Uint8Array(64), st=new Uint32Array(8);
  b2[32]=0x80; b2[62]=0x03; b2[63]=0x00;   /* 바깥쪽: 64 + 32 바이트 = 768비트 */
  return (msg,out)=>{
    const n=msg.length; st.set(Hi); b1.fill(0); b1.set(msg); b1[n]=0x80; const bits=(64+n)*8; b1[62]=(bits>>>8)&255; b1[63]=bits&255; compress(st,b1,0);
    for(let i=0;i<8;i++){ const v=st[i]; b2[i*4]=v>>>24; b2[i*4+1]=v>>>16; b2[i*4+2]=v>>>8; b2[i*4+3]=v; }
    st.set(Ho); compress(st,b2,0);
    for(let i=0;i<8;i++){ const v=st[i]; out[i*4]=v>>>24; out[i*4+1]=v>>>16; out[i*4+2]=v>>>8; out[i*4+3]=v; }
    return out;
  };
}
function pbkdf2(pw,salt,iter,dkLen){
  const prf=hmacShort(pw), out=new Uint8Array(dkLen), u=new Uint8Array(32), t=new Uint8Array(32); let off=0;
  for(let bi=1;off<dkLen;bi++){
    const s=new Uint8Array(salt.length+4); s.set(salt); s[salt.length]=bi>>>24; s[salt.length+1]=bi>>>16; s[salt.length+2]=bi>>>8; s[salt.length+3]=bi;
    prf(s,u); t.set(u);
    for(let i=1;i<iter;i++){ prf(u,u); for(let j=0;j<32;j++) t[j]^=u[j]; }
    out.set(t.subarray(0,Math.min(32,dkLen-off)),off); off+=32;
  }
  return out;
}
const enc=s=>new TextEncoder().encode(s), dec=u=>new TextDecoder().decode(u);
const rnd=n=>{ const u=new Uint8Array(n); (globalThis.crypto||{}).getRandomValues?crypto.getRandomValues(u):u.forEach((_,i)=>u[i]=Math.floor(Math.random()*256)); return u; };
const concat=(...arrs)=>{ const n=arrs.reduce((s,a)=>s+a.length,0), out=new Uint8Array(n); let o=0; for(const a of arrs){ out.set(a,o); o+=a.length; } return out; };
const eq=(a,b)=>{ if(a.length!==b.length) return false; let d=0; for(let i=0;i<a.length;i++) d|=a[i]^b[i]; return d===0; };
/* 흐름 잠금: 열쇠 흐름 조각(32바이트) = HMAC(K, nonce || 번호). 1MB 마다 잠깐 쉬어 화면이 굳지 않게 합니다 */
async function xorStream(key,nonce,data,onProgress){
  const prf=hmacShort(key), out=new Uint8Array(data.length), blk=new Uint8Array(nonce.length+4), ks=new Uint8Array(32); blk.set(nonce); const nb=Math.ceil(data.length/32);
  for(let j=0;j<nb;j++){
    blk[nonce.length]=j>>>24; blk[nonce.length+1]=j>>>16; blk[nonce.length+2]=j>>>8; blk[nonce.length+3]=j;
    prf(blk,ks); const o=j*32, n=Math.min(32,data.length-o); for(let i=0;i<n;i++) out[o+i]=data[o+i]^ks[i];
    if((j&32767)===32767){ if(onProgress) onProgress(o/data.length); await new Promise(r=>setTimeout(r,0)); }
  }
  return out;
}
async function gzip(u8){ if(typeof CompressionStream==='undefined') return null; try{ const cs=new CompressionStream('gzip'); const w=cs.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }catch(e){ return null; } }
async function gunzip(u8){ if(typeof DecompressionStream==='undefined') throw new Error('이 브라우저는 압축을 풀지 못합니다'); const ds=new DecompressionStream('gzip'); const w=ds.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); }
const MAGIC=[0x49,0x53,0x44,0x32];   /* "ISD2" */
const ITER=100000;
/* 잠그기: 머리(ISD2·표시·소금 16·nonce 16) + 잠긴 본문 + 도장 32 (HMAC 으로 머리+본문을 봉인) */
async function lock(obj,pw,onProgress){
  let plain=enc(JSON.stringify(obj)), flags=0; const gz=await gzip(plain); if(gz&&gz.length<plain.length){ plain=gz; flags|=1; }
  const salt=rnd(16), nonce=rnd(16), dk=pbkdf2(enc(String(pw)),salt,ITER,64), mac=hmacKeyed(dk.subarray(32,64));
  const head=new Uint8Array(37); head.set(MAGIC); head[4]=flags; head.set(salt,5); head.set(nonce,21);
  const ct=await xorStream(dk.subarray(0,32),nonce,plain,onProgress), body=concat(head,ct);
  return concat(body,mac(body));
}
async function unlock(u8,pw,onProgress){
  if(!(u8 instanceof Uint8Array)) u8=new Uint8Array(u8);
  if(u8.length<69||u8[0]!==MAGIC[0]||u8[1]!==MAGIC[1]||u8[2]!==MAGIC[2]||u8[3]!==MAGIC[3]) throw new Error('이사돔 주고받기 파일이 아닙니다.');
  const flags=u8[4], salt=u8.subarray(5,21), nonce=u8.subarray(21,37), ct=u8.subarray(37,u8.length-32), tag=u8.subarray(u8.length-32);
  const dk=pbkdf2(enc(String(pw)),salt,ITER,64), mac=hmacKeyed(dk.subarray(32,64));
  if(!eq(tag,mac(u8.subarray(0,u8.length-32)))) throw new Error('비밀번호가 다르거나 파일이 손상되었습니다.');
  let plain=await xorStream(dk.subarray(0,32),nonce,ct,onProgress); if(flags&1) plain=await gunzip(plain);
  return JSON.parse(dec(plain));
}
/* ZIP 담기 (압축 없이 그대로) — 밴드가 낯선 확장자를 막을 수 있어 .zip 안에 isadom.isd 로 넣습니다 */
const CRC_T=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0; } return t; })();
function crc32(u8){ let c=0xFFFFFFFF; for(let i=0;i<u8.length;i++) c=CRC_T[(c^u8[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function zipStore(name,data){
  const nm=enc(name), d=new Date(), dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xFFFF, dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF, crc=crc32(data);
  const lh=new Uint8Array(30+nm.length), v=new DataView(lh.buffer);
  v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint16(6,0x0800,true); v.setUint16(8,0,true); v.setUint16(10,dt,true); v.setUint16(12,dd,true); v.setUint32(14,crc,true); v.setUint32(18,data.length,true); v.setUint32(22,data.length,true); v.setUint16(26,nm.length,true); v.setUint16(28,0,true); lh.set(nm,30);
  const ch=new Uint8Array(46+nm.length), c=new DataView(ch.buffer);
  c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x0800,true); c.setUint16(10,0,true); c.setUint16(12,dt,true); c.setUint16(14,dd,true); c.setUint32(16,crc,true); c.setUint32(20,data.length,true); c.setUint32(24,data.length,true); c.setUint16(28,nm.length,true); c.setUint16(30,0,true); c.setUint16(32,0,true); c.setUint16(34,0,true); c.setUint16(36,0,true); c.setUint32(38,0,true); c.setUint32(42,0,true); ch.set(nm,46);
  const cdOff=lh.length+data.length, eo=new Uint8Array(22), e=new DataView(eo.buffer);
  e.setUint32(0,0x06054b50,true); e.setUint16(4,0,true); e.setUint16(6,0,true); e.setUint16(8,1,true); e.setUint16(10,1,true); e.setUint32(12,ch.length,true); e.setUint32(16,cdOff,true); e.setUint16(20,0,true);
  return concat(lh,data,ch,eo);
}
function zipRead(u8){
  if(!(u8 instanceof Uint8Array)) u8=new Uint8Array(u8);
  const v=new DataView(u8.buffer,u8.byteOffset,u8.byteLength); let p=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-65557);i--){ if(v.getUint32(i,true)===0x06054b50){ p=i; break; } }
  if(p<0) throw new Error('zip 파일이 아닙니다.');
  const n=v.getUint16(p+10,true); let o=v.getUint32(p+16,true); const entries=[];
  for(let i=0;i<n;i++){
    if(v.getUint32(o,true)!==0x02014b50) throw new Error('zip 목록이 깨졌습니다.');
    const method=v.getUint16(o+10,true), csize=v.getUint32(o+20,true), usize=v.getUint32(o+24,true), nl=v.getUint16(o+28,true), el=v.getUint16(o+30,true), cl=v.getUint16(o+32,true), lo=v.getUint32(o+42,true);
    entries.push({name:dec(u8.subarray(o+46,o+46+nl)),method,csize,usize,lo}); o+=46+nl+el+cl;
  }
  const data=async e=>{ const lnl=v.getUint16(e.lo+26,true), lel=v.getUint16(e.lo+28,true), start=e.lo+30+lnl+lel, raw=u8.subarray(start,start+e.csize);
    if(e.method===0) return raw;
    if(e.method===8&&typeof DecompressionStream!=='undefined'){ const ds=new DecompressionStream('deflate-raw'); const w=ds.writable.getWriter(); w.write(raw); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); }
    throw new Error('이 zip 의 압축 방식은 읽지 못합니다.'); };
  return {entries,data};
}
const toHex=u=>[...u].map(b=>b.toString(16).padStart(2,'0')).join('');
globalThis.ISDCRYPT={sha256,hmac,pbkdf2,lock,unlock,zipStore,zipRead,crc32,toHex,enc,dec,concat,rnd,ITER};
})();

