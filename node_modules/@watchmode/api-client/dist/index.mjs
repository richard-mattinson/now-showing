// src/generated/core/bodySerializer.gen.ts
var jsonBodySerializer = {
  bodySerializer: (body) => JSON.stringify(
    body,
    (_key, value) => typeof value === "bigint" ? value.toString() : value
  )
};

// src/generated/core/params.gen.ts
var extraPrefixesMap = {
  $body_: "body",
  $headers_: "headers",
  $path_: "path",
  $query_: "query"
};
var extraPrefixes = Object.entries(extraPrefixesMap);

// src/generated/core/serverSentEvents.gen.ts
var createSseClient = ({
  onRequest,
  onSseError,
  onSseEvent,
  responseTransformer,
  responseValidator,
  sseDefaultRetryDelay,
  sseMaxRetryAttempts,
  sseMaxRetryDelay,
  sseSleepFn,
  url,
  ...options
}) => {
  let lastEventId;
  const sleep = sseSleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const createStream = async function* () {
    let retryDelay = sseDefaultRetryDelay ?? 3e3;
    let attempt = 0;
    const signal = options.signal ?? new AbortController().signal;
    while (true) {
      if (signal.aborted) break;
      attempt++;
      const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
      if (lastEventId !== void 0) {
        headers.set("Last-Event-ID", lastEventId);
      }
      try {
        const requestInit = {
          redirect: "follow",
          ...options,
          body: options.serializedBody,
          headers,
          signal
        };
        let request = new Request(url, requestInit);
        if (onRequest) {
          request = await onRequest(url, requestInit);
        }
        const _fetch = options.fetch ?? globalThis.fetch;
        const response = await _fetch(request);
        if (!response.ok)
          throw new Error(
            `SSE failed: ${response.status} ${response.statusText}`
          );
        if (!response.body) throw new Error("No body in SSE response");
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        const abortHandler = () => {
          try {
            reader.cancel();
          } catch {
          }
        };
        signal.addEventListener("abort", abortHandler);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += value;
            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const lines = chunk.split("\n");
              const dataLines = [];
              let eventName;
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  dataLines.push(line.replace(/^data:\s*/, ""));
                } else if (line.startsWith("event:")) {
                  eventName = line.replace(/^event:\s*/, "");
                } else if (line.startsWith("id:")) {
                  lastEventId = line.replace(/^id:\s*/, "");
                } else if (line.startsWith("retry:")) {
                  const parsed = Number.parseInt(
                    line.replace(/^retry:\s*/, ""),
                    10
                  );
                  if (!Number.isNaN(parsed)) {
                    retryDelay = parsed;
                  }
                }
              }
              let data;
              let parsedJson = false;
              if (dataLines.length) {
                const rawData = dataLines.join("\n");
                try {
                  data = JSON.parse(rawData);
                  parsedJson = true;
                } catch {
                  data = rawData;
                }
              }
              if (parsedJson) {
                if (responseValidator) {
                  await responseValidator(data);
                }
                if (responseTransformer) {
                  data = await responseTransformer(data);
                }
              }
              onSseEvent?.({
                data,
                event: eventName,
                id: lastEventId,
                retry: retryDelay
              });
              if (dataLines.length) {
                yield data;
              }
            }
          }
        } finally {
          signal.removeEventListener("abort", abortHandler);
          reader.releaseLock();
        }
        break;
      } catch (error) {
        onSseError?.(error);
        if (sseMaxRetryAttempts !== void 0 && attempt >= sseMaxRetryAttempts) {
          break;
        }
        const backoff = Math.min(
          retryDelay * 2 ** (attempt - 1),
          sseMaxRetryDelay ?? 3e4
        );
        await sleep(backoff);
      }
    }
  };
  const stream = createStream();
  return { stream };
};

// src/generated/core/pathSerializer.gen.ts
var separatorArrayExplode = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var separatorArrayNoExplode = (style) => {
  switch (style) {
    case "form":
      return ",";
    case "pipeDelimited":
      return "|";
    case "spaceDelimited":
      return "%20";
    default:
      return ",";
  }
};
var separatorObjectExplode = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var serializeArrayParam = ({
  allowReserved,
  explode,
  name,
  style,
  value
}) => {
  if (!explode) {
    const joinedValues2 = (allowReserved ? value : value.map((v) => encodeURIComponent(v))).join(separatorArrayNoExplode(style));
    switch (style) {
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      case "simple":
        return joinedValues2;
      default:
        return `${name}=${joinedValues2}`;
    }
  }
  const separator = separatorArrayExplode(style);
  const joinedValues = value.map((v) => {
    if (style === "label" || style === "simple") {
      return allowReserved ? v : encodeURIComponent(v);
    }
    return serializePrimitiveParam({
      allowReserved,
      name,
      value: v
    });
  }).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var serializePrimitiveParam = ({
  allowReserved,
  name,
  value
}) => {
  if (value === void 0 || value === null) {
    return "";
  }
  if (typeof value === "object") {
    throw new Error(
      "Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these."
    );
  }
  return `${name}=${allowReserved ? value : encodeURIComponent(value)}`;
};
var serializeObjectParam = ({
  allowReserved,
  explode,
  name,
  style,
  value,
  valueOnly
}) => {
  if (value instanceof Date) {
    return valueOnly ? value.toISOString() : `${name}=${value.toISOString()}`;
  }
  if (style !== "deepObject" && !explode) {
    let values = [];
    Object.entries(value).forEach(([key, v]) => {
      values = [
        ...values,
        key,
        allowReserved ? v : encodeURIComponent(v)
      ];
    });
    const joinedValues2 = values.join(",");
    switch (style) {
      case "form":
        return `${name}=${joinedValues2}`;
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      default:
        return joinedValues2;
    }
  }
  const separator = separatorObjectExplode(style);
  const joinedValues = Object.entries(value).map(
    ([key, v]) => serializePrimitiveParam({
      allowReserved,
      name: style === "deepObject" ? `${name}[${key}]` : key,
      value: v
    })
  ).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};

// src/generated/core/utils.gen.ts
var PATH_PARAM_RE = /\{[^{}]+\}/g;
var defaultPathSerializer = ({ path, url: _url }) => {
  let url = _url;
  const matches = _url.match(PATH_PARAM_RE);
  if (matches) {
    for (const match of matches) {
      let explode = false;
      let name = match.substring(1, match.length - 1);
      let style = "simple";
      if (name.endsWith("*")) {
        explode = true;
        name = name.substring(0, name.length - 1);
      }
      if (name.startsWith(".")) {
        name = name.substring(1);
        style = "label";
      } else if (name.startsWith(";")) {
        name = name.substring(1);
        style = "matrix";
      }
      const value = path[name];
      if (value === void 0 || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        url = url.replace(
          match,
          serializeArrayParam({ explode, name, style, value })
        );
        continue;
      }
      if (typeof value === "object") {
        url = url.replace(
          match,
          serializeObjectParam({
            explode,
            name,
            style,
            value,
            valueOnly: true
          })
        );
        continue;
      }
      if (style === "matrix") {
        url = url.replace(
          match,
          `;${serializePrimitiveParam({
            name,
            value
          })}`
        );
        continue;
      }
      const replaceValue = encodeURIComponent(
        style === "label" ? `.${value}` : value
      );
      url = url.replace(match, replaceValue);
    }
  }
  return url;
};
var getUrl = ({
  baseUrl,
  path,
  query,
  querySerializer,
  url: _url
}) => {
  const pathUrl = _url.startsWith("/") ? _url : `/${_url}`;
  let url = (baseUrl ?? "") + pathUrl;
  if (path) {
    url = defaultPathSerializer({ path, url });
  }
  let search2 = query ? querySerializer(query) : "";
  if (search2.startsWith("?")) {
    search2 = search2.substring(1);
  }
  if (search2) {
    url += `?${search2}`;
  }
  return url;
};
function getValidRequestBody(options) {
  const hasBody = options.body !== void 0;
  const isSerializedBody = hasBody && options.bodySerializer;
  if (isSerializedBody) {
    if ("serializedBody" in options) {
      const hasSerializedBody = options.serializedBody !== void 0 && options.serializedBody !== "";
      return hasSerializedBody ? options.serializedBody : null;
    }
    return options.body !== "" ? options.body : null;
  }
  if (hasBody) {
    return options.body;
  }
  return void 0;
}

// src/generated/core/auth.gen.ts
var getAuthToken = async (auth, callback) => {
  const token = typeof callback === "function" ? await callback(auth) : callback;
  if (!token) {
    return;
  }
  if (auth.scheme === "bearer") {
    return `Bearer ${token}`;
  }
  if (auth.scheme === "basic") {
    return `Basic ${btoa(token)}`;
  }
  return token;
};

// src/generated/client/utils.gen.ts
var createQuerySerializer = ({
  parameters = {},
  ...args
} = {}) => {
  const querySerializer = (queryParams) => {
    const search2 = [];
    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams) {
        const value = queryParams[name];
        if (value === void 0 || value === null) {
          continue;
        }
        const options = parameters[name] || args;
        if (Array.isArray(value)) {
          const serializedArray = serializeArrayParam({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "form",
            value,
            ...options.array
          });
          if (serializedArray) search2.push(serializedArray);
        } else if (typeof value === "object") {
          const serializedObject = serializeObjectParam({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "deepObject",
            value,
            ...options.object
          });
          if (serializedObject) search2.push(serializedObject);
        } else {
          const serializedPrimitive = serializePrimitiveParam({
            allowReserved: options.allowReserved,
            name,
            value
          });
          if (serializedPrimitive) search2.push(serializedPrimitive);
        }
      }
    }
    return search2.join("&");
  };
  return querySerializer;
};
var getParseAs = (contentType) => {
  if (!contentType) {
    return "stream";
  }
  const cleanContent = contentType.split(";")[0]?.trim();
  if (!cleanContent) {
    return;
  }
  if (cleanContent.startsWith("application/json") || cleanContent.endsWith("+json")) {
    return "json";
  }
  if (cleanContent === "multipart/form-data") {
    return "formData";
  }
  if (["application/", "audio/", "image/", "video/"].some(
    (type) => cleanContent.startsWith(type)
  )) {
    return "blob";
  }
  if (cleanContent.startsWith("text/")) {
    return "text";
  }
  return;
};
var checkForExistence = (options, name) => {
  if (!name) {
    return false;
  }
  if (options.headers.has(name) || options.query?.[name] || options.headers.get("Cookie")?.includes(`${name}=`)) {
    return true;
  }
  return false;
};
var setAuthParams = async ({
  security,
  ...options
}) => {
  for (const auth of security) {
    if (checkForExistence(options, auth.name)) {
      continue;
    }
    const token = await getAuthToken(auth, options.auth);
    if (!token) {
      continue;
    }
    const name = auth.name ?? "Authorization";
    switch (auth.in) {
      case "query":
        if (!options.query) {
          options.query = {};
        }
        options.query[name] = token;
        break;
      case "cookie":
        options.headers.append("Cookie", `${name}=${token}`);
        break;
      case "header":
      default:
        options.headers.set(name, token);
        break;
    }
  }
};
var buildUrl = (options) => getUrl({
  baseUrl: options.baseUrl,
  path: options.path,
  query: options.query,
  querySerializer: typeof options.querySerializer === "function" ? options.querySerializer : createQuerySerializer(options.querySerializer),
  url: options.url
});
var mergeConfigs = (a, b) => {
  const config = { ...a, ...b };
  if (config.baseUrl?.endsWith("/")) {
    config.baseUrl = config.baseUrl.substring(0, config.baseUrl.length - 1);
  }
  config.headers = mergeHeaders(a.headers, b.headers);
  return config;
};
var headersEntries = (headers) => {
  const entries = [];
  headers.forEach((value, key) => {
    entries.push([key, value]);
  });
  return entries;
};
var mergeHeaders = (...headers) => {
  const mergedHeaders = new Headers();
  for (const header of headers) {
    if (!header) {
      continue;
    }
    const iterator = header instanceof Headers ? headersEntries(header) : Object.entries(header);
    for (const [key, value] of iterator) {
      if (value === null) {
        mergedHeaders.delete(key);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          mergedHeaders.append(key, v);
        }
      } else if (value !== void 0) {
        mergedHeaders.set(
          key,
          typeof value === "object" ? JSON.stringify(value) : value
        );
      }
    }
  }
  return mergedHeaders;
};
var Interceptors = class {
  constructor() {
    this.fns = [];
  }
  clear() {
    this.fns = [];
  }
  eject(id) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = null;
    }
  }
  exists(id) {
    const index = this.getInterceptorIndex(id);
    return Boolean(this.fns[index]);
  }
  getInterceptorIndex(id) {
    if (typeof id === "number") {
      return this.fns[id] ? id : -1;
    }
    return this.fns.indexOf(id);
  }
  update(id, fn) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = fn;
      return id;
    }
    return false;
  }
  use(fn) {
    this.fns.push(fn);
    return this.fns.length - 1;
  }
};
var createInterceptors = () => ({
  error: new Interceptors(),
  request: new Interceptors(),
  response: new Interceptors()
});
var defaultQuerySerializer = createQuerySerializer({
  allowReserved: false,
  array: {
    explode: true,
    style: "form"
  },
  object: {
    explode: true,
    style: "deepObject"
  }
});
var defaultHeaders = {
  "Content-Type": "application/json"
};
var createConfig = (override = {}) => ({
  ...jsonBodySerializer,
  headers: defaultHeaders,
  parseAs: "auto",
  querySerializer: defaultQuerySerializer,
  ...override
});

// src/generated/client/client.gen.ts
var createClient = (config = {}) => {
  let _config = mergeConfigs(createConfig(), config);
  const getConfig = () => ({ ..._config });
  const setConfig = (config2) => {
    _config = mergeConfigs(_config, config2);
    return getConfig();
  };
  const interceptors = createInterceptors();
  const beforeRequest = async (options) => {
    const opts = {
      ..._config,
      ...options,
      fetch: options.fetch ?? _config.fetch ?? globalThis.fetch,
      headers: mergeHeaders(_config.headers, options.headers),
      serializedBody: void 0
    };
    if (opts.security) {
      await setAuthParams({
        ...opts,
        security: opts.security
      });
    }
    if (opts.requestValidator) {
      await opts.requestValidator(opts);
    }
    if (opts.body !== void 0 && opts.bodySerializer) {
      opts.serializedBody = opts.bodySerializer(opts.body);
    }
    if (opts.body === void 0 || opts.serializedBody === "") {
      opts.headers.delete("Content-Type");
    }
    const url = buildUrl(opts);
    return { opts, url };
  };
  const request = async (options) => {
    const { opts, url } = await beforeRequest(options);
    const requestInit = {
      redirect: "follow",
      ...opts,
      body: getValidRequestBody(opts)
    };
    let request2 = new Request(url, requestInit);
    for (const fn of interceptors.request.fns) {
      if (fn) {
        request2 = await fn(request2, opts);
      }
    }
    const _fetch = opts.fetch;
    let response;
    try {
      response = await _fetch(request2);
    } catch (error2) {
      let finalError2 = error2;
      for (const fn of interceptors.error.fns) {
        if (fn) {
          finalError2 = await fn(
            error2,
            void 0,
            request2,
            opts
          );
        }
      }
      finalError2 = finalError2 || {};
      if (opts.throwOnError) {
        throw finalError2;
      }
      return opts.responseStyle === "data" ? void 0 : {
        error: finalError2,
        request: request2,
        response: void 0
      };
    }
    for (const fn of interceptors.response.fns) {
      if (fn) {
        response = await fn(response, request2, opts);
      }
    }
    const result = {
      request: request2,
      response
    };
    if (response.ok) {
      const parseAs = (opts.parseAs === "auto" ? getParseAs(response.headers.get("Content-Type")) : opts.parseAs) ?? "json";
      if (response.status === 204 || response.headers.get("Content-Length") === "0") {
        let emptyData;
        switch (parseAs) {
          case "arrayBuffer":
          case "blob":
          case "text":
            emptyData = await response[parseAs]();
            break;
          case "formData":
            emptyData = new FormData();
            break;
          case "stream":
            emptyData = response.body;
            break;
          case "json":
          default:
            emptyData = {};
            break;
        }
        return opts.responseStyle === "data" ? emptyData : {
          data: emptyData,
          ...result
        };
      }
      let data;
      switch (parseAs) {
        case "arrayBuffer":
        case "blob":
        case "formData":
        case "json":
        case "text":
          data = await response[parseAs]();
          break;
        case "stream":
          return opts.responseStyle === "data" ? response.body : {
            data: response.body,
            ...result
          };
      }
      if (parseAs === "json") {
        if (opts.responseValidator) {
          await opts.responseValidator(data);
        }
        if (opts.responseTransformer) {
          data = await opts.responseTransformer(data);
        }
      }
      return opts.responseStyle === "data" ? data : {
        data,
        ...result
      };
    }
    const textError = await response.text();
    let jsonError;
    try {
      jsonError = JSON.parse(textError);
    } catch {
    }
    const error = jsonError ?? textError;
    let finalError = error;
    for (const fn of interceptors.error.fns) {
      if (fn) {
        finalError = await fn(error, response, request2, opts);
      }
    }
    finalError = finalError || {};
    if (opts.throwOnError) {
      throw finalError;
    }
    return opts.responseStyle === "data" ? void 0 : {
      error: finalError,
      ...result
    };
  };
  const makeMethodFn = (method) => (options) => request({ ...options, method });
  const makeSseFn = (method) => async (options) => {
    const { opts, url } = await beforeRequest(options);
    return createSseClient({
      ...opts,
      body: opts.body,
      headers: opts.headers,
      method,
      onRequest: async (url2, init) => {
        let request2 = new Request(url2, init);
        for (const fn of interceptors.request.fns) {
          if (fn) {
            request2 = await fn(request2, opts);
          }
        }
        return request2;
      },
      url
    });
  };
  return {
    buildUrl,
    connect: makeMethodFn("CONNECT"),
    delete: makeMethodFn("DELETE"),
    get: makeMethodFn("GET"),
    getConfig,
    head: makeMethodFn("HEAD"),
    interceptors,
    options: makeMethodFn("OPTIONS"),
    patch: makeMethodFn("PATCH"),
    post: makeMethodFn("POST"),
    put: makeMethodFn("PUT"),
    request,
    setConfig,
    sse: {
      connect: makeSseFn("CONNECT"),
      delete: makeSseFn("DELETE"),
      get: makeSseFn("GET"),
      head: makeSseFn("HEAD"),
      options: makeSseFn("OPTIONS"),
      patch: makeSseFn("PATCH"),
      post: makeSseFn("POST"),
      put: makeSseFn("PUT"),
      trace: makeSseFn("TRACE")
    },
    trace: makeMethodFn("TRACE")
  };
};

// src/generated/client.gen.ts
var client = createClient(createConfig({ baseUrl: "https://api.watchmode.com/v1" }));

// src/generated/sdk.gen.ts
var getStatus = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/status",
  ...options
});
var getSources = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/sources",
  ...options
});
var getRegions = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/regions",
  ...options
});
var getNetworks = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/networks",
  ...options
});
var getGenres = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/genres",
  ...options
});
var search = (options) => (options.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/search",
  ...options
});
var autocompleteSearch = (options) => (options.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/autocomplete-search",
  ...options
});
var listTitles = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/list-titles",
  ...options
});
var getTitleDetails = (options) => (options.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/title/{title_id}/details",
  ...options
});
var getTitleSources = (options) => (options.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/title/{title_id}/sources",
  ...options
});
var getTitleSeasons = (options) => (options.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/title/{title_id}/seasons",
  ...options
});
var getTitleEpisodes = (options) => (options.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/title/{title_id}/episodes",
  ...options
});
var getTitleCastCrew = (options) => (options.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/title/{title_id}/cast-crew",
  ...options
});
var reportIncorrectData = (options) => (options.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/title/{title_id}/incorrect-data",
  ...options
});
var getPerson = (options) => (options.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/person/{person_id}",
  ...options
});
var getReleases = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/releases",
  ...options
});
var getTitleReleaseDates = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/title-release-dates",
  ...options
});
var getNewTitles = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/changes/new_titles",
  ...options
});
var getNewPeople = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/changes/new_people",
  ...options
});
var getTitlesSourcesChanged = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/changes/titles_sources_changed",
  ...options
});
var getTitlesDetailsChanged = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/changes/titles_details_changed",
  ...options
});
var getTitlesEpisodesChanged = (options) => (options?.client ?? client).get({
  security: [{
    in: "query",
    name: "apiKey",
    type: "apiKey"
  }],
  url: "/changes/titles_episodes_changed",
  ...options
});

// src/index.ts
var WatchmodeClient = class {
  /**
   * Create a new Watchmode API client
   *
   * @param config - Configuration options including API key
   *
   * @example
   * ```typescript
   * const client = new WatchmodeClient({ apiKey: 'your-api-key' });
   * ```
   */
  constructor(config) {
    this.client = createClient(
      createConfig({
        baseUrl: config.baseUrl ?? "https://api.watchmode.com/v1",
        fetch: config.fetch,
        // Set auth to return the API key for the apiKey security scheme
        auth: config.apiKey
      })
    );
    this.title = new TitleApi(this.client);
    this.search = new SearchApi(this.client);
    this.person = new PersonApi(this.client);
    this.sources = new SourcesApi(this.client);
    this.releases = new ReleasesApi(this.client);
    this.changes = new ChangesApi(this.client);
    this.account = new AccountApi(this.client);
    this.reference = new ReferenceApi(this.client);
  }
  /**
   * Get the underlying client for advanced usage
   */
  getClient() {
    return this.client;
  }
};
var TitleApi = class {
  constructor(client2) {
    this.client = client2;
  }
  /**
   * Get detailed information about a movie or TV show
   *
   * @param titleId - Watchmode ID, IMDB ID (tt...), or TMDB format (movie-X, tv-X)
   * @param options - Optional parameters
   *
   * @example
   * ```typescript
   * // By Watchmode ID
   * const { data } = await client.title.getDetails('3173903');
   *
   * // By IMDB ID
   * const { data } = await client.title.getDetails('tt0903747');
   *
   * // With additional data
   * const { data } = await client.title.getDetails('3173903', {
   *   appendToResponse: 'sources,cast-crew'
   * });
   * ```
   */
  getDetails(titleId, options) {
    return getTitleDetails({
      client: this.client,
      path: { title_id: titleId },
      query: {
        append_to_response: options?.appendToResponse,
        language: options?.language,
        regions: options?.regions
      }
    });
  }
  /**
   * Get streaming sources for a title
   *
   * @example
   * ```typescript
   * const { data: sources } = await client.title.getSources('3173903', { regions: 'US,CA' });
   * ```
   */
  getSources(titleId, options) {
    return getTitleSources({
      client: this.client,
      path: { title_id: titleId },
      query: { regions: options?.regions }
    });
  }
  /**
   * Get seasons for a TV series
   */
  getSeasons(titleId) {
    return getTitleSeasons({
      client: this.client,
      path: { title_id: titleId }
    });
  }
  /**
   * Get episodes for a TV series
   */
  getEpisodes(titleId) {
    return getTitleEpisodes({
      client: this.client,
      path: { title_id: titleId }
    });
  }
  /**
   * Get cast and crew for a title
   */
  getCastCrew(titleId, options) {
    return getTitleCastCrew({
      client: this.client,
      path: { title_id: titleId },
      query: { language: options?.language }
    });
  }
  /**
   * List titles with optional filtering
   *
   * @example
   * ```typescript
   * // Horror movies on Netflix in the US
   * const { data } = await client.title.list({
   *   types: 'movie',
   *   genres: '12', // Horror genre ID
   *   sourceIds: '203', // Netflix
   *   regions: 'US'
   * });
   * ```
   */
  list(options) {
    return listTitles({
      client: this.client,
      query: {
        types: options?.types,
        regions: options?.regions,
        source_types: options?.sourceTypes,
        source_ids: options?.sourceIds,
        genres: options?.genres,
        network_ids: options?.networkIds,
        languages: options?.languages,
        release_date_start: options?.releaseDateStart,
        release_date_end: options?.releaseDateEnd,
        user_rating_low: options?.userRatingLow,
        user_rating_high: options?.userRatingHigh,
        critic_score_low: options?.criticScoreLow,
        critic_score_high: options?.criticScoreHigh,
        person_id: options?.personId,
        sort_by: options?.sortBy,
        page: options?.page,
        limit: options?.limit
      }
    });
  }
  /**
   * Report incorrect data for a title
   */
  reportIncorrectData(titleId, options) {
    return reportIncorrectData({
      client: this.client,
      path: { title_id: titleId },
      query: {
        somethingWrongDescription: options?.somethingWrongDescription,
        serviceIncorrect: options?.serviceIncorrect,
        sourceMissing: options?.sourceMissing,
        somethingElseWrong: options?.somethingElseWrong,
        somethingWrongDetails: options?.somethingWrongDetails
      }
    });
  }
};
var SearchApi = class {
  constructor(client2) {
    this.client = client2;
  }
  /**
   * Search by name
   *
   * @example
   * ```typescript
   * const { data } = await client.search.byName('Breaking Bad');
   * ```
   */
  byName(searchValue, options) {
    return search({
      client: this.client,
      query: {
        search_field: "name",
        search_value: searchValue,
        types: options?.types
      }
    });
  }
  /**
   * Search by IMDB ID
   *
   * @example
   * ```typescript
   * const { data } = await client.search.byImdbId('tt0903747');
   * ```
   */
  byImdbId(imdbId) {
    return search({
      client: this.client,
      query: {
        search_field: "imdb_id",
        search_value: imdbId
      }
    });
  }
  /**
   * Search by TMDB movie ID
   */
  byTmdbMovieId(tmdbId) {
    return search({
      client: this.client,
      query: {
        search_field: "tmdb_movie_id",
        search_value: String(tmdbId)
      }
    });
  }
  /**
   * Search by TMDB TV ID
   */
  byTmdbTvId(tmdbId) {
    return search({
      client: this.client,
      query: {
        search_field: "tmdb_tv_id",
        search_value: String(tmdbId)
      }
    });
  }
  /**
   * Search by TMDB person ID
   */
  byTmdbPersonId(tmdbId) {
    return search({
      client: this.client,
      query: {
        search_field: "tmdb_person_id",
        search_value: String(tmdbId)
      }
    });
  }
  /**
   * Autocomplete search (optimized for typeahead)
   *
   * @example
   * ```typescript
   * const { data } = await client.search.autocomplete('break', { searchType: 2 }); // titles only
   * ```
   */
  autocomplete(searchValue, options) {
    return autocompleteSearch({
      client: this.client,
      query: {
        search_value: searchValue,
        search_type: options?.searchType
      }
    });
  }
};
var PersonApi = class {
  constructor(client2) {
    this.client = client2;
  }
  /**
   * Get person details
   *
   * @param personId - Watchmode person ID (starts with 7)
   *
   * @example
   * ```typescript
   * const { data } = await client.person.getDetails(7110004);
   * ```
   */
  getDetails(personId) {
    return getPerson({
      client: this.client,
      path: { person_id: personId }
    });
  }
};
var SourcesApi = class {
  constructor(client2) {
    this.client = client2;
  }
  /**
   * List all streaming sources/providers
   *
   * @example
   * ```typescript
   * const { data: sources } = await client.sources.list({ regions: 'US', types: 'sub,free' });
   * ```
   */
  list(options) {
    return getSources({
      client: this.client,
      query: {
        regions: options?.regions,
        types: options?.types
      }
    });
  }
};
var ReleasesApi = class {
  constructor(client2) {
    this.client = client2;
  }
  /**
   * Get recent and upcoming streaming releases
   *
   * @example
   * ```typescript
   * const { data } = await client.releases.getRecent({ limit: 100 });
   * ```
   */
  getRecent(options) {
    return getReleases({
      client: this.client,
      query: {
        start_date: options?.startDate,
        end_date: options?.endDate,
        limit: options?.limit
      }
    });
  }
  /**
   * Get upcoming release dates (paid plans only)
   */
  getUpcoming(options) {
    return getTitleReleaseDates({
      client: this.client,
      query: {
        start_date: options?.startDate,
        end_date: options?.endDate
      }
    });
  }
};
var ChangesApi = class {
  constructor(client2) {
    this.client = client2;
  }
  /**
   * Get newly added titles
   */
  getNewTitles(options) {
    return getNewTitles({
      client: this.client,
      query: {
        start_date: options?.startDate,
        end_date: options?.endDate,
        types: options?.types,
        page: options?.page,
        limit: options?.limit
      }
    });
  }
  /**
   * Get newly added people
   */
  getNewPeople(options) {
    return getNewPeople({
      client: this.client,
      query: {
        start_date: options?.startDate,
        end_date: options?.endDate,
        page: options?.page,
        limit: options?.limit
      }
    });
  }
  /**
   * Get titles with changed streaming sources
   */
  getTitlesWithSourceChanges(options) {
    return getTitlesSourcesChanged({
      client: this.client,
      query: {
        start_date: options?.startDate,
        end_date: options?.endDate,
        types: options?.types,
        regions: options?.regions,
        page: options?.page,
        limit: options?.limit
      }
    });
  }
  /**
   * Get titles with changed details/metadata
   */
  getTitlesWithDetailChanges(options) {
    return getTitlesDetailsChanged({
      client: this.client,
      query: {
        start_date: options?.startDate,
        end_date: options?.endDate,
        types: options?.types,
        page: options?.page,
        limit: options?.limit
      }
    });
  }
  /**
   * Get titles with changed episodes
   */
  getTitlesWithEpisodeChanges(options) {
    return getTitlesEpisodesChanged({
      client: this.client,
      query: {
        start_date: options?.startDate,
        end_date: options?.endDate,
        page: options?.page,
        limit: options?.limit
      }
    });
  }
};
var AccountApi = class {
  constructor(client2) {
    this.client = client2;
  }
  /**
   * Get API quota status
   *
   * @example
   * ```typescript
   * const { data } = await client.account.getStatus();
   * console.log(`Used ${data?.quotaUsed} of ${data?.quota} requests`);
   * ```
   */
  getStatus() {
    return getStatus({
      client: this.client
    });
  }
};
var ReferenceApi = class {
  constructor(client2) {
    this.client = client2;
  }
  /**
   * Get all supported regions
   */
  getRegions() {
    return getRegions({
      client: this.client
    });
  }
  /**
   * Get all TV networks
   */
  getNetworks() {
    return getNetworks({
      client: this.client
    });
  }
  /**
   * Get all genres
   */
  getGenres() {
    return getGenres({
      client: this.client
    });
  }
};
var index_default = WatchmodeClient;
export {
  WatchmodeClient,
  index_default as default,
  client as generatedClient
};
