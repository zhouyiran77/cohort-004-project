import { data } from "react-router";
import { z } from "zod";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import { createQuestion } from "~/services/questionService";
import { getCourseByLessonId } from "~/services/courseService";
import { isUserEnrolled } from "~/services/enrollmentService";

const createQuestionSchema = z.object({
  lessonId: z.number(),
  title: z.string().min(5).max(200),
  content: z.string().min(10).max(5000),
});

export async function action({ request }: { request: Request }) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, createQuestionSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { lessonId, title, content } = parsed.data;

  const course = await getCourseByLessonId(lessonId);
  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  const enrolled = isUserEnrolled(currentUserId, course.id);
  const isInstructor = course.instructorId === currentUserId;
  if (!enrolled && !isInstructor) {
    throw data("You must be enrolled in this course to ask questions", {
      status: 403,
    });
  }

  const question = createQuestion(lessonId, currentUserId, title, content);

  return { success: true, question };
}
