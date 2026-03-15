// commands/serve.ts — "runefeed serve" command implementation
//
// Re-exports the server's main function. The actual server logic lives
// in src/server/index.ts — this file just bridges the CLI command to it.

export { main } from '../../server/index.js';
// "export { main } from '...'" re-exports a named export from another module.
// When cli/index.ts does `await import('./commands/serve.js')`, it gets
// the same main() function defined in server/index.ts.
