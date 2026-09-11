import { buildSavedViewQueryString, normalizeSavedViewQueryString } from "@/lib/saved-views";

describe("saved view query helpers", () => {
  it("normalizes ordering and removes blank values", () => {
    expect(normalizeSavedViewQueryString("memoStatus=READY&q=&readiness=high")).toBe(
      "memoStatus=READY&readiness=high",
    );
  });

  it("builds a stable query string from optional filter values", () => {
    expect(
      buildSavedViewQueryString({
        reviewState: "pending",
        q: "",
        readiness: "high",
        memoStatus: undefined,
      }),
    ).toBe("readiness=high&reviewState=pending");
  });
});
