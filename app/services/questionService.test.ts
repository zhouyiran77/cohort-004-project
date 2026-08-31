import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getQuestionById,
  getQuestionsByLesson,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  acceptAnswer,
  unacceptAnswer,
  canEditQuestion,
  canDeleteQuestion,
  canAcceptAnswer,
} from "./questionService";
import { createModule } from "./moduleService";
import { createLesson } from "./lessonService";
import { createAnswer } from "./answerService";

let moduleId: number;
let lessonId: number;

describe("questionService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    const mod = createModule(base.course.id, "Test Module", 1);
    moduleId = mod.id;
    const lesson = createLesson(
      moduleId,
      "Test Lesson",
      "Content",
      null,
      1,
      null
    );
    lessonId = lesson.id;
  });

  // ─── CRUD ───

  describe("createQuestion", () => {
    it("creates a question with correct fields", () => {
      const question = createQuestion(
        lessonId,
        base.user.id,
        "How to fix this?",
        "I am getting an error when running the code..."
      );

      expect(question).toBeDefined();
      expect(question.title).toBe("How to fix this?");
      expect(question.content).toBe(
        "I am getting an error when running the code..."
      );
      expect(question.lessonId).toBe(lessonId);
      expect(question.userId).toBe(base.user.id);
      expect(question.status).toBe(schema.QuestionStatus.Open);
      expect(question.isDeleted).toBe(false);
      expect(question.acceptedAnswerId).toBeNull();
    });
  });

  describe("getQuestionById", () => {
    it("returns a question by id", () => {
      const created = createQuestion(
        lessonId,
        base.user.id,
        "Title",
        "Content text here"
      );
      const found = getQuestionById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it("returns undefined for deleted questions", () => {
      const created = createQuestion(
        lessonId,
        base.user.id,
        "Title",
        "Content text here"
      );
      deleteQuestion(created.id);
      const found = getQuestionById(created.id);

      expect(found).toBeUndefined();
    });
  });

  describe("getQuestionsByLesson", () => {
    it("returns questions ordered by creation time desc", () => {
      createQuestion(lessonId, base.user.id, "First question", "First content");
      createQuestion(
        lessonId,
        base.user.id,
        "Second question",
        "Second content"
      );

      const questions = getQuestionsByLesson(lessonId);

      expect(questions).toHaveLength(2);
      expect(questions[0].title).toBe("Second question");
      expect(questions[1].title).toBe("First question");
    });

    it("excludes deleted questions", () => {
      const q1 = createQuestion(
        lessonId,
        base.user.id,
        "Keep this",
        "Keep content"
      );
      const q2 = createQuestion(
        lessonId,
        base.user.id,
        "Delete this",
        "Delete content"
      );
      deleteQuestion(q2.id);

      const questions = getQuestionsByLesson(lessonId);

      expect(questions).toHaveLength(1);
      expect(questions[0].id).toBe(q1.id);
    });
  });

  describe("updateQuestion", () => {
    it("updates title and content", () => {
      const created = createQuestion(
        lessonId,
        base.user.id,
        "Old title",
        "Old content text"
      );
      const updated = updateQuestion(
        created.id,
        "New title",
        "New content text"
      );

      expect(updated!.title).toBe("New title");
      expect(updated!.content).toBe("New content text");
    });
  });

  describe("deleteQuestion (soft delete)", () => {
    it("marks question as deleted", () => {
      const created = createQuestion(
        lessonId,
        base.user.id,
        "Title here",
        "Content text here"
      );
      deleteQuestion(created.id);

      const found = getQuestionById(created.id);
      expect(found).toBeUndefined();
    });
  });

  // ─── Accept Answer ───

  describe("acceptAnswer", () => {
    it("marks question as resolved with accepted answer", () => {
      const question = createQuestion(
        lessonId,
        base.user.id,
        "My question",
        "Question content"
      );
      const answer = createAnswer(
        question.id,
        base.instructor.id,
        "Here is the answer"
      );

      const updated = acceptAnswer(
        question.id,
        answer.id,
        schema.AcceptedByRole.Instructor
      );

      expect(updated!.acceptedAnswerId).toBe(answer.id);
      expect(updated!.acceptedByRole).toBe(schema.AcceptedByRole.Instructor);
      expect(updated!.status).toBe(schema.QuestionStatus.Resolved);
      expect(updated!.resolvedAt).not.toBeNull();
    });
  });

  describe("unacceptAnswer", () => {
    it("reverts question to open status", () => {
      const question = createQuestion(
        lessonId,
        base.user.id,
        "My question",
        "Question content"
      );
      const answer = createAnswer(
        question.id,
        base.instructor.id,
        "Answer here"
      );
      acceptAnswer(question.id, answer.id, schema.AcceptedByRole.Student);

      const updated = unacceptAnswer(question.id);

      expect(updated!.acceptedAnswerId).toBeNull();
      expect(updated!.acceptedByRole).toBeNull();
      expect(updated!.status).toBe(schema.QuestionStatus.Open);
      expect(updated!.resolvedAt).toBeNull();
    });
  });

  // ─── Permissions ───

  describe("canEditQuestion", () => {
    it("allows author to edit within 30 minutes", () => {
      const question = {
        userId: 1,
        createdAt: new Date().toISOString(),
      };

      expect(canEditQuestion(question, 1)).toBe(true);
    });

    it("denies author after 30 minutes", () => {
      const ago = new Date(Date.now() - 31 * 60 * 1000);
      const question = {
        userId: 1,
        createdAt: ago.toISOString(),
      };

      expect(canEditQuestion(question, 1)).toBe(false);
    });

    it("denies non-author", () => {
      const question = {
        userId: 1,
        createdAt: new Date().toISOString(),
      };

      expect(canEditQuestion(question, 2)).toBe(false);
    });
  });

  describe("canDeleteQuestion", () => {
    it("allows author to delete", () => {
      const result = canDeleteQuestion(
        { userId: 1 },
        1,
        schema.UserRole.Student,
        false
      );
      expect(result).toBe(true);
    });

    it("allows instructor to delete", () => {
      const result = canDeleteQuestion(
        { userId: 1 },
        2,
        schema.UserRole.Instructor,
        true
      );
      expect(result).toBe(true);
    });

    it("allows admin to delete", () => {
      const result = canDeleteQuestion(
        { userId: 1 },
        3,
        schema.UserRole.Admin,
        false
      );
      expect(result).toBe(true);
    });

    it("denies non-author non-instructor non-admin", () => {
      const result = canDeleteQuestion(
        { userId: 1 },
        2,
        schema.UserRole.Student,
        false
      );
      expect(result).toBe(false);
    });
  });

  describe("canAcceptAnswer", () => {
    it("allows question author to accept", () => {
      expect(canAcceptAnswer({ userId: 1 }, 1, false)).toBe(true);
    });

    it("allows instructor to accept", () => {
      expect(canAcceptAnswer({ userId: 1 }, 2, true)).toBe(true);
    });

    it("denies non-author non-instructor", () => {
      expect(canAcceptAnswer({ userId: 1 }, 2, false)).toBe(false);
    });
  });
});
