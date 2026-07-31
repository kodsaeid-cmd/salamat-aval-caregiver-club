(()=>{
'use strict';
if(window.__salamatLegacyBrowserImportV1)return;
window.__salamatLegacyBrowserImportV1=true;

const KEY='salamatAvalEvaluationSystemV13';
let finished=false;
const parse=value=>{try{return JSON.parse(value||'null')}catch{return null}};
const clean=value=>{
  if(!value||typeof value!=='object')return null;
  const profile=value.profile&&typeof value.profile==='object'?value.profile:{};
  const rank=value.rank&&typeof value.rank==='object'?value.rank:{};
  const license=value.license&&typeof value.license==='object'?value.license:{};
  const name=String(value.name||value.fullName||'').trim();if(name.length<3)return null;
  return {
    id:String(value.id||value.membershipCode||''),backendId:String(value.backendId||''),membershipCode:String(value.membershipCode||value.id||''),
    name,phone:String(value.phone||value.mobile||''),nationalId:String(value.nationalId||''),serviceGroup:String(value.serviceGroup||value.primaryType||''),
    fileStatus:String(value.fileStatus||value.cooperationStatus||''),createdAt:String(value.createdAt||''),
    profile:{city:String(profile.city||value.city||''),address:String(profile.address||value.address||''),birthDate:String(profile.birthDate||value.birthDate||''),skills:Array.isArray(profile.skills)?profile.skills.map(String):String(profile.skills||value.skills||''),bio:String(profile.bio||value.bio||value.workHistory||'')},
    rank:{title:String(rank.title||value.professionalLevel||''),pri:rank.pri??value.professionalScore??null},license:{status:String(license.status||value.licenseStatus||'')},
  };
};
async function attempt(){
  if(finished)return true;
  const user=window.SalamatBackend?.getCurrentUser?.();
  if(!user||String(user.role||'').toUpperCase()!=='ADMIN')return false;
  finished=true;
  const state=parse(localStorage.getItem(KEY));
  const profiles=Array.isArray(state?.caregivers)?state.caregivers.map(clean).filter(Boolean):[];
  if(!profiles.length)return true;
  try{
    const api=window.SalamatBackend?.api;
    if(!api){finished=false;return false}
    const result=await api('/api/admin/import-legacy-profiles',{method:'POST',body:JSON.stringify({profiles})});
    if(Number(result?.data?.queued||0)>0)window.dispatchEvent(new CustomEvent('salamat-server-directory-refresh',{detail:result.data}));
  }catch(error){finished=false;console.error('Legacy caregiver profile import failed',error)}
  return finished;
}
const timer=setInterval(async()=>{if(await attempt())clearInterval(timer)},500);
setTimeout(()=>clearInterval(timer),30000);
window.addEventListener('salamat-identity-changed',()=>void attempt());
})();
