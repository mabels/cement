import { AppContext } from "./app-context.js";
import { Option } from "./option.js";
import { ResolveOnce } from "./resolve-once.js";
import { exception2Result, Result } from "./result.js";

/**
 * Encoder/decoder interface for transforming request and response data.
 * Used to serialize/deserialize data for event handling.
 *
 * @typeParam REQ - The request type to encode
 * @typeParam RES - The response type to decode
 */
export interface EventoEnDecoder<REQ, RES> {
  /**
   * Encodes request arguments into a serializable format.
   *
   * @param args - The request data to encode
   * @returns A Result containing the encoded data or an error
   */
  encode(args: REQ): Promise<Result<unknown>>;

  /**
   * Decodes serialized data back into response format.
   *
   * @param data - The serialized data to decode
   * @returns A Result containing the decoded response or an error
   */
  decode(data: unknown): Promise<Result<RES>>;
}

/**
 * Interface for sending data during event handling.
 * Provides lifecycle hooks (start, send, done) for managing event communication.
 *
 * @typeParam INREQ - The input request type
 * @typeParam REQ - The validated request type
 * @typeParam RES - The response type
 */
export interface EventoSend<INREQ, REQ, RES> {
  /**
   * Optional hook called once before the first handler processes the event.
   *
   * @param trigger - The trigger context
   * @returns A Result indicating success or failure
   */
  start?(trigger: HandleTriggerCtx<INREQ, REQ, RES>): Promise<Result<void>>;

  /**
   * Sends data during event handling.
   *
   * @typeParam IS - Input send data type
   * @typeParam OS - Output send data type
   * @param trigger - The trigger context
   * @param data - The data to send
   * @returns A Result containing the response or an error
   */
  send<IS, OS>(trigger: HandleTriggerCtx<INREQ, REQ, RES>, data: IS): Promise<Result<OS>>;

  /**
   * Optional hook called after all handlers have finished processing.
   *
   * @param trigger - The trigger context
   * @returns A Result indicating success or failure
   */
  done?(trigger: HandleTriggerCtx<INREQ, REQ, RES>): Promise<Result<void>>;
}

// export interface ActiveTriggerCtx<INREQ, REQ, RES> {
//   request?: INREQ;
//   ctx: AppContext;
//   enRequest?: unknown;
//   validated?: REQ;
//   send: EventoSend<INREQ, REQ, RES>;
//   encoder: EventoEnDecoder<INREQ, RES>;
// }

/**
 * Base interface for trigger context containing core dependencies.
 *
 * @typeParam INREQ - The input request type
 * @typeParam REQ - The validated request type
 * @typeParam RES - The response type
 */
export interface TriggerCtxBase<INREQ, REQ, RES> {
  send: EventoSend<INREQ, REQ, RES>;
  ctx: AppContext;
  encoder: EventoEnDecoder<INREQ, RES>;
}

/**
 * Readonly version of the base trigger context.
 */
export type ReadonlyTriggerCtxBase<INREQ, REQ, RES> = Readonly<TriggerCtxBase<INREQ, REQ, RES>>;

/**
 * Parameters for creating a trigger context.
 * Requires send, but ctx and encoder are optional and will use defaults.
 */
export type TriggerCtxBaseParams<INREQ, REQ, RES> = Pick<ReadonlyTriggerCtxBase<INREQ, REQ, RES>, "send"> &
  Partial<Pick<ReadonlyTriggerCtxBase<INREQ, REQ, RES>, "ctx" | "encoder">>;

/**
 * Complete parameters for triggering an event, including optional request data.
 */
export type TriggerCtxParams<INREQ, REQ, RES> = TriggerCtxBaseParams<INREQ, REQ, RES> & { request?: INREQ; enRequest?: unknown };

/**
 * Union type representing different trigger context states.
 * Can have raw request, encoded request, or both.
 */
export type TriggerCtx<INREQ, REQ, RES> =
  | (ReadonlyTriggerCtxBase<INREQ, REQ, RES> & { request: INREQ })
  | (ReadonlyTriggerCtxBase<INREQ, REQ, RES> & { enRequest: unknown })
  | (ReadonlyTriggerCtxBase<INREQ, REQ, RES> & { enRequest: unknown; request: INREQ });

/**
 * Context provided to validation handlers.
 * Contains the encoded request data for validation.
 */
export interface ValidateTriggerCtx<INREQ, REQ, RES> extends ReadonlyTriggerCtxBase<INREQ, REQ, RES> {
  readonly request?: INREQ;
  readonly enRequest: unknown;
}

/**
 * Mutable parts of the handle trigger context.
 * Contains all forms of the request: raw, encoded, and validated.
 */
export interface MutableHandleTriggerCtx<INREQ, REQ> {
  request: INREQ;
  enRequest: unknown;
  validated: REQ;
  error?: Error;
  triggerResult?: string[];
}

/**
 * Context provided to event handlers.
 * Combines validated request data with base context.
 */
export type HandleTriggerCtx<INREQ, REQ, RES> = Readonly<MutableHandleTriggerCtx<INREQ, REQ>> &
  ReadonlyTriggerCtxBase<INREQ, REQ, RES>;

/**
 * Result values that event handlers can return to control flow.
 */
export const EventoResult = {
  /** Continue processing subsequent handlers */
  Continue: "continue",
  /** Stop processing and skip remaining handlers */
  Stop: "stop",
} as const;

export type EventoResultType = (typeof EventoResult)[keyof typeof EventoResult];

/**
 * Operations for registering handlers in different positions.
 */
export enum EventoOp {
  /** Add handler to the end of the list */
  Push = "push",
  /** Add handler to the beginning of the list */
  Unshift = "unshift",
  /** Add handler at a specific position */
  Position = "position",
}

/**
 * Types of event handlers.
 */
export enum EventoType {
  /** Wildcard handlers run only if no regular handlers match */
  WildCard = "wildcard",
  /** Regular handlers run first */
  Regular = "regular",
  /** Error handlers run on errors */
  Error = "error",
}

// export type EventoOrderType = typeof EventoOrder[keyof typeof EventoOrder];
/**
 * Event handler interface.
 * Handlers can optionally validate requests before handling them.
 *
 * @typeParam INREQ - The input request type (defaults to unknown)
 * @typeParam REQ - The validated request type (defaults to unknown)
 * @typeParam RES - The response type (defaults to unknown)
 */
export interface EventoHandler<INREQ = unknown, REQ = unknown, RES = unknown> {
  /** Handler type (defaults to Regular if not specified) */
  readonly type?: EventoType;
  /** Unique identifier for this handler */
  readonly hash: string;

  /**
   * Handles the validated event.
   *
   * @param trigger - The trigger context with validated data
   * @returns A Result indicating whether to continue or stop processing
   */
  handle(trigger: HandleTriggerCtx<INREQ, REQ, RES>): Promise<Result<EventoResultType>>;

  /**
   * Optional validation method.
   * Return Some(validated data) to handle this event, or None to skip.
   *
   * @param trigger - The trigger context for validation
   * @returns A Result containing Option of validated data
   */
  validate?(trigger: ValidateTriggerCtx<INREQ, REQ, RES>): Promise<Result<Option<REQ>>>;

  /** Optional hook called after handling the event.
   *
   * @param trigger - The trigger context
   * @returns A Promise that resolves when post-processing is complete
   */
  post?(trigger: HandleTriggerCtx<INREQ, REQ, RES>): Promise<void>;
}

/**
 * Simple handler operation (push or unshift).
 */
export interface EventoHandlerOpSimple {
  readonly type: EventoType;
  readonly op: EventoOp.Push | EventoOp.Unshift;
  readonly handler: EventoHandler;
}

/**
 * Position-based handler operation for inserting at a specific index.
 */
export interface EventoHandlerOpPosition {
  readonly type: EventoType;
  readonly op: EventoOp.Position;
  readonly handler: EventoHandler;
  readonly idx: number;
}

/**
 * Union type for all handler operations.
 */
export type EventoHandlerOp = EventoHandlerOpSimple | EventoHandlerOpPosition;

/**
 * Creates an unregister function for removing a handler from the handler list.
 *
 * @param item - The handler to create an unregister function for
 * @param actions - The handler list containing the handler
 * @returns A function that removes the handler when called
 */
function unregFunc(item: EventoHandler, actions: EventoHandler[]): () => void {
  return (): void => {
    const index = actions.findIndex((x) => x.hash === item.hash);
    if (index >= 0) {
      actions.splice(index, 1);
    }
  };
}

/**
 * Event handling system with validation and encoding support.
 * Manages regular and wildcard handlers with customizable execution order.
 *
 * Regular handlers are processed first. If any regular handler matches and processes
 * the event, wildcard handlers are skipped. Wildcard handlers only run if no regular
 * handlers matched.
 *
 * @example
 * ```typescript
 * // Define your types
 * interface MyRequest { action: string; value: number; }
 * interface MyResponse { success: boolean; data?: unknown; }
 *
 * // Create an encoder/decoder
 * class MyEncoder implements EventoEnDecoder<MyRequest, MyResponse> {
 *   async encode(args: MyRequest): Promise<Result<unknown>> {
 *     return Result.Ok(args);
 *   }
 *   async decode(data: unknown): Promise<Result<MyResponse>> {
 *     return Result.Ok(data as MyResponse);
 *   }
 * }
 *
 * // Create a send implementation
 * class MySend implements EventoSend<MyRequest, MyRequest, MyResponse> {
 *   async send<IS, OS>(trigger: HandleTriggerCtx<MyRequest, MyRequest, MyResponse>, data: IS): Promise<Result<OS>> {
 *     // Send the response data
 *     console.log('Sending:', data);
 *     return Result.Ok(data as OS);
 *   }
 * }
 *
 * // Initialize Evento
 * const evento = new Evento(new MyEncoder());
 * const send = new MySend();
 *
 * // Register regular handlers (run first)
 * evento.push({
 *   hash: 'update-handler',
 *   validate: async (ctx) => {
 *     const req = ctx.enRequest as MyRequest;
 *     // Only handle "update" actions
 *     if (req.action === 'update') {
 *       return Result.Ok(Option.Some(req));
 *     }
 *     return Result.Ok(Option.None());
 *   },
 *   handle: async (ctx) => {
 *     await ctx.send.send(ctx, {
 *       success: true,
 *       data: { updated: ctx.validated.value }
 *     });
 *     return Result.Ok(EventoResult.Continue);
 *   }
 * });
 *
 * // Register wildcard handler (runs if no regular handlers match)
 * evento.push({
 *   hash: 'default-handler',
 *   type: EventoType.WildCard,
 *   handle: async (ctx) => {
 *     await ctx.send.send(ctx, { success: false });
 *     return Result.Ok(EventoResult.Stop);
 *   }
 * });
 *
 * // Trigger an event
 * await evento.trigger({
 *   send,
 *   request: { action: 'update', value: 42 }
 * });
 * ```
 */
export class Evento {
  private actions: EventoHandler[] = [];
  private wildcards: EventoHandler[] = [];
  private errors: EventoHandler[] = [];

  private encoder: EventoEnDecoder<unknown, unknown>;

  /**
   * Creates a new Evento instance.
   *
   * @param encoder - The default encoder/decoder for requests and responses
   */
  constructor(encoder: EventoEnDecoder<unknown, unknown>) {
    this.encoder = encoder;
  }

  /**
   * Returns copies of the current handler lists.
   *
   * @returns An object containing arrays of regular actions and wildcard handlers
   */
  handlers(): {
    actions: EventoHandler[];
    wildcards: EventoHandler[];
  } {
    return {
      actions: [...this.actions],
      wildcards: [...this.wildcards],
    };
  }

  /**
   * Registers handlers at the end of their respective lists.
   *
   * @param hdls - One or more handlers or arrays of handlers
   * @returns Array of unregister functions, one for each handler
   */
  push(...hdls: (EventoHandler | EventoHandler[])[]): (() => void)[] {
    return this.register(
      ...hdls.flat().map((handler) => {
        return {
          handler,
          type: handler.type ?? EventoType.Regular,
          op: EventoOp.Push as const,
        };
      }),
    );
  }

  /**
   * Registers handlers at the beginning of their respective lists.
   *
   * @param hdls - One or more handlers or arrays of handlers
   * @returns Array of unregister functions, one for each handler
   */
  unshift(...hdls: (EventoHandler | EventoHandler[])[]): (() => void)[] {
    return this.register(
      ...hdls.flat().map((handler) => {
        return {
          handler: handler,
          type: handler.type ?? EventoType.Regular,
          op: EventoOp.Unshift as const,
        };
      }),
    );
  }

  /**
   * Registers handlers with specific operations.
   * If a handler with the same hash already exists, returns its unregister function
   * without adding a duplicate.
   *
   * @param hdls - Handler operations specifying where to place each handler
   * @returns Array of unregister functions, one for each handler
   * @throws Error if an unknown operation is specified
   */
  register(...hdls: EventoHandlerOp[]): (() => void)[] {
    return hdls.map((item) => {
      let handlers: EventoHandler[];
      switch (item.type) {
        case EventoType.WildCard:
          handlers = this.wildcards;
          break;
        case EventoType.Error:
          handlers = this.errors;
          break;
        case EventoType.Regular:
        default:
          handlers = this.actions;
          break;
      }
      const hasHandler = handlers.find((h) => h.hash === item.handler.hash);
      if (hasHandler) {
        return unregFunc(hasHandler, handlers);
      }
      switch (item.op) {
        case EventoOp.Push:
          handlers.push(item.handler);
          return unregFunc(item.handler, handlers);
        case EventoOp.Unshift:
          handlers.unshift(item.handler);
          return unregFunc(item.handler, handlers);
        case EventoOp.Position:
          handlers.splice(item.idx, 0, item.handler);
          return unregFunc(item.handler, handlers);
        default:
          throw new Error(`Unknown position`);
      }
    });
  }

  /**
   * Triggers event processing through registered handlers.
   *
   * Process flow:
   * 1. Encodes the request if not already encoded
   * 2. Validates against each handler (regular handlers first)
   * 3. For matching handlers, calls handle() method
   * 4. If any regular handler matches, wildcard handlers are skipped
   * 5. Calls optional start/done lifecycle hooks on the send interface
   *
   * @typeParam INREQ - The input request type
   * @typeParam REQ - The validated request type
   * @typeParam RES - The response type
   * @param ictx - The trigger context parameters
   * @returns A Result containing an array of handler hashes that processed the event
   */
  async trigger<INREQ, REQ, RES>(ictx: TriggerCtxParams<INREQ, REQ, RES>): Promise<Result<string[]>> {
    let stepCtx:
      | HandleTriggerCtx<INREQ, REQ, RES>
      | ValidateTriggerCtx<INREQ, REQ, RES>
      | (ReadonlyTriggerCtxBase<INREQ, REQ, RES> & Partial<MutableHandleTriggerCtx<INREQ, REQ>>)
      | object = {};
    const toPost: EventoHandler[] = [];
    const startOnce = new ResolveOnce<Result<HandleTriggerCtx<INREQ, REQ, RES>>>();
    const res = await exception2Result(async (): Promise<Result<string[]>> => {
      const ctx: ReadonlyTriggerCtxBase<INREQ, REQ, RES> & Partial<MutableHandleTriggerCtx<INREQ, REQ>> = {
        ...ictx,
        encoder: ictx.encoder ?? (this.encoder as EventoEnDecoder<INREQ, RES>),
        ctx: ictx.ctx ?? new AppContext(),
      };
      stepCtx = ctx;
      const results: string[] = [];
      // this skips encoding if already encoded
      if (!ctx.enRequest) {
        const rUnk = await this.encoder.encode(ctx.request as never);
        if (rUnk.isErr()) {
          return Result.Err(rUnk);
        }
        const unk = rUnk.unwrap();
        ctx.enRequest = unk;
      }
      const validateCtx = (stepCtx = {
        ...ctx,
        enRequest: ctx.enRequest,
        request: ctx.request,
      });
      for (const hdl of [...this.actions, "breakpoint", ...this.wildcards]) {
        if (typeof hdl === "string") {
          if (results.length > 0) {
            // we handled actions so we do not process wildcards
            break;
          }
          continue;
        }
        if (hdl.post) {
          toPost.push(hdl);
        }
        const rData = await Promise.resolve(hdl.validate ? hdl.validate(validateCtx) : Result.Ok(Option.Some(ctx.enRequest)));
        if (rData.isErr()) {
          return Result.Err(rData);
        }
        const data = rData.Ok();
        if (data.IsNone()) {
          continue;
        }
        const hdlCtx = (stepCtx = {
          ...ctx,
          validated: data.Unwrap() as REQ,
          request: ctx.request as INREQ,
          enRequest: ctx.enRequest,
        }); // satisfies HandleTriggerCtx<INREQ, REQ, RES>;
        if (ctx.send.start) {
          const rStart = await startOnce.once(() =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            ctx.send.start!(hdlCtx).then((rv): Result<HandleTriggerCtx<INREQ, REQ, RES>> => {
              if (rv.isErr()) {
                return Result.Err(rv);
              }
              return Result.Ok(hdlCtx);
            }),
          );
          if (rStart.isErr()) {
            return Result.Err(rStart);
          }
        }
        const rHandle = await hdl.handle(hdlCtx);
        if (rHandle.isErr()) {
          return Result.Err(rHandle);
        }
        results.push(hdl.hash);
        if (rHandle.Ok() === EventoResult.Stop) {
          break;
        }
      }

      return Result.Ok(results);
    });
    for (const hdl of toPost) {
      if (res.isOk()) {
        (stepCtx as MutableHandleTriggerCtx<INREQ, REQ>).triggerResult = res.Ok();
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await exception2Result(() => hdl.post!(stepCtx as HandleTriggerCtx<INREQ, REQ, RES>));
    }
    if (res.isErr()) {
      (stepCtx as MutableHandleTriggerCtx<INREQ, REQ>).error = res.Err();
      for (const hdl of this.errors) {
        await exception2Result(() => hdl.handle(stepCtx as HandleTriggerCtx<INREQ, REQ, RES>));
      }
    }
    const send = stepCtx && "send" in stepCtx ? (stepCtx.send as HandleTriggerCtx<INREQ, REQ, RES>["send"]) : undefined;
    if (send && send.done && startOnce.state === "processed" && startOnce.value) {
      if (startOnce.value.isOk()) {
        await send.done(startOnce.value.Ok());
      }
    }
    return res;
  }
}
