import { beforeEach, describe, expect, it, vi } from "vitest";

const betterAuthMock = vi.fn();

vi.mock("better-auth", () => ({
  betterAuth: betterAuthMock,
}));

vi.mock("../../database", () => ({
  getDB: () => ({})
}));

vi.mock("../../cloudflare/context", () => ({
  getCloudflareContext: () => ({ env: {} }),
}));

vi.mock("../../cloudflare/ip-geolocation", () => ({
  detectVpnAndLocation: vi.fn().mockResolvedValue({ city: null, state: null, isVpn: false }),
}));

vi.mock("../../config/site", () => ({
  config: {
    appName: "Test App",
    appEmail: "noreply@example.com",
    baseUrl: "http://localhost:3000",
  },
}));

describe("auth configuration", () => {
  beforeEach(() => {
    betterAuthMock.mockReset();
    betterAuthMock.mockReturnValue({ api: {} });
  });

  it("enables account deletion in the better-auth config", async () => {
    const { initAuth } = await import("../index");

    await initAuth();

    expect(betterAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          deleteUser: expect.objectContaining({ enabled: true }),
        }),
      }),
    );
  });

  describe("trustedOrigins", () => {
    const resolveOrigins = async (requestUrl: string) => {
      // initAuth memoizes its instance at module scope, so the config has to be
      // rebuilt to observe a fresh betterAuth() call.
      vi.resetModules();
      const { initAuth } = await import("../index");
      await initAuth();
      const { trustedOrigins } = betterAuthMock.mock.calls.at(-1)![0];
      return trustedOrigins(new Request(requestUrl, { method: "POST" }));
    };

    it("trusts the origin the request was actually served from", async () => {
      // better-auth answers a sign-in POST from an untrusted origin with a 403,
      // so a deploy on a host nobody listed at build time (workers.dev,
      // preview URLs, a dev server on another port) could never sign in.
      expect(await resolveOrigins("https://qwksearch.pages.dev/api/auth/sign-in/social"))
        .toContain("https://qwksearch.pages.dev");
      expect(await resolveOrigins("http://localhost:4321/api/auth/sign-in/social"))
        .toContain("http://localhost:4321");
    });

    it("keeps the statically configured origins", async () => {
      const origins = await resolveOrigins("https://qwksearch.com/api/auth/sign-in/social");

      expect(origins).toEqual(
        expect.arrayContaining([
          "https://qwksearch.com",
          "https://*.qwksearch.com",
          "http://localhost:3000",
        ]),
      );
    });

    it("normalizes configured origins to bare origins", async () => {
      // Non-wildcard entries are compared by exact string equality, so a
      // trailing slash or path would silently never match.
      vi.stubEnv(
        "BETTER_AUTH_TRUSTED_ORIGINS",
        " https://staging.example.com/ ,https://app.example.com/dashboard",
      );

      const origins = await resolveOrigins("https://qwksearch.com/api/auth/sign-in/social");

      expect(origins).toEqual(
        expect.arrayContaining([
          "https://staging.example.com",
          "https://app.example.com",
        ]),
      );

      vi.unstubAllEnvs();
    });
  });

  describe("google sign-in scopes", () => {
    const buildConfig = async () => {
      // initAuth memoizes its instance at module scope, so the config has to
      // be rebuilt to observe a fresh betterAuth() call.
      vi.resetModules();
      const { initAuth } = await import("../index");
      await initAuth();
      return betterAuthMock.mock.calls.at(-1)![0];
    };

    it("asks Google for identity only, never for Drive or Docs", async () => {
      // The same OAuth client backs sign-in and the optional Drive connector.
      // If a connector scope reached the sign-in request, a first-time Google
      // sign-in would ask the user to hand over their whole Drive.
      vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
      vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");

      const { socialProviders } = await buildConfig();

      expect(socialProviders.google.scope).toEqual(["openid", "email", "profile"]);
      expect(socialProviders.google.scope.join(" ")).not.toMatch(
        /drive|documents/,
      );

      vi.unstubAllEnvs();
    });

    it("leaves Google unconfigured when no credentials are set", async () => {
      vi.stubEnv("GOOGLE_CLIENT_ID", "");
      vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

      const { socialProviders } = await buildConfig();

      expect(socialProviders.google).toBeUndefined();

      vi.unstubAllEnvs();
    });
  });
});
