const isProd = import.meta.env.PROD;

export const logger = {
  info(...args: unknown[]) {
    if (!isProd) {
      console.log(...args);
    }
  },
  warn(...args: unknown[]) {
    console.warn(...args);
  },
  error(...args: unknown[]) {
    console.error(...args);
  },
};
