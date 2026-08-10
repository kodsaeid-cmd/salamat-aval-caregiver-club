import {downloadCredentialCard,generateCredentialPassword,suggestCaregiverUsername} from "./credential-card-v1";

type Issued={fullName:string;username:string;password:string};
let admin=false,installed=false,lastIssued:Issued|null=null;

function setNativeValue(input:HTMLInputElement|HTMLSelectElement,value:string){
  const proto=input instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLSelectElement.prototype;
  const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set;setter?.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));
}

function showCredentialPanel(data:Issued){
  lastIssued=data;document.getElementById("salamat-issued-credential-panel")?.remove();
  const panel=document.createElement("div");panel.id="salamat-issued-credential-panel";panel.dir="rtl";panel.style.cssText="position:fixed;z-index:9999;left:16px;right:16px;bottom:20px;max-width:520px;margin:auto;padding:14px;border:1px solid #cfe4d7;border-radius:18px;background:#fff;box-shadow:0 18px 50px rgba(13,76,44,.20);font-family:Vazirmatn,Tahoma,sans-serif;color:#173a2a";
  panel.innerHTML=`<div style="font-weight:900;font-size:14px;margin-bottom:4px">اطلاعات ورود ذخیره شد</div><div style="font-size:11px;color:#687b70;margin-bottom:10px">نام کاربری: <b dir="ltr">${data.username.replace(/[<>&]/g,"")}</b> — برای تحویل امن به مراقب کارت ورود را دانلود کنید.</div><div style="display:grid;grid-template-columns:1fr auto;gap:8px"><button data-download style="min-height:44px;border:0;border-radius:13px;background:#17733f;color:#fff;font:800 12px Vazirmatn,Tahoma,sans-serif">دانلود کارت ورود PNG</button><button data-close style="min-width:72px;border:1px solid #dce8e1;border-radius:13px;background:#f6f9f7;color:#496055;font:800 11px Vazirmatn,Tahoma,sans-serif">بستن</button></div>`;
  panel.querySelector<HTMLButtonElement>("[data-download]")?.addEventListener("click",()=>void downloadCredentialCard(data));panel.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click",()=>panel.remove());document.body.appendChild(panel);
}

function keepEditable(form:HTMLFormElement){
  const username=form.querySelector<HTMLInputElement>('input[name="username"]');
  if(username){username.readOnly=false;username.removeAttribute("readonly")}
}

function enhanceForm(form:HTMLFormElement){
  if(!admin)return;
  keepEditable(form);
  if(form.dataset.salCredV1==="1")return;
  const username=form.querySelector<HTMLInputElement>('input[name="username"]'),password=form.querySelector<HTMLInputElement>('input[name="password"]'),mobile=form.querySelector<HTMLInputElement>('input[name="mobile"]'),fullName=form.querySelector<HTMLInputElement>('input[name="fullName"]'),role=form.querySelector<HTMLSelectElement>('select[name="role"]'),status=form.querySelector<HTMLSelectElement>('select[name="status"]');
  if(!username||!password)return;form.dataset.salCredV1="1";
  const likelyPending=!username.value.trim()&&(!role||role.value.toUpperCase()==="CAREGIVER");
  if(likelyPending){if(!username.value.trim())setNativeValue(username,suggestCaregiverUsername(mobile?.value||""));if(!password.value)setNativeValue(password,generateCredentialPassword());password.required=true;if(status)setNativeValue(status,"ACTIVE");
    if(!form.querySelector("[data-sal-credential-note]")){const note=document.createElement("div");note.setAttribute("data-sal-credential-note","1");note.style.cssText="grid-column:1/-1;padding:10px 12px;border-radius:12px;background:#eef8f2;color:#176c3e;font-size:11px;line-height:1.9";note.textContent="این پرونده هنوز حساب ورود ندارد. با ذخیره در وضعیت فعال، نام کاربری و رمز عبور ساخته و حساب مراقب تأیید می‌شود.";username.closest(".ma-form-grid,.da-form-grid")?.appendChild(note)}
  }
  if(!form.querySelector("[data-sal-credential-generator]")){const generator=document.createElement("button");generator.type="button";generator.setAttribute("data-sal-credential-generator","1");generator.textContent="تولید نام کاربری و رمز جدید";generator.style.cssText="min-height:40px;border:1px solid #cfe4d7;border-radius:12px;background:#eef8f2;color:#17733f;font:800 11px Vazirmatn,Tahoma,sans-serif;padding:8px 12px";generator.addEventListener("click",()=>{keepEditable(form);if(!username.value.trim())setNativeValue(username,suggestCaregiverUsername(mobile?.value||""));setNativeValue(password,generateCredentialPassword());password.type="text"});password.closest("label")?.insertAdjacentElement("afterend",generator)}
  form.addEventListener("submit",()=>{keepEditable(form);const pwd=password.value.trim(),usr=username.value.trim();if(pwd&&usr){lastIssued={fullName:fullName?.value.trim()||"مراقب سلامت اول",username:usr,password:pwd}}},true);
}

function scan(){document.querySelectorAll<HTMLFormElement>("form.ma-form,form.da-form").forEach(enhanceForm)}

async function install(){if(installed)return;installed=true;try{const r=await fetch("/api/auth/me",{credentials:"same-origin",cache:"no-store"}),p:any=await r.json().catch(()=>({}));admin=String(p?.data?.role||"").toUpperCase()==="ADMIN"}catch{admin=false}if(!admin)return;
  const nativeFetch=window.fetch.bind(window);window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{const url=typeof input==="string"?input:input instanceof URL?input.toString():input.url,method=String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase();let captured:Issued|null=null;if(method==="PATCH"&&/\/api\/users\//.test(url)){try{const raw=typeof init?.body==="string"?init.body:input instanceof Request?await input.clone().text():"",body=raw?JSON.parse(raw):{};if(body.password&&body.username)captured={fullName:String(body.fullName||"مراقب سلامت اول"),username:String(body.username),password:String(body.password)}}catch{}}
    const response=await nativeFetch(input as any,init);if(response.ok&&(captured||lastIssued)){const data=captured||lastIssued;if(data){setTimeout(()=>showCredentialPanel(data),80);lastIssued=null}}return response};
  scan();new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["readonly"]});
}
void install();
