import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const must=(condition,message)=>{if(!condition)throw new Error(message)};

const training=read('worker/training.ts');
const routes=read('worker/index-with-benefits.ts');
const mobile=read('mobile-react/admin-training-v2.tsx');
const desktop=read('desktop-react/training-v2.tsx');
const cleanup=read('migrations/0119_training_content_cleanup.sql');

must(training.includes('if (!contentUrl) return fail("برای ثبت آموزش، فایل یا نشانی محتوا الزامی است.")'),'course creation must reject contentless training');
must(training.includes('body.contentUrl !== undefined && !str(body.contentUrl)'),'course update must reject clearing training content');
must(training.includes('"staff.training", "delete"')&&training.includes("status='DELETED'"),'course deletion must be permission-protected soft deletion');
must(routes.includes('method === "DELETE"')&&routes.includes('deleteCourse(request, env, actor'),'training router must expose course deletion');
must(cleanup.includes("TRIM(COALESCE(content_url,'')) = ''")&&cleanup.includes("status = 'DELETED'"),'cleanup migration must retire only contentless courses by soft deletion');
must(mobile.includes('Pencil')&&mobile.includes('Trash2')&&mobile.includes('method:"PATCH"')&&mobile.includes('method:"DELETE"')&&mobile.includes('ویرایش')&&mobile.includes('حذف'),'mobile training bank must expose edit/delete controls');
must(desktop.includes('Pencil')&&desktop.includes('Trash2')&&desktop.includes('method:"PATCH"')&&desktop.includes('method:"DELETE"')&&desktop.includes('ویرایش')&&desktop.includes('حذف'),'desktop training bank must expose edit/delete controls');

console.log('Training content cleanup + edit/delete management validation passed');
