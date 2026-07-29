---
trigger: always_on
---

# RESTROEX PROJECT CONTEXT

# Project Overview

Project Name:
Restroex

Category:
AI Restaurant Operating System

Current Stage:
Production SaaS under active development.

---

# Vision

Restroex is not a chatbot.

Restroex is an AI Employee.

The goal is to replace the first restaurant employee who takes orders over WhatsApp.

Customers should feel like they are chatting with a real restaurant employee.

The AI must understand natural language, maintain context, build orders, ask follow-up questions, handle modifications, and complete checkout naturally.

---

# Primary Goal

Restaurant owners should be able to operate their WhatsApp ordering business with minimal manual effort.

The system should be reliable enough that restaurant owners can trust it with real customers.

---

# Long-Term Vision

Restroex should become the operating system for restaurants.

Future modules may include:

Inventory

Kitchen Display

CRM

Marketing

Analytics

Payments

Loyalty

Staff Management

Delivery Management

Reports

AI Insights

Voice Ordering

Multi-Branch Management

---

# Product Philosophy

Every feature should solve a real restaurant problem.

Avoid unnecessary complexity.

Keep workflows simple.

Reduce manual work.

Reduce human errors.

Automate repetitive tasks.

---

# AI Philosophy

The AI should behave like an experienced restaurant employee.

The AI should:

Understand intent.

Ask clarification questions.

Remember conversation context.

Never confuse menu items.

Never invent prices.

Never invent menu items.

Never invent variants.

Never assume customer intent without sufficient confidence.

Always prioritize customer experience.

---

# Engineering Philosophy

Build software for production.

Not for demos.

Not for portfolios.

Not for tutorials.

Every implementation should survive production traffic.

---

# Architecture Philosophy

Respect the existing architecture.

Prefer extending existing modules.

Avoid unnecessary rewrites.

Avoid unnecessary abstractions.

Keep modules loosely coupled.

Keep responsibilities separated.

---

# Backend Philosophy

Controllers should stay thin.

Business logic belongs in services.

Validation must happen before processing.

Errors should be handled gracefully.

Never trust user input.

---

# Database Philosophy

The database is the source of truth.

Never hardcode business data.

Always verify schema before changes.

Prefer reusable queries.

Protect data integrity.

---

# Frontend Philosophy

Restaurant owners should learn the product quickly.

Keep interfaces simple.

Reduce unnecessary clicks.

Always show meaningful feedback.

Loading states matter.

Error states matter.

Empty states matter.

---

# Security Philosophy

Assume attackers exist.

Validate everything.

Authorize everything.

Protect customer data.

Protect restaurant data.

Protect API keys.

Protect secrets.

Never expose sensitive information.

---

# Performance Philosophy

Optimize for real production usage.

Avoid unnecessary database queries.

Avoid unnecessary API requests.

Think about scaling.

Measure before optimizing.

---

# User Experience Philosophy

Restaurant owners are not engineers.

Customers are impatient.

Every interaction should feel fast.

Every workflow should feel natural.

Every screen should reduce confusion.

---

# Code Quality Philosophy

Readable code is better than clever code.

Simple code is better than complex code.

Reusable code is better than duplicated code.

Maintainable code is better than short-term hacks.

---

# Decision Priority

Whenever multiple implementation options exist, prioritize:

1. Correctness

2. Security

3. Reliability

4. Maintainability

5. Scalability

6. Performance

7. Developer Experience

8. Speed of Development

Never sacrifice the first seven simply to implement something faster.

---

# Definition of Done

A feature is NOT complete until:

Business logic works.

Edge cases are handled.

Errors are handled.

Security has been considered.

Code follows architecture.

Code is understandable.

Implementation is production-ready.

Documentation is updated if required.

Testing has been considered.

---

# Final Responsibility

Every change should move Restroex closer to becoming the best AI Restaurant Operating System.

Never optimize for writing code quickly.

Optimize for building software that real businesses can trust.