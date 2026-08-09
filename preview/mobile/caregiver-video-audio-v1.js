(()=>{
'use strict';
if(window.__salamatCaregiverVideoAudioV1)return;
window.__salamatCaregiverVideoAudioV1=true;

const speakerOn='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15 9.5c1.4 1.4 1.4 3.6 0 5"/><path d="M17.8 6.8c3 3 3 7.4 0 10.4"/></svg>';
const speakerOff='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="m16 9 5 5"/><path d="m21 9-5 5"/></svg>';

function label(button,on){
  button.classList.toggle('active',on);
  button.setAttribute('aria-pressed',on?'true':'false');
  button.innerHTML=(on?speakerOn:speakerOff)+`<span>${on?'صدا فعال است':'فعال‌کردن صدا'}</span>`;
}

function enhance(){
  const wrap=document.querySelector('.mr-login-video');
  const video=wrap?.querySelector('video');
  if(!wrap||!video||video.dataset.audioEnhancer==='1')return;
  video.dataset.audioEnhancer='1';
  video.volume=1;
  video.muted=true;
  const button=document.createElement('button');
  button.type='button';
  button.className='mr-video-sound-control';
  button.setAttribute('aria-label','فعال یا غیرفعال کردن صدای ویدئو');
  label(button,false);
  button.addEventListener('click',async(event)=>{
    event.preventDefault();
    event.stopPropagation();
    const enable=video.muted;
    video.muted=!enable;
    video.volume=1;
    if(enable){
      try{await video.play()}catch{}
    }
    label(button,enable);
  });
  wrap.appendChild(button);
}

enhance();
const timer=window.setInterval(enhance,350);
window.addEventListener('pagehide',()=>window.clearInterval(timer),{once:true});
})();
