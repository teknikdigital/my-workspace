import React from "react";
import { getReminders } from "@/lib/actions/personal";
import { RemindersClient } from "./RemindersClient";

export const revalidate = 0;

export default async function RemindersPage() {
  const reminders = await getReminders();
  return <RemindersClient initialReminders={reminders} />;
}
