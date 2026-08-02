(()=>{
'use strict';
if(window.__salamatPerformanceBootstrapV1)return;
window.__salamatPerformanceBootstrapV1=true;

const nativeFetch=window.fetch.bind(window);
const ACCESS_TTL=8000;
const ACCESS_401_TTL=1200;
let accessSnapshot=null;
let accessInflight=null;
const loadedScripts=new Map();

function requestMeta(input,init){
  try{
    const request=input instanceof Request?input:null;
    const url=new URL(request?.url||String(input),location.href);
    const method=String(init?.method||request?.method||'GET').toUpperCase();
    return {url,method};
  }catch{return null}
}
function isAccessRequest(input,init){
  const meta=requestMeta(input,init);
  return Boolean(meta&&meta.method==='GET'&&meta.url.origin===location.origin&&meta.url.pathname==='/api/access/me');
}
async function captureResponse(response){
  const body=await response.clone().arrayBuffer();
  return {
    body,
    status:response.status,
    statusText:response.statusText,
    headers:[...response.headers.entries()],
    expiresAt:Date.now()+(response.status===401?ACCESS_401_TTL:ACCESS_TTL),
  };
}
function restoreResponse(snapshot,cacheState='HIT'){
  const headers=new Headers(snapshot.headers);
  headers.set('x-salamat-client-cache',cacheState);
  return new Response(snapshot.body.slice(0),{
    status:snapshot.status,
    statusText:snapshot.statusText,
    headers,
  });
}
function clearAccess(){
  accessSnapshot=null;
  accessInflight=null;
}

window.fetch=function salamatFetch(input,init){
  if(!isAccessRequest(input,init))return nativeFetch(input,init);
  if(accessSnapshot&&accessSnapshot.expiresAt>Date.now()){
    return Promise.resolve(restoreResponse(accessSnapshot));
  }
  if(accessInflight)return accessInflight.then(snapshot=>restoreResponse(snapshot,'COALESCED'));
  accessInflight=nativeFetch(input,init)
    .then(captureResponse)
    .then(snapshot=>{
      accessSnapshot=snapshot;
      try{
        const copy=restoreResponse(snapshot,'SNAPSHOT');
        copy.clone().json().then(payload=>{
          window.__salamatEarlyAccessSnapshot=payload?.data||null;
          window.dispatchEvent(new CustomEvent('salamat-access-snapshot',{detail:payload?.data||null}));
        }).catch(()=>{});
      }catch{}
      return snapshot;
    })
    .finally(()=>{accessInflight=null});
  return accessInflight.then(snapshot=>restoreResponse(snapshot,'MISS'));
};

async function access(force=false){
  if(force)clearAccess();
  const response=await window.fetch('/api/access/me',{
    credentials:'same-origin',
    cache:'no-store',
    headers:{accept:'application/json'},
  });
  const payload=await response.json().catch(()=>({}));
  return {response,payload,data:payload?.data||null};
}
function loadScript(src){
  const absolute=new URL(src,location.href).href;
  if(loadedScripts.has(absolute))return loadedScripts.get(absolute);
  const existing=[...document.scripts].find(script=>script.src===absolute);
  if(existing){
    const ready=existing.dataset.salamatLoaded==='true'||existing.readyState==='complete';
    const promise=ready?Promise.resolve(existing):new Promise((resolve,reject)=>{
      existing.addEventListener('load',()=>resolve(existing),{once:true});
      existing.addEventListener('error',()=>reject(new Error(`بارگذاری ${src} انجام نشد.`)),{once:true});
    });
    loadedScripts.set(absolute,promise);
    return promise;
  }
  const promise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.dataset.salamatDynamic='true';
    script.onload=()=>{script.dataset.salamatLoaded='true';resolve(script)};
    script.onerror=()=>reject(new Error(`بارگذاری ${src} انجام نشد.`));
    document.head.appendChild(script);
  });
  loadedScripts.set(absolute,promise);
  return promise;
}
async function loadSeries(files){for(const file of files)await loadScript(file)}
function idle(callback,timeout=2500){
  if('requestIdleCallback'in window)return requestIdleCallback(callback,{timeout});
  return setTimeout(callback,Math.min(timeout,900));
}
function connectionAllowsHero(){
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(connection?.saveData)return false;
  return !['slow-2g','2g'].includes(String(connection?.effectiveType||''));
}
async function loadHero(){
  if(window.__salamatHeroLazyStarted)return;
  const login=document.querySelector('#loginView');
  const hero=document.querySelector('.login-visual-photo');
  if(!login||login.classList.contains('hidden')||!hero||innerWidth<900||!connectionAllowsHero())return;
  window.__salamatHeroLazyStarted=true;
  try{
    await loadSeries([
      './hero-hq-avif-part-0.js?v=1.7.0',
      './hero-hq-avif-part-1.js?v=1.7.0',
      './hero-hq-avif-part-2a.js?v=1.7.0',
      './hero-hq-avif-part-2b.js?v=1.7.0',
      './hero-hq-avif-part-3a.js?v=1.7.0',
      './hero-hq-avif-part-3b.js?v=1.7.0',
      './hero-inline.js?v=1.7.0',
    ]);
  }catch(error){console.warn('Salamat hero lazy load failed',error)}
}

function collectMetrics(){
  const navigation=performance.getEntriesByType?.('navigation')?.[0];
  const metrics={
    domInteractive:Math.round(navigation?.domInteractive||0),
    domContentLoaded:Math.round(navigation?.domContentLoadedEventEnd||0),
    loadEvent:Math.round(navigation?.loadEventEnd||0),
    transferSize:Math.round(navigation?.transferSize||0),
  };
  window.__salamatPerformanceMetrics=metrics;
  document.documentElement.dataset.salamatLoaded='true';
  return metrics;
}

window.addEventListener('salamat-authenticated',clearAccess);
window.addEventListener('salamat-access-changed',clearAccess);
document.addEventListener('click',event=>{if(event.target?.closest?.('#logoutButton'))clearAccess()},true);
window.addEventListener('load',()=>{
  collectMetrics();
  idle(()=>void loadHero(),3200);
},{once:true});
document.addEventListener('pointerenter',event=>{
  if(event.target?.closest?.('.login-visual'))idle(()=>void loadHero(),800);
},true);

window.SalamatPerformance={
  access,
  clearAccess,
  loadScript,
  loadSeries,
  loadHero,
  metrics:()=>window.__salamatPerformanceMetrics||collectMetrics(),
  nativeFetch,
};
})();
