import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface YtDlpRunResult {
  stdout: string;
  stderr: string;
}

function resolveYtDlpBin(): string {
  const envBin = process.env.YT_DLP_BIN?.trim();
  if (envBin) {
    return envBin;
  }

  return path.resolve(process.cwd(), '.venv', 'bin', 'yt-dlp');
}

export function getYtDlpBinPath(): string {
  const ytDlpBin = resolveYtDlpBin();
  if (!fs.existsSync(ytDlpBin)) {
    throw new Error(
      `yt-dlp not found at ${ytDlpBin}. Please install it with uv in venv, for example: "uv venv && uv pip install yt-dlp".`
    );
  }
  return ytDlpBin;
}

export async function runYtDlp(args: string[]): Promise<YtDlpRunResult> {
  const ytDlpBin = getYtDlpBinPath();
  console.log(`[yt-dlp] bin=${ytDlpBin}`);
  console.log(`[yt-dlp] args=${JSON.stringify(args)}`);

  return await new Promise((resolve, reject) => {
    const child = spawn(ytDlpBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`yt-dlp exited with code ${code}. stderr=${stderr || '(empty)'}`));
    });
  });
}
