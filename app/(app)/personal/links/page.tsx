import React from "react";
import { getPersonalLinks } from "@/lib/actions/personal";
import { LinksClient } from "./LinksClient";

export const revalidate = 0;

export default async function LinksPage() {
  const links = await getPersonalLinks();
  return <LinksClient initialLinks={links} />;
}
