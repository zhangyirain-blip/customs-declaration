/**
 * 工作流状态机
 *
 * 报关资料生成是一个多阶段流程，状态机确保：
 * 1. 每个阶段必须满足前置条件才能推进
 * 2. 支持前进、后退、退回修改
 * 3. 每个状态变更记录审计日志
 */

export type WorkflowStatus =
  | 'draft'
  | 'pi_uploaded'
  | 'data_extracted'
  | 'components_reviewed'
  | 'price_balanced'
  | 'docs_generated'
  | 'exported'
  | 'archived'

export interface WorkflowTransition {
  from: WorkflowStatus
  to: WorkflowStatus
  action: string
  validate?: (ctx: WorkflowContext) => { ok: boolean; message?: string }
}

export interface WorkflowContext {
  piData: Record<string, unknown>
  componentPrices: Record<string, number>
  isBalanced: boolean
  documentsGenerated: Record<string, boolean>
}

export interface AuditLog {
  timestamp: string
  from: WorkflowStatus
  to: WorkflowStatus
  action: string
  user: string
  note?: string
}

// ─── State Definitions ───────────────────────────────────

export const WORKFLOW_STEPS: { status: WorkflowStatus; label: string; description: string }[] = [
  { status: 'draft', label: '草稿', description: '新建报关单，等待上传PI' },
  { status: 'pi_uploaded', label: 'PI已上传', description: 'PI文件已上传，等待数据提取' },
  { status: 'data_extracted', label: '数据已提取', description: 'PI信息已提取并核对' },
  { status: 'components_reviewed', label: '组件已确认', description: '组件拆解配置已审核' },
  { status: 'price_balanced', label: '价格已平衡', description: '各组件价格已调整并平衡' },
  { status: 'docs_generated', label: '文档已生成', description: '四份报关资料已生成' },
  { status: 'exported', label: '已导出', description: '文档已导出交付' },
  { status: 'archived', label: '已归档', description: '报关单已归档' },
]

export const STATUS_INDEX: Record<WorkflowStatus, number> = WORKFLOW_STEPS.reduce(
  (acc, s, i) => ({ ...acc, [s.status]: i }),
  {} as Record<WorkflowStatus, number>
)

// ─── Valid Transitions ───────────────────────────────────

const VALID_TRANSITIONS: WorkflowTransition[] = [
  { from: 'draft', to: 'pi_uploaded', action: 'upload_pi' },
  { from: 'pi_uploaded', to: 'data_extracted', action: 'extract_data' },
  { from: 'data_extracted', to: 'components_reviewed', action: 'review_components' },
  { from: 'components_reviewed', to: 'price_balanced', action: 'balance_prices' },
  { from: 'price_balanced', to: 'docs_generated', action: 'generate_docs' },
  { from: 'docs_generated', to: 'exported', action: 'export_docs' },
  { from: 'exported', to: 'archived', action: 'archive' },

  // Backward / skip transitions
  { from: 'data_extracted', to: 'pi_uploaded', action: 'reupload_pi' },
  { from: 'components_reviewed', to: 'data_extracted', action: 'reedit_data' },
  { from: 'price_balanced', to: 'components_reviewed', action: 'reedit_components' },
  { from: 'docs_generated', to: 'price_balanced', action: 'reedit_prices' },
  { from: 'exported', to: 'docs_generated', action: 'regenerate' },
]

// ─── Validation Rules ────────────────────────────────────

const VALIDATION_RULES: Record<string, (ctx: WorkflowContext) => { ok: boolean; message?: string }> = {
  extract_data: (ctx) => {
    const pi = ctx.piData as { piNumber?: string; quantity?: number; unitPrice?: number }
    if (!pi.piNumber) return { ok: false, message: 'PI编号不能为空' }
    if (!pi.quantity || pi.quantity <= 0) return { ok: false, message: '数量必须大于0' }
    if (!pi.unitPrice || pi.unitPrice <= 0) return { ok: false, message: '单价必须大于0' }
    return { ok: true }
  },

  balance_prices: (ctx) => {
    if (!ctx.isBalanced) return { ok: false, message: '价格未平衡，请调整后再继续' }
    return { ok: true }
  },

  generate_docs: (ctx) => {
    const docs = ctx.documentsGenerated || {}
    const allGenerated = Object.values(docs).every(Boolean)
    if (!allGenerated) return { ok: false, message: '请先生成所有文档' }
    return { ok: true }
  },
}

// ─── State Machine Functions ─────────────────────────────

export function canTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
  ctx?: WorkflowContext
): { ok: boolean; message?: string } {
  // Same state
  if (from === to) return { ok: true }

  // Find transition definition
  const transition = VALID_TRANSITIONS.find((t) => t.from === from && t.to === to)
  if (!transition) {
    return { ok: false, message: `不允许从 "${getStatusLabel(from)}" 直接跳转到 "${getStatusLabel(to)}"` }
  }

  // Run validation if context provided
  if (ctx && VALIDATION_RULES[transition.action]) {
    const result = VALIDATION_RULES[transition.action](ctx)
    if (!result.ok) return result
  }

  return { ok: true }
}

export function getNextStatuses(from: WorkflowStatus): WorkflowStatus[] {
  return VALID_TRANSITIONS
    .filter((t) => t.from === from)
    .map((t) => t.to)
}

export function getPrevStatuses(from: WorkflowStatus): WorkflowStatus[] {
  return VALID_TRANSITIONS
    .filter((t) => t.to === from)
    .map((t) => t.from)
}

export function getStatusLabel(status: WorkflowStatus): string {
  return WORKFLOW_STEPS.find((s) => s.status === status)?.label || status
}

export function getStatusDescription(status: WorkflowStatus): string {
  return WORKFLOW_STEPS.find((s) => s.status === status)?.description || ''
}

export function isStatusAfter(a: WorkflowStatus, b: WorkflowStatus): boolean {
  return STATUS_INDEX[a] > STATUS_INDEX[b]
}

export function getProgressPercent(status: WorkflowStatus): number {
  const idx = STATUS_INDEX[status]
  return Math.round((idx / (WORKFLOW_STEPS.length - 1)) * 100)
}

// ─── Audit Logging ───────────────────────────────────────

export function createAuditLog(
  from: WorkflowStatus,
  to: WorkflowStatus,
  action: string,
  user = 'system',
  note?: string
): AuditLog {
  return {
    timestamp: new Date().toISOString(),
    from,
    to,
    action,
    user,
    note,
  }
}
