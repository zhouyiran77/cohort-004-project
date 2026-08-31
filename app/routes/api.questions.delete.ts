import { data } from "react-router";
import { z } from "zod";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import {
  getQuestionById,
  deleteQuestion,
  canDeleteQuestion,
} from "~/services/questionService";
import { getCourseByLessonId } from "~/services/courseService";
import { getUserById } from "~/services/userService";

const deleteQuestionSchema = z.object({
  questionId: z.number(),
});

export async function action({ request }: { request: Request }) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const currentUser = getUserById(currentUserId);
  if (!currentUser) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, deleteQuestionSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { questionId } = parsed.data;

  const question = getQuestionById(questionId);
  if (!question) {
    throw data("Question not found", { status: 404 });
  }

  const course = await getCourseByLessonId(question.lessonId);
  const isInstructor = course ? course.instructorId === currentUserId : false;

  if (
    !canDeleteQuestion(question, currentUserId, currentUser.role, isInstructor)
  ) {
    throw data("You do not have permission to delete this question", {
      status: 403,
    });
  }

  deleteQuestion(questionId);

  return { success: true };
}
