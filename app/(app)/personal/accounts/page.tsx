import React from "react";
import { getAccounts, getServices } from "@/lib/actions/accounts";
import { AccountsClient } from "../../work/accounts/AccountsClient";

export const revalidate = 0;

export default async function PersonalAccountsPage() {
  const [allAccounts, services] = await Promise.all([
    getAccounts(),
    getServices(),
  ]);

  const personalAccounts = allAccounts.filter((a) => a.is_personal);

  return (
    <AccountsClient
      initialAccounts={personalAccounts}
      services={services}
    />
  );
}
