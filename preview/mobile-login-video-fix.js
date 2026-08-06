(()=>{
'use strict';
const VIDEO_ID='loginIntroVideo';
const PLAYER_ID='loginIntroPlayer';
const STYLE_ID='mobile-login-video-fix-style';
const PLAY_ID='mobileLoginVideoPlay';
const HQ_VIDEO_SRC='./media/caregiver-club-intro.mp4?v=2.0.0-hq-original';

function installStyle(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement('style');
 style.id=STYLE_ID;
 style.textContent=`
 .mobile-login-video-play{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);z-index:5;display:none;align-items:center;justify-content:center;width:68px;height:68px;border:0;border-radius:50%;background:rgba(255,255,255,.94);color:#08743f;font:900 28px/1 sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.28);cursor:pointer;-webkit-tap-highlight-color:transparent}
 .login-intro-player.needs-user-play .mobile-login-video-play{display:flex}
 .login-intro-player.needs-user-play video{opacity:1}
 @media(max-width:980px){.mobile-login-video-play{display:flex}.login-intro-player.is-playing .mobile-login-video-play{display:none}}
 `;
 document.head.appendChild(style);
}

function boot(){
 const video=document.getElementById(VIDEO_ID);
 const player=document.getElementById(PLAYER_ID);
 if(!video||!player||document.getElementById(PLAY_ID))return;
 installStyle();
 const ensureHqSource=()=>{
   const current=video.getAttribute('src')||'';
   if(!current||current.includes('v=2.0.0-hq-original'))return;
   const shouldResume=!video.paused;
   video.src=HQ_VIDEO_SRC;
   video.load();
   if(shouldResume)video.play().catch(()=>{});
 };
 new MutationObserver(ensureHqSource).observe(video,{attributes:true,attributeFilter:['src']});
 ensureHqSource();
 video.muted=true;
 video.defaultMuted=true;
 video.setAttribute('muted','');
 video.setAttribute('playsinline','');
 video.setAttribute('webkit-playsinline','');
 video.setAttribute('autoplay','');
 const button=document.createElement('button');
 button.type='button';
 button.id=PLAY_ID;
 button.className='mobile-login-video-play';
 button.setAttribute('aria-label','پخش ویدئو');
 button.textContent='▶';
 player.appendChild(button);
 const markPlaying=()=>{player.classList.add('is-playing');player.classList.remove('needs-user-play')};
 const markPaused=()=>{if(video.currentTime===0||video.paused)player.classList.add('needs-user-play')};
 const attempt=()=>{
   ensureHqSource();
   video.muted=true;
   const promise=video.play();
   if(promise&&typeof promise.then==='function')promise.then(markPlaying).catch(()=>player.classList.add('needs-user-play'));
 };
 button.addEventListener('click',attempt,{passive:true});
 button.addEventListener('touchend',attempt,{passive:true});
 video.addEventListener('playing',markPlaying);
 video.addEventListener('pause',markPaused);
 video.addEventListener('canplay',attempt,{once:true});
 document.addEventListener('touchstart',()=>{if(video.paused)attempt()},{once:true,passive:true});
 setTimeout(()=>{if(video.paused)player.classList.add('needs-user-play')},1800);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
