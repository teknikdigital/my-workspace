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
    <div className="relative min-h-screen flex flex-col bg-[url('/bagroundutamamyworkspace.png')] bg-cover bg-center bg-fixed bg-no-repeat">
      {/* Dynamic backdrop wash for crisp readability */}
      <div className="fixed inset-0 bg-white/75 dark:bg-[#0c121d]/85 backdrop-blur-[2px] pointer-events-none -z-10" />

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
