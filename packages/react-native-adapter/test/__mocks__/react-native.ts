/**
 * Minimal react-native stub for vitest / jsdom tests.
 *
 * Hook tests (usePath, usePathContext, PathProvider) use only React core APIs.
 * PathShell tests render the shell through these stubs: each primitive maps to
 * a plain DOM element and forwards the props the tests assert on — `testID`
 * becomes `data-testid`, `Pressable`'s `disabled` / `onPress` become the
 * button's `disabled` / `onClick`. Layout, styling and keyboard behaviour are
 * not modelled.
 */

import { createElement } from "react";

const noop = (..._args: any[]) => null;

/**
 * Maps the accessibility props to their closest ARIA equivalents so tests can
 * assert them. React Native hands these to the platform accessibility APIs
 * rather than to the DOM, so this is an approximation — but asserting the props
 * are set at all is the point: the shell shipped with none of them, and screen
 * readers announced every control as static text.
 */
const domProps = (props: any) => ({
  "data-testid": props.testID,
  ...(props.accessibilityRole ? { role: props.accessibilityRole } : {}),
  ...(props.accessibilityLabel ? { "aria-label": props.accessibilityLabel } : {}),
  ...(props.accessibilityHint ? { "aria-description": props.accessibilityHint } : {}),
  ...(props.accessibilityLiveRegion ? { "aria-live": props.accessibilityLiveRegion } : {}),
  ...(props.accessibilityState?.disabled !== undefined
    ? { "aria-disabled": String(!!props.accessibilityState.disabled) }
    : {}),
  ...(props.accessibilityState?.busy !== undefined
    ? { "aria-busy": String(!!props.accessibilityState.busy) }
    : {}),
  ...(props.accessibilityValue?.now !== undefined
    ? {
        "aria-valuenow": String(props.accessibilityValue.now),
        "aria-valuemin": String(props.accessibilityValue.min ?? 0),
        "aria-valuemax": String(props.accessibilityValue.max ?? 100),
      }
    : {}),
  ...(props.accessibilityValue?.text ? { "aria-valuetext": props.accessibilityValue.text } : {}),
});

export const View = (props: any) => createElement("div", domProps(props), props.children);
export const Text = (props: any) => createElement("span", domProps(props), props.children);
export const Pressable = (props: any) =>
  createElement(
    "button",
    { ...domProps(props), type: "button", onClick: props.onPress, disabled: !!props.disabled },
    props.children
  );
export const ScrollView = (props: any) => createElement("div", domProps(props), props.children);
export const KeyboardAvoidingView = (props: any) => createElement("div", domProps(props), props.children);
export const TextInput = (props: {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  testID?: string;
  [k: string]: unknown;
}) =>
  createElement("input", {
    ...domProps(props),
    value: props.value ?? "",
    onChange: (e: any) => props.onChangeText?.(e.target.value),
    placeholder: props.placeholder,
  });
export const ActivityIndicator = noop;

export const Platform = {
  OS: "ios" as const,
  select: <T>(spec: Record<string, T>): T | undefined => spec.ios ?? spec.default,
};

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
  flatten: (style: any) => style,
  hairlineWidth: 1,
};

export type StyleProp<T> = T | null | undefined;
export type ViewStyle = Record<string, unknown>;
export type TextStyle = Record<string, unknown>;
