(()=>{
'use strict';
if(window.__salamatCaregiverUrgentGateV1)return;
window.__salamatCaregiverUrgentGateV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
function addStyles(){
  if($('#caregiverUrgentGateStylesV1'))return;
  const style=document.createElement('style');
  style.id='caregiverUrgentGateStylesV1';
  style.textContent=`
.cug-question{display:grid;gap:14px;text-align:center;padding:8px 0}.cug-icon{width:62px;height:62px;margin:auto;border-radius:20px;display:grid;place-items:center;background:#ffe9ed;color:#ae2940;font-size:27px;font-weight:900}.cug-question h3{margin:0;font-size:18px;color:#253b30}.cug-question p{margin:0;color:#6f8177;font-size:9px;line-height:2}.cug-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.cug-choice{border:1px solid #dce8e2;border-radius:15px;background:#f6faf8;padding:14px;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.cug-choice.yes{border-color:#edc2cb;background:#fff3f5;color:#a5223b}.cug-choice.no{color:#087747}.cug-warning{padding:13px;border-radius:14px;background:#fff0f2;color:#98273b;font-size:9px;line-height:2}@media(max-width:540px){.cug-actions{grid-template-columns:1fr}}
`;
  (document.head||document.documentElement).appendChild(style);
}
function drawer(title,html){
  const node=$('#drawer'),backdrop=$('#drawerBackdrop');
  if(!node)return;
  const heading=$('#drawerTitle'),body=$('#drawerBody');
  if(heading)heading.textContent=title;
  if(body)body.innerHTML=html;
  node.classList.add('open');
  backdrop?.classList.remove('hidden');
}
function close(){
  $('#drawer')?.classList.remove('open');
  $('#drawerBackdrop')?.classList.add('hidden');
}
function ask(){
  drawer('پشتیبانی فوری و امنیتی',`<section class="cug-question"><div class="cug-icon">!</div><h3>آیا در خطر هستید؟</h3><p>این مسیر فقط برای خطر، تهدید یا موقعیت فوری است. انتخاب «بله» پیام شما را با اولویت بحرانی برای افراد مجاز پشتیبانی ارسال می‌کند.</p><div class="cug-actions"><button type="button" class="cug-choice yes" data-cug-yes>بله، در خطر هستم</button><button type="button" class="cug-choice no" data-cug-no>خیر، در خطر نیستم</button></div></section>`);
}
function urgentForm(){
  drawer('ارسال درخواست فوری و امنیتی',`<form class="cgp-form" id="cgpNewUrgentForm"><div class="cug-warning cgp-field wide">وجود خطر تأیید شد. پیام شما با اولویت بحرانی در صف پشتیبانی قرار می‌گیرد. در خطر جانی فوری، هم‌زمان با خدمات امدادی محلی تماس بگیرید.</div><label class="cgp-field wide"><span>شرح فوری موقعیت</span><textarea class="cgp-textarea" name="message" required autofocus></textarea></label><button class="cgp-btn danger cgp-field wide">ارسال فوری</button></form>`);
  requestAnimationFrame(()=>$('#cgpNewUrgentForm textarea')?.focus());
}
function notifyNo(){
  close();
  try{window.toast?.('مسیر فوری فعال نشد','لطفاً از پشتیبانی پرونده استفاده کنید.')}catch{}
}
function capture(event){
  const urgent=event.target?.closest?.('[data-cgp-new-urgent]');
  if(urgent){
    event.preventDefault();
    event.stopImmediatePropagation();
    ask();
    return;
  }
  if(event.target?.closest?.('[data-cug-yes]')){
    event.preventDefault();
    event.stopImmediatePropagation();
    urgentForm();
    return;
  }
  if(event.target?.closest?.('[data-cug-no]')){
    event.preventDefault();
    event.stopImmediatePropagation();
    notifyNo();
  }
}
function boot(){addStyles();window.addEventListener('click',capture,true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
