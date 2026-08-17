import React from "react";
import {Notify} from "./core";
import {InitialEvaluationFormV2} from "../shared/initial-evaluation-v2";

export function InitialEvaluationTab({caregiverId,initialAccess,notify}:{caregiverId:string;initialAccess:any;notify:Notify}){
 return <InitialEvaluationFormV2 caregiverId={caregiverId} initialAccess={initialAccess} notify={notify}/>;
}
