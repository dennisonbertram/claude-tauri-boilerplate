# Runbook: Testing

## Prerequisites
- Node.js installed
- Project dependencies installed (`npm install` or equivalent)

## Running Tests

### Full Test Suite
```bash
npm test
```

### Single Test File
```bash
npm test -- path/to/test.spec.ts
```

### Watch Mode
```bash
npm test -- --watch
```

## TDD Workflow

1. **Write the test first** — describe expected behavior
2. **Run it** — confirm it fails (red)
3. **Implement the feature** — minimum code to pass
4. **Run again** — confirm it passes (green)
5. **Refactor** — clean up while tests still pass

## Test Quality Checklist

- [ ] Tests cover happy path
- [ ] Tests cover error/edge cases
- [ ] Tests are not trivial (no `expect(true).toBe(true)`)
- [ ] Tests have meaningful assertions
- [ ] Tests are independent (no order dependency)
- [ ] Test names describe the behavior being tested

## When a Bug is Found

1. Add entry to `docs/logs/engineering-log.md`
2. Write a regression test that reproduces the bug (should fail)
3. Fix the bug
4. Confirm the regression test passes
5. Create a GitHub issue if the bug was significant

## Pre-Commit Checklist

- [ ] All tests pass
- [ ] No skipped tests (`.skip`) unless documented
- [ ] New code has corresponding tests
