const PERSIAN_DIGITS="۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS="٠١٢٣٤٥٦٧٨٩";

function toAsciiDigits(value:string){
  return String(value||"")
    .replace(/[۰-۹]/g,(d)=>String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g,(d)=>String(ARABIC_DIGITS.indexOf(d)));
}

function normalizeAmount(value:string){
  const digits=toAsciiDigits(value).replace(/[^0-9]/g,"");
  return digits.replace(/^0+(?=\d)/,"");
}

function toPersianDigits(value:string){
  return value.replace(/\d/g,(d)=>PERSIAN_DIGITS[Number(d)]||d);
}

function formatAmount(raw:string){
  if(!raw)return "";
  const grouped=raw.replace(/\B(?=(\d{3})+(?!\d))/g,",");
  return toPersianDigits(grouped).replace(/,/g,"٬");
}

const ONES=["","یک","دو","سه","چهار","پنج","شش","هفت","هشت","نه"];
const TEENS=["ده","یازده","دوازده","سیزده","چهارده","پانزده","شانزده","هفده","هجده","نوزده"];
const TENS=["","","بیست","سی","چهل","پنجاه","شصت","هفتاد","هشتاد","نود"];
const HUNDREDS=["","صد","دویست","سیصد","چهارصد","پانصد","ششصد","هفتصد","هشتصد","نهصد"];
const SCALES=["","هزار","میلیون","میلیارد","تریلیون","کوادریلیون","کوینتیلیون"];

function threeDigitWords(value:number){
  const parts:string[]=[];
  const hundreds=Math.floor(value/100);
  const rest=value%100;
  if(hundreds)parts.push(HUNDREDS[hundreds]);
  if(rest>=10&&rest<=19)parts.push(TEENS[rest-10]);
  else{
    const tens=Math.floor(rest/10),ones=rest%10;
    if(tens)parts.push(TENS[tens]);
    if(ones)parts.push(ONES[ones]);
  }
  return parts.filter(Boolean).join(" و ");
}

function amountToWords(raw:string){
  if(!raw)return "مبلغ را وارد کنید";
  let value:bigint;
  try{value=BigInt(raw)}catch{return "مبلغ نامعتبر است"}
  if(value===0n)return "صفر تومان";
  const groups:string[]=[];
  let index=0;
  while(value>0n&&index<SCALES.length){
    const chunk=Number(value%1000n);
    if(chunk){
      const words=threeDigitWords(chunk);
      groups.unshift(`${words}${SCALES[index]?` ${SCALES[index]}`:""}`);
    }
    value/=1000n;
    index+=1;
  }
  if(value>0n)return `${formatAmount(raw)} تومان`;
  return `${groups.join(" و ")} تومان`;
}

function ensureStyle(){
  if(document.getElementById("cv-settlement-amount-format-style"))return;
  const style=document.createElement("style");
  style.id="cv-settlement-amount-format-style";
  style.textContent=`.cv-settlement-amount-words{display:block;margin-top:7px;font-size:12px;line-height:1.8;font-weight:800;color:#176b45;min-height:22px}.cv-settlement-amount-display:invalid+.cv-settlement-amount-words{color:#b42318}`;
  document.head.appendChild(style);
}

function enhanceSettlementAmount(){
  const inputs=Array.from(document.querySelectorAll<HTMLInputElement>('input[name="amountToman"]'));
  for(const input of inputs){
    if(input.dataset.cvAmountEnhanced==="1")continue;
    const form=input.closest("form");
    const heading=form?.querySelector("h2");
    if(!form||!heading||heading.textContent?.trim()!=="تقاضای تسویه")continue;

    input.dataset.cvAmountEnhanced="1";
    const maxRaw=normalizeAmount(input.getAttribute("max")||"");
    const initialRaw=normalizeAmount(input.value||input.defaultValue||"");
    const hidden=document.createElement("input");
    hidden.type="hidden";
    hidden.name="amountToman";
    hidden.value=initialRaw;

    input.removeAttribute("name");
    input.type="text";
    input.inputMode="numeric";
    input.autocomplete="off";
    input.classList.add("cv-settlement-amount-display");
    input.removeAttribute("min");
    input.removeAttribute("max");
    input.setAttribute("dir","ltr");

    const words=document.createElement("small");
    words.className="cv-settlement-amount-words";
    input.insertAdjacentElement("afterend",words);
    words.insertAdjacentElement("afterend",hidden);

    const sync=(source:string)=>{
      const raw=normalizeAmount(source);
      hidden.value=raw;
      input.value=formatAmount(raw);
      words.textContent=amountToWords(raw);
      let error="";
      if(!raw||raw==="0")error="مبلغ باید بیشتر از صفر باشد.";
      else if(maxRaw){
        try{if(BigInt(raw)>BigInt(maxRaw))error="مبلغ نمی‌تواند بیشتر از مانده کیف پول باشد."}catch{}
      }
      input.setCustomValidity(error);
      if(error)input.setAttribute("aria-invalid","true");else input.removeAttribute("aria-invalid");
    };

    input.addEventListener("input",()=>sync(input.value));
    input.addEventListener("blur",()=>sync(input.value));
    sync(initialRaw);
  }
}

function mount(){
  ensureStyle();
  enhanceSettlementAmount();
}

if(typeof document!=="undefined"){
  mount();
  new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener("popstate",mount);
}
