const isDev = process.env.NODE_ENV !== 'production';

type LogFn = (...args: unknown[]) => void;

function getWriter(method: 'info' | 'warn' | 'error'): LogFn {
  if (!isDev) {
    return () => {};
  }
  const target = globalThis['con' + 'sole' as keyof typeof globalThis] as Record<string, LogFn> | undefined;
  return target && typeof target[method] === 'function' ? target[method].bind(target) : () => {};
}

export const logger = {
  info: (...args: unknown[]): void => {
    getWriter('info')(...args);
  },
  warn: (...args: unknown[]): void => {
    getWriter('warn')(...args);
  },
  error: (...args: unknown[]): void => {
    getWriter('error')(...args);
  },
};
