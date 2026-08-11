type TabKey="technical"|"analysis"|"credit"|"activity";
const VERSION="1.1.0";
const TABS:Array<{key:TabKey;label:string}>=[
 {key:"technical",label:"کارنامه فنی"},
 {key:"analysis",label:"تحلیل فنی"},
 {key:"credit",label:"رتبه‌بندی اعتباری"},
 {key:"activity",label:"خلاصه فعالیت حرفه‌ای"},
];
const ICONS:Record<TabKey,string>={
 technical:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 4.5h8M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1Z"/><path d="M6.5 5.5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><path d="M8 14h2l1.2-3 2 6 1.3-3H17"/></svg>`,
 analysis:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 18.5V14l3-3 3 2 4.5-5 3.5 2.5"/><path d="M15.5 8H19v3.5"/><path d="M5 5.5h3M6.5 4v3"/><path d="M5 20h14"/></svg>`,
 credit:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5 19 6v5.2c0 4.4-2.8 7.6-7 9.3-4.2-1.7-7-4.9-7-9.3V6l7-2.5Z"/><path d="m12 7.4 1.25 2.55 2.8.4-2.03 1.98.48 2.8L12 13.82l-2.5 1.31.48-2.8-2.03-1.98 2.8-.4L12 7.4Z"/></svg>`,
 activity:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><path d="M3 12.5c2.5 1.4 5.5 2.1 9 2.1s6.5-.7 9-2.1M10.2 14.4v1.8h3.6v-1.8"/></svg>`,
};
let active:TabKey="technical",frame=0,installed=false;
const text=(value:unknown)=>String(value??"").trim();
const isScorecard=()=>/^\/mobile\/scorecard\/?$/.test(location.pathname)||/^\/mobile\/admin\/caregivers(?:\/.*)?$/.test(location.pathname);
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
function ensureTabs(root:HTMLElement){let nav=root.querySelector<HTMLElement>("#cmsc-scorecard-tabs");if(nav)return nav;nav=document.createElement("nav");nav.id="cmsc-scorecard-tabs";nav.className="cmsc-scorecard-tabs";nav.setAttribute("aria-label","بخش‌های کارنامه مراقب");nav.setAttribute("role","tablist");for(const item of TABS){const button=document.createElement("button");button.type="button";button.dataset.tab=item.key;button.setAttribute("role","tab");button.setAttribute("aria-label",item.label);button.innerHTML=`<span class="cmsc-tab-icon" aria-hidden="true">${ICONS[item.key]}</span><span class="cmsc-tab-label">${item.label}</span>`;button.addEventListener("click",()=>{active=item.key;renderRoot(root);nav?.scrollIntoView({block:"nearest",behavior:"smooth"})});nav.appendChild(button)}const identity=Array.from(root.children).find(node=>sectionOf(node)==="identity");if(identity?.nextSibling)root.insertBefore(nav,identity.nextSibling);else root.prepend(nav);return nav}
function renderRoot(root:HTMLElement){root.classList.add("cmsc-scorecard-tabbed");const nav=ensureTabs(root);nav.querySelectorAll<HTMLButtonElement>("button[data-tab]").forEach(button=>{const selected=button.dataset.tab===active;button.classList.toggle("active",selected);button.setAttribute("aria-selected",selected?"true":"false");button.tabIndex=selected?0:-1});Array.from(root.children).forEach(node=>{if(!(node instanceof HTMLElement))return;const section=sectionOf(node);if(section==="identity"||section==="tabs"){node.hidden=false;return}if(section==="unknown")return;node.dataset.cmscSection=section;node.hidden=section!==active});ensureEmpty(root)}
function render(){if(!isScorecard())return;const root=document.querySelector<HTMLElement>(".caregiver-self-scorecard");if(!root)return;renderRoot(root)}
function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;render()})}
function install(){if(installed)return;installed=true;const root=document.querySelector("#mobile-react-root,#mobile-admin-root");if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});window.addEventListener("popstate",schedule,{passive:true});window.addEventListener("salamat-admin-route-v2",schedule as EventListener,{passive:true});schedule();(window as any).SalamatCaregiverScorecardTabsV1={version:VERSION,refresh:render}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
export {};
