/**
 * Shim for cross-fetch and node-fetch to prevent them from attempting 
 * to overwrite window.fetch in environments where it is read-only.
 */
const nativeFetch = window.fetch.bind(window);
export const fetch = nativeFetch;
export const Headers = window.Headers;
export const Request = window.Request;
export const Response = window.Response;
export const AbortController = window.AbortController;
export const AbortSignal = window.AbortSignal;

export default nativeFetch;
