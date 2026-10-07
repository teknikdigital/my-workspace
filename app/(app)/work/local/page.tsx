import React from "react";
import { LocalAppsClient } from "./LocalAppsClient";

// Status aplikasi diambil langsung dari browser ke agent di laptop,
// jadi halaman ini tidak butuh data dari server.
export default function LocalAppsPage() {
  return <LocalAppsClient />;
}
