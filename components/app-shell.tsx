"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Headphones,
  HeartHandshake,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const navigation = [
  { href: "/admin/users", label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/users", label: "کاربران", icon: Users, exact: true },
  { href: "/admin/roles", label: "نقش‌ها و دسترسی‌ها", icon: ShieldCheck },
  { href: "/recruitment/caregivers/new", label: "جذب و استخدام", icon: UserPlus },
  { href: "/caregivers", label: "پروفایل مراقبین", icon: HeartHandshake },
  { href: "/evaluations", label: "ارزیابی و پایش", icon: ChartNoAxesCombined },
  { href: "/education", label: "آموزش‌ها", icon: GraduationCap },
  { href: "/support", label: "پشتیبانی", icon: Headphones },
  { href: "/reports", label: "گزارش‌ها", icon: FileText },
  { href: "/settings", label: "تنظیمات", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <BrandLogo light />
          <button type="button" className="icon-button sidebar__menu" aria-label="باز و بسته کردن منو">
            <Menu size={22} />
          </button>
        </div>
        <nav className="sidebar__nav" aria-label="ناوبری اصلی">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={`${item.href}-${item.label}`} href={item.href} className={active ? "nav-item nav-item--active" : "nav-item"}>
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar__footer">
          <BookOpen size={18} />
          <span>راهنمای باشگاه مراقبین</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__profile">
            <div className="avatar avatar--green">ع</div>
            <div>
              <strong>علی محمدی</strong>
              <span>ادمین سیستم</span>
            </div>
            <ChevronDown size={16} />
          </div>

          <div className="topbar__actions">
            <button type="button" className="icon-button notification-button" aria-label="اعلان‌ها">
              <Bell size={20} />
              <span>۳</span>
            </button>
            <div className="search-box">
              <Search size={18} />
              <input aria-label="جست‌وجو" placeholder="جست‌وجو در کاربران، مراقبین و پرونده‌ها" />
            </div>
          </div>

          <div className="topbar__title">
            <CircleHelp size={18} />
            <span>باشگاه مراقبین سلامت اول</span>
            <ClipboardCheck size={20} />
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
