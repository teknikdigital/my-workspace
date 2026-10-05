import React from "react";
import { getResources } from "@/lib/actions/resources";
import { getAccounts } from "@/lib/actions/accounts";
import { ResourcesClient } from "./ResourcesClient";

export const revalidate = 0;

export default async function ResourcesPage() {
  const [resources, accounts] = await Promise.all([
    getResources(),
    getAccounts(),
  ]);

  return (
    <ResourcesClient
      initialResources={resources}
      accounts={accounts}
    />
  );
}
