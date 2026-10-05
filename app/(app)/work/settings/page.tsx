import { Suspense } from "react";
import { getIntegrations, getIntegrationTokens } from "@/lib/actions/integrations";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const [integrations, tokens] = await Promise.all([
    getIntegrations(),
    getIntegrationTokens(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal border-t-transparent" />
        </div>
      }
    >
      <SettingsClient initialIntegrations={integrations} initialTokens={tokens} />
    </Suspense>
  );
}
