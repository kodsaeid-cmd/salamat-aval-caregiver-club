import "../shared/staff-credential-runtime-v1";
import "../shared/evaluation-jalali-runtime-v1";
import "../shared/job-ad-auto-points-runtime-v1";
import React from "react";
import {createRoot} from "react-dom/client";
import {DesktopStaffApp} from "./app";

const params=new URLSearchParams(location.search);
const explicitDesktop=params.get("desktop")==="1"||params.get("classic")==="1";
const narrowViewport=window.matchMedia?.("(max-width: 899px)").matches??window.innerWidth<=899;

if(narrowViewport&&!explicitDesktop){
  location.replace("/mobile/admin/");
}else{
  const root=document.getElementById("desktop-react-root");
  if(!root)throw new Error("desktop-react-root is missing");
  createRoot(root).render(<React.StrictMode><DesktopStaffApp/></React.StrictMode>);
}
