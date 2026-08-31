import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
import {
  MessageSquare,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Award,
  Trash2,
} from "lucide-react";

type Answer = {
  id: number;
  questionId: number;
  userId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: string;
};

type Question = {
  id: number;
  lessonId: number;
  userId: number;
  title: string;
  content: string;
  status: "open" | "resolved";
  acceptedAnswerId: number | null;
  acceptedByRole: "student" | "instructor" | null;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: string;
  answers: Answer[];
};

type QnASectionProps = {
  lessonId: number;
  questions: Question[];
  currentUserId: number | null;
  currentUserRole: string;
  isInstructor: boolean;
  enrolled: boolean;
  onMutate: () => void;
};

export function QnASection({
  lessonId,
  questions: initialQuestions,
  currentUserId,
  currentUserRole,
  isInstructor,
  enrolled,
  onMutate,
}: QnASectionProps) {
  const [showAskForm, setShowAskForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.length < 5 || content.length < 10) return;

    setIsCreating(true);
    try {
      await fetch("/api/questions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, title, content }),
      });
      setTitle("");
      setContent("");
      setShowAskForm(false);
      onMutate();
    } finally {
      setIsCreating(false);
    }
  };

  if (!currentUserId) return null;
  if (!enrolled && !isInstructor && currentUserRole !== "admin") return null;

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">Questions & Answers</h2>
            <span className="text-sm text-muted-foreground">
              ({initialQuestions.length})
            </span>
          </div>
          {!showAskForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAskForm(true)}
            >
              <Plus className="mr-1.5 size-4" />
              Ask Question
            </Button>
          )}
        </div>

        {showAskForm && (
          <form
            onSubmit={handleSubmitQuestion}
            className="mb-6 space-y-4 rounded-lg border p-4"
          >
            <div>
              <Input
                placeholder="Question title (5-200 characters)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                minLength={5}
                maxLength={200}
                required
                className="mb-2"
              />
              <Textarea
                placeholder="Describe your question in detail (10-5000 characters)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                minLength={10}
                maxLength={5000}
                required
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isCreating || title.length < 5 || content.length < 10}
              >
                {isCreating ? "Posting..." : "Post Question"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAskForm(false);
                  setTitle("");
                  setContent("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {initialQuestions.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No questions yet. Be the first to ask!
          </p>
        ) : (
          <div className="space-y-3">
            {initialQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                isExpanded={expandedId === question.id}
                onToggle={() =>
                  setExpandedId(expandedId === question.id ? null : question.id)
                }
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                isInstructor={isInstructor}
                onMutate={onMutate}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Question Card ───

function QuestionCard({
  question,
  isExpanded,
  onToggle,
  currentUserId,
  currentUserRole,
  isInstructor,
  onMutate,
}: {
  question: Question;
  isExpanded: boolean;
  onToggle: () => void;
  currentUserId: number;
  currentUserRole: string;
  isInstructor: boolean;
  onMutate: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete =
    question.userId === currentUserId ||
    isInstructor ||
    currentUserRole === "admin";

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this question?")) return;

    setIsDeleting(true);
    try {
      await fetch("/api/questions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id }),
      });
      onMutate();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between p-4 text-left hover:bg-muted/50"
      >
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{question.title}</h3>
            {question.status === "resolved" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                <Check className="size-3" />
                Resolved
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {question.authorName}
            {question.authorRole === "instructor" && (
              <span className="ml-1 text-xs text-primary">(Instructor)</span>
            )}
            {" · "}
            {new Date(question.createdAt).toLocaleDateString()}
            {" · "}
            {question.answers.length}{" "}
            {question.answers.length === 1 ? "answer" : "answers"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="mt-0.5 size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="mt-0.5 size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-4 pb-4 pt-3">
          <p className="mb-4 whitespace-pre-wrap text-sm">{question.content}</p>

          {question.answers.length > 0 && (
            <div className="mb-4 space-y-3">
              {question.answers.map((answer) => (
                <AnswerCard
                  key={answer.id}
                  answer={answer}
                  isAccepted={answer.id === question.acceptedAnswerId}
                  acceptedByRole={question.acceptedByRole}
                  canAccept={question.userId === currentUserId || isInstructor}
                  canDelete={
                    answer.userId === currentUserId ||
                    isInstructor ||
                    currentUserRole === "admin"
                  }
                  questionId={question.id}
                  onMutate={onMutate}
                />
              ))}
            </div>
          )}

          <AnswerForm questionId={question.id} onMutate={onMutate} />
        </div>
      )}
    </div>
  );
}

// ─── Answer Card ───

function AnswerCard({
  answer,
  isAccepted,
  acceptedByRole,
  canAccept,
  canDelete,
  questionId,
  onMutate,
}: {
  answer: Answer;
  isAccepted: boolean;
  acceptedByRole: string | null;
  canAccept: boolean;
  canDelete: boolean;
  questionId: number;
  onMutate: () => void;
}) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await fetch("/api/answers/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answerId: answer.id }),
      });
      onMutate();
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this answer?")) return;

    setIsDeleting(true);
    try {
      await fetch("/api/answers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId: answer.id }),
      });
      onMutate();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`rounded-md border p-3 ${isAccepted ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30" : "bg-muted/30"}`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {answer.authorName}
          </span>
          {answer.authorRole === "instructor" && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              Instructor
            </span>
          )}
          <span>{new Date(answer.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1">
          {isAccepted && (
            <span className="inline-flex items-center gap-1 text-xs text-green-600">
              <Award className="size-3" />
              {acceptedByRole === "instructor"
                ? "Instructor Accepted"
                : "Accepted"}
            </span>
          )}
          {canAccept && !isAccepted && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={handleAccept}
              disabled={isAccepting}
            >
              <Check className="mr-1 size-3" />
              Accept
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm">{answer.content}</p>
    </div>
  );
}

// ─── Answer Form ───

function AnswerForm({
  questionId,
  onMutate,
}: {
  questionId: number;
  onMutate: () => void;
}) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.length < 10) return;

    setIsSubmitting(true);
    try {
      await fetch("/api/answers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, content }),
      });
      setContent("");
      setShowForm(false);
      onMutate();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
        Write an Answer
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder="Write your answer (10-5000 characters)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        minLength={10}
        maxLength={5000}
        required
        rows={3}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || content.length < 10}
        >
          {isSubmitting ? "Posting..." : "Post Answer"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setShowForm(false);
            setContent("");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
