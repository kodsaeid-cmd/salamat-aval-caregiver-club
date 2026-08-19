/* Caregiver Web Push Service Worker v1.0.0 */
self.addEventListener("push",event=>{
  if(!event.data)return;
  let data={};
  try{data=event.data.json()}catch{data={body:event.data.text()}}
  const title=data.title||"باشگاه مراقبین سلامت اول";
  event.waitUntil(self.registration.showNotification(title,{
    body:data.body||"اعلان جدیدی برای شما ثبت شده است.",
    icon:data.icon||"/logo-salamat-aval.svg",
    badge:data.badge||"/logo-salamat-aval.svg",
    tag:data.tag||"salamat-caregiver",
    renotify:true,
    dir:"rtl",
    lang:"fa",
    data:{url:data.url||"/mobile/notifications",kind:data.kind||"CAREGIVER_NOTIFICATION"}
  }));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const raw=event.notification?.data?.url||"/mobile/notifications";
  const target=new URL(raw,self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){
      try{
        if(new URL(client.url).origin===self.location.origin){
          if("navigate" in client)await client.navigate(target);
          if("focus" in client)return client.focus();
        }
      }catch{}
    }
    if(self.clients.openWindow)return self.clients.openWindow(target);
  })());
});

self.addEventListener("pushsubscriptionchange",event=>{
  event.waitUntil((async()=>{
    try{
      const previous=event.oldSubscription;
      const fresh=await self.registration.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:previous?.options?.applicationServerKey
      });
      const json=fresh.toJSON();
      await fetch("/api/caregiver/push/subscriptions",{
        method:"POST",credentials:"include",headers:{"content-type":"application/json"},
        body:JSON.stringify({...json,platform:"service-worker-refresh"})
      });
    }catch{}
  })());
});
