import React,{useMemo,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight,X} from "lucide-react";

const TEHRAN="Asia/Tehran";
const partsFormatter=new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn",{timeZone:TEHRAN,year:"numeric",month:"numeric",day:"numeric"});
const labelFormatter=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{timeZone:TEHRAN,year:"numeric",month:"long",day:"numeric"});
const monthFormatter=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{timeZone:TEHRAN,year:"numeric",month:"long"});
const keyFormatter=new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn",{timeZone:TEHRAN,year:"numeric",month:"2-digit",day:"2-digit"});
const weekdays=["ش","ی","د","س","چ","پ","ج"];
type Parts={year:number;month:number;day:number};
function parts(date:Date):Parts{const values:Record<string,string>={};for(const item of partsFormatter.formatToParts(date))if(item.type!=="literal")values[item.type]=item.value;return {year:Number(values.year),month:Number(values.month),day:Number(values.day)}}
function key(date:Date){const values:Record<string,string>={};for(const item of keyFormatter.formatToParts(date))if(item.type!=="literal")values[item.type]=item.value;return `${values.year}-${values.month}-${values.day}`}
function fromKey(value:string){const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return new Date();return new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),12))}
function addDays(date:Date,days:number){return new Date(date.getTime()+days*86400000)}
function sameMonth(date:Date,target:Parts){const p=parts(date);return p.year===target.year&&p.month===target.month}
function daysForMonth(anchor:Date){const target=parts(anchor);let first=anchor;for(let i=0;i<35&&sameMonth(addDays(first,-1),target);i++)first=addDays(first,-1);const days:Date[]=[];for(let cursor=first;days.length<32&&sameMonth(cursor,target);cursor=addDays(cursor,1))days.push(cursor);return days}
function shiftMonth(anchor:Date,direction:-1|1){const current=parts(anchor);let cursor=addDays(anchor,direction*20);for(let i=0;i<45&&sameMonth(cursor,current);i++)cursor=addDays(cursor,direction);return cursor}
function weekOffset(date:Date){return (date.getUTCDay()+1)%7}
function todayKey(){return key(new Date())}

export function AdminJalaliDateFilter({value,onChange,placeholder}:{value:string;onChange:(value:string)=>void;placeholder:string}){
 const [open,setOpen]=useState(false),[anchor,setAnchor]=useState<Date>(()=>value?fromKey(value):new Date());
 const days=useMemo(()=>daysForMonth(anchor),[anchor]),first=days[0]||anchor,offset=weekOffset(first),selected=value?fromKey(value):null;
 const choose=(date:Date)=>{onChange(key(date));setAnchor(date);setOpen(false)};
 return <div className="mafr-jdf-root"><button type="button" className={`mafr-jdf-trigger${value?" active":""}`} aria-label={placeholder} onClick={()=>setOpen(v=>!v)}><CalendarDays size={14}/><span>{value&&selected?labelFormatter.format(selected):placeholder}</span>{value&&<span className="mafr-jdf-clear" role="button" tabIndex={0} aria-label="پاک‌کردن تاریخ" onClick={e=>{e.stopPropagation();onChange("")}} onKeyDown={e=>{if(e.key==="Enter"){e.stopPropagation();onChange("")}}}><X size={11}/></span>}</button>{open&&<div className="mafr-jdf-popover"><header><button type="button" onClick={()=>setAnchor(a=>shiftMonth(a,1))} aria-label="ماه بعد"><ChevronRight size={17}/></button><strong>{monthFormatter.format(anchor)}</strong><button type="button" onClick={()=>setAnchor(a=>shiftMonth(a,-1))} aria-label="ماه قبل"><ChevronLeft size={17}/></button></header><div className="mafr-jdf-week">{weekdays.map(day=><span key={day}>{day}</span>)}</div><div className="mafr-jdf-grid">{Array.from({length:offset},(_,i)=><span className="empty" key={`e${i}`}/>)}{days.map(date=>{const p=parts(date),dateKey=key(date);return <button type="button" key={dateKey} className={`${dateKey===value?"selected":""} ${dateKey===todayKey()?"today":""}`} onClick={()=>choose(date)}>{Number(p.day).toLocaleString("fa-IR")}</button>})}</div><footer><button type="button" onClick={()=>choose(fromKey(todayKey()))}>امروز</button><button type="button" onClick={()=>{onChange("");setOpen(false)}}>پاک‌کردن</button></footer></div>}</div>;
}
