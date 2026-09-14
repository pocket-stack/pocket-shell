// SPDX-License-Identifier: GPL-3.0-only
import { createSignal, type Accessor } from "solid-js";

/** A Solid signal with its writer attached, for independently owned window
 * state. Reading calls the accessor; writes participate in Solid batching.
 * Values remain shallow so geometry and document snapshots retain identity. */
export type State<T> = Accessor<T> & { set(value: T): T };

export function createState<T>(value: T, equals?: false): State<T> {
  const [read, write] = createSignal(
    value,
    equals === false ? { equals: false } : undefined,
  );
  return Object.assign(read, { set: (next: T) => write(() => next) });
}
