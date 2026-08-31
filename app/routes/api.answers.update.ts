import { data } from "react-router";
import { z } from "zod";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import {
  getAnswerById,
  updateAnswer,
  canEditAnswer,
} from "~/services/answerService";

const updateAnswerSchema = z.object({
  answerId: z.number(),
  content: z.string().min(10).max(5000),
});

export async function action({ request }: { request: Request }) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, updateAnswerSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { answerId, content } = parsed.data;

  const answer = getAnswerById(answerId);
  if (!answer) {
    throw data("Answer not found", { status: 404 });
  }

  if (!canEditAnswer(answer, currentUserId)) {
    throw data(
      "You can only edit your own answers within 30 minutes of creation",
      { status: 403 }
    );
  }

  const updated = updateAnswer(answerId, content);

  return { success: true, answer: updated };
}
