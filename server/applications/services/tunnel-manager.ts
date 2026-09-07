import { spawn, execSync, ChildProcess } from 'child_process';
import { config } from '../database/db.js';
import logger from '../utils/logger.js';

export type TunnelMode = 'off' | 'quick' | 'named';

export interface TunnelStatus {
  running: boolean;
  mode: TunnelMode;
  url: string | null;
}

class TunnelManager {
  private process: ChildProcess | null = null;
  private currentMode: TunnelMode = 'off';
  private currentUrl: string | null = null;
  private isStarting = false;

  constructor() {
    process.on('exit', () => {
      this.stop();
    });
  }

  private isCloudflaredInstalled(): boolean {
    try {
      const cmd = process.platform === 'win32' ? 'where cloudflared' : 'which cloudflared';
      execSync(cmd, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  public async start(mode: TunnelMode, tunnelName?: string): Promise<TunnelStatus> {
    if (this.isStarting) throw new Error('Tunnel is already starting.');
    if (this.process) {
      this.stop();
    }

    if (mode === 'off') {
      return this.getStatus();
    }

    if (!this.isCloudflaredInstalled()) {
      throw new Error('cloudflared is not installed. Please install it (e.g. `winget install cloudflare.cloudflared`).');
    }

    this.isStarting = true;
    this.currentMode = mode;
    this.currentUrl = null;

    try {
      const port = config.port || 3000;
      
      const args = mode === 'quick' 
        ? ['tunnel', '--url', `http://localhost:${port}`]
        : ['tunnel', 'run', tunnelName || ''];
        
      if (mode === 'named' && !tunnelName) {
        throw new Error('Tunnel name is required for named mode.');
      }

      logger.info(`Starting cloudflared tunnel in ${mode} mode...`);
      
      this.process = spawn('cloudflared', args, {
        windowsHide: true,
      });

      this.process.on('error', (err) => {
        logger.error('Failed to start cloudflared process:', err);
        this.resetState();
      });

      this.process.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          logger.warn(`cloudflared process exited with code ${code}`);
        } else {
          logger.info('cloudflared process exited cleanly.');
        }
        this.resetState();
      });

      if (mode === 'quick') {
        // Quick mode requires parsing the stdout/stderr for the trycloudflare.com URL
        const url = await this.waitForQuickUrl();
        this.currentUrl = url;
      } else {
        // Named mode URL is presumably known by the user or their custom domain setup
        this.currentUrl = null;
      }
      
      this.isStarting = false;
      return this.getStatus();
    } catch (error) {
      this.resetState();
      this.isStarting = false;
      throw error;
    }
  }

  private waitForQuickUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.process) return reject(new Error('Process not running'));

      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for cloudflare URL.'));
      }, 15000);

      const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i;

      const onData = (data: Buffer) => {
        const output = data.toString();
        const match = output.match(urlRegex);
        if (match) {
          clearTimeout(timeout);
          this.process?.stdout?.off('data', onData);
          this.process?.stderr?.off('data', onData);
          resolve(match[0]);
        }
      };

      this.process.stdout?.on('data', onData);
      this.process.stderr?.on('data', onData);
    });
  }

  public stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.resetState();
  }

  private resetState(): void {
    this.process = null;
    this.currentMode = 'off';
    this.currentUrl = null;
    this.isStarting = false;
  }

  public getStatus(): TunnelStatus {
    return {
      running: this.process !== null,
      mode: this.currentMode,
      url: this.currentUrl
    };
  }
}

export const tunnelManager = new TunnelManager();
