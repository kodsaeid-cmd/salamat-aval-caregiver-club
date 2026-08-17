export type TrainingDeliveryMode="IN_PERSON"|"REMOTE"|"HYBRID";
export type TrainingLearningNature="THEORY"|"PRACTICAL"|"MIXED";
export type TrainingCategoryGroup="CLINICAL"|"GENERAL";
export type TrainingCategoryAudience="ELDERLY"|"PATIENT"|"CHILD"|"";
export type TrainingCategoryStage="PRE_CONTRACT"|"ONBOARDING"|"REFRESHER";

export const TRAINING_DELIVERY_OPTIONS=[
 {key:"IN_PERSON",label:"حضوری"},
 {key:"REMOTE",label:"از راه دور"},
 {key:"HYBRID",label:"حضوری/از راه دور"},
] as const;

export const TRAINING_NATURE_OPTIONS=[
 {key:"THEORY",label:"تئوری"},
 {key:"PRACTICAL",label:"عملی"},
 {key:"MIXED",label:"تئوری/عملی"},
] as const;

export const TRAINING_GROUP_OPTIONS=[
 {key:"CLINICAL",label:"بالینی"},
 {key:"GENERAL",label:"عمومی"},
] as const;

export const TRAINING_CLINICAL_AUDIENCE_OPTIONS=[
 {key:"ELDERLY",label:"سالمند"},
 {key:"PATIENT",label:"بیمار"},
 {key:"CHILD",label:"کودک"},
] as const;

export const TRAINING_CLINICAL_STAGE_OPTIONS=[
 {key:"PRE_CONTRACT",label:"پیش از قرارداد"},
 {key:"REFRESHER",label:"بازآموزی"},
] as const;

export const TRAINING_GENERAL_STAGE_OPTIONS=[
 {key:"ONBOARDING",label:"بدو استخدام"},
 {key:"REFRESHER",label:"بازآموزی"},
] as const;

const deliveryKeys=new Set(TRAINING_DELIVERY_OPTIONS.map(x=>x.key));
const natureKeys=new Set(TRAINING_NATURE_OPTIONS.map(x=>x.key));
const groupKeys=new Set(TRAINING_GROUP_OPTIONS.map(x=>x.key));
const audienceKeys=new Set(TRAINING_CLINICAL_AUDIENCE_OPTIONS.map(x=>x.key));
const clinicalStageKeys=new Set(TRAINING_CLINICAL_STAGE_OPTIONS.map(x=>x.key));
const generalStageKeys=new Set(TRAINING_GENERAL_STAGE_OPTIONS.map(x=>x.key));

export function normalizeTrainingDeliveryMode(value:unknown):TrainingDeliveryMode|""{const key=String(value||"").toUpperCase();return deliveryKeys.has(key as any)?key as TrainingDeliveryMode:""}
export function normalizeTrainingLearningNature(value:unknown):TrainingLearningNature|""{const key=String(value||"").toUpperCase();return natureKeys.has(key as any)?key as TrainingLearningNature:""}
export function normalizeTrainingCategoryGroup(value:unknown):TrainingCategoryGroup|""{const key=String(value||"").toUpperCase();return groupKeys.has(key as any)?key as TrainingCategoryGroup:""}
export function normalizeTrainingCategoryAudience(value:unknown):TrainingCategoryAudience{const key=String(value||"").toUpperCase();return audienceKeys.has(key as any)?key as TrainingCategoryAudience:""}
export function normalizeTrainingCategoryStage(value:unknown,group?:unknown):TrainingCategoryStage|""{const key=String(value||"").toUpperCase(),g=normalizeTrainingCategoryGroup(group);if(g==="CLINICAL")return clinicalStageKeys.has(key as any)?key as TrainingCategoryStage:"";if(g==="GENERAL")return generalStageKeys.has(key as any)?key as TrainingCategoryStage:"";return clinicalStageKeys.has(key as any)||generalStageKeys.has(key as any)?key as TrainingCategoryStage:""}

export function trainingDeliveryLabel(value:unknown){const key=normalizeTrainingDeliveryMode(value);return TRAINING_DELIVERY_OPTIONS.find(x=>x.key===key)?.label||"تعیین نشده"}
export function trainingNatureLabel(value:unknown){const key=normalizeTrainingLearningNature(value);return TRAINING_NATURE_OPTIONS.find(x=>x.key===key)?.label||"تعیین نشده"}
export function trainingGroupLabel(value:unknown){const key=normalizeTrainingCategoryGroup(value);return TRAINING_GROUP_OPTIONS.find(x=>x.key===key)?.label||""}
export function trainingAudienceLabel(value:unknown){const key=normalizeTrainingCategoryAudience(value);return TRAINING_CLINICAL_AUDIENCE_OPTIONS.find(x=>x.key===key)?.label||""}
export function trainingStageLabel(value:unknown,group?:unknown){const key=normalizeTrainingCategoryStage(value,group);return [...TRAINING_CLINICAL_STAGE_OPTIONS,...TRAINING_GENERAL_STAGE_OPTIONS].find(x=>x.key===key)?.label||""}

export function trainingCategoryLabel(group:unknown,audience:unknown,stage:unknown){const g=normalizeTrainingCategoryGroup(group),a=normalizeTrainingCategoryAudience(audience),s=normalizeTrainingCategoryStage(stage,g);if(g==="CLINICAL"&&a&&s)return `بالینی / ${trainingAudienceLabel(a)} / ${trainingStageLabel(s,g)}`;if(g==="GENERAL"&&s)return `عمومی / ${trainingStageLabel(s,g)}`;return "دسته‌بندی نشده"}

export function trainingTaxonomyKey(item:any){const g=normalizeTrainingCategoryGroup(item?.categoryGroup||item?.category_group),a=normalizeTrainingCategoryAudience(item?.categoryAudience||item?.category_audience),s=normalizeTrainingCategoryStage(item?.categoryStage||item?.category_stage,g);if(g==="CLINICAL"&&a&&s)return `${g}:${a}:${s}`;if(g==="GENERAL"&&s)return `${g}:${s}`;return "LEGACY"}

export function trainingTaxonomyOf(item:any){const group=normalizeTrainingCategoryGroup(item?.categoryGroup||item?.category_group),audience=normalizeTrainingCategoryAudience(item?.categoryAudience||item?.category_audience),stage=normalizeTrainingCategoryStage(item?.categoryStage||item?.category_stage,group);return {group,audience,stage,key:trainingTaxonomyKey(item),label:group&&stage?trainingCategoryLabel(group,audience,stage):String(item?.category||"دسته‌بندی نشده")||"دسته‌بندی نشده",legacy:!group||!stage||(group==="CLINICAL"&&!audience)}}

export function isValidTrainingTaxonomy(group:unknown,audience:unknown,stage:unknown){const g=normalizeTrainingCategoryGroup(group),a=normalizeTrainingCategoryAudience(audience),s=normalizeTrainingCategoryStage(stage,g);return g==="CLINICAL"?Boolean(a&&s):g==="GENERAL"?Boolean(s):false}
