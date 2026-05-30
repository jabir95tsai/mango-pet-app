"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";

export async function setLocale(value: string): Promise<void> {
  if (!routing.locales.includes(value as (typeof routing.locales)[number])) return;
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", value, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
