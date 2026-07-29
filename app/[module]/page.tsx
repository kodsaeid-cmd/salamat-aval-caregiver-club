import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";

const modules: Record<string, { title: string; description: string }> = {
  evaluations: {
    title: "ارزیابی و پایش",
    description: "ثبت رویدادهای حرفه‌ای، امتیازدهی شاخص‌های هشت‌گانه، تولید کارنامه و مدیریت اعتراضات در این ماژول تکمیل می‌شود.",
  },
  education: {
    title: "آموزش و بازآموزی",
    description: "دوره‌های الزامی، آموزش‌های تجویزی، آزمون‌ها، اعتبار آموزشی و اتصال نتایج آموزش به کارنامه مراقب در این بخش قرار می‌گیرد.",
  },
  support: {
    title: "پشتیبانی باشگاه",
    description: "تیکت‌های عضویت و پرونده، سطح اولویت، ارجاع به واحدها و تاریخچه پاسخ‌گویی در این بخش مدیریت می‌شود.",
  },
  reports: {
    title: "گزارش‌های مدیریتی",
    description: "گزارش جذب، توزیع رتبه‌ها، روند امتیازات، آموزش، شکایات و شاخص‌های عملکرد باشگاه در این بخش ارائه خواهد شد.",
  },
  settings: {
    title: "تنظیمات سامانه",
    description: "قوانین امتیازدهی، سطوح حرفه‌ای، دسترسی‌ها، اعلان‌ها و تنظیمات پایه سازمان در این بخش کنترل می‌شود.",
  },
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const config = modules[module];
  if (!config) notFound();
  return <ModulePlaceholder title={config.title} description={config.description} />;
}
