(()=>{
  const VERSION="1.0.1";
  const THREADS="/api/caregiver/platform/support/threads";
  const EVENT="salamat-support-unread-changed";
  if(window.__salamatMobileSupportThreadUnreadV1)return;
  window.__salamatMobileSupportThreadUnreadV1=VERSION;
  const nativeFetch=window.fetch.bind(window);
  const state={threads:[],allowThreadId:"",openedThreadId:"",allowUntil:0,autoSuppressed:false,decorateTimer:0,backTimer:0};
  const isSupportRoute=()=>location.pathname.replace(/\/+$/,"")==="/mobile/admin/support";
  const messageThreadId=(path)=>{const m=path.match(/^\/api\/caregiver\/platform\/support\/threads\/([^/]+)\/messages$/);return m?decodeURIComponent(m[1]):""};
  const jsonResponse=(payload)=>new Response(JSON.stringify(payload),{status:200,headers:{"content-type":"application/json; charset=utf-8","x-salamat-mobile-support-unread":VERSION}});
  const markLocalRead=(id)=>{state.threads=state.threads.map(t=>String(t?.id||"")===id?{...t,unreadCount:0,hasUnread:false}:t);scheduleDecorate();window.dispatchEvent(new CustomEvent(EVENT,{detail:{threadId:id}}))};
  function scheduleDecorate(){window.clearTimeout(state.decorateTimer);state.decorateTimer=window.setTimeout(decorate,40)}
  function scheduleBackFromAutoOpen(){
    window.clearTimeout(state.backTimer);
    state.backTimer=window.setTimeout(()=>{
      if(!isSupportRoute()||!state.autoSuppressed||state.allowThreadId||state.openedThreadId)return;
      const subpage=document.querySelector(".ma-main .ma-subpage"),back=subpage?.querySelector(".ma-subpage-head>button");
      if(back){state.autoSuppressed=false;back.dispatchEvent(new MouseEvent("click",{bubbles:true}))}
    },60);
  }
  function decorate(){
    if(!isSupportRoute())return;
    const list=document.querySelector(".ma-main>.ma-user-list")||document.querySelector(".ma-main .ma-user-list");
    if(!list)return;
    state.openedThreadId="";
    const rows=[...list.children].filter(el=>el instanceof HTMLElement&&el.matches("button.ma-person"));
    rows.forEach((row,index)=>{
      const thread=state.threads[index];if(!thread)return;
      const id=String(thread.id||"");row.dataset.msuThreadId=id;
      row.classList.add("msu-thread-row");
      const unread=Number(thread.unreadCount||0)>0||thread.hasUnread===true;
      row.classList.toggle("msu-thread-unread",unread);
      row.querySelectorAll(".msu-thread-dot,.msu-thread-preview").forEach(x=>x.remove());
      const end=row.querySelector(".ma-row-end");
      if(unread&&end){const dot=document.createElement("span");dot.className="msu-thread-dot";dot.setAttribute("aria-label","پیام جدید خوانده‌نشده");dot.title="پیام جدید";end.prepend(dot)}
      const info=row.children[1];
      const preview=String(thread.lastMessagePreview||"").trim();
      if(info&&preview){const small=document.createElement("small");small.className="msu-thread-preview";small.textContent=preview;info.appendChild(small)}
    });
  }
  window.fetch=async(input,init)=>{
    let url,method="GET";
    try{const raw=input instanceof Request?input.url:String(input);url=new URL(raw,location.origin);method=String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase()}catch{return nativeFetch(input,init)}
    if(url.origin!==location.origin)return nativeFetch(input,init);
    if(url.pathname===THREADS&&method==="GET"){
      const response=await nativeFetch(input,init);
      if(response.ok){response.clone().json().then(payload=>{state.threads=Array.isArray(payload?.data?.threads)?payload.data.threads:Array.isArray(payload?.threads)?payload.threads:[];state.autoSuppressed=isSupportRoute();scheduleDecorate()}).catch(()=>{})}
      return response;
    }
    const threadId=messageThreadId(url.pathname);
    if(threadId&&method==="GET"&&isSupportRoute()){
      const allowed=(state.allowThreadId===threadId&&Date.now()<state.allowUntil)||state.openedThreadId===threadId;
      if(!allowed){state.autoSuppressed=true;scheduleBackFromAutoOpen();return jsonResponse({data:{messages:[]},version:VERSION,source:"mobile-support-auto-open-guard"})}
      state.allowThreadId="";state.allowUntil=0;state.openedThreadId=threadId;state.autoSuppressed=false;
      const response=await nativeFetch(input,init);
      if(response.ok)markLocalRead(threadId);
      return response;
    }
    return nativeFetch(input,init);
  };
  document.addEventListener("click",event=>{
    if(!isSupportRoute())return;
    const target=event.target instanceof Element?event.target:null;
    const row=target?.closest(".ma-main .ma-user-list button.ma-person[data-msu-thread-id]");
    if(row){state.allowThreadId=String(row.dataset.msuThreadId||"");state.allowUntil=Date.now()+5000;state.autoSuppressed=false}
  },true);
  const observer=new MutationObserver(()=>{if(isSupportRoute()){scheduleDecorate();scheduleBackFromAutoOpen()}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("popstate",()=>window.setTimeout(scheduleDecorate,80));
  window.addEventListener(EVENT,()=>window.setTimeout(scheduleDecorate,60));
})();
