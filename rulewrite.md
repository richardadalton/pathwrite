# rulewrite — composable business rules for TypeScript

> rulewrite brings the Specification Pattern to TypeScript: capture each business rule as a named, typed predicate, compose rules with logical operators (`and`, `or`, `not`, `implies`, `prevents`), project them across types with `.on()`, apply them over collections with `someOf`/`allOf`/`noneOf`, and evaluate them either as a boolean (`isSatisfiedBy`) or as a full explainable result tree (`evaluate`) for diagnostics, audit logs, and UI feedback.

- npm: `@daltonr/rulewrite`
- Repo: https://github.com/richardadalton/rulewrite — docs in `docs/` (quickstart, developer guide, API reference); runnable examples in `examples/` (checkout, authorization, attendance).
- License: MIT. Zero dependencies.

## Quick start

```ts
import { rule } from '@daltonr/rulewrite';

const isAdult    = rule<User>(u => u.age >= 18, 'IsAdult');
const isVerified = rule<User>(u => u.emailVerified, 'IsVerified');

const canRegister = isAdult.and(isVerified);

canRegister.isSatisfiedBy(user);  // boolean
canRegister.evaluate(user);       // full evaluation tree
```

## API

### `rule<T>(predicate, label)`

```ts
function rule<T>(predicate: (value: T) => boolean, label: string): Rule<T>
```

Creates an atomic rule — a named predicate over a single type. The label appears in evaluation output.

### `Rule<T>`

```ts
interface Rule<T> {
  isSatisfiedBy(value: T): boolean;
  evaluate(value: T): EvaluationResult;

  and(other: Rule<T>): Rule<T>;       // both must be satisfied
  or(other: Rule<T>): Rule<T>;        // at least one satisfied
  not(): Rule<T>;                     // must not be satisfied
  implies(other: Rule<T>): Rule<T>;   // if A satisfied, B must be too (false only when A && !B)
  prevents(other: Rule<T>): Rule<T>;  // A and B cannot both be satisfied (NAND)

  on<C>(selector: (ctx: C) => T): Rule<C>;         // project into a wider context
  someOf<C>(selector: (ctx: C) => T[]): Rule<C>;   // at least one item satisfies (empty → false)
  allOf<C>(selector: (ctx: C) => T[]): Rule<C>;    // all items satisfy (empty → true, vacuous)
  noneOf<C>(selector: (ctx: C) => T[]): Rule<C>;   // no items satisfy (empty → true)
}
```

### `EvaluationResult`

```ts
interface EvaluationResult {
  satisfied: boolean;
  label: string;                    // e.g. 'IsAdult', 'AND', 'IMPLIES'
  children?: EvaluationResult[];    // per-operand results, recursively
}
```

## Composition patterns

```ts
// Chaining
const eligible = isAdult.and(isVerified).and(isActive);
const allowed  = isOwner.or(isAdmin);
const flagged  = hasPendingPayment.prevents(canWithdraw);
const policy   = containsAlcohol.implies(isAgeVerified);
// implies captures conditional requirements: "IF the order contains alcohol,
// the customer must be age-verified" — an AND would demand verification on every order.

// Projecting single-type rules into a context
type OrderContext = { customer: User; product: Product };
const customerIsAdult = isAdult.on((ctx: OrderContext) => ctx.customer);

// Cross-type rules are written directly against the context
const withinBudget = rule<OrderContext>(
  ctx => ctx.product.price <= ctx.customer.creditLimit, 'WithinBudget');

// Collections
type Team = { members: User[] };
const allAdults = isAdult.allOf<Team>(t => t.members);
```

## Why rules instead of plain functions?

Plain predicates compose with `&&`/`||` but lose structure. rulewrite rules carry their composition tree, so you can **explain** a decision, not just compute it — `evaluate()` shows exactly which sub-rule passed or failed, recursively. `.on()` keeps rules focused on one type and projects them into wider contexts only at the composition site, so the same `isAdult` works on a `User`, a `Department.leader`, or any field of any context.
