import React from "react";
import { getAccounts, getServices } from "@/lib/actions/accounts";
import { AccountsClient } from "./AccountsClient";

export const revalidate = 0;

export default async function AccountsPage() {
  const [accounts, services] = await Promise.all([
    getAccounts(),
    getServices(),
  ]);

  return (
    <AccountsClient
      initialAccounts={accounts}
      services={services}
    />
  );
}
