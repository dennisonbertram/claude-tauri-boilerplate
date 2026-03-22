import { Database } from 'bun:sqlite';

interface AgentProfileRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_default: number;
  sort_order: number;
  system_prompt: string | null;
  use_claude_code_prompt: number;
  model: string | null;
  effort: string | null;
  thinking_budget_tokens: number | null;
  allowed_tools: string | null;
  disallowed_tools: string | null;
  permission_mode: string | null;
  hooks_json: string | null;
  hooks_canvas_json: string | null;
  mcp_servers_json: string | null;
  sandbox_json: string | null;
  cwd: string | null;
  additional_directories: string | null;
  setting_sources: string | null;
  max_turns: number | null;
  max_budget_usd: number | null;
  agents_json: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonArray(value: string | null): string[] | null {
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
    return null;
  } catch {
    return null;
  }
}

function mapAgentProfile(row: AgentProfileRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order,
    systemPrompt: row.system_prompt,
    useClaudeCodePrompt: row.use_claude_code_prompt === 1,
    model: row.model,
    effort: row.effort,
    thinkingBudgetTokens: row.thinking_budget_tokens,
    allowedTools: parseJsonArray(row.allowed_tools),
    disallowedTools: parseJsonArray(row.disallowed_tools),
    permissionMode: row.permission_mode,
    hooksJson: row.hooks_json,
    hooksCanvasJson: row.hooks_canvas_json,
    mcpServersJson: row.mcp_servers_json,
    sandboxJson: row.sandbox_json,
    cwd: row.cwd,
    additionalDirectories: parseJsonArray(row.additional_directories),
    settingSources: parseJsonArray(row.setting_sources),
    maxTurns: row.max_turns,
    maxBudgetUsd: row.max_budget_usd,
    agentsJson: row.agents_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createAgentProfile(
  db: Database,
  id: string,
  data: import('@claude-tauri/shared').CreateAgentProfileRequest
) {
  const stmt = db.prepare(
    `INSERT INTO agent_profiles (
      id, name, description, icon, color, is_default, sort_order,
      system_prompt, use_claude_code_prompt, model, effort, thinking_budget_tokens,
      allowed_tools, disallowed_tools, permission_mode,
      hooks_json, hooks_canvas_json, mcp_servers_json, sandbox_json,
      cwd, additional_directories, setting_sources,
      max_turns, max_budget_usd, agents_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    id,
    data.name,
    data.description ?? null,
    data.icon ?? null,
    data.color ?? null,
    data.isDefault ? 1 : 0,
    data.sortOrder ?? 0,
    data.systemPrompt ?? null,
    data.useClaudeCodePrompt === false ? 0 : 1,
    data.model ?? null,
    data.effort ?? null,
    data.thinkingBudgetTokens ?? null,
    data.allowedTools ? JSON.stringify(data.allowedTools) : null,
    data.disallowedTools ? JSON.stringify(data.disallowedTools) : null,
    data.permissionMode ?? null,
    data.hooksJson ?? null,
    data.hooksCanvasJson ?? null,
    data.mcpServersJson ?? null,
    data.sandboxJson ?? null,
    data.cwd ?? null,
    data.additionalDirectories ? JSON.stringify(data.additionalDirectories) : null,
    data.settingSources ? JSON.stringify(data.settingSources) : null,
    data.maxTurns ?? null,
    data.maxBudgetUsd ?? null,
    data.agentsJson ?? null
  ) as AgentProfileRow;
  return mapAgentProfile(row);
}

export function getAgentProfile(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM agent_profiles WHERE id = ?`);
  const row = stmt.get(id) as AgentProfileRow | null;
  return row ? mapAgentProfile(row) : null;
}

export function listAgentProfiles(db: Database) {
  const stmt = db.prepare(`SELECT * FROM agent_profiles ORDER BY sort_order ASC, name ASC`);
  const rows = stmt.all() as AgentProfileRow[];
  return rows.map(mapAgentProfile);
}

export function updateAgentProfile(
  db: Database,
  id: string,
  updates: Partial<import('@claude-tauri/shared').UpdateAgentProfileRequest>
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description);
  }
  if (updates.icon !== undefined) {
    setClauses.push('icon = ?');
    values.push(updates.icon);
  }
  if (updates.color !== undefined) {
    setClauses.push('color = ?');
    values.push(updates.color);
  }
  if (updates.isDefault !== undefined) {
    setClauses.push('is_default = ?');
    values.push(updates.isDefault ? 1 : 0);
  }
  if (updates.sortOrder !== undefined) {
    setClauses.push('sort_order = ?');
    values.push(updates.sortOrder);
  }
  if (updates.systemPrompt !== undefined) {
    setClauses.push('system_prompt = ?');
    values.push(updates.systemPrompt);
  }
  if (updates.useClaudeCodePrompt !== undefined) {
    setClauses.push('use_claude_code_prompt = ?');
    values.push(updates.useClaudeCodePrompt ? 1 : 0);
  }
  if (updates.model !== undefined) {
    setClauses.push('model = ?');
    values.push(updates.model);
  }
  if (updates.effort !== undefined) {
    setClauses.push('effort = ?');
    values.push(updates.effort);
  }
  if (updates.thinkingBudgetTokens !== undefined) {
    setClauses.push('thinking_budget_tokens = ?');
    values.push(updates.thinkingBudgetTokens);
  }
  if (updates.allowedTools !== undefined) {
    setClauses.push('allowed_tools = ?');
    values.push(updates.allowedTools ? JSON.stringify(updates.allowedTools) : null);
  }
  if (updates.disallowedTools !== undefined) {
    setClauses.push('disallowed_tools = ?');
    values.push(updates.disallowedTools ? JSON.stringify(updates.disallowedTools) : null);
  }
  if (updates.permissionMode !== undefined) {
    setClauses.push('permission_mode = ?');
    values.push(updates.permissionMode);
  }
  if (updates.hooksJson !== undefined) {
    setClauses.push('hooks_json = ?');
    values.push(updates.hooksJson);
  }
  if (updates.hooksCanvasJson !== undefined) {
    setClauses.push('hooks_canvas_json = ?');
    values.push(updates.hooksCanvasJson);
  }
  if (updates.mcpServersJson !== undefined) {
    setClauses.push('mcp_servers_json = ?');
    values.push(updates.mcpServersJson);
  }
  if (updates.sandboxJson !== undefined) {
    setClauses.push('sandbox_json = ?');
    values.push(updates.sandboxJson);
  }
  if (updates.cwd !== undefined) {
    setClauses.push('cwd = ?');
    values.push(updates.cwd);
  }
  if (updates.additionalDirectories !== undefined) {
    setClauses.push('additional_directories = ?');
    values.push(updates.additionalDirectories ? JSON.stringify(updates.additionalDirectories) : null);
  }
  if (updates.settingSources !== undefined) {
    setClauses.push('setting_sources = ?');
    values.push(updates.settingSources ? JSON.stringify(updates.settingSources) : null);
  }
  if (updates.maxTurns !== undefined) {
    setClauses.push('max_turns = ?');
    values.push(updates.maxTurns);
  }
  if (updates.maxBudgetUsd !== undefined) {
    setClauses.push('max_budget_usd = ?');
    values.push(updates.maxBudgetUsd);
  }
  if (updates.agentsJson !== undefined) {
    setClauses.push('agents_json = ?');
    values.push(updates.agentsJson);
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(
    `UPDATE agent_profiles SET ${setClauses.join(', ')} WHERE id = ?`
  );
  return stmt.run(...values);
}

export function deleteAgentProfile(db: Database, id: string) {
  const stmt = db.prepare(`DELETE FROM agent_profiles WHERE id = ?`);
  return stmt.run(id);
}

export function duplicateAgentProfile(db: Database, sourceId: string, newId: string) {
  const source = getAgentProfile(db, sourceId);
  if (!source) return null;

  const stmt = db.prepare(
    `INSERT INTO agent_profiles (
      id, name, description, icon, color, is_default, sort_order,
      system_prompt, use_claude_code_prompt, model, effort, thinking_budget_tokens,
      allowed_tools, disallowed_tools, permission_mode,
      hooks_json, hooks_canvas_json, mcp_servers_json, sandbox_json,
      cwd, additional_directories, setting_sources,
      max_turns, max_budget_usd, agents_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    newId,
    source.name + ' (copy)',
    source.description,
    source.icon,
    source.color,
    0, // copies are never default
    source.sortOrder,
    source.systemPrompt,
    source.useClaudeCodePrompt ? 1 : 0,
    source.model,
    source.effort,
    source.thinkingBudgetTokens,
    source.allowedTools ? JSON.stringify(source.allowedTools) : null,
    source.disallowedTools ? JSON.stringify(source.disallowedTools) : null,
    source.permissionMode,
    source.hooksJson,
    source.hooksCanvasJson,
    source.mcpServersJson,
    source.sandboxJson,
    source.cwd,
    source.additionalDirectories ? JSON.stringify(source.additionalDirectories) : null,
    source.settingSources ? JSON.stringify(source.settingSources) : null,
    source.maxTurns,
    source.maxBudgetUsd,
    source.agentsJson
  ) as AgentProfileRow;
  return mapAgentProfile(row);
}
