import { Construction, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export function ModulePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <AppShell>
      <div className="module-page">
        <section className="panel module-card">
          <Construction />
          <span className="eyebrow">نسخه اولیه محصول</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="role-chip module-card__status"><Sparkles size={18} /><div><span>وضعیت توسعه</span><strong>زیرساخت آماده؛ رابط تخصصی در فاز بعد</strong></div></div>
        </section>
      </div>
    </AppShell>
  );
}
