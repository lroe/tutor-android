import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Circle,
  Pencil,
  Trash2,
} from "lucide-react";
import { SettingsSheet } from "../components/SettingsSheet";
import { PageSheet } from "../components/PageSheet";
import { Sheet } from "../components/Sheet";
import { Spinner } from "../components/Brand";
import { db, deleteBookDeep } from "../lib/db";
import { customChapter, openLesson, renameBook } from "../lib/library";
import { isConfigured } from "../lib/provider";
import type { Book, Lesson, Settings } from "../lib/types";
import { useSettings } from "../state/settings";

export function Note({
  id,
  autoPages,
  navigate,
}: {
  id: string;
  autoPages: boolean;
  navigate: (path: string) => void;
}) {
  const { settings, update } = useSettings();
  const book = useLiveQuery(() => db.books.get(id), [id]);
  const lessons = useLiveQuery(
    () => db.lessons.where("bookId").equals(id).toArray(),
    [id],
    [] as Lesson[],
  );
  const [pageOpen, setPageOpen] = useState(Boolean(autoPages));
  const [keyOpen, setKeyOpen] = useState(false);
  const [showConcepts, setShowConcepts] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [pending, setPending] = useState<{
    book: Book;
    start: number;
    end: number;
  } | null>(null);

  const startLesson = useCallback(
    async (target: Book, startPage: number, endPage: number) => {
      const lesson = await openLesson(target, customChapter(startPage, endPage, target.format));
      setPageOpen(false);
      navigate(`/lesson/${lesson.id}`);
    },
    [navigate],
  );

  useEffect(() => {
    if (!pending || !isConfigured(settings)) return;
    const queued = pending;
    setPending(null);
    void startLesson(queued.book, queued.start, queued.end);
  }, [pending, settings, startLesson]);

  const build = (startPage: number, endPage: number) => {
    if (!book) return;
    if (!isConfigured(settings)) {
      setPageOpen(false);
      setPending({ book, start: startPage, end: endPage });
      setKeyOpen(true);
      return;
    }
    void startLesson(book, startPage, endPage);
  };

  const saveSettings = (patch: Partial<Settings>) => {
    update(patch);
    setKeyOpen(false);
  };

  const closeKey = () => {
    setKeyOpen(false);
    setPending(null);
  };

  const saveTitle = async () => {
    const clean = titleDraft.replace(/\s+/g, " ").trim();
    if (!clean) return;
    setSavingTitle(true);
    setTitleError("");
    try {
      await renameBook(id, clean);
      setRenameOpen(false);
    } catch {
      setTitleError("Couldn't rename this note.");
    } finally {
      setSavingTitle(false);
    }
  };

  const removeBook = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteBookDeep(id);
      navigate("/");
    } catch (error) {
      setDeleting(false);
      setDeleteError(
        error instanceof Error ? error.message : "Couldn’t delete this note.",
      );
    }
  };

  if (book === undefined) {
    return (
      <div className="note">
        <header className="chat-bar">
          <button
            type="button"
            className="icon-button"
            onClick={() => navigate("/")}
            aria-label="Back"
          >
            <ArrowLeft size={21} />
          </button>
          <div className="chat-title" />
          <span className="chat-bar-spacer" />
        </header>
        <div className="state-center">
          <Spinner size={22} />
        </div>
      </div>
    );
  }

  if (book === null) {
    return (
      <div className="note">
        <header className="chat-bar">
          <button
            type="button"
            className="icon-button"
            onClick={() => navigate("/")}
            aria-label="Back"
          >
            <ArrowLeft size={21} />
          </button>
          <div className="chat-title">Note</div>
          <span className="chat-bar-spacer" />
        </header>
        <div className="state-center">
          <p>This note isn’t here.</p>
          <button
            type="button"
            className="text-button"
            onClick={() => navigate("/")}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const active = lessons
    .filter(
      (lesson) =>
        lesson.status === "active" ||
        lesson.status === "planning" ||
        lesson.status === "error",
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const learned = lessons.reduce(
    (sum, lesson) =>
      sum + lesson.plan.filter((concept) => concept.covered).length,
    0,
  );
  const ordered = [...lessons].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="note">
      <header className="chat-bar">
        <button
          type="button"
          className="icon-button"
          onClick={() => navigate("/")}
          aria-label="Back"
        >
          <ArrowLeft size={21} />
        </button>
        <button
          type="button"
          className="chat-title note-title-button"
          title="Rename note"
          onClick={() => {
            setTitleDraft(book.title);
            setTitleError("");
            setRenameOpen(true);
          }}
        >
          <span className="note-title-text">{book.title}</span>
          <Pencil size={12} />
        </button>
        <button
          type="button"
          className="icon-button note-delete"
          onClick={() => {
            setDeleteError("");
            setDeleteOpen(true);
          }}
          aria-label="Delete note"
        >
          <Trash2 size={18} />
        </button>
      </header>

      <div className="note-scroll">
        <div className="note-progress-head">
          <p className="note-eyebrow">Progress</p>
          <button
            type="button"
            className="text-button note-toggle"
            onClick={() => setShowConcepts((current) => !current)}
          >
            {showConcepts ? "Hide concepts" : "Show concepts"}
          </button>
        </div>
        <p className="note-learned">
          {learned > 0
            ? `${learned} ${learned === 1 ? "idea" : "ideas"} learned`
            : "No ideas yet"}
        </p>

        {active ? (
          <>
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate(`/lesson/${active.id}`)}
            >
              Continue lesson
            </button>
            <button
              type="button"
              className="text-button note-new-pages"
              onClick={() => setPageOpen(true)}
            >
              New pages
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={() => setPageOpen(true)}
          >
            Choose pages
          </button>
        )}

        {ordered.length > 0 && (
          <div className="note-groups">
            {ordered.map((lesson) => {
              const covered = lesson.plan.filter(
                (concept) => concept.covered,
              ).length;
              const total = lesson.plan.length;
              const canOpen = true;
              const status =
                lesson.status === "planning"
                  ? "Preparing…"
                  : lesson.status === "error"
                    ? "Try again"
                    : lesson.status === "done"
                      ? "Done"
                      : total > 0
                        ? `${covered} / ${total}`
                        : "In progress";

              const head = (
                <>
                  <span className="lesson-group-range">
                    {lesson.chapterTitle}
                  </span>
                  <span className="lesson-group-status">
                    {status}
                    {canOpen && <ChevronRight size={14} />}
                  </span>
                </>
              );

              return (
                <section className="lesson-group" key={lesson.id}>
                  {canOpen ? (
                    <button
                      type="button"
                      className="lesson-group-head is-action"
                      onClick={() => navigate(`/lesson/${lesson.id}`)}
                    >
                      {head}
                    </button>
                  ) : (
                    <div className="lesson-group-head">{head}</div>
                  )}

                  {lesson.plan.length > 0 && showConcepts ? (
                    <ul className="concept-list">
                      {lesson.plan.map((concept) => (
                        <li
                          key={concept.id}
                          className={
                            concept.covered
                              ? "concept-row is-learned"
                              : "concept-row"
                          }
                        >
                          <span className="concept-mark">
                            {concept.covered ? (
                              <Check size={12} />
                            ) : (
                              <Circle size={12} />
                            )}
                          </span>
                          <span>{concept.title}</span>
                        </li>
                      ))}
                    </ul>
                  ) : lesson.plan.length === 0 ? (
                    <p className="note-empty">
                      {lesson.status === "error"
                        ? "Couldn’t build this lesson. Tap the title to retry."
                        : lesson.status === "planning"
                          ? "Preparing the ideas…"
                          : "No ideas yet."}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {pageOpen && (
        <PageSheet
          book={book}
          onClose={() => setPageOpen(false)}
          onBuild={build}
        />
      )}

      {keyOpen && (
        <SettingsSheet
          settings={settings}
          onClose={closeKey}
          onSave={saveSettings}
        />
      )}

      {renameOpen && (
        <Sheet
          open
          onClose={() => {
            if (!savingTitle) setRenameOpen(false);
          }}
          title="Rename note"
          footer={
            <button
              type="button"
              className="primary-button"
              disabled={!titleDraft.trim() || savingTitle}
              onClick={() => void saveTitle()}
            >
              {savingTitle ? "Saving…" : "Save"}
            </button>
          }
        >
          <label className="field">
            <span>Title</span>
            <input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && titleDraft.trim()) {
                  void saveTitle();
                }
              }}
              maxLength={140}
              autoFocus
            />
          </label>
          {titleError && <p className="form-error">{titleError}</p>}
        </Sheet>
      )}

      {deleteOpen && (
        <Sheet
          open
          onClose={() => {
            if (!deleting) setDeleteOpen(false);
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
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
            </div>
          }
        >
          <p className="confirm-copy">
            This removes the PDF, every lesson, and all progress for this note
            from this device. It cannot be undone.
          </p>
          {deleteError && <p className="confirm-error">{deleteError}</p>}
        </Sheet>
      )}
    </div>
  );
}
