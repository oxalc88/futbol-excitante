import { describe, expect, it } from "vitest";
import { SUITES, TEAM_SUITE } from "../../eval/contracts/suites.js";

describe("Gauntlet 0.9 team-suite declaration boundary", () => {
  it("keeps the normative team suite out of the executable registry until bindings exist", () => {
    expect(TEAM_SUITE.suite_id).toBe("team");
    expect(TEAM_SUITE.direct_test_ids).toContain("TRANS-AD-001");
    expect(TEAM_SUITE.direct_test_ids).toContain("TRANS-DA-001");
    expect(SUITES).not.toHaveProperty("team");
  });
});
