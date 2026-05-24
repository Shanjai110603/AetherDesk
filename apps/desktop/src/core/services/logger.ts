import { info, warn, error, debug, trace } from '@tauri-apps/plugin-log';

export const logger = {
  info: async (message: string, ...args: any[]) => {
    console.info(message, ...args);
    try { await info(message); } catch (e) { /* ignore if plugin not initialized */ }
  },
  warn: async (message: string, ...args: any[]) => {
    console.warn(message, ...args);
    try { await warn(message); } catch (e) {}
  },
  error: async (message: string, errorObj?: any) => {
    console.error(message, errorObj);
    const errorString = errorObj instanceof Error ? errorObj.stack || errorObj.message : String(errorObj || '');
    try { await error(`${message} ${errorString}`); } catch (e) {}
  },
  debug: async (message: string, ...args: any[]) => {
    console.debug(message, ...args);
    try { await debug(message); } catch (e) {}
  },
  trace: async (message: string, ...args: any[]) => {
    console.trace(message, ...args);
    try { await trace(message); } catch (e) {}
  }
};
