import { eq, and, asc } from "drizzle-orm";
import { db } from "~/db";
import { answers, UserRole } from "~/db/schema";

// ─── Answer Service ───
// Handles answer CRUD with permission checks and 30-minute edit window.

export function getAnswerById(id: number) {
  return db
    .select()
    .from(answers)
    .where(and(eq(answers.id, id), eq(answers.isDeleted, false)))
    .get();
}

export function getAnswersByQuestion(questionId: number) {
  return db
    .select()
    .from(answers)
    .where(
      and(eq(answers.questionId, questionId), eq(answers.isDeleted, false))
    )
    .orderBy(asc(answers.createdAt))
    .all();
}

export function createAnswer(
  questionId: number,
  userId: number,
  content: string
) {
  return db
    .insert(answers)
    .values({
      questionId,
      userId,
      content,
      isDeleted: false,
    })
    .returning()
    .get();
}

export function updateAnswer(id: number, content: string) {
  return db
    .update(answers)
    .set({
      content,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(answers.id, id))
    .returning()
    .get();
}

export function deleteAnswer(id: number) {
  return db
    .update(answers)
    .set({
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(answers.id, id))
    .returning()
    .get();
}

// ─── Permission Helpers ───

export function canEditAnswer(
  answer: { userId: number; createdAt: string },
  currentUserId: number
): boolean {
  if (answer.userId !== currentUserId) {
    return false;
  }

  const createdAt = new Date(answer.createdAt);
  const now = new Date();
  const minutesElapsed = (now.getTime() - createdAt.getTime()) / 1000 / 60;

  return minutesElapsed <= 30;
}

export function canDeleteAnswer(
  answer: { userId: number },
  currentUserId: number,
  currentUserRole: UserRole,
  isInstructor: boolean
): boolean {
  // Author can delete
  if (answer.userId === currentUserId) {
    return true;
  }

  // Instructor can delete answers in their course
  if (isInstructor) {
    return true;
  }

  // Admin can delete any answer
  if (currentUserRole === UserRole.Admin) {
    return true;
  }

  return false;
}
