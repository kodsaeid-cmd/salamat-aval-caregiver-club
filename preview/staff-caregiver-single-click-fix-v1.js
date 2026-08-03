(()=>{
'use strict';
if(window.__salamatStaffCaregiverSingleClickV1)return;
window.__salamatStaffCaregiverSingleClickV1=true;

const VERSION='1.0.0';
const ROW_SELECTOR='[data-server-caregiver-open]';
const LIST_SELECTOR='[data-view="staff-caregiver-list"]';
const DETAIL_SELECTOR='[data-view="staff-caregiver-detail"]';
const DESKTOP=window.matchMedia('(min-width:761px)');
const OPEN_TIMEOUT=6500;
const RETRY_DELAYS=[0,40,90,180,340,620,980];
let sequence=0;
let active=null;
let retryTimer=0;
let observer=null;
let lastPointerClaim={id:'',at:0};

const $=(selector,root=document)=>root.querySelector(selector);
const recordController=()=>window.SalamatStaffCaregivers;
const rowId=row=>String(row?.dataset?.serverCaregiverOpen||row?.dataset?.caregiverId||row?.dataset?.recordId||'');
const listVisible=()=>Boolean($(LIST_SELECTOR));
const detailNode=id=>{
 const detail=$(DETAIL_SELECTOR);if(!detail)return null;
 const current=String(detail.dataset.caregiverId||detail.dataset.recordId||'');
 return !id||current===String(id)?detail:null;
};

function clearRow(row){
 if(!row)return;
 row.removeAttribute('aria-busy');
 row.classList.remove('scv-single-click-opening');
 delete row.dataset.scvSingleClickOpening;
}
function finish(success){
 if(!active)return;
 clearTimeout(retryTimer);
 clearRow(active.row);
 document.documentElement.removeAttribute('data-caregiver-record-opening');
 const detail={id:active.id,success:Boolean(success),version:VERSION};
 active=null;
 window.dispatchEvent(new CustomEvent('salamat-caregiver-single-click-settled',{detail}));
}
function expired(){return !active||performance.now()>active.expiresAt}
function schedule(delay=0){
 clearTimeout(retryTimer);
 if(!active)return;
 retryTimer=setTimeout(()=>void invoke(active?.token),Math.max(0,delay));
}
async function invoke(token){
 const current=active;
 if(!current||current.token!==token)return;
 if(detailNode(current.id)){finish(true);return}
 if(expired()){finish(false);return}
 if(current.inflight){schedule(45);return}
 const controller=recordController();
 if(typeof controller?.openRecord!=='function'){schedule(55);return}
 current.inflight=true;
 try{
  await controller.openRecord(current.id,current.row,{force:true});
 }catch(error){
  console.error('Caregiver single-click open failed',error);
 }finally{
  if(active?.token===token)active.inflight=false;
 }
 if(active?.token!==token)return;
 if(detailNode(current.id)){finish(true);return}
 if(expired()){finish(false);return}
 schedule(listVisible()?35:100);
}
function begin(row,reason){
 const id=rowId(row);if(!id)return false;
 if(active?.id===id&&!expired()){
  schedule(0);
  return true;
 }
 if(active)finish(false);
 const token=++sequence;
 active={id,row,reason,token,inflight:false,expiresAt:performance.now()+OPEN_TIMEOUT};
 row.dataset.scvSingleClickOpening='true';
 row.setAttribute('aria-busy','true');
 row.classList.add('scv-single-click-opening');
 document.documentElement.dataset.caregiverRecordOpening=id;
 RETRY_DELAYS.forEach(delay=>setTimeout(()=>{
  if(active?.token===token&&!detailNode(id))schedule(0);
 },delay));
 schedule(0);
 window.dispatchEvent(new CustomEvent('salamat-caregiver-single-click-started',{detail:{id,reason,version:VERSION}}));
 return true;
}
function claimEvent(event,reason){
 if(!DESKTOP.matches)return false;
 const row=event.target?.closest?.(ROW_SELECTOR);if(!row)return false;
 if('button'in event&&event.button!==0)return false;
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 const id=rowId(row);
 if(reason==='pointerdown')lastPointerClaim={id,at:performance.now()};
 if(reason==='mousedown'&&lastPointerClaim.id===id&&performance.now()-lastPointerClaim.at<240)return true;
 begin(row,reason);
 return true;
}
function onPointerDown(event){
 if(event.pointerType==='touch')return;
 claimEvent(event,'pointerdown');
}
function onMouseDown(event){claimEvent(event,'mousedown')}
function onClick(event){
 if(!DESKTOP.matches)return;
 const row=event.target?.closest?.(ROW_SELECTOR);if(!row)return;
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 const id=rowId(row);
 if(!active||active.id!==id||expired())begin(row,event.detail===0?'keyboard':'click');
 else schedule(0);
}
function onKeyDown(event){
 if(!DESKTOP.matches||!['Enter',' '].includes(event.key))return;
 const row=event.target?.closest?.(ROW_SELECTOR);if(!row)return;
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 begin(row,'keyboard');
}
function observeContent(){
 observer?.disconnect();
 const content=$('#content');
 if(!content){requestAnimationFrame(observeContent);return}
 observer=new MutationObserver(()=>{
  if(!active)return;
  if(detailNode(active.id)){finish(true);return}
  if(listVisible())schedule(0);
 });
 observer.observe(content,{childList:true,subtree:true});
}
function cancelForOtherNavigation(event){
 if(!active)return;
 const nav=event.target?.closest?.('#sidebarNav [data-staff-module-key]');
 if(nav&&nav.dataset.staffModuleKey!=='staff.caregivers')finish(false);
}

document.addEventListener('pointerdown',onPointerDown,true);
document.addEventListener('mousedown',onMouseDown,true);
document.addEventListener('click',onClick,true);
document.addEventListener('keydown',onKeyDown,true);
document.addEventListener('pointerdown',cancelForOtherNavigation,true);
window.addEventListener('salamat-history-restored',()=>{if(active)schedule(0)});
window.addEventListener('salamat-caregiver-list-ready',()=>{if(active)schedule(0)});
window.addEventListener('salamat-caregiver-record-opened',event=>{
 if(active&&String(event.detail?.caregiverId||'')===active.id)finish(true);
});
DESKTOP.addEventListener?.('change',()=>{if(!DESKTOP.matches&&active)finish(false)});

const style=document.createElement('style');
style.id='salamatStaffCaregiverSingleClickStylesV1';
style.textContent=`
@media(min-width:761px){
 [data-server-caregiver-open].scv-single-click-opening{position:relative;pointer-events:none;opacity:.72;border-color:#168e55!important;background:#f1faf5!important}
 [data-server-caregiver-open].scv-single-click-opening::after{content:'در حال بازکردن پرونده…';position:absolute;inset-inline-end:16px;bottom:8px;padding:4px 8px;border-radius:999px;background:#185b38;color:#fff;font-size:8px;font-weight:900}
}
`;
(document.head||document.documentElement).appendChild(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeContent,{once:true});else observeContent();

window.SalamatStaffCaregiverSingleClick={version:VERSION,open:(id)=>{
 const row=document.querySelector(`${ROW_SELECTOR}[data-server-caregiver-open="${CSS.escape(String(id))}"]`);
 return row?begin(row,'api'):false;
},get active(){return active?{id:active.id,reason:active.reason}:null}};
})();