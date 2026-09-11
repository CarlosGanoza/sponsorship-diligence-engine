import { MembershipRole } from "@prisma/client";

import { hasRequiredMembershipRole } from "@/lib/auth/session";
import { buildWorkspaceInvitePath, mapMembershipRoleToUserRole } from "@/lib/auth/invites";
import { buildPasswordResetPath } from "@/lib/auth/password-reset";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/passwords";

describe("workspace auth helpers", () => {
  it("enforces membership role order correctly", () => {
    expect(hasRequiredMembershipRole(MembershipRole.OWNER, MembershipRole.ADMIN)).toBe(true);
    expect(hasRequiredMembershipRole(MembershipRole.ADMIN, MembershipRole.MEMBER)).toBe(true);
    expect(hasRequiredMembershipRole(MembershipRole.MEMBER, MembershipRole.VIEWER)).toBe(true);
    expect(hasRequiredMembershipRole(MembershipRole.VIEWER, MembershipRole.MEMBER)).toBe(false);
    expect(hasRequiredMembershipRole(MembershipRole.MEMBER, MembershipRole.ADMIN)).toBe(false);
  });

  it("hashes and verifies passwords deterministically", () => {
    const password = "signalsponsor-demo";
    const hash = hashPassword(password);

    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("validates workspace password strength", () => {
    expect(validatePasswordStrength("short")).toEqual({
      valid: false,
      error: "Use at least 10 characters.",
    });
    expect(validatePasswordStrength("alllettersonly")).toEqual({
      valid: false,
      error: "Include at least one letter and one number.",
    });
    expect(validatePasswordStrength("signal12345")).toEqual({
      valid: true,
      error: null,
    });
  });

  it("builds auth lifecycle paths and role mapping predictably", () => {
    expect(buildWorkspaceInvitePath("invite-token")).toBe("/accept-invite/invite-token");
    expect(buildPasswordResetPath("reset-token")).toBe("/reset-password/reset-token");
    expect(mapMembershipRoleToUserRole(MembershipRole.OWNER)).toBe("ADMIN");
    expect(mapMembershipRoleToUserRole(MembershipRole.ADMIN)).toBe("ADMIN");
    expect(mapMembershipRoleToUserRole(MembershipRole.MEMBER)).toBe("OPERATOR");
  });
});
