import { canCreateContent, roleLabel, normalizeAccountType } from "../roles";

describe("roles", () => {
  test("canCreateContent: writers and admins create, readers do not", () => {
    expect(canCreateContent("WRITER")).toBe(true);
    expect(canCreateContent("ADMIN")).toBe(true);
    expect(canCreateContent("READER")).toBe(false);
    expect(canCreateContent(null)).toBe(false);
    expect(canCreateContent(undefined)).toBe(false);
    expect(canCreateContent("")).toBe(false);
  });

  test("roleLabel maps roles to display names", () => {
    expect(roleLabel("ADMIN")).toBe("PRO AUTHOR");
    expect(roleLabel("WRITER")).toBe("NEST WRITER");
    expect(roleLabel("READER")).toBe("NEST READER");
    expect(roleLabel(null)).toBe("NEST READER");
    expect(roleLabel("something-else")).toBe("NEST READER");
  });

  test("normalizeAccountType only ever yields READER or WRITER", () => {
    expect(normalizeAccountType("writer")).toBe("WRITER");
    expect(normalizeAccountType("WRITER")).toBe("WRITER");
    expect(normalizeAccountType("reader")).toBe("READER");
    expect(normalizeAccountType("ADMIN")).toBe("READER");
    expect(normalizeAccountType("admin")).toBe("READER");
    expect(normalizeAccountType(null)).toBe("READER");
    expect(normalizeAccountType(undefined)).toBe("READER");
    expect(normalizeAccountType("")).toBe("READER");
  });
});
