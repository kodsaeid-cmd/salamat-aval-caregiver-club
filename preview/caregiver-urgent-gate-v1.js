(()=>{
'use strict';
if(window.__salamatCaregiverUrgentGateV1)return;
window.__salamatCaregiverUrgentGateV1=true;

const VERSION='2.0.0';
const CALL_NUMBER='1527';
const HIDDEN_CLASS='salamat-caregiver-temporary-hidden';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let queued=false;
let redirecting=false;
let observer=null;

function normalize(value){return String(value||'').replace(/\s+/g,' ').trim()}
function caregiverActive(){
  const roleText=normalize($('#sidebarRole')?.textContent||$('#topRole')?.textContent);
  let role='';
  try{role=String(window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||'')}catch{}
  return /caregiver/i.test(role)||roleText.includes('مراقب');
}
function payrollText(value){
  const text=normalize(value);
  return text.includes('حقوق و فیش حقوقی')||text.includes('فیش حقوقی');
}
function urgentText(value){
  const text=normalize(value);
  return text.includes('فوری و امنیتی')||text.includes('فوری');
}
function addStyles(){
  if($('#caregiverUrgentGateStylesV1'))return;
  const style=document.createElement('style');
  style.id='caregiverUrgentGateStylesV1';
  style.textContent=`
.${HIDDEN_CLASS}{display:none!important}.cgp-support-action.cgp-call-now{display:block;text-decoration:none;color:inherit;border-color:#b9ddc9;background:#f3fbf7}.cgp-support-action.cgp-call-now strong{color:#087747}.cgp-support-action.cgp-call-now .cgp-call-number{display:inline-flex;margin-top:9px;padding:6px 10px;border-radius:999px;background:#078848;color:#fff;font-size:11px;font-weight:900;direction:ltr}.cgp-call-placeholder{margin:15px;padding:24px;border:1px solid #cfe4d8;border-radius:18px;background:#f5fbf8;text-align:center}.cgp-call-placeholder strong{display:block;color:#087747;font-size:13px}.cgp-call-placeholder p{margin:8px 0 14px;color:#687a70;font-size:9px;line-height:1.9}.cgp-call-placeholder a{display:inline-flex;text-decoration:none;border-radius:12px;padding:10px 16px;background:#078848;color:#fff;font-size:10px;font-weight:900}
`;
  (document.head||document.documentElement).appendChild(style);
}
function hidePayrollNavigation(){
  const nav=$('#sidebarNav');
  if(nav){
    $$('button,a,[data-caregiver-module-key],[data-access-module]',nav).forEach(node=>{
      const key=String(node.getAttribute('data-caregiver-module-key')||node.getAttribute('data-access-module')||'').toLowerCase();
      if(key.includes('payroll')||key.includes('payslip')||payrollText(node.textContent)){
        node.classList.add(HIDDEN_CLASS);
        node.setAttribute('aria-hidden','true');
        node.setAttribute('tabindex','-1');
      }
    });
  }
  $$('.mobile-bottom-nav button,.mobile-bottom-nav a,[data-mobile-nav] button,[data-mobile-nav] a').forEach(node=>{
    if(payrollText(node.textContent)){
      node.classList.add(HIDDEN_CLASS);
      node.setAttribute('aria-hidden','true');
      node.setAttribute('tabindex','-1');
    }
  });
}
function hidePayrollDashboard(){
  $$('.cgp-kpi,.cgr3-kpi').forEach(card=>{
    if(payrollText(card.textContent))card.classList.add(HIDDEN_CLASS);
  });
  $$('.cgp-hero p,.cgr3-dashboard-copy p').forEach(paragraph=>{
    const text=normalize(paragraph.textContent);
    if(!text.includes('حقوق'))return;
    paragraph.textContent=text
      .replace('پرونده، قرارداد، ارزیابی، آموزش، حقوق و کیف پول','پرونده، قرارداد، ارزیابی، آموزش و کیف پول')
      .replace('پرونده، ارزیابی، آموزش، قرارداد، حقوق و کیف پول','پرونده، ارزیابی، آموزش، قرارداد و کیف پول');
  });
}
function replaceUrgentAction(){
  $$('[data-cgp-new-urgent]').forEach(button=>{
    const link=document.createElement('a');
    link.className='cgp-support-action cgp-call-now';
    link.href=`tel:${CALL_NUMBER}`;
    link.setAttribute('data-cgp-urgent-call','true');
    link.setAttribute('aria-label',`تماس فوری با ${CALL_NUMBER}`);
    link.innerHTML=`<strong>تماس فوری</strong><small>برای تماس فوری با مرکز پاسخگویی سلامت اول روی این دکمه بزنید.</small><span class="cgp-call-number">۱۵۲۷</span>`;
    button.replaceWith(link);
  });
}
function hideUrgentThreads(){
  $$('.cgp-thread').forEach(thread=>{
    const badge=$('.cgp-badge',thread);
    if((badge&&urgentText(badge.textContent))||normalize(thread.textContent).includes('فوری و امنیتی')){
      thread.classList.add(HIDDEN_CLASS);
      thread.setAttribute('aria-hidden','true');
      thread.setAttribute('tabindex','-1');
    }
  });
}
function cleanSupportCopy(){
  const title=normalize($('#pageTitle')?.textContent);
  if(title!=='پشتیبانی'&&!$('.cgp-support-actions'))return;
  const subtitle=$('#pageSubtitle');
  if(subtitle)subtitle.textContent='پشتیبانی پرونده و تماس فوری با ۱۵۲۷';
  $$('.cgp-card-head p').forEach(node=>{
    const text=normalize(node.textContent);
    if(text==='پرونده و فوری')node.textContent='پشتیبانی پرونده';
  });
  $$('.cgp-empty small').forEach(node=>{
    if(normalize(node.textContent).includes('دو مسیر پشتیبانی'))node.textContent='برای پشتیبانی پرونده، گفت‌وگو را شروع کنید؛ برای موارد فوری با ۱۵۲۷ تماس بگیرید.';
  });
  const activeChat=$('.cgp-chat .cgp-card-head p');
  if(activeChat&&urgentText(activeChat.textContent)){
    const chat=$('#cgpChat')||activeChat.closest('.cgp-chat');
    if(chat)chat.innerHTML=`<div class="cgp-call-placeholder"><strong>تماس فوری</strong><p>مسیر پیام فوری و امنیتی فعلاً غیرفعال است. برای دریافت پشتیبانی فوری مستقیماً با مرکز پاسخگویی سلامت اول تماس بگیرید.</p><a href="tel:${CALL_NUMBER}">تماس با ۱۵۲۷</a></div>`;
  }
}
function redirectPayrollPage(){
  if(redirecting)return;
  const title=normalize($('#pageTitle')?.textContent);
  if(!payrollText(title))return;
  redirecting=true;
  const canonical=window.SalamatCaregiverCanonicalRouteOwner;
  if(canonical?.openDashboard){
    Promise.resolve(canonical.openDashboard()).finally(()=>setTimeout(()=>{redirecting=false},150));
    return;
  }
  const dashboard=$('#sidebarNav [data-caregiver-module-key="caregiver.dashboard"]')||[...$$('#sidebarNav button')].find(node=>normalize(node.textContent)==='داشبورد');
  if(dashboard)dashboard.click();
  setTimeout(()=>{redirecting=false},150);
}
function enforce(){
  queued=false;
  if(!caregiverActive())return;
  addStyles();
  hidePayrollNavigation();
  hidePayrollDashboard();
  replaceUrgentAction();
  hideUrgentThreads();
  cleanSupportCopy();
  redirectPayrollPage();
}
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(enforce);
}
function installObserver(){
  if(observer)return;
  const app=$('#appView');
  if(!app)return;
  observer=new MutationObserver(schedule);
  observer.observe(app,{childList:true,subtree:true,characterData:true});
}
function boot(){
  addStyles();
  installObserver();
  schedule();
  window.addEventListener('salamat-authenticated',schedule);
  window.addEventListener('salamat-access-ready',schedule);
  window.addEventListener('pageshow',schedule);
  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    installObserver();
    schedule();
    if((observer&&caregiverActive())||attempts>=40)clearInterval(timer);
  },125);
  window.SalamatCaregiverUrgentGate={version:VERSION,enforce:schedule,callNumber:CALL_NUMBER};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
