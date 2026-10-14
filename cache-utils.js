/* Cache content URLs independently so one missing file never discards others. */
(function (root) {
  async function cacheIndividually(urls, cache, fetcher, makeRequest) {
    const createRequest = makeRequest || ((url) => new Request(url, { credentials: "same-origin" }));
    const missing = [];
    for (const url of urls) {
      try {
        const request = createRequest(url);
        if (!(await cache.match(request))) missing.push(request);
      } catch { /* Ignore malformed URLs and continue with the rest. */ }
    }
    let saved = 0;
    for (const request of missing) {
      try {
        const response = await fetcher(request);
        if (response?.ok) {
          await cache.put(request, response.clone());
          saved++;
        }
      } catch { /* Keep successful files when another request fails. */ }
    }
    return { saved, total: urls.length };
  }

  const api = { cacheIndividually };
  root.StudyCache = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
