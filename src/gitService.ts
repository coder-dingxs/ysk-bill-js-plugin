import * as cp from 'child_process';

export class GitService {
  constructor(private workspaceRoot: string) {}

  private exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      cp.execFile('git', args, { cwd: this.workspaceRoot }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  async commitAndPush(filePath: string, message: string): Promise<void> {
    await this.exec(['add', filePath]);
    await this.exec(['commit', '-m', message]);
    await this.exec(['push']);
  }
}
