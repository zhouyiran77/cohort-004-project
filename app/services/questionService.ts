import { eq, and, desc } from "drizzle-orm";
import { db } from "~/db";
import {
  questions,
  answers,
  QuestionStatus,
  AcceptedByRole,
  UserRole,
} from "~/db/schema";

// ─── Question Service ───
// Handles Q&A system for lessons with permission checks and state management.

export function getQuestionById(id: number) {
  return db
    .select()
    .from(questions)
    .where(and(eq(questions.id, id), eq(questions.isDeleted, false)))
    .get();
}

export function getQuestionsByLesson(lessonId: number) {
  return db
    .select()
    .from(questions)
    .where(
      and(eq(questions.lessonId, lessonId), eq(questions.isDeleted, false))
    )
    .orderBy(desc(questions.createdAt))
    .all();
}

export function createQuestion(
  lessonId: number,
  userId: number,
  title: string,
  content: string
) {
  return db
    .insert(questions)
    .values({
      lessonId,
      userId,
      title,
      content,
      status: QuestionStatus.Open,
      isDeleted: false,
    })
    .returning()
    .get();
}

export function updateQuestion(id: number, title: string, content: string) {
  return db
    .update(questions)
    .set({
      title,
      content,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(questions.id, id))
    .returning()
    .get();
}

export function deleteQuestion(id: number) {
  return db
    .update(questions)
    .set({
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(questions.id, id))
    .returning()
    .get();
}

export function acceptAnswer(
  questionId: number,
  answerId: number,
  acceptedByRole: AcceptedByRole
) {
  return db
    .update(questions)
    .set({
      acceptedAnswerId: answerId,
      acceptedByRole,
      status: QuestionStatus.Resolved,
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(questions.id, questionId))
    .returning()
    .get();
}

export function unacceptAnswer(questionId: number) {
  return db
    .update(questions)
    .set({
      acceptedAnswerId: null,
      acceptedByRole: null,
      status: QuestionStatus.Open,
      resolvedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(questions.id, questionId))
    .returning()
    .get();
}

// ─── Permission Helpers ───

export function canEditQuestion(
  question: { userId: number; createdAt: string },
  currentUserId: number
): boolean {
  if (question.userId !== currentUserId) {
    return false;
  }

  const createdAt = new Date(question.createdAt);
  const now = new Date();
  const minutesElapsed = (now.getTime() - createdAt.getTime()) / 1000 / 60;

  return minutesElapsed <= 30;
}

export function canDeleteQuestion(
  question: { userId: number },
  currentUserId: number,
  currentUserRole: UserRole,
  isInstructor: boolean
): boolean {
  // Author can delete
  if (question.userId === currentUserId) {
    return true;
  }

  // Instructor can delete questions in their course
  if (isInstructor) {
    return true;
  }

  // Admin can delete any question
  if (currentUserRole === UserRole.Admin) {
    return true;
  }

  return false;
}

export function canAcceptAnswer(
  question: { userId: number },
  currentUserId: number,
  isInstructor: boolean
): boolean {
  // Question author can accept
  if (question.userId === currentUserId) {
    return true;
  }

  // Instructor can accept
  if (isInstructor) {
    return true;
  }

  return false;
}
