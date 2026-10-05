import React from "react";
import { getDocuments } from "@/lib/actions/personal";
import { DocumentsClient } from "./DocumentsClient";

export const revalidate = 0;

export default async function DocumentsPage() {
  const documents = await getDocuments();
  return <DocumentsClient initialDocuments={documents} />;
}
