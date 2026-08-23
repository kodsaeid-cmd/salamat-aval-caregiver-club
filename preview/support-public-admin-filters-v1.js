(()=>{
  const VERSION="1.0.0";
  if(window.__salamatSupportPublicAdminFiltersV1)return;window.__salamatSupportPublicAdminFiltersV1=VERSION;
  const state={q:"",answer:"",from:"",to:""};
  const nativeFetch=window.fetch.bind(window);
  const latinDigits=(value)=>String(value||"").replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const pad=(n)=>String(n).padStart(2,"0");
  function jalaliToGregorian(jy,jm,jd){
    jy+=1595;let days=-355668+(365*jy)+(Math.floor(jy/33)*8)+Math.floor(((jy%33)+3)/4)+jd;
    days+=jm<7?(jm-1)*31:((jm-7)*30)+186;
    let gy=400*Math.floor(days/146097);days%=146097;
    if(days>36524){gy+=100*Math.floor((days-1)/36524);days=(days-1)%36524;if(days>=365)days++}
    gy+=4*Math.floor(days/1461);days%=1461;
    if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365}
    let gd=days+1,gm=1;const leap=(gy%4===0&&gy%100!==0)||gy%400===0,monthDays=[0,31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    while(gm<=12&&gd>monthDays[gm]){gd-=monthDays[gm];gm++}return{gy,gm,gd};
  }
  function parseJalali(value){
    const raw=latinDigits(value).trim().replace(/[.\-]/g,"/");if(!raw)return null;
    const match=raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);if(!match)return false;
    const jy=Number(match[1]),jm=Number(match[2]),jd=Number(match[3]);if(jy<1300||jy>1600||jm<1||jm>12||jd<1||jd>(jm<=6?31:jm<=11?30:30))return false;
    const g=jalaliToGregorian(jy,jm,jd);
    try{
      const parts=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{timeZone:"Asia/Tehran",year:"numeric",month:"numeric",day:"numeric"}).formatToParts(new Date(Date.UTC(g.gy,g.gm-1,g.gd,12)));
      const get=(type)=>Number(latinDigits(parts.find(p=>p.type===type)?.value||"0"));if(get("year")!==jy||get("month")!==jm||get("day")!==jd)return false;
    }catch{}
    return{...g,jy,jm,jd};
  }
  function boundary(value,endExclusive){
    const parsed=parseJalali(value);if(parsed===null)return"";if(parsed===false)return null;
    const day=new Date(Date.UTC(parsed.gy,parsed.gm-1,parsed.gd+(endExclusive?1:0)));
    return `${day.getUTCFullYear()}-${pad(day.getUTCMonth()+1)}-${pad(day.getUTCDate())}T00:00:00+03:30`;
  }
  window.fetch=(async(input,init)=>{
    let url=null;try{const raw=input instanceof Request?input.url:String(input),candidate=new URL(raw,location.origin),method=String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase();if(candidate.origin===location.origin&&candidate.pathname==="/api/staff/public-support"&&method==="GET")url=candidate}catch{}
    if(!url)return nativeFetch(input,init);
    for(const [key,value] of Object.entries(state)){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key)}
    return input instanceof Request?nativeFetch(new Request(url.toString(),input),init):nativeFetch(url.toString(),init);
  });
  function requestRefresh(){document.querySelector(".spu-list-head .spu-refresh")?.dispatchEvent(new MouseEvent("click",{bubbles:true}))}
  function inject(){
    const list=document.querySelector(".spu-list"),rows=list?.querySelector(".spu-list-rows");if(!list||!rows||list.querySelector(".spuf-toolbar"))return;
    const box=document.createElement("section");box.className="spuf-toolbar";box.innerHTML='<label class="spuf-search"><span>جستجو در پیام‌ها</span><input type="search" autocomplete="off" placeholder="متن پیام، نام یا شماره موبایل" /></label><label><span>وضعیت پاسخ</span><select><option value="">همه پیام‌ها</option><option value="unanswered">جواب داده نشده</option><option value="answered">جواب داده شده</option></select></label><div class="spuf-date-title"><span>تاریخ آخرین پیام • شمسی</span><small>مثال: ۱۴۰۵/۰۶/۰۱</small></div><div class="spuf-dates"><label><span>از تاریخ</span><input class="spuf-from" inputmode="numeric" dir="ltr" placeholder="۱۴۰۵/۰۶/۰۱" /></label><label><span>تا تاریخ</span><input class="spuf-to" inputmode="numeric" dir="ltr" placeholder="۱۴۰۵/۰۶/۰۱" /></label></div><div class="spuf-error" role="alert"></div><div class="spuf-actions"><button type="button" class="spuf-apply">اعمال فیلتر</button><button type="button" class="spuf-clear">پاک کردن</button></div><small class="spuf-hint">«جواب داده نشده» یعنی آخرین پیام گفتگو از سمت کاربر است.</small>';
    list.insertBefore(box,rows);
    const search=box.querySelector('input[type="search"]'),answer=box.querySelector("select"),from=box.querySelector(".spuf-from"),to=box.querySelector(".spuf-to"),error=box.querySelector(".spuf-error");
    const apply=()=>{
      const fromIso=boundary(from.value,false),toIso=boundary(to.value,true);error.textContent="";
      if(fromIso===null){error.textContent="تاریخ شروع را به شکل ۱۴۰۵/۰۶/۰۱ وارد کنید.";from.focus();return}
      if(toIso===null){error.textContent="تاریخ پایان را به شکل ۱۴۰۵/۰۶/۰۱ وارد کنید.";to.focus();return}
      if(fromIso&&toIso&&Date.parse(fromIso)>=Date.parse(toIso)){error.textContent="تاریخ شروع باید قبل از تاریخ پایان باشد.";return}
      state.q=search.value.trim();state.answer=answer.value;state.from=fromIso||"";state.to=toIso||"";requestRefresh();
    };
    box.querySelector(".spuf-apply").addEventListener("click",apply);answer.addEventListener("change",apply);
    [search,from,to].forEach(el=>el.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();apply()}}));
    box.querySelector(".spuf-clear").addEventListener("click",()=>{search.value="";answer.value="";from.value="";to.value="";error.textContent="";state.q=state.answer=state.from=state.to="";requestRefresh()});
  }
  new MutationObserver(inject).observe(document.documentElement,{childList:true,subtree:true});inject();
})();
