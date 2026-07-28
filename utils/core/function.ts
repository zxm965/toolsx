import type { AnyFunction } from './type'

export const noop = () => {}

export interface OnceFunction<T extends AnyFunction> {
  (...args: Parameters<T>): ReturnType<T>
  called: () => boolean
}

export function once<T extends AnyFunction>(fn: T): OnceFunction<T> {
  let invoked = false
  let failed = false
  let result: ReturnType<T>
  let failure: unknown

  const wrapped = function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (!invoked) {
      invoked = true

      try {
        result = fn.apply(this, args) as ReturnType<T>
      } catch (error) {
        failed = true
        failure = error
      }
    }

    if (failed) throw failure
    return result
  } as OnceFunction<T>

  wrapped.called = () => invoked
  return wrapped
}

export function identity<T>(value: T) {
  return value
}

export function constant<T>(value: T) {
  return () => value
}

export type Unary<TInput, TOutput> = (value: TInput) => TOutput

export function pipe<T1, T2>(first: Unary<T1, T2>): Unary<T1, T2>
export function pipe<T1, T2, T3>(first: Unary<T1, T2>, second: Unary<T2, T3>): Unary<T1, T3>
export function pipe<T1, T2, T3, T4>(first: Unary<T1, T2>, second: Unary<T2, T3>, third: Unary<T3, T4>): Unary<T1, T4>
export function pipe<T1, T2, T3, T4, T5>(first: Unary<T1, T2>, second: Unary<T2, T3>, third: Unary<T3, T4>, fourth: Unary<T4, T5>): Unary<T1, T5>
export function pipe(...functions: readonly Unary<unknown, unknown>[]) {
  return (value: unknown) => functions.reduce((result, fn) => fn(result), value)
}

export function compose<T1, T2>(first: Unary<T1, T2>): Unary<T1, T2>
export function compose<T1, T2, T3>(second: Unary<T2, T3>, first: Unary<T1, T2>): Unary<T1, T3>
export function compose<T1, T2, T3, T4>(third: Unary<T3, T4>, second: Unary<T2, T3>, first: Unary<T1, T2>): Unary<T1, T4>
export function compose<T1, T2, T3, T4, T5>(fourth: Unary<T4, T5>, third: Unary<T3, T4>, second: Unary<T2, T3>, first: Unary<T1, T2>): Unary<T1, T5>
export function compose(...functions: readonly Unary<unknown, unknown>[]) {
  return (value: unknown) => [...functions].reverse().reduce((result, fn) => fn(result), value)
}
