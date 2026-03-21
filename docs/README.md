# Pathwrite Documentation

This directory contains all documentation and guides for the Pathwrite project.

---

## 📁 Directory Structure

### `/guides/` - Development & Implementation Guides

Comprehensive guides for developers using and contributing to Pathwrite:

- **[DEVELOPER_GUIDE.md](guides/DEVELOPER_GUIDE.md)** - Main developer documentation
- **[BEYOND_WIZARDS.md](guides/BEYOND_WIZARDS.md)** - Using Pathwrite beyond multi-step forms
- **[COMPETITIVE_ANALYSIS.md](guides/COMPETITIVE_ANALYSIS.md)** - How Pathwrite compares to alternatives
- **[AUTO_PERSISTENCE_SUMMARY.md](guides/AUTO_PERSISTENCE_SUMMARY.md)** - Auto-persistence feature implementation details
- **[PERSISTENCE_STRATEGY_GUIDE.md](guides/PERSISTENCE_STRATEGY_GUIDE.md)** - Detailed analysis of persistence strategies
- **[REST_API_PERSISTENCE_SUMMARY.md](guides/REST_API_PERSISTENCE_SUMMARY.md)** - REST API persistence implementation
- **[HTTP_STORE_STATUS.md](guides/HTTP_STORE_STATUS.md)** - HTTP store implementation status
- **[PUBLISHING.md](guides/PUBLISHING.md)** - Publishing and release process

---

## 🚀 Quick Start

**New to Pathwrite?** Start with the main [README.md](../README.md) in the project root.

**Exploring use cases?** See [BEYOND_WIZARDS.md](guides/BEYOND_WIZARDS.md) for non-wizard applications like:
- Single-page forms
- Shopping carts & checkout
- Backend workflows
- State machines

**Implementing persistence?** Check out:
1. [AUTO_PERSISTENCE_SUMMARY.md](guides/AUTO_PERSISTENCE_SUMMARY.md) - Overview
2. [PERSISTENCE_STRATEGY_GUIDE.md](guides/PERSISTENCE_STRATEGY_GUIDE.md) - Detailed guide
3. Package-specific README in `/packages/store-http/`

**Contributing?** See:
1. [DEVELOPER_GUIDE.md](guides/DEVELOPER_GUIDE.md)
2. [PUBLISHING.md](guides/PUBLISHING.md)

---

## 📚 Documentation Roadmap

### Planned Improvements

- [ ] Consolidate persistence guides into a single comprehensive guide
- [ ] Add architecture overview document
- [ ] Create migration guides for major version upgrades
- [ ] Add troubleshooting guide
- [ ] Create API reference documentation
- [ ] Add performance optimization guide
- [ ] Create testing best practices guide

---

## 🏗️ Guide Organization Plan

### Current State
We have multiple persistence-related documents that overlap:
- AUTO_PERSISTENCE_SUMMARY.md
- PERSISTENCE_STRATEGY_GUIDE.md
- REST_API_PERSISTENCE_SUMMARY.md

### Future State
These will be consolidated into:
- **PERSISTENCE_GUIDE.md** - Comprehensive persistence guide
  - Quick start
  - Strategy reference
  - Implementation examples
  - Advanced patterns
  - Performance optimization
  - Troubleshooting

---

## 📝 Contributing to Documentation

When adding new documentation:

1. **Guides** → Place in `/docs/guides/`
   - Implementation details
   - How-to guides
   - Architecture docs
   - Migration guides

2. **Package-specific** → Keep in package directory
   - `/packages/*/README.md` - User-facing docs
   - `/packages/*/CHANGELOG.md` - Version history

3. **Project root** → Only essential files
   - `README.md` - Main project overview
   - `LICENSE` - Project license



