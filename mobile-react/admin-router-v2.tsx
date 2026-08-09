import React,{useEffect,useState} from "react";
import {AdminMobileApp} from "./admin";
import {AdminEvaluationsMobileV2} from "./admin-evaluations-v2";
import "./admin-grid-v2.css";

const ROUTE_EVENT="salamat-admin-route-v2";
function currentPath(){return location.pathname}
function go(path:string){history.pushState({},"",path);window.dispatchEvent(new Event(ROUTE_EVENT));window.scrollTo({top:0,behavior:"auto"})}

export function AdminMobileRouterV2({user,onLogout}:{user:any;onLogout:()=>void}){
 const [path,setPath]=useState(currentPath);
 useEffect(()=>{const nativePush=history.pushState.bind(history),nativeReplace=history.replaceState.bind(history);const emit=()=>window.dispatchEvent(new Event(ROUTE_EVENT));history.pushState=((...args:any[])=>{nativePush(...args as [any,string,string?]);emit()}) as History["pushState"];history.replaceState=((...args:any[])=>{nativeReplace(...args as [any,string,string?]);emit()}) as History["replaceState"];const sync=()=>setPath(currentPath());window.addEventListener("popstate",sync);window.addEventListener(ROUTE_EVENT,sync);return()=>{history.pushState=nativePush as History["pushState"];history.replaceState=nativeReplace as History["replaceState"];window.removeEventListener("popstate",sync);window.removeEventListener(ROUTE_EVENT,sync)}},[]);
 if(/^\/mobile\/admin\/evaluations(?:\/|$)/.test(path))return <AdminEvaluationsMobileV2 user={user} onExit={()=>go("/mobile/admin/")}/>;
 return <AdminMobileApp user={user} onLogout={onLogout}/>;
}
