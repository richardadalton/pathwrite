// @vitest-environment node
//
// Static / server rendering (e.g. Expo Router web export) goes through
// react-dom/server: the hook must supply a server snapshot.

import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PathDefinition } from "@daltonr/pathwrite-core";
import { PathShell, usePath } from "../src/index";

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { errorSpy = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { errorSpy.mockRestore(); });

describe("React Native adapter — server rendering", () => {
  it("usePath renders on the server with a null snapshot", () => {
    function Probe() {
      const { snapshot } = usePath();
      return createElement("p", null, snapshot ? "active" : "no path");
    }
    expect(renderToString(createElement(Probe))).toContain("no path");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("PathShell renders its empty state on the server", () => {
    const path: PathDefinition = { id: "ssr", steps: [{ id: "a" }, { id: "b" }] };
    const html = renderToString(createElement(PathShell, { path, steps: { a: createElement("span", null, "A"), b: createElement("span", null, "B") } } as any));
    expect(html).toContain("No active path");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
