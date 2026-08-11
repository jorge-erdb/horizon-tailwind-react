import { describe, expect, it } from "vitest";
import {
  MAX_BATCH,
  readEvents,
  readWriteKey,
  statusForPgError,
} from "../parse.ts";

const headers = (init) => new Headers(init);

describe("readWriteKey", () => {
  it("reads a bearer token", () => {
    expect(readWriteKey(headers({ authorization: "Bearer nvk_abc" }))).toBe(
      "nvk_abc"
    );
  });

  it("accepts a lowercase scheme", () => {
    // RFC 7235 makes the scheme case-insensitive and real clients send
    // "bearer". Matching only "Bearer " would pass the whole header through
    // as the key and fail as an unexplained 401.
    expect(readWriteKey(headers({ authorization: "bearer nvk_abc" }))).toBe(
      "nvk_abc"
    );
    expect(readWriteKey(headers({ authorization: "BEARER nvk_abc" }))).toBe(
      "nvk_abc"
    );
  });

  it("tolerates extra whitespace around the token", () => {
    expect(readWriteKey(headers({ authorization: "Bearer   nvk_abc  " }))).toBe(
      "nvk_abc"
    );
  });

  it("falls back to the dedicated header", () => {
    expect(readWriteKey(headers({ "x-nova-write-key": "nvk_xyz" }))).toBe(
      "nvk_xyz"
    );
  });

  it("prefers the Authorization header when both are present", () => {
    expect(
      readWriteKey(
        headers({ authorization: "Bearer nvk_a", "x-nova-write-key": "nvk_b" })
      )
    ).toBe("nvk_a");
  });

  it("returns null rather than an empty string", () => {
    // An empty string would reach the database as a key and be compared
    // against write_key_hash; null keeps the 401 in the edge function.
    expect(readWriteKey(headers({}))).toBeNull();
    expect(readWriteKey(headers({ authorization: "Bearer   " }))).toBeNull();
    expect(readWriteKey(headers({ "x-nova-write-key": "  " }))).toBeNull();
  });

  it("ignores a non-bearer scheme without falling through to it", () => {
    expect(readWriteKey(headers({ authorization: "Basic abc" }))).toBeNull();
  });
});

describe("readEvents", () => {
  it("accepts the wrapped form", () => {
    expect(readEvents({ events: [{ name: "page_view" }] })).toEqual([
      { name: "page_view" },
    ]);
  });

  it("accepts a bare array", () => {
    expect(readEvents([{ name: "signup" }])).toEqual([{ name: "signup" }]);
  });

  it("accepts an empty batch", () => {
    // Distinct from null: a client flushing on a timer with nothing queued
    // should get a 202, not a 400.
    expect(readEvents({ events: [] })).toEqual([]);
    expect(readEvents([])).toEqual([]);
  });

  it("rejects anything that is not an array of events", () => {
    expect(readEvents({ events: "nope" })).toBeNull();
    expect(readEvents({ name: "page_view" })).toBeNull();
    expect(readEvents(null)).toBeNull();
    expect(readEvents("[]")).toBeNull();
    expect(readEvents(42)).toBeNull();
  });
});

describe("statusForPgError", () => {
  it("maps a bad write key to 401", () => {
    expect(statusForPgError("28000")).toBe(401);
  });

  it("maps caller-fixable errors to 400", () => {
    expect(statusForPgError("22023")).toBe(400);
    expect(statusForPgError("P0001")).toBe(400);
  });

  it("treats anything else as our problem", () => {
    // 42501 is permission denied — that means the grants are wrong, which is
    // a deployment bug. Returning 400 would tell the caller to fix their
    // payload and send them chasing a problem they cannot see.
    expect(statusForPgError("42501")).toBe(500);
    expect(statusForPgError("42P01")).toBe(500);
    expect(statusForPgError(undefined)).toBe(500);
    expect(statusForPgError(null)).toBe(500);
  });
});

describe("MAX_BATCH", () => {
  it("matches the limit enforced in migration 0010", () => {
    // The edge function rejects early to save a round trip, but SQL is the
    // real gate. If these drift, the cheap check stops meaning anything.
    expect(MAX_BATCH).toBe(500);
  });
});
