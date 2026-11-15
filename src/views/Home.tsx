import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { Wordmark } from "../components/Brand";
import { SettingsSheet } from "../components/SettingsSheet";
import { Sheet } from "../components/Sheet";
import { UploadOverlay } from "../components/UploadOverlay";
import { db, deleteBookDeep } from "../lib/db";
import type { Book, Lesson } from "../lib/types";
import { useSettings } from "../state/settings";

export function Home({ navigate }: { navigate: (path: string) => void }) {
  const { settings, update } = useSettings();
  const books = useLiveQuery(
    () => db.books.orderBy("lastOpenedAt").reverse().toArray(),
    [],
    [] as Book[],
  );
  const lessons = useLiveQuery(
    () => db.lessons.toArray(),
    [],
    [] as Lesson[],
  );

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [homeError, setHomeError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const countFor = (bookId: string) =>
    lessons
      .filter((lesson) => lesson.bookId === bookId)
      .reduce(
        (sum, lesson) =>
          sum + lesson.plan.filter((concept) => concept.covered).length,
        0,
      );

  const removeBook = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteBookDeep(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Couldn’t delete this note.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
    const isPptx =
      file.type ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      lower.endsWith(".pptx");
    if (!isPdf && !isPptx) {
      setHomeError("Choose a PDF or PowerPoint.");
      return;
    }
    setHomeError("");
    setUploadFile(file);
  };

  return (
    <main className="home">
      <header className="home-bar">
        <Wordmark />
        <button
          type="button"
          className="icon-button"
          onClick={() => setKeyOpen(true)}
          aria-label="Settings"
        >
          <SettingsIcon size={19} />
        </button>
      </header>

      <div className="home-scroll">
        {books.length === 0 ? (
          <div className="home-empty">No notes yet</div>
        ) : (
          <div className="note-list">
            {books.map((book) => {
              const count = countFor(book.id);
              const latest = lessons
                .filter((lesson) => lesson.bookId === book.id)
                .sort((a, b) => b.updatedAt - a.updatedAt)[0];
              return (
                <div className="note-row" key={book.id}>
                  <button
                    type="button"
                    className="note-main"
                    onClick={() => {
                      setHomeError("");
                      void db.books.update(book.id, {
                        lastOpenedAt: Date.now(),
                      });
                      navigate(`/note/${book.id}`);
                    }}
                  >
                    <span className="note-title">{book.title}</span>
                    <span className="note-count">
                      {latest ? `${latest.chapterTitle} · ` : ""}
                      {count > 0
                        ? `${count} ${count === 1 ? "idea" : "ideas"} learned`
                        : latest?.status === "planning"
                          ? "Preparing…"
                          : latest?.status === "error"
                            ? "Couldn’t build"
                            : latest
                              ? "Not started"
                              : "No ideas yet"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="note-row-delete"
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget(book);
                    }}
                    aria-label={`Delete ${book.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {homeError && <p className="home-error">{homeError}</p>}

      <button
        type="button"
        className="upload-bar"
        onClick={() => fileRef.current?.click()}
      >
        <Plus size={20} />
        <span>Upload a note</span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
        className="visually-hidden"
        onChange={onFile}
      />

      {uploadFile && (
        <UploadOverlay
          file={uploadFile}
          onClose={() => setUploadFile(null)}
          onDone={(book) => {
            setUploadFile(null);
            navigate(`/note/${book.id}?pages=1`);
          }}
        />
      )}

      {keyOpen && (
        <SettingsSheet
          settings={settings}
          onClose={() => setKeyOpen(false)}
          onSave={(patch) => {
            update(patch);
            setKeyOpen(false);
          }}
        />
      )}

      {deleteTarget && (
        <Sheet
          open
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          title="Delete this note?"
          footer={
            <div className="confirm-actions">
              <button
                type="button"
                className="danger-button"
                disabled={deleting}
                onClick={() => void removeBook()}
              >
                {deleting ? "Deleting…" : "Delete note"}
              </button>
              <button
                type="button"
                className="text-button confirm-cancel"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
            </div>
          }
        >
          <p className="confirm-copy">
            “{deleteTarget.title}” and all its lessons, chats, and progress will
            be removed from this device. This cannot be undone.
          </p>
          {deleteError && <p className="confirm-error">{deleteError}</p>}
        </Sheet>
      )}
    </main>
  );
}
