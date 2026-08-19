import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');
const must=(condition,message)=>{if(!condition)throw new Error(message)};

const notification=read('mobile-react/caregiver-notification-center-v1.tsx');
const notificationCss=read('mobile-react/caregiver-notification-center-v1.css');
const runtime=read('preview/training-admin-row-actions-v1.js');
const injector=read('worker/index-with-benefits.ts');
const training=read('worker/training.ts');
new Function(runtime);

must(notification.includes('<Smartphone size={24}/>')&&!notification.includes('<i>🔔</i>'),'caregiver push activation card must keep the phone icon without the redundant bell badge');
must(!notificationCss.includes('.cvn-push-icon i'),'redundant push bell badge styling must be removed');
must(notification.includes('NotificationBell')&&notification.includes('<Bell size={20}/>'),'functional unread notification navigation must remain intact');

must(injector.includes('training-admin-row-actions-v1.js?v=1.0.0'),'admin training row action runtime must be injected into live HTML');
must(runtime.includes("currentRole()==='ADMIN'")&&runtime.includes('data-training-course-row'),'training row management must be scoped to system admin and attach stable row identifiers');
must(runtime.includes("row.addEventListener('click'")&&runtime.includes("event.key==='Enter'")&&runtime.includes("event.key===' '"),'registered training rows must be clickable and keyboard accessible');
must(runtime.includes('مشاهده آموزش')&&runtime.includes('ویرایش')&&runtime.includes('حذف'),'training detail must expose view, edit and delete actions');
must(runtime.includes("method:'PATCH'")&&runtime.includes("method:'DELETE'"),'edit and delete actions must use the server-backed training APIs');
must(runtime.includes('نمای مراقب')&&runtime.includes('هیچ بازدید، زمان مشاهده یا پیشرفتی')&&runtime.includes('<iframe')&&runtime.includes('<video')&&runtime.includes('<audio'),'system admin must have a side-effect-free caregiver-style content preview');
must(runtime.includes("event.target.closest('button,a,input,select,textarea,label')"),'row click must not hijack existing inline controls');

must(training.includes('export async function deleteCourse')&&training.includes("status='DELETED'")&&training.includes('softDelete:true'),'training deletion must remain audited soft-delete so database history is preserved');

console.log('Admin training clickable rows + edit/delete/caregiver preview + caregiver notification icon cleanup validation passed');
