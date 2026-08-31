import { data } from "react-router";
import { z } from "zod";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import {
  getAnswerById,
  deleteAnswer,
  canDeleteAnswer,
} from "~/services/answerService";
import { getQuestionById } from "~/services/questionService";
import { getCourseByLessonId } from "~/services/courseService";
import { getUserById } from "~/services/userService";

const deleteAnswerSchema = z.object({
  answerId: z.number(),
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

  const parsed = await parseJsonBody(request, deleteAnswerSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { answerId } = parsed.data;

  const answer = getAnswerById(answerId);
  if (!answer) {
    throw data("Answer not found", { status: 404 });
  }

  const question = getQuestionById(answer.questionId);
  if (!question) {
    throw data("Question not found", { status: 404 });
  }

  const course = await getCourseByLessonId(question.lessonId);
  const isInstructor = course ? course.instructorId === currentUserId : false;

  if (!canDeleteAnswer(answer, currentUserId, currentUser.role, isInstructor)) {
    throw data("You do not have permission to delete this answer", {
      status: 403,
    });
  }

  deleteAnswer(answerId);

  return { success: true };
}
