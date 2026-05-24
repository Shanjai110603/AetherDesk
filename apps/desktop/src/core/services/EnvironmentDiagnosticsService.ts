import { Command } from '@tauri-apps/plugin-shell';

export interface DiagnosticsResult {
  hasNode: boolean;
  nodeVersion?: string;
  hasPython: boolean;
  pythonVersion?: string;
  hasGit: boolean;
  gitVersion?: string;
  hasOllama: boolean;
  ollamaVersion?: string;
}

export class EnvironmentDiagnosticsService {
  /**
   * Checks if a command is available by running it with a version flag.
   */
  private async checkCommand(
    command: string,
    args: string[]
  ): Promise<{ available: boolean; version?: string }> {
    try {
      const cmd = Command.create(command, args);
      const result = await cmd.execute();
      if (result.code === 0) {
        return { available: true, version: result.stdout.trim() };
      }
      return { available: false };
    } catch (error) {
      console.warn(`Diagnostics: ${command} not found or failed`, error);
      return { available: false };
    }
  }

  /**
   * Run full environment diagnostics for the onboarding flow.
   */
  public async runDiagnostics(): Promise<DiagnosticsResult> {
    const [nodeResult, pythonResult, gitResult, ollamaResult] = await Promise.all([
      this.checkCommand('node', ['--version']),
      this.checkCommand('python', ['--version']),
      this.checkCommand('git', ['--version']),
      this.checkCommand('ollama', ['--version']),
    ]);

    return {
      hasNode: nodeResult.available,
      nodeVersion: nodeResult.version,
      hasPython: pythonResult.available,
      pythonVersion: pythonResult.version,
      hasGit: gitResult.available,
      gitVersion: gitResult.version,
      hasOllama: ollamaResult.available,
      ollamaVersion: ollamaResult.version,
    };
  }
}

export const diagnosticsService = new EnvironmentDiagnosticsService();
