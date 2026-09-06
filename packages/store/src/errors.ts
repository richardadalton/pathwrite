/**
 * Thrown by a store when it *did* read the stored record and the record itself
 * is no good: unparseable text, or a shape that is not serialized path state.
 *
 * The distinction matters because `PathStore.load` throwing is otherwise
 * ambiguous. "The server returned 503" and "the bytes on disk are garbage" both
 * arrive as an exception, but they deserve opposite treatment: a record that
 * cannot be parsed will never become loadable and should be cleared, while a
 * store that could not be reached says nothing about the record and must never
 * cost the user their saved progress. `restoreOrStart` deletes only for this
 * type; every other failure leaves whatever is stored untouched.
 *
 * Custom `PathStore` implementations should throw it for the same reason.
 */
export class UnusableStateError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UnusableStateError";
  }
}
