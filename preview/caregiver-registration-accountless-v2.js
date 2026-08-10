(()=>{
  const ROOT_ID='caregiverSignupForm';
  const HIDDEN_NAMES=['email','password','confirmPassword'];
  const digits=value=>String(value||'').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const cleanMobile=value=>{const d=digits(value).replace(/\D/g,'');if(d.startsWith('0098'))return `0${d.slice(4)}`;if(d.startsWith('98'))return `0${d.slice(2)}`;if(d.length===10&&d.startsWith('9'))return `0${d}`;return d};
  const removeCredentialFields=form=>{
    for(const name of HIDDEN_NAMES){
      const input=form.querySelector(`[name="${name}"]`);if(!input)continue;
      input.disabled=true;input.required=false;input.removeAttribute('required');input.removeAttribute('minlength');input.removeAttribute('maxlength');input.removeAttribute('pattern');input.setCustomValidity?.('');
      if('value' in input)input.value='';
      const box=input.closest('label,.form-group,.input-group,.field,.form-field,.signup-field,.registration-field')||input.parentElement;
      if(box)box.style.display='none';else input.style.display='none';
    }
    [...form.querySelectorAll('label,small,p,span')].forEach(el=>{
      const t=(el.textContent||'').trim();
      if(/ایمیل سازمانی|تکرار رمز|تأیید رمز|رمز عبور/.test(t)&&el.querySelector?.('input'))el.style.display='none';
    });
  };
  const statusBox=form=>{
    let box=form.querySelector('[data-accountless-registration-status]');
    if(!box){box=document.createElement('div');box.setAttribute('data-accountless-registration-status','1');box.style.cssText='margin:14px 0;padding:12px 14px;border-radius:14px;background:#eef8f2;color:#176c3e;font:700 14px/2 Vazirmatn,Tahoma,sans-serif;display:none;text-align:right';form.appendChild(box)}
    return box;
  };
  const show=(form,message,error=false)=>{const box=statusBox(form);box.textContent=message;box.style.display='block';box.style.background=error?'#fff0f1':'#eef8f2';box.style.color=error?'#a43145':'#176c3e'};
  let submitting=false;
  async function submitProfile(form){
    if(!(form instanceof HTMLFormElement)||submitting)return;
    removeCredentialFields(form);
    const fd=new FormData(form),mobile=cleanMobile(fd.get('mobile')),nationalId=digits(fd.get('nationalId')).replace(/\D/g,''),fullName=String(fd.get('name')||fd.get('fullName')||'').trim();
    if(fullName.length<3)return show(form,'نام و نام خانوادگی را کامل وارد کنید.',true);
    if(!/^09\d{9}$/.test(mobile))return show(form,'شماره همراه معتبر وارد کنید.',true);
    if(nationalId&&!/^\d{10}$/.test(nationalId))return show(form,'کد ملی باید ۱۰ رقم باشد.',true);
    const payload={fullName,mobile,nationalId,serviceGroup:String(fd.get('serviceGroup')||''),city:String(fd.get('city')||'').trim(),birthDate:String(fd.get('birthDate')||''),skills:String(fd.get('skills')||'').trim(),address:String(fd.get('address')||'').trim(),bio:String(fd.get('bio')||'').trim()};
    const submit=form.querySelector('button[type="submit"],input[type="submit"]');if(submit)submit.disabled=true;submitting=true;show(form,'در حال تشکیل پرونده مراقب...');
    try{
      const response=await fetch('/api/public/caregivers/register',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||'ثبت پرونده انجام نشد.');
      const code=data?.data?.membershipCode||data?.data?.caregiverId||'';
      show(form,`پرونده شما با موفقیت تشکیل شد${code?`؛ کد عضویت: ${code}`:''}. پس از بررسی و تأیید سلامت اول، نام کاربری و رمز عبور برای شما ایجاد می‌شود.`);
      form.reset();removeCredentialFields(form);
    }catch(error){show(form,error?.message||'ثبت پرونده انجام نشد.',true)}finally{submitting=false;if(submit)submit.disabled=false}
  }
  function onSubmit(event){
    const form=event.currentTarget;if(!(form instanceof HTMLFormElement))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void submitProfile(form);
  }
  function onSubmitClick(event){
    const form=event.currentTarget;if(!(form instanceof HTMLFormElement))return;
    const target=event.target instanceof Element?event.target.closest('button,input'):null;
    if(!target||!form.contains(target))return;
    const isSubmit=(target instanceof HTMLButtonElement&&(target.type||'submit')==='submit')||(target instanceof HTMLInputElement&&['submit','image'].includes(target.type));
    if(!isSubmit)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void submitProfile(form);
  }
  function activate(){const form=document.getElementById(ROOT_ID);if(!(form instanceof HTMLFormElement)||form.dataset.accountlessV2==='2')return;form.dataset.accountlessV2='2';removeCredentialFields(form);form.noValidate=true;form.setAttribute('novalidate','novalidate');form.addEventListener('click',onSubmitClick,true);form.addEventListener('submit',onSubmit,true)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',activate,{once:true});else activate();
  new MutationObserver(activate).observe(document.documentElement,{childList:true,subtree:true});
})();
