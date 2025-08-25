import { pathOps } from "./path-ops.js";
import { Result, exception2Result } from "./result.js";
import { runtimeFn } from "./runtime.js";
import { CoerceURI, URI } from "./uri.js";

interface MockLoadAsset {
  fetch: typeof globalThis.fetch;
  fsReadFile: (fname: string) => Promise<Uint8Array>;
}

function callFetch(mock?: Partial<MockLoadAsset>): typeof globalThis.fetch {
  return mock?.fetch ? mock.fetch : globalThis.fetch;
}

async function callFsReadFile(mock?: Partial<MockLoadAsset>): Promise<MockLoadAsset["fsReadFile"]> {
  if (mock?.fsReadFile) {
    return mock.fsReadFile;
  }
  const fs = await import("fs");
  return (fname: string) => fs.promises.readFile(fname);
}

export interface LoadAssetOptions {
  readonly fallBackUrl: CoerceURI;
  readonly pathCleaner: (base: string, localPath: string, mode: "fallback" | "normal") => string;
  readonly mock: Partial<MockLoadAsset>;
}

function fallBackBaseUrl(opts: Partial<LoadAssetOptions>): { url?: URL; src: "opts.fallBackUrl" } {
  return { url: opts.fallBackUrl ? URI.from(opts.fallBackUrl).asURL() : undefined, src: "opts.fallBackUrl" };
}

export async function loadAsset(localPath: string, opts: Partial<LoadAssetOptions> = {}): Promise<Result<string>> {
  const base: {
    url?: URL;
    src: "import.meta.url" | "opts.fallBackUrl";
  } = import.meta?.url ? { url: new URL(pathOps.dirname(import.meta.url)), src: "import.meta.url" } : fallBackBaseUrl(opts);
  return loadAssetReal(base, localPath, opts);
}

async function loadAssetReal(
  baseUrl: { url?: URL; src: "import.meta.url" | "opts.fallBackUrl" },
  localPath: string,
  opts: Partial<LoadAssetOptions>,
): Promise<Result<string>> {
  if (!baseUrl.url) {
    return Result.Err(`base url not found from ${baseUrl.src}`);
  }
  const urlO = new URL(baseUrl.url.toString());
  urlO.pathname = pathOps.dirname(urlO.pathname);
  if (baseUrl.url.protocol.startsWith("file")) {
    const rt = runtimeFn();
    const fname = opts.pathCleaner(baseUrl.url.pathname, localPath, "normal");
    if (rt.isNodeIsh || rt.isDeno) {
      try {
        const out = await callFsReadFile(opts.mock).then((fn) => fn(fname));
        const txt = new TextDecoder().decode(out);
        return Result.Ok(txt);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("fs direct access failed:", baseUrl.url.pathname, baseUrl.src, e);
      }
    }
    /*
      baseUrl.url.pathname = fname;
      const x = await fetch(baseUrl.url);
      console.log("fetched", baseUrl.url, x.ok, x.status);
      */

    if (baseUrl.src === "import.meta.url") {
      return loadAssetReal(fallBackBaseUrl(opts), localPath, opts);
    }
    return Result.Err(`cannot load file: ${baseUrl.url.toString()} from ${baseUrl.src}`);
  }
  switch (baseUrl.src) {
    case "opts.fallBackUrl":
      baseUrl.url.pathname = opts.pathCleaner(baseUrl.url.pathname, localPath, "fallback");
      break;
    case "import.meta.url":
      baseUrl.url.pathname = opts.pathCleaner(baseUrl.url.pathname, localPath, "normal");
      break;
  }
  const rRes = await exception2Result(() => callFetch(opts.mock)(baseUrl.url));
  if (rRes.isErr()) {
    if (baseUrl.src === "import.meta.url") {
      // eslint-disable-next-line no-console
      console.warn(`fetch failed for: ${baseUrl.url}`);
      return loadAssetReal(fallBackBaseUrl(opts), localPath, opts);
    }
    return Result.Err(rRes);
  }
  if (!rRes.Ok().ok) {
    if (baseUrl.src === "import.meta.url") {
      // eslint-disable-next-line no-console
      console.warn(`fetch return !ok for: ${baseUrl.url}`);
      return loadAssetReal(fallBackBaseUrl(opts), localPath, opts);
    }
    return Result.Err(`Fetch failed: ${baseUrl.url.toString()} ${rRes.Ok().status} ${rRes.Ok().statusText}`);
  }
  return Result.Ok(await rRes.Ok().text());
}
