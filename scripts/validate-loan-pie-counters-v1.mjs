import {readFile} from "node:fs/promises";

const cases=[
  {tsx:"mobile-react/caregiver-benefits-v3.tsx",css:"mobile-react/caregiver-loan-pies-v1.css",root:"cb3-loan-pie-grid"},
  {tsx:"mobile-react/admin-financial-credits-loan-policy-v4.tsx",css:"mobile-react/admin-loan-pies-v1.css",root:"mafl-pie-grid"},
  {tsx:"desktop-react/financial-credits-loan-policy-v5.tsx",css:"desktop-react/financial-loan-pies-v1.css",root:"flp-pie-grid"},
];

for(const item of cases){
  const [tsx,css]=await Promise.all([readFile(item.tsx,"utf8"),readFile(item.css,"utf8")]);
  for(const point of [200,400,600,800]){
    if(!tsx.includes(`p:${point}`)&&!tsx.includes(`points:${point}`))throw new Error(`${item.tsx}: missing ${point}-point loan tier`);
  }
  if(!tsx.includes("conic-gradient(#087443"))throw new Error(`${item.tsx}: pie chart gradient is missing`);
  if(!tsx.includes(item.root))throw new Error(`${item.tsx}: pie grid root is missing`);
  if(!tsx.includes("Math.max(0")||!tsx.includes("Math.min(points"))throw new Error(`${item.tsx}: per-tier current/remaining math is missing`);
  if(!css.includes(`.${item.root}`))throw new Error(`${item.css}: pie grid styles are missing`);
  if(!css.includes("grid-template-columns"))throw new Error(`${item.css}: responsive grid is missing`);
  if(!css.includes("@media"))throw new Error(`${item.css}: responsive breakpoint is missing`);
}

console.log("Loan tier pie counters validated for caregiver responsive UI, mobile admin, and desktop admin.");
