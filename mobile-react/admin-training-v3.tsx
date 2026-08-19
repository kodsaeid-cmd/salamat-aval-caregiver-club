import React,{useEffect,useRef,useState} from "react";
import {AdminTrainingMobileV2} from "./admin-training-v2";

type Notify=(message:string,tone?:"success"|"error"|"info")=>void;
const OPTIONAL_EMPTY_SENTINEL="__SALAMAT_OPTIONAL_EMPTY__";
const PRESERVE_CONTENT_SENTINEL="__SALAMAT_PRESERVE_CONTENT__";
const MAX_TRAINING_FILE_BYTES=100*1024*1024;
const TRAINING_FILE_ACCEPT=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.md,.srt,.vtt,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mp3,.m4a";
function normalizedUrl(value:unknown){const raw=String(value||"").trim();return /^www\./i.test(raw)?`https://${raw}`:raw}
function isCreateTrainingForm(form:HTMLFormElement){return Array.from(form.querySelectorAll("button")).some(button=>/ثبت در بانک آموزش|ثبت آموزش/.test(String(button.textContent||"")))}
function isEditTrainingForm(form:HTMLFormElement){return Array.from(form.querySelectorAll("button")).some(button=>/ذخیره تغییرات/.test(String(button.textContent||"")))}
function relaxManagedForm(form:HTMLFormElement){
 if(!isCreateTrainingForm(form)&&!isEditTrainingForm(form))return;
 form.querySelectorAll<HTMLElement>("[required]").forEach(node=>node.removeAttribute("required"));
 form.querySelectorAll("label>span").forEach(span=>{if(!/اختیاری/.test(String(span.textContent||"")))span.textContent=`${span.textContent||""} (اختیاری)`});
}
async function uploadTrainingFile(file:File){
 if(!file.size)throw new Error("فایل آموزشی خالی است.");
 if(file.size>MAX_TRAINING_FILE_BYTES)throw new Error("حداکثر حجم فایل آموزشی ۱۰۰ مگابایت است.");
 const response=await fetch("/api/files/raw",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":file.type||"application/octet-stream","x-file-name":encodeURIComponent(file.name),"x-file-size":String(file.size),"x-file-category":"training"},body:file});
 const payload:any=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload?.message||`بارگذاری فایل انجام نشد (خطای ${response.status}).`);
 const id=String(payload?.data?.id||"").trim();if(!id)throw new Error("شناسه فایل بارگذاری‌شده دریافت نشد.");
 return `/api/files/${encodeURIComponent(id)}/download?inline=1`;
}
export function AdminTrainingMobileV3({access,onExit,notify}:{access:any;onExit:()=>void;notify:Notify}){
 const shell=useRef<HTMLDivElement>(null),[courses,setCourses]=useState<any[]>([]);const coursesRef=useRef<any[]>([]);coursesRef.current=courses;
 const loadCourses=async()=>{try{const r=await fetch("/api/training/admin",{credentials:"same-origin",cache:"no-store"});if(!r.ok)return;const p:any=await r.json();setCourses(Array.isArray(p?.data?.courses)?p.data.courses:[])}catch{}};
 useEffect(()=>{void loadCourses()},[]);
 useEffect(()=>{const root=shell.current;if(!root)return;const submitCapture=async(event:Event)=>{
  const form=event.target instanceof HTMLFormElement?event.target:null;if(!form||!form.querySelector('[name="categoryGroup"]'))return;
  const createForm=isCreateTrainingForm(form),editForm=isEditTrainingForm(form);if(!createForm&&!editForm)return;
  relaxManagedForm(form);
  const content=form.querySelector<HTMLInputElement>('[name="contentUrl"]'),fileInput=form.querySelector<HTMLInputElement>('input[data-training-content-file="1"]'),file=fileInput?.files?.[0];
  if(file){
   event.preventDefault();event.stopPropagation();
   if(form.dataset.trainingUploadBusy==="1")return;form.dataset.trainingUploadBusy="1";
   const submit=form.querySelector<HTMLButtonElement>('button.ma-save');const previous=submit?.textContent||"";if(submit){submit.disabled=true;submit.textContent="در حال بارگذاری فایل..."}
   try{const url=await uploadTrainingFile(file);if(content)content.value=url;if(fileInput)fileInput.value="";notify("فایل آموزشی با موفقیت بارگذاری شد.","success");delete form.dataset.trainingUploadBusy;queueMicrotask(()=>form.requestSubmit())}
   catch(error:any){delete form.dataset.trainingUploadBusy;if(submit){submit.disabled=false;submit.textContent=previous}notify(error?.message||"بارگذاری فایل آموزشی انجام نشد.","error")}
   return;
  }
  if(content&&!content.value.trim()){
   content.value=createForm?OPTIONAL_EMPTY_SENTINEL:PRESERVE_CONTENT_SENTINEL;
   queueMicrotask(()=>{if(content.value===OPTIONAL_EMPTY_SENTINEL||content.value===PRESERVE_CONTENT_SENTINEL)content.value=""});
  }
 };root.addEventListener("submit",submitCapture,true);return()=>root.removeEventListener("submit",submitCapture,true)},[notify]);
 useEffect(()=>{const nativeFetch=window.fetch.bind(window);const patched:typeof window.fetch=async(input,init)=>{const raw=typeof input==="string"?input:input instanceof URL?input.toString():input.url,url=new URL(raw,location.origin),method=String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase();if(url.origin===location.origin&&(url.pathname==="/api/training/courses"&&method==="POST"||/^\/api\/training\/courses\/[^/]+$/.test(url.pathname)&&method==="PATCH")&&typeof init?.body==="string"){try{const body=JSON.parse(init.body);if(body.contentUrl===PRESERVE_CONTENT_SENTINEL)delete body.contentUrl;if(!Object.prototype.hasOwnProperty.call(body,"examUrl")){const inputNode=shell.current?.querySelector<HTMLInputElement>('input[data-training-exam-url="1"]');body.examUrl=String(inputNode?.value||"").trim()}init={...init,body:JSON.stringify(body)}}catch{}}const response=await nativeFetch(input as RequestInfo|URL,init);if(response.ok&&url.origin===location.origin&&((url.pathname==="/api/training/courses"&&method==="POST")||(/^\/api\/training\/courses\/[^/]+$/.test(url.pathname)&&["PATCH","DELETE"].includes(method))))setTimeout(()=>void loadCourses(),80);return response};window.fetch=patched;return()=>{if(window.fetch===patched)window.fetch=nativeFetch as typeof window.fetch}},[]);
 useEffect(()=>{const root=shell.current;if(!root)return;const decorate=()=>{const current=coursesRef.current;root.querySelectorAll<HTMLFormElement>("form.ma-form").forEach(form=>{
  const createForm=isCreateTrainingForm(form),editForm=isEditTrainingForm(form);if(!createForm&&!editForm)return;relaxManagedForm(form);
  const contentInput=form.querySelector<HTMLInputElement>('[name="contentUrl"]');
  if(contentInput&&!form.querySelector('[data-training-file-field="1"]')){const label=document.createElement("label");label.className="wide";label.dataset.trainingFileField="1";const span=document.createElement("span");span.textContent="فایل آموزش (اختیاری)";const input=document.createElement("input");input.type="file";input.accept=TRAINING_FILE_ACCEPT;input.dataset.trainingContentFile="1";const note=document.createElement("small");note.textContent="PDF، Word، تصویر، صوت یا ویدئو؛ حداکثر ۱۰۰ مگابایت. با انتخاب فایل، نشانی محتوا خودکار ثبت می‌شود.";note.style.cssText="display:block;margin-top:6px;color:#60776d;font-size:11px";label.append(span,input,note);contentInput.closest("label")?.parentElement?.insertBefore(label,contentInput.closest("label"))}
  if(!form.querySelector('[name="contentUrl"]')||form.querySelector('[data-training-exam-field="1"]'))return;
  const title=String(form.querySelector<HTMLInputElement>('[name="title"]')?.value||"").trim(),content=String(form.querySelector<HTMLInputElement>('[name="contentUrl"]')?.value||"").trim();const course=current.find(x=>String(x.contentUrl||"").trim()===content&&content)||current.find(x=>String(x.title||"").trim()===title&&title);
  const label=document.createElement("label");label.className="wide";label.dataset.trainingExamField="1";const span=document.createElement("span");span.textContent="لینک آزمون (اختیاری)";const input=document.createElement("input");input.type="url";input.required=false;input.placeholder="https://...";input.value=normalizedUrl(course?.examUrl);input.dataset.trainingExamUrl="1";label.append(span,input);const description=Array.from(form.querySelectorAll("label")).find(x=>x.querySelector("textarea[name='description']"));description?.parentElement?.insertBefore(label,description);if(!description)form.querySelector(".ma-form-grid")?.appendChild(label);relaxManagedForm(form)
 });root.querySelectorAll<HTMLElement>(".atv3-course-row").forEach(row=>{const title=String(row.querySelector("strong")?.textContent||"").trim();if(!title||row.querySelector(".atv3-exam-link"))return;const course=current.find(x=>String(x.title||"").trim()===title),body=row.querySelector("span:nth-child(2)");if(!body)return;const line=document.createElement("small");line.className="atv3-exam-link";if(course?.examUrl){const a=document.createElement("a");a.href=normalizedUrl(course.examUrl);a.target="_blank";a.rel="noopener noreferrer";a.textContent="لینک آزمون";a.style.cssText="color:#087443;font-weight:900;text-decoration:none";line.appendChild(a)}else{line.textContent="آزمون: ثبت نشده"}body.appendChild(line)})};decorate();const observer=new MutationObserver(decorate);observer.observe(root,{childList:true,subtree:true});return()=>observer.disconnect()},[courses]);
 return <div ref={shell} className="atv3-exam-shell"><style>{`[data-training-exam-field="1"] input{direction:ltr}[data-training-file-field="1"] input{direction:rtl;padding:9px;background:#fff}.atv3-exam-link{display:block;margin-top:4px}`}</style><AdminTrainingMobileV2 access={access} onExit={onExit} notify={notify}/></div>;
}
