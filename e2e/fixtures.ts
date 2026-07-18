import { createHash, randomBytes } from "node:crypto";
import { expect, test as base } from "@playwright/test";
import { E2E_LEARNER_COOKIE } from "../lib/auth/development-user";

type IsolationFixtures = {
  isolatedLearner: void;
};

const runNonce = randomBytes(12).toString("hex");

export const test = base.extend<IsolationFixtures>({
  isolatedLearner: [
    async ({ context }, use, testInfo) => {
      const digest = createHash("sha256")
        .update(`${runNonce}:${testInfo.testId}`)
        .digest("hex")
        .slice(0, 12);
      await context.addCookies([{
        name: E2E_LEARNER_COOKIE,
        value: `e2e-${digest}-${testInfo.retry}`,
        url: "http://127.0.0.1:3000",
        httpOnly: true,
        sameSite: "Lax",
      }]);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
