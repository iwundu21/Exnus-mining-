if (typeof fetch === "undefined") {
  const { fetch, Request, Response, Headers } = await import("undici");
  Object.assign(globalThis, { fetch, Request, Response, Headers });
}
