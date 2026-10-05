import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { BottomNav } from "@/components/shell/BottomNav";
import { CommandPalette } from "@/components/shell/CommandPalette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role_label")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        displayName={profile?.display_name}
        roleLabel={profile?.role_label}
        email={user.email}
      />

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-6 pb-32">
        {children}
      </main>

      <BottomNav />
      <CommandPalette />
    </div>
  );
}
