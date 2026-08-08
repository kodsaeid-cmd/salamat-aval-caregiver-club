const VERSION='8.2.0';
const TARGETS=[
  'https://salamatavalcaregivers.site',
  'https://salamat-aval-caregiver-club.kod-saeid.workers.dev',
];
const PHOTOS=['contracts','caregivers','users','training','credits','payroll','settings','support','evaluation'];

const fail=message=>{throw new Error(message)};
const noCache=()=>({cache:'no-store',headers:{'cache-control':'no-cache','pragma':'no-cache'}});

for(const base of TARGETS){
  const stamp=`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const htmlResponse=await fetch(`${base}/?mobile-reference-smoke=${stamp}`,noCache());
  if(!htmlResponse.ok)fail(`${base}: HTML ${htmlResponse.status}`);
  const header=htmlResponse.headers.get('x-salamat-mobile-reference-dashboard');
  if(header!==VERSION)fail(`${base}: x-salamat-mobile-reference-dashboard=${header||'missing'}`);
  const html=await htmlResponse.text();
  const tag=`mobile-reference-dashboard-v8-2.js?v=${VERSION}`;
  if(!html.includes(tag))fail(`${base}: missing ${tag}`);

  const runtimeResponse=await fetch(`${base}/mobile-reference-dashboard-v8-2.js?v=${VERSION}&smoke=${stamp}`,noCache());
  if(!runtimeResponse.ok)fail(`${base}: runtime ${runtimeResponse.status}`);
  const runtimeType=runtimeResponse.headers.get('content-type')||'';
  const runtime=await runtimeResponse.text();
  if(/<html/i.test(runtime.slice(0,256)))fail(`${base}: runtime resolved to HTML`);
  if(!/javascript|text\/plain/i.test(runtimeType))fail(`${base}: runtime content-type ${runtimeType}`);
  if(!runtime.includes("const VERSION='8.2.0'"))fail(`${base}: runtime version marker missing`);
  if(!runtime.includes('m82-reference-home'))fail(`${base}: approved reference home marker missing`);

  const photoEvidence=[];
  for(const photo of PHOTOS){
    const response=await fetch(`${base}/media/mobile-reference/${photo}.webp?v=${VERSION}&smoke=${stamp}`,noCache());
    if(!response.ok)fail(`${base}: ${photo}.webp ${response.status}`);
    const type=response.headers.get('content-type')||'';
    if(!type.includes('image/webp'))fail(`${base}: ${photo}.webp content-type ${type}`);
    const bytes=(await response.arrayBuffer()).byteLength;
    if(bytes<4000)fail(`${base}: ${photo}.webp suspiciously small (${bytes} bytes)`);
    photoEvidence.push({photo,bytes});
  }

  const logo=await fetch(`${base}/logo-salamat-aval.svg?smoke=${stamp}`,noCache());
  if(!logo.ok)fail(`${base}: official logo ${logo.status}`);

  console.log(JSON.stringify({base,version:VERSION,header,runtimeBytes:runtime.length,photos:photoEvidence,logo:true},null,2));
}

console.log('Mobile Reference V8.2 live smoke passed on both production domains.');
