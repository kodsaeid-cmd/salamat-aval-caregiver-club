type TabKey="technical"|"analysis"|"credit"|"activity";
const VERSION="1.0.0";
const TABS:Array<{key:TabKey;label:string}>=[
 {key:"technical",label:"کارنامه فنی"},
 {key:"analysis",label:"تحلیل فنی"},
 {key:"credit",label:"رتبه‌بندی اعتباری"},
 {key:"activity",label:"خلاصه فعالیت حرفه‌ای"},
];
let active:TabKey="technical",frame=0,installed=false;
const text=(value:unknown)=>String(value??"").trim();
const isScorecard=()=>/^\/mobile\/scorecard\/?$/.test(location.pathname);
const sectionOf=(node:Element):TabKey|"identity"|"tabs"|"unknown"=>{
 if(node.id==="cmsc-scorecard-tabs")return"tabs";
 if(node.classList.contains("cs-identity"))return"identity";
 if(node.classList.contains("cs-primary-metrics"))return"technical";
 const heading=text(node.querySelector(".cs-section-head h3")?.textContent);
 if(heading.includes("نظام ارزیابی")||heading.includes("رتبه حرفه‌ای"))return"technical";
 if(heading.includes("تحلیل نقاط قوت")||heading.includes("تحلیل فنی"))return"analysis";
 if(heading.includes("رتبه‌بندی اعتباری")||heading.includes("توان مالی"))return"credit";
 if(heading.includes("خلاصه فعالیت حرفه‌ای")||heading.includes("تاریخچه ارزیابی"))return"activity";
 return"unknown";
};
function ensureEmpty(root:HTMLElement){let empty=root.querySelector<HTMLElement>("#cmsc-analysis-empty");const hasAnalysis=Array.from(root.children).some(node=>sectionOf(node)==="analysis");if(hasAnalysis){empty?.remove();return}if(!empty){empty=document.createElement("section");empty.id="cmsc-analysis-empty";empty.className="cmsc-analysis-empty";empty.dataset.cmscSection="analysis";empty.innerHTML="<strong>تحلیل فنی هنوز آماده نیست</strong><small>پس از ثبت معیارهای کافی در نظام ارزیابی، تحلیل نقاط قوت و زمینه‌های قابل بهبود در این تب نمایش داده می‌شود.</small>";root.appendChild(empty)}empty.hidden=active!=="analysis"}
function ensureTabs(root:HTMLElement){let nav=root.querySelector<HTMLElement>("#cmsc-scorecard-tabs");if(nav)return nav;nav=document.createElement("nav");nav.id="cmsc-scorecard-tabs";nav.className="cmsc-scorecard-tabs";nav.setAttribute("aria-label","بخش‌های کارنامه مراقب");for(const item of TABS){const button=document.createElement("button");button.type="button";button.dataset.tab=item.key;button.textContent=item.label;button.addEventListener("click",()=>{active=item.key;renderRoot(root);nav?.scrollIntoView({block:"nearest",behavior:"smooth"})});nav.appendChild(button)}const identity=Array.from(root.children).find(node=>sectionOf(node)==="identity");if(identity?.nextSibling)root.insertBefore(nav,identity.nextSibling);else root.prepend(nav);return nav}
function renderRoot(root:HTMLElement){root.classList.add("cmsc-scorecard-tabbed");const nav=ensureTabs(root);nav.querySelectorAll<HTMLButtonElement>("button[data-tab]").forEach(button=>{const selected=button.dataset.tab===active;button.classList.toggle("active",selected);button.setAttribute("aria-selected",selected?"true":"false")});Array.from(root.children).forEach(node=>{if(!(node instanceof HTMLElement))return;const section=sectionOf(node);if(section==="identity"||section==="tabs"){node.hidden=false;return}if(section==="unknown")return;node.dataset.cmscSection=section;node.hidden=section!==active});ensureEmpty(root)}
function render(){if(!isScorecard())return;const root=document.querySelector<HTMLElement>(".caregiver-self-scorecard");if(!root)return;renderRoot(root)}
function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;render()})}
function install(){if(installed)return;installed=true;const root=document.querySelector("#mobile-react-root");if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});window.addEventListener("popstate",schedule,{passive:true});schedule();(window as any).SalamatCaregiverScorecardTabsV1={version:VERSION,refresh:render}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
export {};
