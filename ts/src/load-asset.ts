import { pathOps } from "./path-ops.js";
import { Result, exception2Result } from "./result.js";
import { runtimeFn } from "./runtime.js";
import { TxtEnDecoderSingleton } from "./txt-en-decoder.js";
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
  const fsMod = "node:fs"; // make ts and esbuild happy
  const fs = (await import(fsMod)) as typeof import("node:fs");
  return (fname: string) => fs.promises.readFile(fname);
}

export interface LoadAssetOptionals {
  readonly fallBackUrl: CoerceURI;
  readonly pathCleaner: (base: string, localPath: string, mode: "fallback" | "normal") => string;
  readonly mock: Partial<MockLoadAsset>;
}

// basePath could fail throw
export type LoadAssetOpts = Partial<LoadAssetOptionals> & { readonly basePath: () => string };

function fallBackBaseUrl(opts: { fallBackUrl?: CoerceURI }): { url?: URL; src: "opts.fallBackUrl" } {
  return { url: opts.fallBackUrl ? URI.from(opts.fallBackUrl).asURL() : undefined, src: "opts.fallBackUrl" };
}

function baseUrlFromOpts(opts: LoadAssetOpts): URL | undefined {
  try {
    return urlDirname(opts.basePath()).asURL();
  } catch (e) {
    return;
  }
}

export function urlDirname(url: CoerceURI): URI {
  const uri = URI.from(url);
  const buri = uri.build();
  return buri.pathname(pathOps.dirname(uri.pathname)).URI();
}

export async function loadAsset(localPath: string, opts: LoadAssetOpts): Promise<Result<string>> {
  const baseURL = baseUrlFromOpts(opts);
  const base: {
    url?: URL;
    src: "import.meta.url" | "opts.fallBackUrl";
  } = baseURL ? { url: baseURL, src: "import.meta.url" } : fallBackBaseUrl(opts);
  return loadAssetReal(base, localPath, {
    pathCleaner: (base, localPath) => pathOps.join(base, localPath),
    ...opts,
  });
}

async function loadAssetReal(
  baseUrl: { url?: URL; src: "import.meta.url" | "opts.fallBackUrl" },
  localPath: string,
  opts: Partial<Omit<LoadAssetOpts, "pathCleaner">> & {
    pathCleaner: (base: string, localPath: string, mode: "fallback" | "normal") => string;
  },
): Promise<Result<string>> {
  if (!baseUrl.url) {
    return Result.Err(`base url not found from ${baseUrl.src}`);
  }
  if (baseUrl.url.protocol.startsWith("file")) {
    const rt = runtimeFn();
    const fname = opts.pathCleaner(baseUrl.url.pathname, localPath, "normal");
    if (rt.isNodeIsh || rt.isDeno) {
      try {
        const out = await callFsReadFile(opts.mock).then((fn) => fn(fname));
        const txt = TxtEnDecoderSingleton().decode(out);
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

  const rRes = await exception2Result(() => {
    if (!baseUrl.url) {
      throw Error(`base url not found from ${baseUrl.src}`);
    }
    return callFetch(opts.mock)(baseUrl.url);
  });
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
