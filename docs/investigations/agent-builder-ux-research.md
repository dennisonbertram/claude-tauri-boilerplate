# Visual Agent Builder UX Research

**Date:** 2026-03-19
**Purpose:** Research visual agent builder UX patterns and existing tools to inform the design of a visual configuration interface for Claude Code hooks, agent profiles, and workflow automation within the claude-tauri-boilerplate desktop app.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Existing Visual Agent Builders](#existing-visual-agent-builders)
   - [n8n](#n8n)
   - [Langflow](#langflow)
   - [Flowise](#flowise)
   - [Dify](#dify)
   - [ComfyUI](#comfyui)
   - [Sim Studio](#sim-studio)
   - [OpenAI Agent Builder / AgentKit](#openai-agent-builder--agentkit)
   - [MindStudio](#mindstudio)
   - [VS Code AI Toolkit Agent Builder](#vs-code-ai-toolkit-agent-builder)
3. [Visual Workflow Builders (Zapier, Make.com)](#visual-workflow-builders-zapier-makecom)
4. [Agent Configuration UI Patterns](#agent-configuration-ui-patterns)
5. [Best Practices for Visual Programming UIs](#best-practices-for-visual-programming-uis)
6. [ComfyUI Deep Dive: Node Graphs for AI Workflows](#comfyui-deep-dive-node-graphs-for-ai-workflows)
7. [React Implementation Libraries](#react-implementation-libraries)
8. [Application to Claude Code Hooks](#application-to-claude-code-hooks)
9. [Recommended UX Patterns for Our App](#recommended-ux-patterns-for-our-app)
10. [Sources](#sources)

---

## Executive Summary

The visual agent builder space has matured rapidly, with 2026 being called "the year of the node-based editor." The convergence of AI models and visual programming has created a new generation of tools that let users configure complex AI behaviors without writing code. Key patterns that emerge across all tools:

1. **Canvas + Nodes + Edges** is the dominant paradigm for complex workflows (n8n, Langflow, ComfyUI, Flowise, OpenAI AgentKit)
2. **Form-based configuration panels** work better for simpler agent setup (VS Code AI Toolkit, MindStudio, Dify)
3. **Trigger-Condition-Action** is the universal pattern for automation workflows (Zapier, Make.com, n8n)
4. **JSON serialization** is the standard for saving/loading/sharing configurations (ComfyUI, Node-RED, Langflow)
5. **Progressive disclosure** keeps interfaces manageable -- show simple options first, reveal complexity on demand (Sim Studio skills, MindStudio)
6. **Real-time preview and testing** is expected in every tool -- users need to see what their configuration does immediately

For our use case (configuring Claude Code hooks, agent profiles, and trigger-condition-action flows), a **hybrid approach** is recommended: a form-based configuration panel for simple hook/profile setup, with an optional node-based canvas for complex multi-step workflows.

---

## Existing Visual Agent Builders

### n8n

**What it is:** Fair-code workflow automation platform with native AI capabilities. Over 400 integrations with a visual drag-and-drop builder.

**Key UX patterns:**
- **Drag-and-drop workflow builder** that is "clean and responsive" -- users report building a Google Sheets to Slack automation with data filtering in ~15 minutes
- **Real-time execution preview** -- as you configure each node, sample output data appears immediately next to settings, eliminating guesswork
- **AI Workflow Builder (text-to-workflow)** -- describe what you want in natural language and it auto-generates a working workflow with nodes, logic, and configuration
- **Node categories for AI workflows:**
  - Agent Nodes: central orchestrators connecting to LLMs and managing context
  - Action Nodes: execute tasks (send emails, update databases)
  - Utility Nodes: transform and filter data
  - Memory & Vector Store Nodes: context retention and semantic search

**Relevance to our project:** n8n's real-time execution preview is highly relevant -- when configuring a Claude Code hook, the user should see sample input/output for the hook event immediately. The text-to-workflow feature is aspirational but shows the direction the field is heading.

### Langflow

**What it is:** Low-code AI builder for agentic and RAG applications, backed by DataStax.

**Key UX patterns:**
- **Node-based workspace** with a component sidebar -- drag components from sidebar onto canvas, connect them to form a pipeline
- **Built-in Agent node** that abstracts the iterative loop -- configure instructions and model, attach other components as tools
- **Interactive playground** for immediate testing and refinement with step-by-step control
- **JSON export/import** -- all flows are JSON, can be exported, imported, shared, and even deployed as MCP servers
- **Multi-agent orchestration** with conversation management

**Relevance to our project:** Langflow's approach of having a dedicated "Agent" node with configurable instructions, model selection, and attached tools maps well to configuring Claude Code agent profiles. The JSON export format is directly applicable to saving/loading hook configurations.

### Flowise

**What it is:** Open-source drag-and-drop UI for building LLM apps. YC-backed (Flowise 3.0).

**Key UX patterns:**
- **Canvas-based visual builder** where the entire AI pipeline is visible at a glance: data sources -> embeddings -> vector stores -> retrieval -> LLM prompts
- **Two workflow types:** Chatflows (single-agent) and Agentflows (multi-agent with loops and conditional branching)
- **Modular building blocks:** nodes for LLMs, prompts, tools, retrievers, memory, and control flow
- **Reusable subgraphs** for common patterns (ingestion, RAG, post-processing, evaluation)
- **Visual trace debugging** -- when something breaks, trace where the problem is visually. Share traces publicly for review
- **Flow validation** -- automatically checks for common misconfigurations and errors before execution

**Relevance to our project:** Flowise's flow validation concept is critical for hook configuration -- we should validate hook configurations before saving (e.g., check that command paths exist, matchers are valid regex, required fields are filled). The reusable subgraph pattern could apply to "hook templates" that users can share.

### Dify

**What it is:** Production-ready platform for agentic workflow development.

**Key UX patterns:**
- **Visual canvas** for building and testing AI workflows with drag-and-drop nodes
- **Clean, modern interface** designed for non-technical users -- "intuitive experience" with minimal cognitive load
- **Function blocks** organized as "Home," "Tools," and "Knowledge Base" -- clear information architecture
- **Per-node debugging** -- intuitively view and modify each node's output variables, instantly see downstream impact
- **Step-by-step execution** with inspection pauses at each node
- **Configuration via prompts** rather than code -- guide agent behavior through natural language instructions

**Relevance to our project:** Dify's per-node debugging and step-by-step execution directly maps to testing hook configurations -- users should be able to "dry run" a hook against a sample tool call and see what would happen. The clean, modern interface approach fits our Tailwind CSS v4 aesthetic.

### ComfyUI

**What it is:** The most powerful and modular diffusion model GUI with a graph/nodes interface.

**Key UX patterns:**
- **Full node graph** with typed connections -- each node represents a step, edges represent data flow (latent tensors, images, conditioning)
- **Non-linear workflows** -- branch, remix, adjust any part without starting over
- **Complete reproducibility** -- every parameter captured in the visual graph, can be saved/shared/restored exactly
- **Workflow embedded in output** -- the workflow JSON is automatically saved in image metadata
- **Massive community extension ecosystem** -- hundreds of custom nodes
- **Professional tool familiarity** -- design mirrors Nuke and Blender's shader graph

**JSON workflow format:**
```json
{
  "nodes": [
    {
      "id": 1,
      "type": "KSampler",
      "pos": [400, 200],
      "size": [315, 262],
      "widgets_values": ["euler", "normal", 20, 8.0],
      "inputs": [
        { "name": "model", "type": "MODEL", "link": 1 }
      ],
      "outputs": [
        { "name": "LATENT", "type": "LATENT", "links": [7] }
      ]
    }
  ],
  "links": [
    [1, 4, 0, 3, 0, "MODEL"]
  ],
  "groups": [
    { "title": "Sampling", "bounding": [350, 150, 400, 350] }
  ]
}
```

**Relevance to our project:** ComfyUI's approach to workflow serialization (JSON with node positions, widget values, typed connections) is the gold standard for save/load/share functionality. The "workflow embedded in output" concept is interesting -- hook configurations could be embedded in exported session data.

### Sim Studio

**What it is:** Open-source AI agent workflow builder. YC-backed, 1,463 GitHub stars in 24 hours.

**Key UX patterns:**
- **Figma-like canvas** for designing agent workflows visually
- **Modular block system:**
  - Processing blocks: AI agents, API calls, custom functions
  - Logic blocks: conditional branching, loops, routers
  - Output blocks: responses, evaluators
- **AI Copilot** -- generate nodes, fix errors, and iterate on flows from natural language
- **Agent Skills with progressive disclosure:**
  - Discovery: only skill names/descriptions in system prompt (~50-100 tokens each)
  - Activation: agent calls `load_skill` to load full instructions on demand
  - Execution: agent follows loaded instructions
  - Result: many skills attached without bloating context window

**Relevance to our project:** Sim Studio's progressive disclosure pattern for skills is directly applicable to how we handle Claude Code skills in the visual builder. The "skill cards" UI pattern (select from dropdown, appear as cards, click to edit/remove) is an excellent UX for managing tool/skill configurations. The block categorization (processing, logic, output) maps to hook types (validation, transformation, notification).

### OpenAI Agent Builder / AgentKit

**What it is:** OpenAI's visual agent building platform launched in 2026 with AgentKit.

**Key UX patterns:**
- **Visual canvas** with drag-and-drop nodes for multi-step agent workflows
- **Typed inputs and outputs** on each node
- **Template system** -- start from templates for common patterns, or build from scratch
- **Live data preview** -- preview runs using actual data
- **Connector Registry** -- centralized management of how data and tools connect
- **Automatic prompt optimization** based on eval results
- **ChatKit embedding** -- deploy workflows as embeddable chat experiences
- **Eval integration** -- built-in evaluation of agent performance with custom metrics

**Relevance to our project:** The template system is highly relevant -- we should offer pre-built hook configuration templates (e.g., "lint on file save," "block dangerous bash commands," "auto-format code"). The eval integration concept could apply to testing hook effectiveness over time.

### MindStudio

**What it is:** Powerful no-code visual builder for AI agents with 600+ integrations.

**Key UX patterns:**
- **Block-based interface** -- Start block -> modules -> End block, linear flow
- **Visual configuration per integration** -- no auth code or API requests needed, platform handles it
- **MindStudio Architect** -- generates workflow scaffolding from text descriptions, cuts setup from hours to minutes
- **Real-time testing** -- test changes immediately, deploy without downtime
- **Multiple deployment targets** -- web apps, browser extensions, API endpoints, email triggers, chat platforms
- **Multi-model workflow** -- chain different AI models (Claude for analysis, GPT-4o for generation, specialized model for formatting)
- **Conditional branching, loops, variable management, human-in-the-loop checkpoints** -- all without code

**Relevance to our project:** MindStudio's linear block-based interface is simpler than a full node graph and may be more appropriate for most hook configurations (which are typically linear: trigger -> validate -> execute). The Architect feature (text-to-workflow) is a pattern worth considering for v2.

### VS Code AI Toolkit Agent Builder

**What it is:** Microsoft's built-in VS Code extension for creating, testing, and deploying AI agents.

**Key UX patterns:**
- **Dual creation paths:**
  - "Create in Code" -- scaffolding with full control
  - "Design Without Code" -- visual Agent Builder UI
- **Prompt engineering with natural language** -- generate and improve prompts iteratively
- **Integrated Playground** -- refine prompts based on real-time model responses
- **Tool Catalog + MCP servers** -- select tools from catalog or connect MCP servers, with auto/manual approval for tool calls
- **Conversations tab** -- review conversation history for debugging
- **Auto-save** -- automatically saves draft agents before running
- **Built-in evaluation** -- accuracy and performance metrics

**Relevance to our project:** The dual creation paths approach is excellent for our use case -- power users can edit JSON directly, while visual users can use the builder. The integrated Playground for testing prompts maps directly to testing hook configurations. The MCP tool approval pattern (auto vs manual) is relevant to permission handling in hooks.

---

## Visual Workflow Builders (Zapier, Make.com)

### Zapier

**Interface model:** Linear (step-by-step)
- Automations called "Zaps" consist of a trigger + sequential actions
- **Paths feature** -- if/then branching: if "A" happens, do this; if "B" happens, do something else
- **Visual Editor** (new) -- see each path, included steps, and sub-paths; rename paths for context
- **Input Designer** -- add input fields for each piece of data needed to configure triggers

**UX strengths:** Simplicity. The linear model makes it easy to understand how each part works. Ideal for straightforward trigger -> action flows.

**UX weaknesses:** Complex branching becomes unwieldy in the linear model.

### Make.com

**Interface model:** Canvas (flowchart-like)
- Automations called "Scenarios" built by connecting modules on a canvas
- **Routers and filters** for sophisticated branching and conditional execution
- **Unlimited routes** within a single scenario
- **Flowchart representation** provides immediate understanding of data flow

**UX strengths:** Complex logic is visually clear. Branching, loops, and conditions are first-class citizens.

**UX weaknesses:** Steeper learning curve than Zapier's linear model.

### Key Takeaway: Trigger-Condition-Action Pattern

Both tools organize around the same fundamental pattern:

```
TRIGGER (when) -> CONDITION (if) -> ACTION (then)
```

Visual design best practices for this pattern:
- **Start simple** -- basic triggers and conditions first, complex scenarios later
- **Consistent naming** -- descriptive names for triggers and conditions enhance readability
- **Visual condition builders** -- drop-down menus, form fields, and logical operators instead of code
- **Branching visualization** -- clear representation of decision points and their branches
- **Test-first approach** -- every trigger/condition/action should be individually testable

---

## Agent Configuration UI Patterns

Across all tools studied, five core UI patterns emerge for configuring AI agents:

### 1. System Prompt / Instructions Editor
- Rich text editor for defining agent behavior
- Natural language instructions with variables/templates
- Prompt improvement suggestions (OpenAI Agent Builder, MindStudio)
- Version history for prompts

### 2. Tool/Skill Attachment
- **Catalog/marketplace view** -- browse available tools, click to add
- **Card-based display** -- each attached tool shown as a card with name, description, config
- **Progressive disclosure** (Sim Studio) -- only names/descriptions loaded; full config on demand
- **MCP server integration** (VS Code AI Toolkit) -- connect to external tool servers
- **Drag-and-drop from sidebar** (Langflow, Flowise)

### 3. Model Selection and Parameters
- Model dropdown with capability indicators
- Temperature, max tokens, thinking effort sliders
- Multi-model chaining (MindStudio) -- different models for different steps

### 4. Condition/Filter Configuration
- **Visual condition builders** with dropdowns and logical operators
- **Regex matchers** with syntax highlighting and validation (Claude Code hooks)
- **Pre-built condition templates** (e.g., "file type is .ts", "command contains rm")

### 5. Testing and Preview
- **Integrated playground** -- test configuration against sample inputs
- **Step-by-step execution** with inspection pauses (Dify)
- **Real-time output preview** next to configuration (n8n)
- **Eval metrics** -- track configuration effectiveness (OpenAI Agent Builder)

### 6. Markdown-Based Configuration (Emerging Pattern)

Microsoft and GitHub now treat **Markdown as the control surface for AI behavior**:
- Instructions encoded as standalone Markdown files
- Skills are folders of instructions, scripts, and resources
- Agent behavior defined in `.md` files that are version-controlled
- This is the same pattern Claude Code uses with `CLAUDE.md` and skill frontmatter

---

## Best Practices for Visual Programming UIs

Synthesized from research on node-based editors (dev.to, xyflow, Rete.js, industry tools):

### Layout and Flow Direction

- **Horizontal flow** (left-to-right) for execution/sequence
- **Vertical flow** (top-to-bottom) for data/hierarchy
- **Mixed flow** possible but requires clear visual separation between edge types
- Place labels outside nodes to compress graph and remove naming constraints
- Use node grouping to organize related functionality

### Connection Design

Two distinct edge types are essential:
- **Execution edges** -- define what runs in what order (usually dashed or thicker lines)
- **Data edges** -- transfer values between nodes (usually solid, colored by type)

Connection rules:
- Execution: any number of nodes can trigger the same next node, but each node links to only one "next" node
- Data: output can connect to any number of inputs, but each input has only one source

### Color Coding

- **Color-code ports/pins by data type** -- makes connections intuitive at a glance
- Standard palette: strings (green), numbers (blue), booleans (red/pink), objects (orange), arrays (purple)
- Execution connections in a neutral color (gray/white) to distinguish from data
- Use contrast between node background and canvas background
- Avoid excessive customization that creates visual clutter

### Error Prevention

- **Forbid invalid connections** at the UI level -- ports reject incompatible types
- **Mark unfilled required pins** visually (red outline, warning icon)
- **Clean up references** when deleting nodes (handle dangling connections)
- **Validate graphs before execution** -- check for cycles, missing inputs, type mismatches
- **Context-aware error messages** with "Go to problem" navigation

### Search and Discovery

- **Searchbox is critical** -- "the difference between a horrible and great visual programming language is often determined by the presence of a searchbox"
- **Context-aware search** when dragging an edge into empty space -- suggest compatible nodes
- Eliminates constant sidebar reference and saves screen real estate

### Essential Interactions

- One-click disconnection of edges
- Auto-link when deleting middle nodes (reconnect inputs to outputs)
- Auto-connection when placing nodes near compatible ports
- Undo/redo and copy/paste
- Node duplication
- Drag-and-drop OR click-to-add from palette
- Keyboard shortcuts for frequent actions
- Dark/light theme support
- Collapsible subgraphs for managing complexity
- Floating annotations and comments

### Performance

- **60fps+ for drag, zoom, and pan** -- smooth interaction is non-negotiable
- Only re-render changed nodes (React Flow handles this with memoization)
- Consider node virtualization for very large graphs (though most workflows are <100 nodes)

### Accessibility

- UI translations for nodes and labels
- Accessible documentation on hover
- Simple, human-readable error messages
- Touch-device optimization
- Keyboard navigation for all operations
- ARIA labels on interactive elements

---

## ComfyUI Deep Dive: Node Graphs for AI Workflows

ComfyUI deserves special attention as it represents the most mature node-based AI workflow system.

### Architecture Philosophy

ComfyUI is simultaneously:
1. A **node graph** (visual representation)
2. A **visual programming environment** (user interaction layer)
3. A **procedural framework** (execution engine)

This separation is critical -- the visual representation and the execution engine are independent. Workflows can be saved, edited as JSON, and executed headlessly via API.

### Node Design Patterns

Each node has:
- **Type** -- determines behavior (e.g., KSampler, LoadCheckpoint, CLIPTextEncode)
- **Position** -- x/y on canvas for layout
- **Size** -- width/height for display
- **Widget values** -- in-node configuration (dropdowns, sliders, text fields)
- **Typed inputs** -- named ports with specific types (MODEL, LATENT, CONDITIONING, IMAGE)
- **Typed outputs** -- named ports producing specific types

Key insight: **Widget values for unconnected inputs eliminate unnecessary "constant value" nodes.** When an input port has no connection, a small inline widget (text field, dropdown, slider) appears directly on the node.

### Workflow Serialization

- Workflows saved as compact JSON (~1-10KB typically)
- JSON includes: nodes with positions and widget values, links with source/target/type, groups with bounding boxes
- **Embedded in output metadata** -- workflow JSON saved in generated image EXIF data
- Import via drag-and-drop (JSON file or image with embedded metadata)
- Import via clipboard paste
- Human-readable and version-controllable

### Reproducibility

- Every parameter is part of the saved workflow
- Random seeds explicitly stored (no hidden state)
- Re-running a workflow produces identical output
- Users can share workflows and get the same results

### Community Extensions

- ComfyUI Manager for installing/managing custom nodes
- Hundreds of community-built node types
- Standard interface contract for custom nodes
- Nodes can be packaged and distributed independently

### Lessons for Our Project

1. **Typed connections prevent errors** -- hook event types should be enforced in the visual builder
2. **Widget values in nodes are essential** -- each node should have inline configuration for its parameters
3. **JSON serialization enables sharing** -- hook configurations should be exportable/importable JSON
4. **Embedding config in output** -- consider embedding hook config in session exports
5. **Community extensions** -- design for extensibility from day one

---

## React Implementation Libraries

### React Flow (@xyflow/react)

**The dominant library for node-based UIs in React.** Used by many of the tools surveyed.

- Highly customizable nodes and edges
- Built-in zoom, pan, selection, keyboard shortcuts
- Custom node components with multiple handles
- Plugin components: Background, MiniMap, Controls
- TypeScript-first
- Only re-renders changed nodes (performance-optimized)
- Active development and community

**Installation:** `npm i @xyflow/react`

**Workflow Editor template available** with Pro subscription (includes 1:1 support).

### Rete.js

Alternative JavaScript framework for visual programming:
- Editor state serializable to JSON
- Version management for backward compatibility
- Plugin architecture

### Flume

React-based node editor focused on business logic extraction:
- Color-coded ports for type safety
- Designed for non-programmers
- Simpler API than React Flow

### Recommendation

**React Flow (@xyflow/react)** is the clear choice for our project:
- Already React-based (matches our stack)
- TypeScript support
- Most mature and well-maintained
- Largest community and ecosystem
- Used by production tools (Langflow, Flowise, and others)

---

## Application to Claude Code Hooks

### Current Hook Configuration Format

Claude Code hooks are defined in JSON settings files with this structure:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/script.sh",
            "timeout": 30,
            "statusMessage": "Validating..."
          }
        ]
      }
    ]
  }
}
```

### Hook Events and Their Visual Representations

| Event | Visual Node Type | Description |
|-------|-----------------|-------------|
| `SessionStart` | Trigger (green) | Session begins -- startup, resume, clear, compact |
| `SessionEnd` | Trigger (red) | Session ends |
| `PreToolUse` | Gate (yellow) | Before a tool runs -- can block |
| `PostToolUse` | Observer (blue) | After a tool completes -- can add context |
| `PostToolUseFailure` | Observer (orange) | After a tool fails |
| `PermissionRequest` | Gate (yellow) | Permission check -- can allow/deny |
| `UserPromptSubmit` | Gate (yellow) | User sends a prompt -- can block/modify |
| `Stop` | Gate (yellow) | Agent about to stop -- can prevent |
| `Notification` | Observer (blue) | System notification |
| `SubagentStart` / `SubagentStop` | Observer (blue) | Subagent lifecycle |
| `ConfigChange` | Observer (blue) | Settings changed |
| `StopFailure` | Observer (orange) | Agent stop failed |

### Hook Types as Action Nodes

| Type | Visual Representation | Key Config |
|------|----------------------|------------|
| `command` | Terminal icon, green border | command path, timeout, async flag |
| `http` | Globe icon, blue border | URL, headers, allowed env vars |
| `prompt` | Brain icon, purple border | prompt text, model |
| `agent` | Robot icon, purple border | prompt text |

### Proposed Visual Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   TRIGGER    │────>│  CONDITION   │────>│    ACTION     │
│ PreToolUse   │     │ matcher:Bash │     │ type:command  │
│              │     │              │     │ cmd: lint.sh  │
└──────────────┘     └──────────────┘     └──────────────┘
      │                                         │
      │                                   ┌─────┴─────┐
      │                                   │  EXIT CODE │
      │                                   ├───────────┤
      │                                   │ 0: allow  │
      │                                   │ 2: block  │
      │                                   │ *: warn   │
      │                                   └───────────┘
```

---

## Recommended UX Patterns for Our App

Based on all research, here are specific recommendations organized by feature area.

### 1. Hook Configuration UI

**Approach: Hybrid (Form + Optional Canvas)**

**Simple mode (form-based, default):**
- List view of configured hooks, grouped by event type
- Click to expand/configure each hook
- Form fields: event type dropdown, matcher regex (with syntax highlighting), hook type selector, type-specific configuration fields
- "Test" button that runs the hook against a sample payload
- Drag to reorder hooks within an event group

**Advanced mode (canvas-based, opt-in):**
- React Flow canvas showing the full hook pipeline
- Trigger nodes (left) -> Condition nodes (middle) -> Action nodes (right)
- Click any node to open its configuration panel on the right
- Multiple hooks visualized as parallel paths from the same trigger

### 2. Agent Profile Configuration

**Approach: Form-based with Card UI**

- Profile name and description at top
- System prompt editor (rich text / markdown with preview)
- Model selector with parameter sliders (temperature, thinking effort)
- Skills section: card-based display, click to add/remove, search to discover
- Tools section: similar card-based UI with enable/disable toggles
- Hook overrides: which hooks are active for this profile
- Export/Import as JSON

### 3. Trigger-Condition-Action Flow Builder

**Approach: Visual Canvas (React Flow)**

```
TRIGGER                  CONDITION               ACTION
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ 🔔 PreToolUse   │───>│ 🔀 Matcher       │───>│ ⚡ Run Command  │
│                 │    │  tool: Bash       │    │  cmd: lint.sh   │
│ Event selector  │    │  regex: .*        │    │  timeout: 30s   │
│ [PreToolUse ▾]  │    │                  │    │  async: false    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              │ else
                              ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ 🔀 Matcher       │───>│ 🌐 HTTP Request │
                       │  tool: Write     │    │  url: /validate  │
                       └──────────────────┘    └─────────────────┘
```

### 4. Configuration Persistence

- **Primary format:** JSON matching Claude Code's settings.json schema
- **Export/Import:** Download/upload JSON files
- **Templates:** Pre-built configurations for common patterns
  - "Lint on file save" -- PostToolUse on Write/Edit, runs linter
  - "Block dangerous commands" -- PreToolUse on Bash, validates input
  - "Auto-format code" -- PostToolUse on Write, runs formatter
  - "Notify on completion" -- Stop event, sends notification
- **Version history:** Track changes to configurations over time
- **Embedded in sessions:** Optionally embed active hook config in session exports

### 5. Testing and Validation

- **Dry run mode:** Run a hook against a sample JSON payload without executing
- **Sample payload generator:** Auto-generate realistic payloads for each event type
- **Exit code simulation:** Show what would happen for each exit code (0/2/other)
- **Flow validation:** Check for invalid regex, missing commands, unreachable paths
- **Live testing:** Execute a hook against a real tool call in a sandboxed environment

### 6. Information Architecture

```
Visual Agent Builder
├── Hooks                    (trigger-condition-action configurations)
│   ├── Simple View          (form-based list)
│   └── Canvas View          (React Flow graph)
├── Agent Profiles           (system prompt, model, tools, skills)
│   ├── Profile List         (card grid)
│   └── Profile Editor       (form with sections)
├── Templates                (pre-built configurations)
│   ├── Hook Templates       (common hook patterns)
│   └── Profile Templates    (common agent setups)
└── Import/Export            (JSON management)
```

### 7. Implementation Priority

**Phase 1: Form-based Hook Builder**
- List/detail view of hooks grouped by event
- Form fields for all hook configuration options
- Matcher regex validation with live preview
- Export/import JSON
- Built-in templates

**Phase 2: Agent Profile Editor**
- Profile CRUD with card-based UI
- System prompt editor
- Model/parameter configuration
- Skill and tool attachment

**Phase 3: Visual Canvas (React Flow)**
- Node-based hook visualization
- Drag-and-drop from sidebar palette
- Connection validation (typed ports)
- Canvas save/load

**Phase 4: Advanced Features**
- Text-to-configuration (natural language to hook config)
- Dry run testing
- Performance analytics
- Community template sharing

---

## Sources

### Visual Agent Builders
- [n8n - AI Workflow Automation Platform](https://n8n.io/)
- [n8n Guide 2026: Features & Workflow Automation Deep Dive](https://hatchworks.com/blog/ai-agents/n8n-guide/)
- [n8n AI Agents 2025 Capabilities Review](https://latenode.com/blog/low-code-no-code-platforms/n8n-setup-workflows-self-hosting-templates/n8n-ai-agents-2025-complete-capabilities-review-implementation-reality-check)
- [Langflow - Low-code AI Builder](https://www.langflow.org/)
- [Visual Agent Building with Langflow and LangGraph](https://medium.com/@atnoforgenai/visual-agent-building-designing-multi-step-ai-workflows-with-langflow-and-langgraph-c41eb54a1d6c)
- [Langflow Visual Editor Documentation](https://docs.langflow.org/concepts-overview)
- [LangFlow Tutorial: Building Production-Ready AI Applications](https://www.firecrawl.dev/blog/langflow-tutorial-visual-ai-workflows)
- [Flowise - Build AI Agents Visually](https://flowiseai.com/)
- [Flowise 3.0 - YC Launch](https://www.ycombinator.com/launches/NVQ-flowise-3-0-build-ai-agents-visually)
- [Flowise Documentation](https://docs.flowiseai.com/)
- [Dify - Leading Agentic Workflow Builder](https://dify.ai/)
- [Dify for Developers](https://dify.ai/developer)
- [Dify AI Review 2026](https://www.gptbots.ai/blog/dify-ai)

### ComfyUI
- [ComfyUI Workflow Documentation](https://docs.comfy.org/development/core-concepts/workflow)
- [ComfyUI GitHub Repository](https://github.com/Comfy-Org/ComfyUI)
- [ComfyUI: How the Node-Based System Works](https://www.datastudios.org/post/comfyui-how-the-node-based-system-works-why-creators-use-it-and-how-it-transforms-ai-image-genera)
- [ComfyUI Workflow JSON Format - DeepWiki](https://deepwiki.com/Comfy-Org/ComfyUI/7.3-workflow-json-format)
- [ComfyUI Workflow Manager Guide](https://comfyuimanager.com/workflow-manager-documentation/)
- [Getting Started with ComfyUI](https://medium.com/@rohitsahu1909/getting-started-with-comfyui-a-visual-workflow-for-ai-image-generation-cbe83d08e24f)

### Workflow Automation Platforms
- [Zapier's New Visual Editor](https://zapier.com/blog/introducing-visual-editor/)
- [Visual Workflows: The Ultimate Guide - Zapier](https://zapier.com/blog/visual-workflow/)
- [Make vs Zapier Comparison](https://www.aiacquisition.com/blog/make-vs-zapier)
- [Zapier vs Make vs n8n 2026 Comparison](https://www.digitalapplied.com/blog/zapier-vs-make-vs-n8n-2026-automation-comparison)

### Agent Configuration
- [OpenAI Agent Builder](https://developers.openai.com/api/docs/guides/agent-builder)
- [OpenAI AgentKit Launch](https://openai.com/index/introducing-agentkit/)
- [OpenAI Agent Platform](https://openai.com/agent-platform/)
- [MindStudio - Build Powerful AI Agents](https://www.mindstudio.ai/)
- [MindStudio Review 2026](https://max-productive.ai/ai-tools/mindstudio/)
- [VS Code AI Toolkit - Agent Builder](https://code.visualstudio.com/docs/intelligentapps/agentbuilder)
- [VS Code AI Toolkit March 2026 Update](https://techcommunity.microsoft.com/blog/azuredevcommunityblog/%F0%9F%9A%80-ai-toolkit-for-vs-code-%E2%80%94-march-2026-update/4502517)
- [Sim Studio - AI Agent Workflow Builder](https://www.simstudio.co/)
- [Sim Studio Agent Skills](https://docs.sim.ai/skills)
- [Sim Studio GitHub](https://github.com/simstudioai/sim)

### Visual Programming Best Practices
- [Designing Your Own Node-Based Visual Programming Language](https://dev.to/cosmomyzrailgorynych/designing-your-own-node-based-visual-programming-language-2mpg)
- [Why Creators Are Switching to Node-Based AI Tools in 2026](https://toolfolio.io/productive-value/why-creators-are-switching-to-node-based-ai-tools)
- [xyflow - Awesome Node-Based UIs](https://github.com/xyflow/awesome-node-based-uis)
- [Nodes.io - A New Way to Create with Code](https://nodes.io/story/)

### React Implementation Libraries
- [React Flow - Node-Based UIs in React](https://reactflow.dev)
- [xyflow GitHub Repository](https://github.com/xyflow/xyflow)
- [React Flow Workflow Editor Template](https://reactflow.dev/ui/templates/workflow-editor)
- [Rete.js - JavaScript Framework for Visual Programming](https://retejs.org/)
- [Flume - Node Editor Powered by React](https://flume.dev/)

### Claude Code Hooks
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Hooks Mastery - GitHub](https://github.com/disler/claude-code-hooks-mastery)
- [Claude Code Hooks: A Practical Guide - DataCamp](https://www.datacamp.com/tutorial/claude-code-hooks)
- [cchook - YAML-based Claude Code Hooks](https://github.com/syou6162/cchook)
- [Claude Agent SDK Hooks Documentation](https://platform.claude.com/docs/en/agent-sdk/hooks)

### Trigger-Condition-Action Patterns
- [Feathery Visual Rule Builder](https://docs.feathery.io/platform/build-forms/advanced-logic/visual-rule-builder)
- [Mastering Trigger Condition Builder](https://ones.com/blog/knowledge/mastering-trigger-condition-builder-streamline-automation-workflows/)
- [UiPath - Conditions: Branching a Workflow](https://www.uipath.com/learning/video-tutorials/conditions-branching-a-workflow)
