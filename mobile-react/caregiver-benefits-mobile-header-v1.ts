function isBenefitsRoute(){
  return location.pathname.replace(/\/+$/g,"")==="/mobile/benefits";
}

function updateBenefitsHeader(){
  const header=document.querySelector<HTMLElement>(".cv4-page-header");
  if(!header)return;
  const title=header.querySelector<HTMLElement>("h1");
  const subtitle=header.querySelector<HTMLElement>("p");
  if(isBenefitsRoute()){
    if(title&&title.textContent!=="وام و پاداش")title.textContent="وام و پاداش";
    if(subtitle&&!subtitle.hidden)subtitle.hidden=true;
  }else if(subtitle?.hidden){
    subtitle.hidden=false;
  }
}

if(typeof document!=="undefined"){
  updateBenefitsHeader();
  new MutationObserver(updateBenefitsHeader).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  addEventListener("popstate",updateBenefitsHeader);
  document.addEventListener("click",()=>setTimeout(updateBenefitsHeader,0),true);
}
