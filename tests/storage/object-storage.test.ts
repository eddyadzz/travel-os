import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isR2Configured, uploadObject } from "@/lib/storage/object-storage.server";
import { uploadImage } from "@/lib/api/upload";

vi.mock("@tanstack/react-start", () => {
  const handler = (h: (ctx: { data: unknown }) => unknown) => async (opts?: { data: unknown }) =>
    h({ data: opts?.data });
  return {
    createServerFn: () => ({
      validator: () => ({ handler }),
      handler,
    }),
  };
});

const ORIGINAL_ENV = { ...process.env };

function clearR2Env() {
  delete process.env["R2_ENDPOINT"];
  delete process.env["R2_ACCESS_KEY_ID"];
  delete process.env["R2_SECRET_ACCESS_KEY"];
  delete process.env["R2_BUCKET"];
  delete process.env["R2_PUBLIC_URL"];
}

beforeEach(clearR2Env);
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isR2Configured", () => {
  it("is false without R2 env vars", () => {
    expect(isR2Configured()).toBe(false);
  });

  it("is true when all five R2 vars are present", () => {
    process.env["R2_ENDPOINT"] = "https://acct.r2.cloudflarestorage.com";
    process.env["R2_ACCESS_KEY_ID"] = "key";
    process.env["R2_SECRET_ACCESS_KEY"] = "secret";
    process.env["R2_BUCKET"] = "bucket";
    process.env["R2_PUBLIC_URL"] = "https://cdn.example.com";
    expect(isR2Configured()).toBe(true);
  });
});

describe("uploadObject (local fallback)", () => {
  it("writes to public/uploads and returns a relative URL when R2 is absent", async () => {
    const { url } = await uploadObject({
      key: "images/test-image.png",
      buffer: Buffer.from("fake-image"),
      contentType: "image/png",
    });
    expect(url).toMatch(/^\/uploads\/images\/\d+-test-image\.png$/);
  });
});

describe("uploadImage", () => {
  it("uploads an image and returns its public URL", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" }));
    form.append("folder", "properties/velaa");
    const res = await uploadImage({ data: form });
    expect(res.url).toMatch(/^\/uploads\/properties\/velaa\/\d+-photo\.png$/);
    expect(res.filename).toBe("photo.png");
  });

  it("rejects non-image files", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" }));
    await expect(uploadImage({ data: form })).rejects.toThrow(/Unsupported image type/);
  });
});
