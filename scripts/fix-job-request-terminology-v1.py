from pathlib import Path

roots=[Path("desktop-react"),Path("mobile-react"),Path("worker"),Path("preview"),Path("shared"),Path("scripts")]
for root in roots:
    for p in root.rglob("*"):
        if p.suffix.lower() not in {".ts",".tsx",".js",".mjs",".css",".html",".py"}:
            continue
        try:s=p.read_text()
        except UnicodeDecodeError:continue
        original=s
        # Repair the accidental substring replacement inside the legitimate word «اپلیکیشن».
        s=s.replace("درخواستکیشن","اپلیکیشن")
        # Product wording: application/request as a noun is «درخواست»; the caregiver CTA is «درخواست برای شغل».
        s=s.replace("مراقبین می‌توانند برای آن درخواست برای شغل ثبت کنند.","مراقبین می‌توانند برای این آگهی درخواست ثبت کنند.")
        s=s.replace("مراقبین می‌توانند این آگهی را ببینند و برای آن درخواست برای شغل ثبت کنند.","مراقبین می‌توانند این آگهی را ببینند و درخواست برای شغل ثبت کنند.")
        s=s.replace("هنوز مراقبی برای این آگهی درخواست نکرده است.","هنوز مراقبی برای این آگهی درخواستی ثبت نکرده است.")
        s=s.replace("پس از درخواست مراقبین،","پس از ثبت درخواست مراقبین،")
        s=s.replace("مراقبین درخواست‌کرده","مراقبین درخواست‌دهنده")
        s=s.replace("آماده درخواست","آماده ثبت درخواست")
        s=s.replace("اپلای","درخواست")
        if s!=original:p.write_text(s)
