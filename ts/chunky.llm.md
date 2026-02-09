# Chunky Implementation Session Summary

## Overview

This session implemented a `chunky` utility for processing iterables in chunks with configurable split conditions and commit callbacks. The journey involved significant architectural evolution, ultimately arriving at a clean separation between synchronous and asynchronous variants.

## Evolution of the Implementation

### Stage 1: Initial Requirements
The user provided a test showing the desired behavior:
- Process 100 items in chunks based on a split condition (`splitCondition`)
- Execute a commit callback when chunks are ready
- Track commit results with `onCommit` callback
- Support both success and error cases

### Stage 2: Type System Challenges
**Problem**: How to support both sync and async commit functions with proper type inference?

**Attempts**:
1. Conditional return types with complex generics
2. Hit TypeScript limitation: "void is only valid as a return type or generic type argument"
3. Function overloads to discriminate between sync/async variants

### Stage 3: The Infinite Iterable Problem
**Critical Discovery**: Original implementation collected all promises in an array before processing - would fail with infinite iterables.

```typescript
// ❌ Original problematic approach
const promises = [];
for (const item of input) {
  chunked.push(item);
  if (splitCondition(chunked)) {
    promises.push(commit(chunked));  // Collects infinitely!
  }
}
await Promise.allSettled(promises);
```

**User Insight**: "you see hopefully the problem with your implementation i we change input: T[] to input: iterable<T> then the allSettles with receive a infinitly big array"

### Stage 4: The Breakthrough
**Root Cause Identified**: "the root problem is that we don't know if the return value of commit is a promise or not before calling it"

**Solution**: Split into two separate functions:
- `chunkySync`: For synchronous commit functions
- `chunkyAsync`: For asynchronous commit functions, properly awaiting each commit before consuming the next item

```typescript
// ✅ Async variant - awaits each commit
for (const item of options.input) {
  chunked.push(item);
  if (options.splitCondition(chunked)) {
    await doCommit(chunked);  // Wait before consuming next item
    chunked = [];
  }
}
```

### Stage 5: Type Composition Refinement
Refactored to use a base interface with type composition:

```typescript
export interface ChunkyBaseOptions<T> {
  readonly input: Iterable<T>;
  splitCondition(chunked: T[]): boolean;
  onCommit?(result: Result<void>, idx: number): void;
}

export type ChunkySyncOptions<T> = ChunkyBaseOptions<T> & {
  commit(chunked: T[]): void;
};

export type ChunkyAsyncOptions<T> = ChunkyBaseOptions<T> & {
  commit(chunked: T[]): Promise<void>;
};
```

## Final Implementation

### Files Created

#### [chunky.ts](src/chunky.ts)
- **ChunkyBaseOptions<T>**: Base interface with shared configuration
- **ChunkySyncOptions<T>**: Sync-specific type with void commit
- **ChunkyAsyncOptions<T>**: Async-specific type with Promise commit
- **chunkySync()**: Processes chunks synchronously
- **chunkyAsync()**: Processes chunks asynchronously with proper await semantics

#### [chunky.test.ts](src/chunky.test.ts)
Comprehensive test coverage:
- Edge cases: empty arrays, single items
- Clean cuts: 100 items → 10 chunks of 10
- Uneven splits: 100 items → 12 chunks of 8 + 1 chunk of 4
- Both arrays and generators
- Commit ordering verification for sync and async variants

## Key Technical Decisions

1. **Use Project Utilities**: Integrated existing `exception2Result`, `Result` type, and `isPromise` from the codebase
2. **Separate Functions Over Polymorphism**: Eliminated runtime type checking by having distinct sync/async functions
3. **Sequential Processing**: Async variant waits for each commit before consuming the next item from the iterable
4. **Type Composition**: Used intersection types to compose options from a shared base
5. **Error Resilience**: Wrapped all commits with `exception2Result` to prevent abortion on errors

## Test Coverage

### Parameterized Tests (describe.each)
- Empty array (0 commits expected)
- Clean cut: 100 items, split at 10 (10 commits of 10 items)
- Uneven split: 100 items, split at 8 (12 commits of 8, 1 commit of 4)
- Clean cut with generator: 100 items, split at 10 (10 commits of 10 items)
- Uneven split with generator: 100 items, split at 8 (12 commits of 8, 1 commit of 4)
- Single item (1 commit expected)

### Ordering Tests
- Sync commits execute in order
- Async commits execute sequentially despite varying delays
- onCommit callbacks fire in correct order

## Benefits of Final Design

### For Infinite Iterables
The async variant properly handles infinite iterables by awaiting each commit before consuming the next item:

```typescript
function* infiniteStream() {
  let i = 0;
  while (true) yield i++;
}

await chunkyAsync({
  input: infiniteStream(),
  splitCondition: (chunked) => chunked.length >= 1000,
  commit: async (chunk) => {
    await processChunk(chunk);  // Processes in controlled batches
  }
});
```

### Type Safety
TypeScript correctly infers return types without runtime checks:
- `chunkySync()` returns `void`
- `chunkyAsync()` returns `Promise<void>`

### No Runtime Overhead
Eliminated `isPromise` checks and conditional branching - the type system handles everything at compile time.

### Error Handling
All commit errors are captured in `Result` type and passed to `onCommit`, allowing graceful handling without aborting the entire process.

## Suggested Commit Message

```
feat(chunky): split into sync and async variants with type composition

Split chunky into chunkySync and chunkyAsync functions with dedicated type
signatures. Introduces ChunkyBaseOptions<T> with shared config, composed with
sync/async-specific commit function types. Removes runtime type checking and
enables proper await-before-next-item semantics for infinite iterables.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Lessons Learned

1. **TypeScript Limitations**: Conditional return types with `void` have restrictions; function overloads or separate functions are often clearer
2. **Async Pitfalls**: Collecting promises from iterables can cause memory issues with infinite sources
3. **Type vs Runtime**: Sometimes separating at the function level is cleaner than trying to handle both cases in one implementation
4. **Sequential Control Flow**: For async operations on iterables, explicit `await` in the loop provides the clearest control flow
