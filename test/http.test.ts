import { describe, expect, it } from "vitest";
import { readJsonResponse } from "@/lib/http";

describe("readJsonResponse", () => {
  it("returns the JSON body of a successful response", async () => {
    expect(await readJsonResponse(new Response(JSON.stringify({ a: 1 }), { status: 200 }))).toEqual({ ok: true, body: { a: 1 } });
  });

  it("returns the server's error message on a JSON error", async () => {
    const res = new Response(JSON.stringify({ error: "Too many drafts" }), { status: 429 });
    expect(await readJsonResponse(res)).toEqual({ ok: false, error: "Too many drafts" });
  });

  it("explains a timeout instead of a parse error when the body isn't JSON", async () => {
    const res = new Response("An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT", { status: 504 });
    expect(await readJsonResponse(res)).toEqual({ ok: false, error: "That took too long. Please try again." });
  });

  it("gives a plain message for any other non-JSON failure", async () => {
    expect(await readJsonResponse(new Response("<html>oops</html>", { status: 500 }))).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
  });
});
