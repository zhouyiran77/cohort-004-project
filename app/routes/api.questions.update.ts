import { data } from "react-router";
import { z } from "zod";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import {
  getQuestionById,
  updateQuestion,
  canEditQuestion,
} from "~/services/questionService";

const updateQuestionSchema = z.object({
  questionId: z.number(),
  title: z.string().min(5).max(200),
  content: z.string().min(10).max(5000),
});

export async function action({ request }: { request: Request }) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, updateQuestionSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { questionId, title, content } = parsed.data;

  const question = getQuestionById(questionId);
  if (!question) {
    throw data("Question not found", { status: 404 });
  }

  if (!canEditQuestion(question, currentUserId)) {
    throw data(
      "You can only edit your own questions within 30 minutes of creation",
      { status: 403 }
    );
  }

  const updated = updateQuestion(questionId, title, content);

  return { success: true, question: updated };
}
