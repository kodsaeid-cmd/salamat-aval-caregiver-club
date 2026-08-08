import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const runtime=read('preview/mobile-evaluation-drilldown-v7-6.js');
const owner=read('preview/runtime-single-owner-v8.js');
const evaluation=read('preview/server-evaluation-runtime-v4.js');

const assert=(condition,message)=>{if(!condition)throw new Error(message)};

new Function(runtime);
new Function(owner);

assert(runtime.includes("const VERSION='7.6.0'"),'V7.6 drill-down version missing');
assert(runtime.includes("matchMedia('(max-width:760px)')"),'V7.6 must be mobile-only');
assert(runtime.includes('.sev4-root.me76-directory> .sev4-layout>main.sev4-panel{display:none!important}'),'Directory mode must hide evaluation panel on mobile');
assert(runtime.includes('.sev4-root.me76-overview> .sev4-layout>aside.sev4-panel'),'Selected caregiver overview must hide caregiver directory');
assert(runtime.includes('.sev4-root.me76-criterion> .sev4-layout>aside.sev4-panel'),'Criterion detail must hide caregiver directory');
assert(runtime.includes('.sev4-root.me76-overview .sev4-indicator-body{display:none!important}'),'Overview must show indicator cards without criterion bodies');
assert(runtime.includes('.sev4-root.me76-criterion .sev4-indicator.me76-active-indicator'),'Criterion mode must isolate one selected indicator');
assert(runtime.includes('.sev4-root.me76-criterion .sev4-indicator-body{display:block!important'),'Selected indicator must expose original criterion form');
assert(runtime.includes("back.dataset.me76Back=kind==='criterion'?'indicators':'directory'"),'Mobile back navigation contract missing');
assert(runtime.includes('current.openIndicator=activeIndicator'),'Selected card must hand off to canonical V4 indicator state');
assert(runtime.includes("mode='overview'"),'Caregiver selection must enter evaluation overview');
assert(runtime.includes("mode='criterion'"),'Indicator selection must enter criterion detail');
assert(runtime.includes('MutationObserver'),'Scoped render reconciliation is required');
assert(!runtime.includes('setInterval('),'V7.6 must not add polling');

assert(owner.includes("const MOBILE_EVALUATION_DRILLDOWN_VERSION='7.6.0'"),'Single-owner loader version missing');
assert(owner.includes("const MOBILE_EVALUATION_DRILLDOWN_ASSET='mobile-evaluation-drilldown-v7-6.js'"),'Single-owner loader asset missing');
assert(owner.includes("if(!window.matchMedia?.('(max-width:760px)').matches)return false"),'Desktop must not load V7.6 runtime');
assert(owner.includes('loadMobileEvaluationDrilldown()'),'Single-owner boot must load mobile evaluation drill-down');

assert(evaluation.includes('data-sev4-indicator'),'Canonical V4 indicator contract changed unexpectedly');
assert(evaluation.includes('data-sev4-score'),'Canonical V4 scoring inputs missing');
assert(evaluation.includes('data-sev4-save'),'Canonical V4 save action missing');

console.log('Mobile evaluation drill-down V7.6 validated: directory -> indicator cards -> canonical criterion scoring, mobile only.');
