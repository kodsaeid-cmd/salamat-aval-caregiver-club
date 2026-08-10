import React,{useMemo,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight,X} from "lucide-react";

const TEHRAN="Asia/Tehran";
const persianPartsFormatter=new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn",{timeZone:TEHRAN,year:"numeric",month:"numeric",day:"numeric"});
const persianLabelFormatter=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{timeZone:TEHRAN,year:"numeric",month:"long",day:"numeric"});
const persianMonthFormatter=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{timeZone:TEHRAN,year:"numeric",month:"long"});
const gregorianKeyFormatter=new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn",{timeZone:TEHRAN,year:"numeric",month:"2-digit",day:"2-digit"});
const weekdays=["ش","ی","د","س","چ","پ","ج"];

type Parts={year:number;month:number;day:number};
function parts(date:Date):Parts{const values:Record<string,string>={};for(const item of persianPartsFormatter.formatToParts(date))if(item.type!=="literal")values[item.type]=item.value;return {year:Number(values.year),month:Number(values.month),day:Number(values.day)}}
function key(date:Date){const values:Record<string,string>={};for(const item of gregorianKeyFormatter.formatToParts(date))if(item.type!=="literal")values[item.type]=item.value;return `${values.year}-${values.month}-${values.day}`}
function fromKey(value:string){const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return new Date();return new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),12))}
function addDays(date:Date,days:number){return new Date(date.getTime()+days*86400000)}
function sameMonth(date:Date,target:Parts){const p=parts(date);return p.year===target.year&&p.month===target.month}
function daysForMonth(anchor:Date){const target=parts(anchor);let first=anchor;for(let i=0;i<35&&sameMonth(addDays(first,-1),target);i++)first=addDays(first,-1);const days:Date[]=[];for(let cursor=first;days.length<32&&sameMonth(cursor,target);cursor=addDays(cursor,1))days.push(cursor);return days}
function shiftPersianMonth(anchor:Date,direction:-1|1){const current=parts(anchor);let cursor=addDays(anchor,direction*20);for(let i=0;i<45&&sameMonth(cursor,current);i++)cursor=addDays(cursor,direction);return cursor}
function weekOffset(date:Date){return (date.getUTCDay()+1)%7}

export function tehranDateKey(offsetDays=0){return key(addDays(new Date(),offsetDays))}
export function tehranIsoRange(value:string){const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return null;const y=Number(match[1]),m=Number(match[2]),d=Number(match[3]),tehranOffsetMs=210*60*1000;const start=Date.UTC(y,m-1,d)-tehranOffsetMs;return {from:new Date(start).toISOString(),to:new Date(start+86400000).toISOString()}}

export function JalaliDateFilter({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false),[anchor,setAnchor]=useState<Date>(()=>value?fromKey(value):new Date());
 const days=useMemo(()=>daysForMonth(anchor),[anchor]);
 const first=days[0]||anchor,offset=weekOffset(first),selected=value?fromKey(value):null;
 const label=value&&selected?persianLabelFormatter.format(selected):"تاریخ ایجاد پروفایل";
 const choose=(date:Date)=>{onChange(key(date));setAnchor(date);setOpen(false)};
 return <div className="jdf-root">
  <button type="button" className={`jdf-trigger ${value?"active":""}`} onClick={()=>setOpen(v=>!v)}><CalendarDays size={17}/><span>{label}</span>{value&&<span className="jdf-clear" role="button" tabIndex={0} onClick={e=>{e.stopPropagation();onChange("")}} onKeyDown={e=>{if(e.key==="Enter"){e.stopPropagation();onChange("")}}}><X size={14}/></span>}</button>
  {open&&<div className="jdf-popover"><header><button type="button" onClick={()=>setAnchor(a=>shiftPersianMonth(a,1))} aria-label="ماه بعد"><ChevronRight size={18}/></button><strong>{persianMonthFormatter.format(anchor)}</strong><button type="button" onClick={()=>setAnchor(a=>shiftPersianMonth(a,-1))} aria-label="ماه قبل"><ChevronLeft size={18}/></button></header><div className="jdf-week">{weekdays.map(day=><span key={day}>{day}</span>)}</div><div className="jdf-grid">{Array.from({length:offset},(_,i)=><span className="empty" key={`e${i}`}/>)}{days.map(date=>{const p=parts(date),dateKey=key(date),today=dateKey===tehranDateKey();return <button type="button" key={dateKey} className={`${dateKey===value?"selected":""} ${today?"today":""}`} onClick={()=>choose(date)}>{Number(p.day).toLocaleString("fa-IR")}</button>})}</div><footer><button type="button" onClick={()=>choose(fromKey(tehranDateKey()))}>امروز</button><button type="button" onClick={()=>{onChange("");setOpen(false)}}>پاک‌کردن</button></footer></div>}
 </div>
}
