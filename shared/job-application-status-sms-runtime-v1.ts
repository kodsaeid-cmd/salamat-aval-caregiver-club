const FLAG="__salamatJobApplicationStatusSmsRuntimeV1";
const target=window as typeof window&Record<string,unknown>;
if(!target[FLAG]){
 target[FLAG]=true;
 const nativeFetch=window.fetch.bind(window);
 window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const response=await nativeFetch(input,init);
  try{
   const value=input instanceof Request?input.url:String(input),url=new URL(value,location.origin),method=String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase();
   if(response.ok&&url.origin===location.origin&&method==="PATCH"&&/^\/api\/staff\/job-ads\/[^/]+\/applications\/[^/]+$/.test(url.pathname)){
    queueMicrotask(()=>{void nativeFetch("/api/admin/job-status-sms/flush",{method:"POST",credentials:"same-origin",cache:"no-store",keepalive:true}).catch(()=>undefined)});
   }
  }catch{}
  return response;
 }) as typeof window.fetch;
}

export {};
