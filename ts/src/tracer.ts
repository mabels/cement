import type { MarkWritable } from "ts-essentials";
import { Time } from "./time.js";
import { Logger } from "./logger.js";

export type TraceCtx = {
  readonly spanId: string;
  readonly time: Time;
  readonly parent: TraceNode;
  readonly metrics: Map<string, Metric<unknown>>;
  readonly logger?: Logger;
} & Record<string, unknown>;

export type CleanCtx = {
  readonly spanId: string;
} & Record<string, unknown>;

export type TraceCtxParam = {
  readonly spanId: string;
} & Partial<{
  readonly time: Time;
  readonly parent: TraceNode;
  readonly logger: Logger;
}> &
  Record<string, unknown>;

export class Metric<T> {
  value?: T;
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  set(value: T): void {
    this.value = value;
  }

  add<R extends number | ArrayLike<T>>(value: R): void {
    if (typeof value === "number") {
      if (this.value === undefined) {
        this.value = 0 as T;
      }
      this.value = ((this.value as number) + value) as T;
    } else if (Array.isArray(value)) {
      if (!Array.isArray(this.value)) {
        this.value = [] as T;
      }
      (this.value as T[]).push(...value);
    } else {
      throw new Error("add only support number or array");
    }
  }
}

export type MetricMap = Map<string, Metric<unknown>>;

export class Metrics {
  readonly tracenode: TraceNode;
  private readonly map: MetricMap;

  readonly spanRefs: MetricMap = new Map<string, Metric<unknown>>();
  constructor(tracenode: TraceNode) {
    this.tracenode = tracenode;
    this.map = tracenode.ctx.metrics;
  }

  toJSON(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of this.map) {
      obj[key] = value.value;
    }
    return obj;
  }

  get<T>(ipath: string): Metric<T> {
    const path = ipath.replace(/[/]+/g, "/").trim();
    if (path.startsWith("/")) {
      if (path.slice(1).length === 0) {
        throw new Error(`Metrics path must contain value /:${path}`);
      }
      let metric = this.map.get(path);
      if (!metric) {
        metric = new Metric<T>(path);
        this.map.set(path, metric);
      }
      this.spanRefs.set(path, metric);
      return metric as Metric<T>;
    } else if (path.includes("/")) {
      throw new Error(`Metrics path must start with /:${path}`);
    }
    const rootPath = this.tracenode.getRootPath();
    return this.get(`${rootPath}/${path}`);
  }
}

export interface Invokaction {
  readonly result: "success" | "error";
  readonly start: number;
  readonly end: number;
  readonly metrics?: Metrics;
}

export type TraceNodeMap = Map<string, TraceNode>;

export class TraceNode {
  readonly childs: TraceNodeMap = new Map<string, TraceNode>();

  readonly invokations: Invokaction[] = [];

  readonly spanId: string;
  readonly ctx: TraceCtx;
  readonly metrics: Metrics;

  static root(time: Time, logger?: Logger): TraceNode {
    return new TraceNode({
      spanId: "root",
      time,
      logger,
      metrics: new Map(),
      parent: undefined as unknown as TraceNode,
    });
  }

  constructor(ctx: TraceCtx) {
    this.spanId = ctx.spanId;
    this.ctx = ctx;
    this.metrics = new Metrics(this);
  }

  getRootPath(rpath: string[] = []): string {
    if (!this.ctx.parent) {
      return "/" + rpath.reverse().join("/");
    }
    return this.ctx.parent.getRootPath(rpath.concat(this.ctx.spanId));
  }

  invokes(): { ctx: CleanCtx; invokations: Invokaction[] } {
    const cleanCtx = { ...this.ctx } as CleanCtx;
    delete cleanCtx.parent;
    delete cleanCtx.time;
    delete cleanCtx.logger;
    delete cleanCtx.metrics;
    const spanRefs = this.metrics.toJSON.call({ map: this.metrics.spanRefs });
    const metricsRefs = Object.keys(spanRefs).length > 0 ? { metricRefs: spanRefs } : {};
    return {
      ctx: cleanCtx,
      invokations: this.invokations,
      ...metricsRefs,
    };
  }

  ctxWith(spanId: string, logger?: Logger): TraceCtxParam {
    const ctx = {
      ...this.ctx,
      spanId,
    };
    if (logger) {
      ctx.logger = logger;
    }
    return ctx;
  }

  // <V extends () => Promise<T> | T, T>(id: string, fn: V): ReturnType<V>
  span<V extends (trace: TraceNode) => Promise<T> | T, T>(inSpanId: string | TraceCtxParam, fn: V): ReturnType<V> {
    let ctx: TraceCtx;
    if (typeof inSpanId === "string") {
      ctx = {
        ...this.ctx,
        spanId: inSpanId,
        parent: this,
      };
    } else {
      ctx = {
        ...this.ctx,
        ...inSpanId,
        parent: this,
      };
    }
    if (ctx.logger) {
      ctx = {
        ...ctx,
        ...ctx.logger.Attributes(),
      };
    }
    const spanId = ctx.spanId;
    let spanTrace = this.childs.get(spanId);
    if (!spanTrace) {
      spanTrace = new TraceNode(ctx);
      this.childs.set(spanId.toString(), spanTrace);
    }
    const invokation: MarkWritable<MarkWritable<Invokaction, "end">, "result"> = {
      start: this.ctx.time.Now().getTime(),
      end: 0,
      result: "success",
    };
    spanTrace.invokations.push(invokation);
    try {
      const possiblePromise = fn(spanTrace);
      if (possiblePromise instanceof Promise) {
        return possiblePromise
          .then((v) => {
            return v;
          })
          .catch((e) => {
            invokation.result = "error";
            throw e;
          })
          .finally(() => {
            invokation.end = this.ctx.time.Now().getTime();
          }) as ReturnType<V>;
      }
      invokation.end = this.ctx.time.Now().getTime();
      return possiblePromise as ReturnType<V>;
    } catch (e) {
      invokation.result = "error";
      invokation.end = this.ctx.time.Now().getTime();
      throw e;
    }
  }
}
