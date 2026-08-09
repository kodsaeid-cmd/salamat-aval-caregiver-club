import React,{useState} from "react";

const ones=["","یک","دو","سه","چهار","پنج","شش","هفت","هشت","نه","ده","یازده","دوازده","سیزده","چهارده","پانزده","شانزده","هفده","هجده","نوزده"];
const tens=["","","بیست","سی","چهل","پنجاه","شصت","هفتاد","هشتاد","نود"];
const hundreds=["","صد","دویست","سیصد","چهارصد","پانصد","ششصد","هفتصد","هشتصد","نهصد"];
const scales=["","هزار","میلیون","میلیارد","تریلیون","کوادریلیون"];
const join=(parts:string[])=>parts.filter(Boolean).join(" و ");
function chunkWords(n:number){const p:string[]=[];const h=Math.floor(n/100),r=n%100;if(h)p.push(hundreds[h]);if(r<20){if(r)p.push(ones[r])}else{const t=Math.floor(r/10),o=r%10;p.push(tens[t]);if(o)p.push(ones[o])}return join(p)}
export function numberToPersianWords(value:number){let n=Math.max(0,Math.trunc(value));if(!n)return "صفر";const groups:string[]=[];let scale=0;while(n>0&&scale<scales.length){const chunk=n%1000;if(chunk){const w=chunkWords(chunk);groups.unshift(scales[scale]?`${w} ${scales[scale]}`:w)}n=Math.floor(n/1000);scale++}return join(groups)}
export function normalizeNumericText(value:string){return value.replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^0-9]/g,"").replace(/^0+(?=\d)/,"")}
export function PersianRialInput({name="caregiverSalaryRial",required=true}:{name?:string;required?:boolean}){const [raw,setRaw]=useState("");const amount=Number(raw||0),toman=Math.floor(amount/10);const display=raw?amount.toLocaleString("fa-IR"):"";return <div className="ja-money-field"><input type="hidden" name={name} value={raw}/><input className="ja-money-input" type="text" inputMode="numeric" autoComplete="off" value={display} onChange={e=>setRaw(normalizeNumericText(e.target.value))} placeholder="مثلاً ۱۵۰,۰۰۰,۰۰۰" aria-label="حقوق مراقب به ریال" required={required}/><div className="ja-money-words">{raw?`${numberToPersianWords(toman)} تومان`:"مبلغ به حروف تومان همزمان اینجا نمایش داده می‌شود"}</div></div>}
