export class ClientFetch {
  #server!: ServerFetch;
  connect(server: ServerFetch): void {
    this.#server = server;
  }
  readonly calls: {
    request: Request;
    response: Response;
  }[] = [];
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const req = new Request(url, options);
    const callsReq = req.clone();
    const res = await this.#server.serve(req);
    this.calls.push({ request: callsReq, response: res.clone() });
    return res;
  }
}

export class ServerFetch {
  serve!: (request: Request) => Promise<Response>;

  onServe(serve: (request: Request) => Promise<Response>): void {
    this.serve = serve;
  }
}

export class TestFetchPair {
  public readonly client: ClientFetch = new ClientFetch();
  public readonly server: ServerFetch = new ServerFetch();

  static create(): TestFetchPair {
    const tfp = new TestFetchPair();
    tfp.client.connect(tfp.server);
    return tfp;
  }

  private constructor() {
    /* empty */
  }
}
