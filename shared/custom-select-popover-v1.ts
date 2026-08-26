import "./custom-select-popover-v1.css";

type OpenState={select:HTMLSelectElement;root:HTMLDivElement;search:HTMLInputElement|null;list:HTMLDivElement};

let state:OpenState|null=null;
let suppressClickUntil=0;

function usableSelect(target:EventTarget|null){
 const select=target instanceof Element?target.closest("select"):null;
 if(!(select instanceof HTMLSelectElement))return null;
 if(select.disabled||select.multiple||Number(select.size||0)>1||select.dataset.nativeSelect==="true")return null;
 return select;
}

function selectLabel(select:HTMLSelectElement){
 const explicit=select.getAttribute("aria-label")?.trim();
 if(explicit)return explicit;
 const labelledBy=select.getAttribute("aria-labelledby")?.trim();
 if(labelledBy){const label=labelledBy.split(/\s+/).map(id=>document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(" ");if(label)return label}
 const parent=select.closest("label");
 const span=parent?.querySelector(":scope > span");
 return span?.textContent?.trim()||select.name||"انتخاب گزینه";
}

function closePopover(refocus=false){
 if(!state)return;
 const {select,root}=state;
 select.classList.remove("sa-select-runtime-open");
 root.remove();
 state=null;
 if(refocus)requestAnimationFrame(()=>select.focus({preventScroll:true}));
}

function positionPopover(select:HTMLSelectElement,root:HTMLDivElement){
 const rect=select.getBoundingClientRect();
 const gap=6,pad=8;
 const width=Math.min(Math.max(rect.width,240),Math.max(240,window.innerWidth-pad*2));
 root.style.width=`${Math.round(width)}px`;
 root.style.left=`${Math.round(Math.min(Math.max(rect.left,pad),window.innerWidth-width-pad))}px`;
 root.style.top=`${Math.round(Math.min(rect.bottom+gap,window.innerHeight-pad))}px`;
 requestAnimationFrame(()=>{
  if(!root.isConnected)return;
  const height=root.getBoundingClientRect().height;
  const below=window.innerHeight-rect.bottom-gap-pad;
  const above=rect.top-gap-pad;
  const top=below>=Math.min(height,260)||below>=above?rect.bottom+gap:Math.max(pad,rect.top-gap-height);
  root.style.top=`${Math.round(Math.min(Math.max(top,pad),Math.max(pad,window.innerHeight-height-pad)))}px`;
 });
}

function renderOptions(current:OpenState,query=""){
 const q=query.trim().toLocaleLowerCase("fa-IR");
 current.list.replaceChildren();
 const options=Array.from(current.select.options).filter(option=>!option.hidden);
 const visible=options.filter(option=>!q||option.textContent?.toLocaleLowerCase("fa-IR").includes(q));
 if(!visible.length){const empty=document.createElement("div");empty.className="sa-select-popover-empty";empty.textContent="گزینه‌ای پیدا نشد";current.list.appendChild(empty);return}
 for(const option of visible){
  const button=document.createElement("button");
  button.type="button";
  button.className="sa-select-popover-option";
  button.disabled=option.disabled;
  button.setAttribute("role","option");
  button.setAttribute("aria-selected",String(option.selected));
  const text=document.createElement("span");text.textContent=option.textContent||"—";button.appendChild(text);
  const group=option.parentElement instanceof HTMLOptGroupElement?option.parentElement.label.trim():"";
  if(option.selected){const check=document.createElement("span");check.className="sa-select-popover-check";check.textContent="✓";button.appendChild(check)}
  else if(group){const small=document.createElement("small");small.textContent=group;button.appendChild(small)}
  button.addEventListener("click",event=>{
   event.preventDefault();
   event.stopPropagation();
   if(button.disabled)return;
   const changed=current.select.value!==option.value;
   current.select.value=option.value;
   option.selected=true;
   if(changed){current.select.dispatchEvent(new Event("input",{bubbles:true}));current.select.dispatchEvent(new Event("change",{bubbles:true}))}
   closePopover(true);
  });
  current.list.appendChild(button);
 }
 requestAnimationFrame(()=>current.list.querySelector<HTMLElement>("[aria-selected='true']")?.scrollIntoView({block:"nearest"}));
}

function openPopover(select:HTMLSelectElement){
 if(state?.select===select)return;
 closePopover(false);
 const root=document.createElement("div");root.className="sa-select-popover";root.setAttribute("role","presentation");
 const head=document.createElement("div");head.className="sa-select-popover-head";
 const title=document.createElement("strong");title.className="sa-select-popover-title";title.textContent=selectLabel(select);head.appendChild(title);
 const options=Array.from(select.options).filter(option=>!option.hidden);
 let search:HTMLInputElement|null=null;
 if(options.length>8){search=document.createElement("input");search.className="sa-select-popover-search";search.type="search";search.autocomplete="off";search.placeholder="جست‌وجو در گزینه‌ها…";head.appendChild(search)}
 const list=document.createElement("div");list.className="sa-select-popover-list";list.setAttribute("role","listbox");
 root.append(head,list);document.body.appendChild(root);
 select.classList.add("sa-select-runtime-open");
 state={select,root,search,list};
 renderOptions(state);
 positionPopover(select,root);
 if(search){search.addEventListener("input",()=>state&&state.select===select&&renderOptions(state,search!.value));requestAnimationFrame(()=>search?.focus({preventScroll:true}))}
 else requestAnimationFrame(()=>list.querySelector<HTMLElement>("[aria-selected='true']")?.focus({preventScroll:true}));
}

function isInsidePopover(target:EventTarget|null){return Boolean(state&&target instanceof Node&&state.root.contains(target));}

document.addEventListener("pointerdown",event=>{
 if(isInsidePopover(event.target))return;
 const select=usableSelect(event.target);
 if(select){
  event.preventDefault();
  event.stopPropagation();
  suppressClickUntil=performance.now()+500;
  select.focus({preventScroll:true});
  openPopover(select);
  return;
 }
 if(state)closePopover(false);
},true);

document.addEventListener("click",event=>{
 const select=usableSelect(event.target);
 if(!select)return;
 event.preventDefault();
 event.stopPropagation();
 if(performance.now()>suppressClickUntil)openPopover(select);
},true);

document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&state){event.preventDefault();closePopover(true);return}
 const select=usableSelect(event.target);
 if(!select)return;
 if(["Enter"," ","ArrowDown","ArrowUp"].includes(event.key)){
  event.preventDefault();
  event.stopPropagation();
  openPopover(select);
 }
},true);

window.addEventListener("resize",()=>state&&positionPopover(state.select,state.root),{passive:true});
window.addEventListener("scroll",()=>state&&positionPopover(state.select,state.root),{passive:true,capture:true});

document.addEventListener("focusin",event=>{if(state&&!isInsidePopover(event.target)&&event.target!==state.select&&!(event.target instanceof HTMLSelectElement))closePopover(false)},true);

export const CUSTOM_SELECT_POPOVER_VERSION="1.0.0";
