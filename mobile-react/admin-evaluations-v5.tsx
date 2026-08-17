import React,{useState} from "react";
import {ArrowRight,BookOpen,ClipboardCheck,UserCheck} from "lucide-react";
import {AdminEvaluationsMobileV4} from "./admin-evaluations-v4";
import {AdminTrainingExamEvaluationMobile} from "./admin-training-exam-evaluation-v1";
import {AdminInitialEvaluationMobileV2} from "./admin-initial-evaluation-v2";
import {AdminEvaluationDirectoryControlsMobileV1} from "./admin-evaluation-directory-controls-v1";

type Notify=(message:string,tone?:"success"|"error"|"info")=>void;
const SWITCH_CSS=`.mae-v5-switch{position:sticky;top:0;z-index:20;display:flex;gap:5px;padding:9px 8px;background:#f5f9f7;border-bottom:1px solid #dce7e1}.mae-v5-switch button{flex:1;min-width:0;border:1px solid #d8e5df;background:#fff;border-radius:11px;padding:8px 4px;font:inherit;font-size:9px;font-weight:900;color:#466057;display:flex;align-items:center;justify-content:center;gap:4px}.mae-v5-switch button.active{background:#087443;border-color:#087443;color:#fff}`;
export function AdminEvaluationsMobileV5({user,onExit}:{user:any;onExit:()=>void}){
 const [section,setSection]=useState<"professional"|"initial"|"training">("professional"),[notice,setNotice]=useState<{message:string;tone:string}|null>(null);const notify:Notify=(message,tone="info")=>{setNotice({message,tone});window.setTimeout(()=>setNotice(null),3200)};
 const tabs=<div className="mae-v5-switch"><button className={section==="professional"?"active":""} onClick={()=>setSection("professional")}><ClipboardCheck size={14}/>فنی و پروانه</button><button className={section==="initial"?"active":""} onClick={()=>setSection("initial")}><UserCheck size={14}/>ارزیابی بدوی</button><button className={section==="training"?"active":""} onClick={()=>setSection("training")}><BookOpen size={14}/>ارزیابی آموزش</button></div>;
 if(section==="professional")return <div className="mae-v5-shell"><style>{SWITCH_CSS}</style>{tabs}<AdminEvaluationsMobileV4 user={user} onExit={onExit}/></div>;
 return <div className="ma-app"><style>{SWITCH_CSS}</style><header className="ma-header"><button className="ma-header-action" onClick={onExit}><ArrowRight size={21}/></button><div className="ma-brand"><div><strong>{section==="initial"?"ارزیابی بدوی":"ارزیابی آموزش"}</strong><small>{section==="initial"?"فرم کیفی محرمانه مراقب":"نتایج آزمون دوره‌های آموزشی"}</small></div></div><span className="ma-avatar">{section==="initial"?<UserCheck size={20}/>:<BookOpen size={20}/>}</span></header>{tabs}<main className="ma-main"><AdminEvaluationDirectoryControlsMobileV1>{version=>section==="initial"?<AdminInitialEvaluationMobileV2 key={`initial-${version}`} notify={notify}/>:<AdminTrainingExamEvaluationMobile key={`training-${version}`} notify={notify}/>}</AdminEvaluationDirectoryControlsMobileV1></main>{notice&&<div className={`ma-toast ${notice.tone}`}>{notice.message}</div>}</div>;
}
