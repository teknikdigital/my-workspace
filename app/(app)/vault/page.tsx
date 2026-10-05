import React from "react";
import { getCredentialsMetadata, getVaultAuditLogs } from "@/lib/actions/vault";
import { getServices } from "@/lib/actions/accounts";
import { VaultClient } from "./VaultClient";

export const revalidate = 0;

export default async function VaultPage() {
  const [credentials, services, auditLogs] = await Promise.all([
    getCredentialsMetadata(),
    getServices(),
    getVaultAuditLogs(30),
  ]);

  return (
    <VaultClient
      initialCredentials={credentials}
      services={services}
      auditLogs={auditLogs}
    />
  );
}
