import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CATEGORIES, SERVICES, getService } from "@/lib/catalog";
import { isLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/db";
import { addDays, localDate } from "@/lib/time";
import { Wizard } from "@/components/booking/Wizard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? "Book your appointment" : "Agenda tu cita" };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ servicio?: string; service?: string; topic?: string; embed?: string; bg?: string; theme?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const settings = getSettings();
  const today = localDate(new Date(), settings.timezone);
  const services = SERVICES.map((s) => getService(s.id)!);
  return (
    <Wizard
      locale={locale}
      categories={CATEGORIES}
      services={services}
      todayMonth={today.slice(0, 7)}
      maxMonth={addDays(today, settings.maxDaysAhead).slice(0, 7)}
      initialService={sp.servicio ?? sp.service}
      initialTopic={sp.topic}
      embed={sp.embed === "1" || sp.embed === "true"}
      transparent={sp.bg === "none"}
      theme={sp.theme}
    />
  );
}
