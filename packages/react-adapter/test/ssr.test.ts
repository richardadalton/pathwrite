// @vitest-environment node
//
// Server-side rendering (review finding A6): the adapter must render through
// react-dom/server without throwing and without React warnings.

import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PathDefinition } from "@daltonr/pathwrite-core";
import { PathShell, PathProvider, usePath, usePathContext, useField, FieldError } from "../src/index";

const path: PathDefinition = {
  id: "ssr",
  steps: [
    { id: "details", title: "Details", fieldErrors: ({ data }) => (data.name ? {} : { name: "Required" }) },
    { id: "done", title: "Done" }
  ]
};

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { errorSpy = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { errorSpy.mockRestore(); });

describe("React adapter — server-side rendering", () => {
  it("usePath renders on the server with a null snapshot", () => {
    function Probe() {
      const { snapshot } = usePath();
      return createElement("p", null, snapshot ? "active" : "no path");
    }
    const html = renderToString(createElement(Probe));
    expect(html).toContain("no path");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("PathShell renders its empty state on the server (start() runs in an effect, which the server never runs)", () => {
    const html = renderToString(createElement(PathShell, {
      path,
      steps: { details: createElement("div", null, "Details"), done: createElement("div", null, "Done") }
    } as any));
    expect(html).toContain("pw-shell");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("PathProvider renders its fallback on the server (start() only runs in a client effect)", () => {
    const html = renderToString(createElement(PathProvider, { path, fallback: createElement("p", null, "loading") }, createElement("p", null, "child")));
    expect(html).toContain("loading");
    expect(html).not.toContain("child");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("useField and <FieldError> render on the server under an already-started engine, without warnings", async () => {
    const { PathEngine } = await import("@daltonr/pathwrite-core");
    const engine = new PathEngine();
    await engine.start(path, { name: "" });
    function NameField() {
      const name = useField<{ name: string; [k: string]: unknown }, "name">("name");
      return createElement("div", null,
        createElement("input", { value: name.value, onChange: name.onChange }),
        createElement(FieldError, { field: "name" })
      );
    }
    const html = renderToString(createElement(PathProvider, { engine }, createElement(NameField)));
    expect(html).toContain("<input");
    // useLayoutEffect on the server would log "useLayoutEffect does nothing on the server"
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
