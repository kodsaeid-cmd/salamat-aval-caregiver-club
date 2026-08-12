const TARGET_FORM='form.ja-admin-editor,form.maj-v4-form';
const digits=(value:string)=>String(value||'').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^0-9]/g,'');
const grouped=(value:string)=>digits(value).replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,',');

function ensureSalaryBridge(form:HTMLFormElement){
 let visible=form.querySelector<HTMLInputElement>('[data-sal-job-salary-visible]');
 let raw=form.querySelector<HTMLInputElement>('input[data-sal-job-salary-raw]');
 if(!visible)visible=form.querySelector<HTMLInputElement>('input[name="caregiverSalaryRial"]:not([type="hidden"])');
 if(!visible)return;
 if(!raw){raw=document.createElement('input');raw.type='hidden';raw.name='caregiverSalaryRial';raw.setAttribute('data-sal-job-salary-raw','1');raw.value=digits(visible.value);visible.insertAdjacentElement('afterend',raw)}
 // React v3 may restore these props after a contract-type rerender; keep the visible
 // field presentation-only and leave a raw numeric named field for FormData.
 visible.removeAttribute('name');
 visible.type='text';
 visible.inputMode='numeric';
 visible.classList.add('ja-money-input');
 visible.setAttribute('data-sal-job-salary-visible','1');
 const sync=()=>{if(!raw)return;raw.value=digits(visible!.value);visible!.value=grouped(raw.value)};
 if(visible.dataset.salJobSalaryBound!=='1'){
  visible.dataset.salJobSalaryBound='1';
  visible.addEventListener('input',sync);
  visible.addEventListener('blur',sync);
 }
 sync();
}

function ensureLegacyTrigger(form:HTMLFormElement){
 if(form.querySelector('select[name="contractPoints"]'))return;
 const trigger=document.createElement('select');
 trigger.name='contractPoints';
 trigger.setAttribute('data-sal-job-legacy-trigger','1');
 trigger.tabIndex=-1;
 trigger.setAttribute('aria-hidden','true');
 trigger.style.display='none';
 const option=document.createElement('option');option.value='0';option.textContent='0';trigger.appendChild(option);
 form.appendChild(trigger);
}

function hideReactConditionField(form:HTMLFormElement){
 form.querySelectorAll<HTMLSelectElement>('select[name="recipientCondition"]').forEach(select=>{
  const label=select.closest('label');
  if(label&&!label.classList.contains('sal-job-condition-label')){
   label.style.display='none';
   label.setAttribute('data-sal-job-native-condition','1');
   select.disabled=true;
  }
 });
}

function prepare(form:HTMLFormElement){
 ensureSalaryBridge(form);
 hideReactConditionField(form);
 ensureLegacyTrigger(form);
}
function scan(){document.querySelectorAll<HTMLFormElement>(TARGET_FORM).forEach(prepare)}

scan();
const observer=new MutationObserver(scan);
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['name','type','value']});

export {};
