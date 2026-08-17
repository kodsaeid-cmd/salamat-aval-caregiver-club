export const JOB_AD_WEEKDAYS=[
 {key:"SAT",label:"شنبه"},{key:"SUN",label:"یکشنبه"},{key:"MON",label:"دوشنبه"},{key:"TUE",label:"سه‌شنبه"},{key:"WED",label:"چهارشنبه"},{key:"THU",label:"پنجشنبه"},{key:"FRI",label:"جمعه"},
] as const;

export type JobAdWeekday=(typeof JOB_AD_WEEKDAYS)[number]["key"];
export const DEFAULT_JOB_AD_WEEKDAYS:JobAdWeekday[]=["SAT","SUN","MON","TUE","WED","THU"];
const VALID=new Set<string>(JOB_AD_WEEKDAYS.map(day=>day.key));

function rawList(value:unknown):unknown[]{
 if(Array.isArray(value))return value;
 if(value==null||value==="")return [];
 if(typeof value==="string"){
  const text=value.trim();if(!text)return [];
  if(text.startsWith("[")){try{const parsed=JSON.parse(text);if(Array.isArray(parsed))return parsed}catch{}}
  return text.split(/[,،|]/g);
 }
 return [value];
}

export function normalizeJobAdWeekdays(value:unknown):JobAdWeekday[]{
 const wanted=new Set(rawList(value).map(item=>String(item??"").trim().toUpperCase()).filter(item=>VALID.has(item)));
 return JOB_AD_WEEKDAYS.map(day=>day.key).filter(day=>wanted.has(day));
}

export function jobAdWeekdaysOrDefault(value:unknown):JobAdWeekday[]{
 const normalized=normalizeJobAdWeekdays(value);return normalized.length?normalized:[...DEFAULT_JOB_AD_WEEKDAYS];
}

export function serializeJobAdWeekdays(value:unknown){return JSON.stringify(jobAdWeekdaysOrDefault(value))}

export function jobAdWeekdayScoreFactor(value:unknown){
 const count=Math.min(6,normalizeJobAdWeekdays(value).length);if(count<=0)return 0;
 // Full weekly basis is 6 days. Every one selected day below 6 reduces
 // half an effective workday, therefore every two fewer selected days
 // reduce the score by the equivalent of one 6-day workday. Seven days
 // are allowed but never raise the score above the six-day ceiling.
 return Math.min(1,(6+count)/12);
}

export function applyJobAdWeekdayScore(basePoints:unknown,value:unknown){
 const points=Math.max(0,Number(basePoints||0)),factor=jobAdWeekdayScoreFactor(value);if(points<=0||factor<=0)return 0;
 return Math.max(1,Math.round(points*factor));
}

export function jobAdWeekdayLabels(value:unknown){
 const normalized=jobAdWeekdaysOrDefault(value),labels=new Map(JOB_AD_WEEKDAYS.map(day=>[day.key,day.label]));
 return normalized.map(day=>labels.get(day)||day);
}
