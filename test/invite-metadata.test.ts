import { describe, expect, it } from "vitest";
import { inviteMetadata } from "@/lib/invite-metadata";

const card = { creatorName: "Varun", showName: "In Between", angle: "Dreams and the road to them" };

describe("inviteMetadata", () => {
  it("titles the card with the host and show", () => {
    expect(inviteMetadata(card).title).toBe("Varun invites you to In Between");
  });

  it("sets its own description so the site-wide one (which mentions Mosaic) is never inherited", () => {
    const meta = inviteMetadata(card);
    expect(meta.description).toBe("Dreams and the road to them");
    expect(meta.openGraph).toMatchObject({ title: "Varun invites you to In Between", description: "Dreams and the road to them" });
  });

  it("never mentions Mosaic, even for an unknown invite", () => {
    expect(JSON.stringify(inviteMetadata(null))).not.toMatch(/mosaic/i);
    expect(JSON.stringify(inviteMetadata({ ...card, angle: "" }))).not.toMatch(/mosaic/i);
  });
});
