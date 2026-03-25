# Agent Profile AI Generation Modal

## Feature

Add a modal to the Agent Builder so creating a new agent can follow either a manual blank-profile path or an AI-assisted generation flow. The AI path should prompt for a short description of the agent and generate a new profile from that prompt.

## Why

The current create action immediately makes a blank profile. This adds a second, more guided path for users who want Claude to draft the profile structure and initial prompt for them.

## Acceptance Criteria

- Clicking the create button opens a modal instead of creating a profile immediately.
- The modal offers a blank/manual path and an AI-assisted generation path.
- The AI path accepts a prompt, generates a new profile, and selects it in the editor.
- Errors from generation are shown in the modal.
- The existing manual create flow still works.

## Checklist

- [ ] Add a shared request/response type for AI-generated agent profiles.
- [ ] Add a server endpoint that generates an agent profile from a prompt.
- [ ] Add a client API helper and hook method for generated profiles.
- [ ] Add a modal UI in the Agent Builder for manual vs AI creation.
- [ ] Add tests for the server route and the new modal flow.
- [ ] Manually verify the create flow in the desktop app.
