export {};

declare global {
  interface CacheStorage {
    readonly default: Cache;
  }

  interface RewriterElement {
    remove(): void;
    setAttribute(name: string, value: string): void;
    setInnerContent(content: string, options?: { html?: boolean }): void;
    before(content: string, options?: { html?: boolean }): void;
    prepend(content: string, options?: { html?: boolean }): void;
  }

  interface HTMLRewriterHandler {
    element?(element: RewriterElement): void | Promise<void>;
  }

  interface HTMLRewriter {
    on(selector: string, handlers: HTMLRewriterHandler): HTMLRewriter;
    transform(response: Response): Response;
  }

  var HTMLRewriter: {
    prototype: HTMLRewriter;
    new (): HTMLRewriter;
  };
}
