# Cement

An agnostic platform abstraction layer for TypeScript/JavaScript and Go that provides consistent APIs across Node.js, Deno, Cloudflare Workers, and other runtimes.

## Overview

Cement provides a unified interface for common system operations, logging, and utilities across different JavaScript/TypeScript runtimes and Go. Write your code once and run it anywhere - whether that's Node.js, Deno, browsers, or Cloudflare Workers.

## Key Features

### System Abstraction

Cross-platform system operations through a unified interface:

```typescript
interface SysAbstraction {
  Time(): Time;
  Stdout(): WritableStream<Uint8Array>;
  Stderr(): WritableStream<Uint8Array>;
  NextId(): string;
  Random0ToValue(value: number): number;
  System(): SystemService;
  FileSystem(): FileService;
}
```

### Structured Logging

Inspired by Go's zerolog, providing efficient structured logging:

```typescript
logger
  .Str("user", "john")
  .Uint64("id", 123)
  .Info()
  .Log("User logged in");
```

### Additional Utilities

- **Result & Option Types**: Type-safe error handling inspired by Rust
- **Future**: Promise-based async utilities
- **URI Handling**: Mutable URL utilities for safe URL manipulation
- **Crypto**: Platform-agnostic cryptographic operations
- **Tracer**: Distributed tracing support
- **LRU Cache**: Efficient least-recently-used cache implementation
- **Path Operations**: Cross-platform path manipulation
- **HTTP Headers**: Type-safe HTTP header utilities
- **Poller**: Polling utilities with configurable intervals
- **Timeouted**: Timeout wrapper for async operations

## Installation

### npm (Node.js)

```bash
npm install @adviser/cement
```

### pnpm

```bash
pnpm add @adviser/cement
```

### Deno

```typescript
import { ... } from "jsr:@adviser/cement";
```

### Go

```bash
go get github.com/mabels/cement
```

## Usage

### Basic Example

```typescript
import { BuildBasicSystemService } from "@adviser/cement/node";

const sys = BuildBasicSystemService();
const logger = sys.Logger();

logger
  .Str("module", "app")
  .Info()
  .Log("Application started");

// Use file system operations
const fs = sys.FileSystem();
await fs.writeFile("output.txt", "Hello World");
```

### Platform-Specific Imports

```typescript
// Node.js
import { BuildBasicSystemService } from "@adviser/cement/node";

// Deno
import { BuildBasicSystemService } from "@adviser/cement/deno";

// Cloudflare Workers
import { BuildBasicSystemService } from "@adviser/cement/cf";

// Browser/Web
import { BuildBasicSystemService } from "@adviser/cement/web";
```

### Result Type for Error Handling

```typescript
import { Result } from "@adviser/cement";

function divide(a: number, b: number): Result<number> {
  if (b === 0) {
    return Result.Err(new Error("Division by zero"));
  }
  return Result.Ok(a / b);
}

const result = divide(10, 2);
if (result.isOk()) {
  console.log("Result:", result.unwrap());
} else {
  console.error("Error:", result.unwrapErr());
}
```

## Documentation

For comprehensive documentation, API references, and advanced usage examples, visit:

**[https://mabels.github.io/cement](https://mabels.github.io/cement)**

## Supported Platforms

- **Node.js** (>= 20.19.0)
- **Deno**
- **Cloudflare Workers**
- **Web Browsers**
- **Go** (>= 1.22.0)

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests for specific platform
pnpm test:js     # Node.js/JavaScript tests
pnpm test:deno   # Deno tests

# Build
pnpm build

# Lint
pnpm lint

# Format code
pnpm format
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

## Repository

- **GitHub**: [https://github.com/mabels/cement](https://github.com/mabels/cement)
- **Issues**: [https://github.com/mabels/cement/issues](https://github.com/mabels/cement/issues)
- **npm**: [@adviser/cement](https://www.npmjs.com/package/@adviser/cement)
- **JSR**: [@adviser/cement](https://jsr.io/@adviser/cement)
