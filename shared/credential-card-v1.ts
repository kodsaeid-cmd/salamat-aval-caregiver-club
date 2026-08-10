export type CredentialCardInput={fullName:string;username:string;password:string};

export function generateCredentialPassword(length=12){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  const bytes=crypto.getRandomValues(new Uint8Array(Math.max(8,length)));
  return Array.from(bytes,b=>chars[b%chars.length]).join("").slice(0,Math.max(8,length));
}

export function suggestCaregiverUsername(mobile:string){
  const digits=String(mobile||"").replace(/\D/g,"");
  return digits?`cg${digits}`:`cg${Date.now().toString(36)}`;
}

function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();
}

function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("logo_load_failed"));image.src=src})}

export async function downloadCredentialCard(input:CredentialCardInput){
  const canvas=document.createElement("canvas");canvas.width=1200;canvas.height=820;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("canvas_not_supported");
  ctx.fillStyle="#f4f8f6";ctx.fillRect(0,0,canvas.width,canvas.height);
  const gradient=ctx.createLinearGradient(0,0,1200,820);gradient.addColorStop(0,"rgba(23,115,63,.10)");gradient.addColorStop(.72,"rgba(255,255,255,0)");gradient.addColorStop(1,"rgba(237,32,36,.07)");ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,820);
  roundRect(ctx,80,55,1040,710,44);ctx.fillStyle="#ffffff";ctx.fill();ctx.strokeStyle="#dce9e2";ctx.lineWidth=2;ctx.stroke();
  try{const logo=await loadImage("/logo-salamat-aval.svg");const maxW=260,maxH=150,ratio=Math.min(maxW/logo.width,maxH/logo.height);const w=logo.width*ratio,h=logo.height*ratio;ctx.drawImage(logo,(1200-w)/2,90,w,h)}catch{}
  ctx.direction="rtl";ctx.textAlign="center";ctx.fillStyle="#173a2a";ctx.font='800 38px Vazirmatn,Tahoma,sans-serif';ctx.fillText("اطلاعات ورود باشگاه مراقبین سلامت اول",600,285);
  ctx.font='700 25px Vazirmatn,Tahoma,sans-serif';ctx.fillStyle="#63766c";ctx.fillText(input.fullName||"مراقب سلامت اول",600,335);
  const box=(label:string,value:string,y:number,accent:string)=>{roundRect(ctx,180,y,840,105,24);ctx.fillStyle="#f8fbf9";ctx.fill();ctx.strokeStyle="#dce9e2";ctx.lineWidth=2;ctx.stroke();ctx.textAlign="right";ctx.fillStyle="#73847b";ctx.font='700 21px Vazirmatn,Tahoma,sans-serif';ctx.fillText(label,960,y+34);ctx.fillStyle=accent;ctx.font='900 34px Vazirmatn,Tahoma,sans-serif';ctx.fillText(value,960,y+78)};
  box("نام کاربری",input.username,390,"#17733f");box("رمز عبور",input.password,520,"#173a2a");
  ctx.textAlign="center";ctx.fillStyle="#8a9690";ctx.font='600 20px Vazirmatn,Tahoma,sans-serif';ctx.fillText("این اطلاعات محرمانه است؛ پس از اولین ورود، رمز عبور خود را تغییر دهید.",600,690);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("image_export_failed")),"image/png",1));
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`salamat-aval-login-${String(input.username||"caregiver").replace(/[^a-zA-Z0-9_-]+/g,"-")}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
