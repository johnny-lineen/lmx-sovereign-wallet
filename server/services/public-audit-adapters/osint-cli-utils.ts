import { spawn } from "node:child_process";

type CliOutput = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function runCliJson(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<CliOutput | null> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const done = (result: CliOutput | null) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      done(null);
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", () => {
      clearTimeout(timer);
      done(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      done({
        exitCode: typeof code === "number" ? code : 1,
        stdout,
        stderr,
      });
    });
  });
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
