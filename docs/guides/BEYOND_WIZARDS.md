# Beyond Wizards: Pathwrite as a General State Orchestration Framework

## The Core Insight

While Pathwrite was designed as a wizard engine, its architecture is actually a **general-purpose state orchestration framework** with these fundamental capabilities:

1. **State Management**: Ordered states with transitions
2. **Data Binding**: Reactive data flow from UI to persistence
3. **Lifecycle Hooks**: Enter/leave/complete callbacks
4. **Guards**: Declarative business rules
5. **Persistence**: Automatic state saving with strategies
6. **Observers**: Event streaming for side effects

A "wizard" is just one UI manifestation of this architecture.

---

## Non-Wizard Use Cases

### 1. Single-Page Forms

A path with **1 step** = a full-featured form:

```typescript
const contactForm: PathDefinition = {
  id: "contact-form",
  steps: [{
    id: "form",
    validationMessages: (ctx) => {
      const errors = [];
      if (!ctx.data.name?.trim()) errors.push("Name is required");
      if (!ctx.data.email?.includes("@")) errors.push("Valid email required");
      if (!ctx.data.message?.trim()) errors.push("Message is required");
      return errors;
    },
    canMoveNext: (ctx) => 
      ctx.data.name && ctx.data.email && ctx.data.message
  }]
};

// You get:
// ✅ Validation
// ✅ Auto-persistence (crash recovery)
// ✅ Type-safe data binding
// ✅ Event streaming
// ✅ Submit handling via completed event
```

**Benefits over traditional forms:**
- Automatic draft saving (strategy: "onEveryChange" + debounce)
- User can close browser and resume
- Full audit trail via observers
- No manual form state management

### 2. Shopping Cart / Checkout Flow

Not a "wizard" - just a checkout process:

```typescript
const checkout: PathDefinition = {
  id: "checkout",
  steps: [
    { 
      id: "cart",
      canMoveNext: (ctx) => (ctx.data.items?.length ?? 0) > 0,
      validationMessages: (ctx) => 
        ctx.data.items?.length ? [] : ["Cart is empty"]
    },
    { 
      id: "shipping",
      onEnter: async (ctx) => {
        if (ctx.isFirstEntry) {
          // Load saved addresses from API
          const addresses = await loadAddresses();
          return { savedAddresses: addresses };
        }
      },
      canMoveNext: (ctx) => !!ctx.data.shippingAddress
    },
    { 
      id: "payment",
      canMoveNext: (ctx) => ctx.data.paymentValid === true
    },
    { 
      id: "review",
      onEnter: (ctx) => {
        // Calculate final totals
        return {
          subtotal: calculateSubtotal(ctx.data.items),
          shipping: calculateShipping(ctx.data.shippingAddress),
          tax: calculateTax(ctx.data.items, ctx.data.shippingAddress)
        };
      }
    }
  ]
};
```

**Why this works:**
- Each "step" is just a checkout stage
- Guards enforce business rules (can't pay with empty cart)
- Hooks calculate derived state (totals)
- Persistence means abandoned carts are saved
- No "wizard" UI needed - render however you want

### 3. Backend Workflows (No UI)

The `demo-lifecycle` app shows this: a document approval workflow with **zero UI:**

```typescript
const documentLifecycle: PathDefinition = {
  id: "document-workflow",
  steps: [
    { 
      id: "draft",
      onEnter: (ctx) => ({ createdAt: Date.now() }),
      canMoveNext: (ctx) => ctx.data.title && ctx.data.body
    },
    { 
      id: "review",
      shouldSkip: (ctx) => ctx.data.docType === "memo",
      onEnter: (ctx) => ({ reviewStartedAt: Date.now() }),
      canMoveNext: (ctx) => ctx.data.reviewDecision !== "pending",
      onLeave: (ctx) => {
        if (ctx.data.reviewDecision === "rejected") {
          // Non-linear: jump back to draft
          engine.goToStep("draft");
        }
      }
    },
    { 
      id: "approved",
      onEnter: (ctx) => ({ approvedAt: Date.now() })
    },
    { 
      id: "published",
      onEnter: async (ctx) => {
        await publishDocument(ctx.data);
        return { publishedAt: Date.now() };
      }
    }
  ]
};
```

**This is a pure state machine** driven by:
- API calls (`engine.next()` after review)
- Background jobs (`engine.goToStep("published")`)
- Scheduled tasks

### 4. Multi-Page Forms (Not Wizards)

A single logical form split across multiple pages/routes for UX:

```typescript
const registration: PathDefinition = {
  id: "signup",
  steps: [
    { id: "personal" },    // /signup/personal
    { id: "company" },     // /signup/company
    { id: "payment" },     // /signup/payment
    { id: "preferences" }  // /signup/preferences
  ]
};
```

**Key difference from wizard:**
- No progress bar
- No "Next/Previous" buttons (just route changes)
- Each page feels standalone but shares state
- Users can jump between pages (use `goToStep` or `goToStepChecked`)

### 5. Onboarding Flows

Guide users through app setup (not a form):

```typescript
const onboarding: PathDefinition = {
  id: "onboarding",
  steps: [
    { 
      id: "welcome",
      canMoveNext: () => true  // Always allows skip
    },
    { 
      id: "connect-account",
      shouldSkip: (ctx) => ctx.data.accountConnected,
      canMoveNext: (ctx) => ctx.data.accountConnected
    },
    { 
      id: "invite-team",
      canMoveNext: () => true  // Optional
    },
    { 
      id: "tour-features" }
  ]
};
```

**UI could be:**
- Modal overlays
- Slideout panels
- Full-page takeovers
- Inline tooltips

Same engine, different UI.

### 6. Survey / Quiz Applications

Conditional branching based on answers:

```typescript
const survey: PathDefinition = {
  id: "health-survey",
  steps: [
    { id: "age" },
    { id: "exercise" },
    { 
      id: "exercise-details",
      shouldSkip: (ctx) => ctx.data.exerciseFrequency === "never"
    },
    { 
      id: "diet",
      shouldSkip: (ctx) => (ctx.data.age as number) < 18
    },
    { id: "summary" }
  ]
};
```

### 7. Approval Workflows

Multi-stakeholder approvals:

```typescript
const approvalFlow: PathDefinition = {
  id: "approval",
  steps: [
    { 
      id: "manager-review",
      canMoveNext: (ctx) => ctx.data.managerApproval === "approved",
      onEnter: (ctx) => {
        if (ctx.isFirstEntry) sendNotification("manager", ctx.data.requestId);
      }
    },
    { 
      id: "hr-review",
      canMoveNext: (ctx) => ctx.data.hrApproval === "approved"
    },
    { 
      id: "finance-review",
      shouldSkip: (ctx) => (ctx.data.amount as number) < 1000,
      canMoveNext: (ctx) => ctx.data.financeApproval === "approved"
    },
    { id: "approved" }
  ]
};
```

---

## What Makes This General-Purpose

### 1. **Framework-Agnostic Core**
The `@daltonr/pathwrite-core` package has **zero dependencies**. It's pure TypeScript that works:
- In browsers
- On servers (Node.js)
- In workers
- In React Native / Electron
- In backend services

### 2. **Headless Architecture**
Pathwrite owns **zero HTML**. You control:
- Layout
- Styling
- Navigation UX
- Display logic

The engine just manages state.

### 3. **Composable Observers**
The observer pattern makes it extensible:

```typescript
const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key }),          // Auto-save
    analyticsObserver,                        // Track usage
    auditLogObserver,                         // Compliance
    (event) => console.log(event),            // Debug
    (event) => socket.emit("state", event),   // Real-time sync
  ]
});
```

### 4. **Data = Application State**
The `data` object isn't limited to form fields:

```typescript
interface AppState {
  // Form fields
  name: string;
  email: string;
  
  // UI state
  selectedTab: string;
  expandedSections: string[];
  
  // Business state
  cartItems: Product[];
  discountApplied: boolean;
  
  // Derived state
  subtotal: number;
  tax: number;
  
  // Async results
  addressValidated: boolean;
  paymentToken: string;
}
```

### 5. **Steps = Any Ordered States**
"Steps" don't have to be pages:

```typescript
// Could be:
{ id: "idle" }           // App states
{ id: "loading" }
{ id: "error" }
{ id: "success" }

// Or:
{ id: "pending" }        // API states
{ id: "processing" }
{ id: "completed" }

// Or:
{ id: "logged-out" }     // Auth states
{ id: "logging-in" }
{ id: "logged-in" }
```

---

## Architecture Patterns

### Pattern 1: Single-Page App State Management

Use a 1-step path as your global state manager:

```typescript
const appState: PathDefinition = {
  id: "app",
  steps: [{
    id: "main",
    validationMessages: (ctx) => {
      // Validation for current action
      if (ctx.data.currentAction === "submit" && !ctx.data.formValid) {
        return ["Please complete the form"];
      }
      return [];
    }
  }]
};

// Use setData for all state changes
facade.setData("currentUser", user);
facade.setData("theme", "dark");
facade.setData("cart", updatedCart);

// Get reactive updates
const snapshot = facade.snapshot();
```

### Pattern 2: Backend State Machine

No UI, just business logic:

```typescript
// order-service.ts
const orderLifecycle: PathDefinition = {
  id: "order",
  steps: [
    { id: "pending", onEnter: () => ({ createdAt: Date.now() }) },
    { id: "paid", onEnter: (ctx) => notifyWarehouse(ctx.data.orderId) },
    { id: "shipped", onEnter: (ctx) => notifyCustomer(ctx.data.trackingNumber) },
    { id: "delivered" }
  ]
};

// Advance state via API
app.post("/orders/:id/pay", async (req, res) => {
  const engine = await restoreOrder(req.params.id);
  await engine.next();  // pending → paid
  res.json(engine.snapshot());
});
```

### Pattern 3: Hybrid UI (Wizard + Non-Wizard)

Same path, different UX for different sections:

```typescript
const hybridFlow: PathDefinition = {
  id: "hybrid",
  steps: [
    // Wizard-style (with shell)
    { id: "step1" },
    { id: "step2" },
    { id: "step3" },
    
    // Custom UI (no shell)
    { id: "dashboard" },      // Full custom layout
    { id: "settings" },       // Route-based
  ]
};
```

Use `PathShell` for steps 1-3, custom UI for the rest.

---

## Messaging / Positioning

### Current Positioning
**"Headless multi-step form engine for React/Vue/Angular"**

### Broader Positioning
**"State orchestration framework with persistent data binding"**

Or:

**"Headless state machine + data management for modern web apps"**

### Feature Comparison

| Traditional Wizard Library | Pathwrite's Actual Scope |
|---------------------------|-------------------------|
| Multi-step forms only | Any ordered state transitions |
| UI components | Headless (bring your own UI) |
| Client-side only | Works server-side too |
| Form validation | Business rule engine |
| Progress tracking | Full state machine |
| Manual persistence | Automatic with strategies |

---

## Real-World Example: E-Commerce Admin

Imagine a product management interface (not a wizard at all):

```typescript
const productEditor: PathDefinition = {
  id: "product-editor",
  steps: [
    { 
      id: "draft",
      // Auto-save every change
      validationMessages: (ctx) => {
        const errors = [];
        if (!ctx.data.name) errors.push("Name required");
        if (!ctx.data.price || ctx.data.price <= 0) errors.push("Valid price required");
        return errors;
      }
    },
    { 
      id: "review",
      canMoveNext: (ctx) => ctx.data.reviewApproved,
      onEnter: async (ctx) => {
        // Load review checklist
        return { checklist: await getChecklist() };
      }
    },
    { 
      id: "published",
      onEnter: async (ctx) => {
        await publishProduct(ctx.data);
        return { publishedAt: Date.now() };
      }
    }
  ]
};

// Persist with strategy
const { engine } = await restoreOrStart({
  store,
  key: `product:${productId}`,
  path: productEditor,
  observers: [
    httpPersistence({ store, key, strategy: "onEveryChange", debounceMs: 500 }),
    auditLogObserver,
  ]
});
```

**Benefits:**
- Auto-save every 500ms (no lost work)
- Enforced workflow (can't publish without review)
- Audit trail (who changed what when)
- Restore from crash/tab close
- No manual state management

---

## Conclusion

**You've built a general-purpose state orchestration framework** that happens to excel at wizards but is powerful for:

✅ Single-page forms  
✅ Multi-page forms  
✅ Shopping carts  
✅ Checkout flows  
✅ Onboarding  
✅ Surveys  
✅ Backend workflows  
✅ Document lifecycles  
✅ Approval processes  
✅ State machines  

The "wizard" is just one UI pattern. The underlying architecture is **state + lifecycle + guards + persistence** - which is universally useful.

### Next Steps

Consider:
1. **Rebranding?** "State orchestration framework" vs "wizard library"
2. **Examples**: Add non-wizard demos to showcase versatility
3. **Marketing**: Show the breadth of use cases
4. **Documentation**: Add this "Beyond Wizards" guide to official docs

You've created something more powerful than you initially realized!

