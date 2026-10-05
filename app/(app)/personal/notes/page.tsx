import React from "react";
import { getNotes } from "@/lib/actions/notes";
import { NotesClient } from "./NotesClient";

export const revalidate = 0;

export default async function NotesPage() {
  const notes = await getNotes();
  return <NotesClient initialNotes={notes} />;
}
