Can this product be used by developers in a way that won't put them off?  The simplicity of a boolean check is the reason it persists.  How much extra work will a dev have to do to use Authwrite?  How can we minimise the boilerplate?Will a dev who wants to quickly get an app up and running be frustrated by having to create policies to open up that app, and thus abandon Authwrite in favour of boolean checks that will lead to a problem for someone else later?01:09This is the most important product design question for the whole project. The boolean check persists because if (user.isAdmin) takes 5 seconds to write. If AuthEngine's "getting started" path is longer than 30 seconds, developers will bounce.
Let me think through this honestly.This is the right question to ask, and it needs an honest answer before the product goes any further. Let me map the real friction.
The core problem is a mode mismatch. A developer building a prototype is in "make it work" mode. AuthEngine, as designed, asks them to be in "make it right" mode from line one. Those are incompatible mental states, and "make it right" loses every time before the app is real.
Here's how we solve it — three interlocking ideas:
::view-transition-group(*),
::view-transition-old(*),
::view-transition-new(*) {
animation-duration: 0.25s;
animation-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
}
VvisualizeVvisualize show_widgetIdea 1: mode: 'dev' — allow everything, log everything
The environment flag changes the entire posture of the engine. In dev, nothing is blocked — but every unevaluated request is logged with a clear message telling you what policy rule you'd need to write. The developer can build their whole app first, then look at the log and harden it.
tsconst engine = createAuthEngine({
policy: documentPolicy,   // optional in dev mode
mode: process.env.NODE_ENV === 'production' ? 'enforce' : 'dev',
})

// In dev mode with no matching policy:
// [authwrite] WARN: No policy covers posts:read for user u1
//             Add this rule to your policy to silence this warning:
//             { id: 'posts-read', match: ..., allow: ['read'] }
//
// Request still succeeds. App still works.
When they're ready to ship, they flip NODE_ENV=production and the engine switches to strict enforcement. The warnings become the to-do list.

Idea 2: infer() — meet them where they are
This is the real unlock. Instead of asking developers to abandon their existing patterns, you let them annotate what they're already doing. The infer() call wraps a boolean check and teaches AuthEngine about the shape of their authorization logic — without requiring a full policy up front.
tsimport { infer } from '@authwrite/core'

// Before AuthEngine — what devs write today:
if (post.userId !== req.user.id) return res.status(403).send()

// With infer() — same logic, same result, but now AuthEngine is learning:
if (!infer('posts:write', req.user, post, () => post.userId === req.user.id)) {
return res.status(403).send()
}
The infer call passes the subject, resource, action, and the boolean condition. It evaluates identically to before — the developer's app still works — but AuthEngine is now recording: "whenever post.userId === subject.id, allow posts:write." Run your app in infer mode for a week, then call engine.exportPolicy() and it hands you back a generated PolicyDefinition based on your actual real-world conditions.
ts// After a week of infer() calls:
const generated = engine.exportPolicy()
// → PolicyDefinition with rules inferred from your actual logic
// Review, tweak, commit. You're done.

Idea 3: allow() — the explicit escape hatch
For developers who genuinely don't have complex auth yet — early prototypes, internal tools, toy projects — give them a named escape hatch that's honest about what it is. It's a one-liner, it's self-documenting, and it produces a warning in production so they can't forget about it.
ts// This is better than if (user) return true
// because it's tracked, named, and produces a production warning
const engine = createAuthEngine({
policy: {
id: 'app-policy',
defaultEffect: 'allow',   // ← the honest escape hatch
rules: [],
// AuthEngine logs: "⚠ defaultEffect: 'allow' — all requests permitted.
//                   Set a real policy before production."
}
})
The developer gets zero friction. AuthEngine is installed and working. But unlike a bare boolean, this creates a production warning they'll actually see, and the exportPolicy() path is always one step away when they're ready.

Here's the graduated journey those three ideas create — from zero friction to full policy, with no cliff edge:
::view-transition-group(*),
::view-transition-old(*),
::view-transition-new(*) {
animation-duration: 0.25s;
animation-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
}
VvisualizeVvisualize show_widgetThe crucial thing about this ladder is that there's no point where a developer has to stop and think about authorization before they can continue building. They can go from Stage 0 to Stage 1 in two minutes with no behaviour change. Stage 2 is a mechanical find-and-replace of their existing boolean checks. The policy writes itself.

One more thing: the README has to nail the opening
The existing AuthEngine design docs lead with the rich API. The README has to lead differently — with the fastest path to working:
npm install @authwrite/core @authwrite/express

# That's it. Your app works immediately.
# Add this and forget about auth until you're ready to ship:

const engine = createAuthEngine({ policy: { defaultEffect: 'allow', rules: [] } })

# When you're ready to harden, run:
engine.exportPolicy()
# It tells you exactly what to do next.
The boolean check wins because it's right there — one line, no imports, no concepts, no friction. The job of the onboarding experience is to make AuthEngine feel just as frictionless for the prototype stage, while quietly building the structure that makes the hardening stage trivial.
The key insight is: don't compete with the boolean check at the prototype stage. Win at the production stage, and make the path from one to the other invisible.