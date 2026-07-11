// ============================================
// Logger Utility
// ============================================

type LogLevel = "info" | "warn" | "error" | "debug" | "success";

class Logger {
  private verbose: boolean = false;

  setVerbose(verbose: boolean) {
    this.verbose = verbose;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const icons: Record<LogLevel, string> = {
      info: "ℹ️ ",
      warn: "⚠️ ",
      error: "❌",
      debug: "🔍",
      success: "✅",
    };

    return `${icons[level]} ${message}`;
  }

  info(message: string) {
    console.log(this.formatMessage("info", message));
  }

  warn(message: string) {
    console.warn(this.formatMessage("warn", message));
  }

  error(message: string) {
    console.error(this.formatMessage("error", message));
  }

  success(message: string) {
    console.log(this.formatMessage("success", message));
  }

  debug(message: string) {
    if (this.verbose) {
      console.log(this.formatMessage("debug", message));
    }
  }

  progress(current: number, total: number, message: string) {
    if (total <= 0) return;
    const clamped = Math.min(current, total);
    const percent = Math.round((clamped / total) * 100);
    const filled = Math.floor(percent / 5);
    const bar = "█".repeat(filled) + "░".repeat(20 - filled);
    process.stdout.write(`\r[${bar}] ${percent}% ${message}`);
    if (current >= total) {
      console.log(""); // New line at end
    }
  }

  table(data: Record<string, any>[]) {
    console.table(data);
  }

  json(data: any) {
    console.log(JSON.stringify(data, null, 2));
  }

  divider() {
    console.log("─".repeat(50));
  }

  heading(text: string) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`  ${text}`);
    console.log(`${"─".repeat(50)}\n`);
  }
}

export const logger = new Logger();
