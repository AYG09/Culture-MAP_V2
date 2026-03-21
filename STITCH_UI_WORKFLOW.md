# Culture-MAP V2 Stitch Workflow

## Active Stitch Projects

- Primary redesign project: `projects/2657606386759922037`
- Iteration project: `projects/12956415046153238162`

## Current Constraint

Stitch MCP can currently help with these steps in this workspace flow:

- create a Stitch project
- inspect a Stitch project
- list screens in a project
- edit existing screens

It cannot generate useful iteration output until at least one seed screen exists in the project.

## Recommended Seed Screen

Upload one desktop seed screen that represents the current main workspace after Sprint 1.

### Screen Name

`culture-map-main-workspace-desktop`

### Capture Conditions

- Resolution: 1440 x 1024 or wider
- State: desktop layout
- Show the main workspace, not the login or gateway screen
- Use a realistic populated map with at least:
  - 6 to 10 nodes
  - 5 or more connections
  - at least one selected node or edge
- AI drawer visible in `peek` or `full` mode
- Right inspector visible
- Session strip visible
- Left activity rail visible

### Required UI Elements In Seed

- Session strip at the top
- Main toolbar below the strip
- Left activity rail for workspace modes
- Central React Flow canvas
- Right contextual panel with inspector content
- AI copilot drawer on the left or left-center region
- Distinct layer structure for 4-level culture model

### Best Seed Variants

If possible, upload two seeds instead of one:

1. Workspace overview seed
   - show the whole canvas
   - AI drawer in peek mode
   - right inspector open

2. Copilot interaction seed
   - AI drawer in full mode
   - at least one assistant response with suggested action cards visible
   - canvas still partially visible

## Stitch Iteration Strategy

Once the seed screen exists, use Stitch MCP to branch in two directions.

### Track A: Workspace-First Iteration

Goal:

- make the app feel like a collaborative analysis workspace first
- reduce visual competition between map, AI, report, and session controls
- strengthen information hierarchy for expert facilitation workflows

Use this Stitch edit prompt:

```text
Redesign this screen as a high-clarity collaborative strategy workspace for organizational culture analysis.

Keep the product as a desktop web app with a central node-based map canvas, but improve hierarchy and reduce clutter.

Requirements:
- Preserve the 4-layer cause-to-effect model structure.
- Keep a session strip at the top for collaboration and room status.
- Keep a compact left activity rail for switching between map, AI, report, layers, and session views.
- Keep the map canvas as the visual center of gravity.
- Keep a right contextual panel for selected node or selected connection details.
- Make the AI area secondary when not actively used.
- Use a more refined enterprise workshop aesthetic, not a generic chatbot product.

Improve:
- spacing rhythm
- visual grouping
- typography hierarchy
- panel density
- selection emphasis
- inspector readability
- collaboration affordances

Make the design feel intentional, premium, and operationally useful for consultants running live workshops.
```

Expected output:

- stronger canvas focus
- cleaner panel structure
- better top-level navigation hierarchy
- clearer inspector and collaboration controls

### Track B: Copilot-First Iteration

Goal:

- make the app feel like an AI-assisted facilitation cockpit
- turn the AI sidebar into a decision-support system, not a plain chat window
- surface action cards, evidence, and change previews more clearly

Use this Stitch edit prompt:

```text
Redesign this screen as an AI copilot workspace for collaborative organizational culture mapping.

The AI panel should feel like a professional copilot for consultants, not a simple messenger.

Requirements:
- Keep the node-based culture map visible while the AI panel is open.
- Preserve the 4-layer culture model and the existing collaborative workshop context.
- Turn the AI area into a structured copilot surface with response summary, action cards, evidence blocks, and apply controls.
- Show a clear distinction between conversational explanation and executable map changes.
- Make suggested actions easy to scan, compare, and apply individually.
- Keep collaboration context visible so the AI feels embedded in a live multi-user workspace.

Improve:
- action-card hierarchy
- evidence display
- apply / preview affordances
- AI panel information architecture
- balance between canvas visibility and copilot depth
- trust and professional clarity

Avoid generic consumer chatbot aesthetics. Make it feel like a high-end consulting workbench.
```

Expected output:

- richer copilot panel
- stronger action-card system
- better evidence and decision framing
- more confident AI-assisted workflow design

## Order Of Execution

If only one Stitch iteration is possible first, use this order:

1. Track A first
2. Track B second

Reason:

- the workspace shell defines the spatial contract for every panel
- copilot refinement is more accurate after the workspace hierarchy is stabilized
- AI panel quality is easier to judge when the surrounding shell is already coherent

## Exact MCP Workflow After Seed Upload

Run in this order:

1. Identify the screen IDs in project `projects/12956415046153238162`
2. Apply Track A prompt to the workspace overview seed
3. Apply Track B prompt to the copilot interaction seed or the same seed if only one exists
4. Compare both outputs
5. Choose the better spatial system before more coding

## What To Compare In Stitch Outputs

- Is the map still the dominant surface?
- Does the AI feel embedded rather than bolted on?
- Is the right inspector clearer than the current implementation?
- Is the top strip helping collaboration or just adding chrome?
- Does the layout still work for facilitation-heavy workflows?
- Can a consultant understand where to look first within 3 seconds?

## Implementation Guidance After Stitch Review

If Track A wins:

- continue shell, panel, and navigation refinement first
- postpone deeper AI detail polish until spatial hierarchy is locked

If Track B wins:

- prioritize AI panel restructuring, evidence presentation, and preview/apply flow
- keep shell changes limited to what supports the copilot model

## Notes For This Repository

- The current codebase already has Sprint 1 workspace shell changes in the map workspace.
- The AI panel already supports suggested actions and now renders action cards.
- Stitch should now be used to refine interaction quality and panel relationships, not to rediscover the basic product structure.