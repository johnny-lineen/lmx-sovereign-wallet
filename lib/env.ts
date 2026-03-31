import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    LMX_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
    GOOGLE_GMAIL_CLIENT_ID: z.string().optional(),
    GOOGLE_GMAIL_CLIENT_SECRET: z.string().optional(),
    GOOGLE_GMAIL_REDIRECT_URI: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    const gmailVars = [
      data.GOOGLE_GMAIL_CLIENT_ID,
      data.GOOGLE_GMAIL_CLIENT_SECRET,
      data.GOOGLE_GMAIL_REDIRECT_URI,
    ];
    const gmailConfigured = gmailVars.some((value) => Boolean(value?.trim()));
    const gmailFullyConfigured = gmailVars.every((value) => Boolean(value?.trim()));
    if (gmailConfigured && !gmailFullyConfigured) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Set GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, and GOOGLE_GMAIL_REDIRECT_URI together.",
        path: ["GOOGLE_GMAIL_CLIENT_ID"],
      });
    }
    if (gmailConfigured && !data.LMX_TOKEN_ENCRYPTION_KEY?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "LMX_TOKEN_ENCRYPTION_KEY is required when Gmail import is configured.",
        path: ["LMX_TOKEN_ENCRYPTION_KEY"],
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  const details = parsedEnv.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsedEnv.data;
