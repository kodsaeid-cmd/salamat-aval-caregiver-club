import React from "react";
import {createRoot} from "react-dom/client";
import {DesktopStaffApp} from "./app";
const root=document.getElementById("desktop-react-root");
if(!root)throw new Error("desktop-react-root is missing");
createRoot(root).render(<React.StrictMode><DesktopStaffApp/></React.StrictMode>);
