"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { syncLeads } from "@/leads/sync";

const STATUSES = ["NEW", "SAVED", "CONTACTED", "HIDDEN"] as const;

export async function setStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as (typeof STATUSES)[number];
  if (!STATUSES.includes(status)) return;
  await prisma.lead.update({
    where: { id },
    data: { status, contactedAt: status === "CONTACTED" ? new Date() : undefined },
  });
  revalidatePath("/");
}

export async function refreshLeads() {
  await syncLeads(prisma);
  revalidatePath("/");
}
