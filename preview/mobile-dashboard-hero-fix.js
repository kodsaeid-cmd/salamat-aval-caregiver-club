(()=>{
'use strict';
if(window.__salamatMobileDashboardHeroFix)return;
window.__salamatMobileDashboardHeroFix=true;

const VERSION='1.0.0';
const media=window.matchMedia('(max-width:760px)');
const HERO_SELECTOR='#content .role-hero,#content .adm-hero';
let frame=0;

const normalize=value=>String(value||'')
  .replace(/[\u200c\u200f\u202a-\u202e]/g,' ')
  .replace(/\s+/g,' ')
  .trim();
const visible=element=>element instanceof HTMLElement&&element.getClientRects().length>0;
const isInteractive=element=>Boolean(element.querySelector('button,a[href],input,select,textarea'));
const hasHeading=element=>Boolean(element.querySelector('h1,h2,h3'));
const meaningfulText=element=>normalize(element.textContent).length;

const style=document.createElement('style');
style.id='salamatMobileDashboardHeroFixStyles';
style.textContent=`
@media(max-width:760px){
  html.salamat-mobile-app #content .role-hero,
  html.salamat-mobile-app #content .adm-hero{
    min-height:0!important;
    height:auto!important;
    max-height:none!important;
    aspect-ratio:auto!important;
    display:flex!important;
    flex-direction:column!important;
    align-items:stretch!important;
    justify-content:flex-start!important;
    gap:14px!important;
    overflow:hidden!important;
  }
  html.salamat-mobile-app #content .role-hero:before,
  html.salamat-mobile-app #content .role-hero:after,
  html.salamat-mobile-app #content .adm-hero:before,
  html.salamat-mobile-app #content .adm-hero:after{display:none!important;content:none!important}
  html.salamat-mobile-app #content .role-hero>.sa-mobile-hero-copy,
  html.salamat-mobile-app #content .adm-hero>.sa-mobile-hero-copy{order:1!important;min-width:0!important;width:100%!important}
  html.salamat-mobile-app #content .role-hero>.hero-score,
  html.salamat-mobile-app #content .adm-hero>.hero-score{
    order:2!important;
    width:100%!important;
    height:auto!important;
    min-height:76px!important;
    max-height:108px!important;
    aspect-ratio:auto!important;
    margin:0!important;
    padding:12px!important;
    overflow:hidden!important;
  }
  html.salamat-mobile-app #content .role-hero>.hero-actions,
  html.salamat-mobile-app #content .adm-hero>.adm-hero-actions{order:3!important;margin:0!important}
  html.salamat-mobile-app #content [data-sa-mobile-hero-ghost="true"]{display:none!important}
  html.salamat-mobile-app #content .role-hero img[data-pending="true"],
  html.salamat-mobile-app #content .adm-hero img[data-pending="true"]{display:none!important}
}
`;
(document.head||document.documentElement).appendChild(style);

function isPlaceholderImage(image){
  if(!(image instanceof HTMLImageElement))return false;
  const source=image.currentSrc||image.src||'';
  if(image.dataset.pending==='true')return true;
  if(source.startsWith('data:image/gif;base64,R0lGODlhAQABA'))return true;
  return image.complete&&image.naturalWidth<=2&&image.naturalHeight<=2;
}

function markGhost(element,reason){
  if(!(element instanceof HTMLElement))return;
  element.dataset.saMobileHeroGhost='true';
  element.dataset.saMobileHeroGhostReason=reason;
  element.setAttribute('aria-hidden','true');
}

function sanitizeHero(hero){
  if(!(hero instanceof HTMLElement)||!media.matches)return;
  const children=[...hero.children].filter(element=>element instanceof HTMLElement);
  const copy=children.find(hasHeading)||null;
  if(copy)copy.classList.add('sa-mobile-hero-copy');

  hero.querySelectorAll('img').forEach(image=>{
    if(!isPlaceholderImage(image))return;
    const holder=image.closest('picture,figure,[data-hero-media],.hero-media,.hero-image,.hero-visual')||image;
    markGhost(holder,'placeholder-image');
  });

  children.forEach((child,index)=>{
    if(child===copy||child.matches('.hero-actions,.adm-hero-actions,.hero-score'))return;
    if(isInteractive(child)||hasHeading(child))return;
    const rect=child.getBoundingClientRect();
    const noText=meaningfulText(child)<4;
    const mediaOnly=Boolean(child.querySelector('img,picture,canvas,video'))&&noText;
    const oversizedBlank=noText&&rect.height>180;
    const beforeCopy=copy&&index<children.indexOf(copy)&&noText&&rect.height>120;
    if(mediaOnly||oversizedBlank||beforeCopy)markGhost(child,mediaOnly?'media-only':beforeCopy?'blank-before-copy':'oversized-blank');
  });

  const score=hero.querySelector(':scope>.hero-score');
  if(score instanceof HTMLElement){
    const scoreText=normalize(score.querySelector('strong,span,small')?.textContent);
    const scoreHeight=score.getBoundingClientRect().height;
    if(!scoreText&&scoreHeight>150)markGhost(score,'empty-score');
  }

  hero.style.removeProperty('min-height');
  hero.style.removeProperty('height');
  hero.style.removeProperty('aspect-ratio');
  hero.dataset.saMobileHeroSanitized='true';
}

function sync(){
  if(!media.matches)return;
  document.querySelectorAll(HERO_SELECTOR).forEach(sanitizeHero);
}
function schedule(){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(sync);
}

media.addEventListener?.('change',schedule);
window.addEventListener('pageshow',schedule);
window.addEventListener('orientationchange',()=>setTimeout(schedule,80));
window.addEventListener('salamat-authenticated',schedule);
window.addEventListener('salamat-shell-ready',schedule);
window.addEventListener('salamat-history-restored',schedule);
window.addEventListener('salamat-history-pushed',schedule);
window.addEventListener('salamat-mobile-navigation-complete',schedule);

const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','src','data-pending']});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();

window.SalamatMobileDashboardHeroFix={version:VERSION,sync:schedule,sanitize:sanitizeHero};
})();