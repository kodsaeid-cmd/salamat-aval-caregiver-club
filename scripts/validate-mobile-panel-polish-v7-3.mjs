import fs from 'node:fs';

const runtime=fs.readFileSync('preview/mobile-panel-polish-v7-3.js','utf8');
const worker=fs.readFileSync('worker/index-unified-financial-v4.ts','utf8');
const index=fs.readFileSync('preview/index.html','utf8');
const failures=[];
const need=(source,text,message)=>{if(!source.includes(text))failures.push(message)};
try{new Function(runtime)}catch(error){failures.push(`runtime syntax: ${error.message}`)}
need(runtime,"const VERSION='7.3.0'",'missing V7.3 runtime version');
need(runtime,"aspect-ratio:1/1!important",'Home control must enforce a true circle');
need(runtime,"min-width:54px!important",'Home must enforce fixed minimum width');
need(runtime,"max-width:54px!important",'Home must enforce fixed maximum width');
need(runtime,"border-radius:999px!important",'Home must use a circular radius');
need(runtime,"body.salamat-mobile-input-focus",'mobile nav must retreat while a search/input is focused');
need(runtime,".adp-row[data-caregiver-id],.cdp-row[data-caregiver-id]",'admin person-result click owner missing');
need(runtime,"SalamatCaregiverProfileEditor?.open",'admin person result must open canonical caregiver profile');
need(runtime,"event.stopImmediatePropagation()",'result click must stop competing legacy handlers');
for(const kind of ['users','caregivers','contracts','payroll','wallet','training','evaluation','support','settings'])need(runtime,`${kind}:[`,`detailed staff icon missing: ${kind}`);
need(index,'همین حالا به شبکه مراقبین سلامت اول بپیوندید','canonical join-network CTA missing from source page');
need(runtime,'body.salamat-mobile-login-v5 #loginView .join-network-block{display:block!important','mobile must reveal the canonical join-network CTA');
need(runtime,'.join-network-action','mobile CTA styling missing');
need(worker,'MOBILE_PANEL_POLISH_VERSION = "7.3.0"','worker V7.3 version missing');
need(worker,'mobile-panel-polish-v7-3.js','worker V7.3 asset missing');
need(worker,'injectMobilePanelPolish(html)','worker must inject V7.3 after authenticated shell assets');
need(worker,'x-salamat-mobile-panel-polish','worker V7.3 evidence header missing');
if(failures.length){console.error('Mobile panel V7.3 validation failed:');for(const item of failures)console.error(` - ${item}`);process.exit(1)}
console.log('Mobile V7.3 nav, CTA, admin icons, and result routing verified.');