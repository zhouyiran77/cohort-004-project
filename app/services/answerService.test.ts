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
  getAnswerById,
  getAnswersByQuestion,
  createAnswer,
  updateAnswer,
  deleteAnswer,
  canEditAnswer,
  canDeleteAnswer,
} from "./answerService";
import { createQuestion } from "./questionService";
import { createModule } from "./moduleService";
import { createLesson } from "./lessonService";

let questionId: number;

describe("answerService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    const mod = createModule(base.course.id, "Test Module", 1);
    const lesson = createLesson(
      mod.id,
      "Test Lesson",
      "Content",
      null,
      1,
      null
    );
    const question = createQuestion(
      lesson.id,
      base.user.id,
      "Test Question",
      "Question content"
    );
    questionId = question.id;
  });

  // ─── CRUD ───

  describe("createAnswer", () => {
    it("creates an answer with correct fields", () => {
      const answer = createAnswer(
        questionId,
        base.instructor.id,
        "Here is the answer to your question"
      );

      expect(answer).toBeDefined();
      expect(answer.content).toBe("Here is the answer to your question");
      expect(answer.questionId).toBe(questionId);
      expect(answer.userId).toBe(base.instructor.id);
      expect(answer.isDeleted).toBe(false);
    });
  });

  describe("getAnswerById", () => {
    it("returns an answer by id", () => {
      const created = createAnswer(
        questionId,
        base.instructor.id,
        "Answer content here"
      );
      const found = getAnswerById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it("returns undefined for deleted answers", () => {
      const created = createAnswer(
        questionId,
        base.instructor.id,
        "Answer content here"
      );
      deleteAnswer(created.id);
      const found = getAnswerById(created.id);

      expect(found).toBeUndefined();
    });
  });

  describe("getAnswersByQuestion", () => {
    it("returns answers ordered by creation time asc", () => {
      createAnswer(questionId, base.user.id, "First answer content");
      createAnswer(questionId, base.instructor.id, "Second answer content");

      const answers = getAnswersByQuestion(questionId);

      expect(answers).toHaveLength(2);
      expect(answers[0].content).toBe("First answer content");
      expect(answers[1].content).toBe("Second answer content");
    });

    it("excludes deleted answers", () => {
      const a1 = createAnswer(questionId, base.user.id, "Keep this answer");
      const a2 = createAnswer(
        questionId,
        base.instructor.id,
        "Delete this answer"
      );
      deleteAnswer(a2.id);

      const answers = getAnswersByQuestion(questionId);

      expect(answers).toHaveLength(1);
      expect(answers[0].id).toBe(a1.id);
    });
  });

  describe("updateAnswer", () => {
    it("updates content", () => {
      const created = createAnswer(
        questionId,
        base.user.id,
        "Old answer content"
      );
      const updated = updateAnswer(created.id, "New answer content");

      expect(updated!.content).toBe("New answer content");
    });
  });

  describe("deleteAnswer (soft delete)", () => {
    it("marks answer as deleted", () => {
      const created = createAnswer(
        questionId,
        base.user.id,
        "Answer to delete"
      );
      deleteAnswer(created.id);

      const found = getAnswerById(created.id);
      expect(found).toBeUndefined();
    });
  });

  // ─── Permissions ───

  describe("canEditAnswer", () => {
    it("allows author to edit within 30 minutes", () => {
      const answer = {
        userId: 1,
        createdAt: new Date().toISOString(),
      };

      expect(canEditAnswer(answer, 1)).toBe(true);
    });

    it("denies author after 30 minutes", () => {
      const ago = new Date(Date.now() - 31 * 60 * 1000);
      const answer = {
        userId: 1,
        createdAt: ago.toISOString(),
      };

      expect(canEditAnswer(answer, 1)).toBe(false);
    });

    it("denies non-author", () => {
      const answer = {
        userId: 1,
        createdAt: new Date().toISOString(),
      };

      expect(canEditAnswer(answer, 2)).toBe(false);
    });
  });

  describe("canDeleteAnswer", () => {
    it("allows author to delete", () => {
      const result = canDeleteAnswer(
        { userId: 1 },
        1,
        schema.UserRole.Student,
        false
      );
      expect(result).toBe(true);
    });

    it("allows instructor to delete", () => {
      const result = canDeleteAnswer(
        { userId: 1 },
        2,
        schema.UserRole.Instructor,
        true
      );
      expect(result).toBe(true);
    });

    it("allows admin to delete", () => {
      const result = canDeleteAnswer(
        { userId: 1 },
        3,
        schema.UserRole.Admin,
        false
      );
      expect(result).toBe(true);
    });

    it("denies non-author non-instructor non-admin", () => {
      const result = canDeleteAnswer(
        { userId: 1 },
        2,
        schema.UserRole.Student,
        false
      );
      expect(result).toBe(false);
    });
  });
});
