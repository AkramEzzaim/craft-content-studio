"use client";
import type { Article } from "@/lib/types";

export function NoteEntriesEditor({ notes, change }: { notes: NonNullable<Article["noteEntries"]>; change: (notes: NonNullable<Article["noteEntries"]>) => void }) {
  return <><div className="subsection-head"><h3>Notes</h3><button className="button light" onClick={() => change([...notes, { title: "", body: "" }])}>+ Add note</button></div>{notes.map((note, index) => <div className="step-card" key={index}><label className="field"><span>Short heading (optional)</span><input value={note.title} onChange={event => change(notes.map((item, position) => position === index ? { ...item, title: event.target.value } : item))}/></label><label className="field"><span>Note</span><textarea rows={2} value={note.body} onChange={event => change(notes.map((item, position) => position === index ? { ...item, body: event.target.value } : item))}/></label><button className="button light" onClick={() => change(notes.filter((_, position) => position !== index))}>Remove note</button></div>)}</>;
}
