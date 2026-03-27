/**
 * Minimal react-native stub for vitest / jsdom tests.
 * Hook tests (usePath, usePathContext, PathProvider) use only React core APIs
 * and never render PathShell, so we only need these stubs to satisfy the
 * module graph — they are not called at runtime during the test suite.
 */

import { createElement } from "react";

const noop = (..._args: any[]) => null;

export const View = (props: any) => createElement("div", null, props.children);
export const Text = (props: any) => createElement("span", null, props.children);
export const Pressable = (props: any) => createElement("button", { onClick: props.onPress }, props.children);
export const ScrollView = (props: any) => createElement("div", null, props.children);
export const ActivityIndicator = noop;

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
  flatten: (style: any) => style,
  hairlineWidth: 1,
};

export type StyleProp<T> = T | null | undefined;
export type ViewStyle = Record<string, unknown>;
export type TextStyle = Record<string, unknown>;
