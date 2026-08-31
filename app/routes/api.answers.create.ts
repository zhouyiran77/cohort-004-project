import { data } from "react-router";
import { z } from "zod";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import { getQuestionById } from "~/services/questionService";
import { createAnswer } from "~/services/answerService";
import { getCourseByLessonId } from "~/services/courseService";
import { isUserEnrolled } from "~/services/enrollmentService";

const createAnswerSchema = z.object({
  questionId: z.number(),
  content: z.string().min(10).max(5000),
});

export async function action({ request }: { request: Request }) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, createAnswerSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { questionId, content } = parsed.data;

  const question = getQuestionById(questionId);
  if (!question) {
    throw data("Question not found", { status: 404 });
  }

  const course = await getCourseByLessonId(question.lessonId);
  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  const enrolled = isUserEnrolled(currentUserId, course.id);
  const isInstructor = course.instructorId === currentUserId;
  if (!enrolled && !isInstructor) {
    throw data("You must be enrolled in this course to answer questions", {
      status: 403,
    });
  }

  const answer = createAnswer(questionId, currentUserId, content);

  return { success: true, answer };
}
