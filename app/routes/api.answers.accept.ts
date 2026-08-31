import { data } from "react-router";
import { z } from "zod";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import {
  getQuestionById,
  acceptAnswer,
  canAcceptAnswer,
} from "~/services/questionService";
import { getAnswerById } from "~/services/answerService";
import { getCourseByLessonId } from "~/services/courseService";
import { AcceptedByRole } from "~/db/schema";

const acceptAnswerSchema = z.object({
  questionId: z.number(),
  answerId: z.number(),
});

export async function action({ request }: { request: Request }) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, acceptAnswerSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { questionId, answerId } = parsed.data;

  const question = getQuestionById(questionId);
  if (!question) {
    throw data("Question not found", { status: 404 });
  }

  const answer = getAnswerById(answerId);
  if (!answer || answer.questionId !== questionId) {
    throw data("Answer not found or does not belong to this question", {
      status: 404,
    });
  }

  const course = await getCourseByLessonId(question.lessonId);
  const isInstructor = course ? course.instructorId === currentUserId : false;

  if (!canAcceptAnswer(question, currentUserId, isInstructor)) {
    throw data("You do not have permission to accept answers", {
      status: 403,
    });
  }

  const acceptedByRole = isInstructor
    ? AcceptedByRole.Instructor
    : AcceptedByRole.Student;

  const updated = acceptAnswer(questionId, answerId, acceptedByRole);

  return { success: true, question: updated };
}
