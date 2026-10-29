import { MockLanguageModelV4 } from "ai/test";

/** A language model that answers each call with the next JSON value and records every prompt it saw. */
export function mockJsonModel(...answers: unknown[]) {
  let call = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const answer = answers[Math.min(call++, answers.length - 1)];
      return {
        content: [{ type: "text", text: JSON.stringify(answer) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  const prompts = () => model.doGenerateCalls.map((c) => JSON.stringify(c.prompt));
  return { model, prompts };
}
