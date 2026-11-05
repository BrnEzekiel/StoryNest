/**
 * Ambient types for the jest test runner (no @types/jest installed).
 * These globals exist at test runtime; the declarations only satisfy tsc.
 */

type TestFn = (name: string, fn: () => void | Promise<void>, timeout?: number) => void;

declare const describe: (name: string, fn: () => void) => void;
declare const test: TestFn;
declare const it: TestFn;
declare const beforeEach: (fn: () => void | Promise<void>) => void;
declare const afterEach: (fn: () => void | Promise<void>) => void;
declare const beforeAll: (fn: () => void | Promise<void>) => void;
declare const afterAll: (fn: () => void | Promise<void>) => void;

interface JestExpect {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeGreaterThan(n: number): void;
  toBeGreaterThanOrEqual(n: number): void;
  toBeLessThan(n: number): void;
  toContain(item: unknown): void;
  toThrow(expected?: unknown): void;
  toHaveBeenCalled(): void;
  toHaveBeenCalledTimes(n: number): void;
  toHaveBeenCalledWith(...args: any[]): void;
  not: JestExpect;
}
declare const expect: (actual: unknown) => JestExpect;

declare const jest: {
  fn<T extends (...args: any[]) => any>(impl?: T): T & { mock: any };
  mock(path: string, factory?: () => unknown): void;
  requireActual<T = unknown>(path: string): T;
};

declare module "react-test-renderer" {
  import * as React from "react";
  export interface ReactTestRenderer {
    unmount(): void;
  }
  export function act<T>(callback: () => T | Promise<T>): Promise<T>;
  const renderer: {
    create(element: React.ReactElement, options?: unknown): ReactTestRenderer;
    act<T>(callback: () => T | Promise<T>): Promise<T>;
  };
  export default renderer;
}
