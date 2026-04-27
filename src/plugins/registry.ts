/**
 * 插件系统骨架
 *
 * 设计目标：让第三方开发者（或未来的自己）可以扩展工具功能
 * 而不需要修改核心代码。
 *
 * 插件可以 hook 到以下扩展点：
 * - PI 解析前后
 * - 价格分配前后
 * - 文档渲染前后
 * - 导出前后
 */

export type HookPoint =
  | 'pi:parse:before'
  | 'pi:parse:after'
  | 'price:allocate:before'
  | 'price:allocate:after'
  | 'doc:render:before'
  | 'doc:render:after'
  | 'doc:export:before'
  | 'doc:export:after'
  | 'workflow:transition:before'
  | 'workflow:transition:after'

export type PluginHook<T = unknown> = (context: T) => T | Promise<T>
export type PluginHookGeneric = (context: unknown) => unknown | Promise<unknown>

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  hooks: Partial<Record<HookPoint, PluginHookGeneric>>
}

// ─── Registry ────────────────────────────────────────────

class PluginRegistry {
  private plugins: Map<string, PluginManifest> = new Map()
  private hooks: Map<HookPoint, PluginHookGeneric[]> = new Map()

  register(plugin: PluginManifest): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin ${plugin.id} is already registered. Skipping.`)
      return
    }
    this.plugins.set(plugin.id, plugin)

    // Register hooks
    Object.entries(plugin.hooks).forEach(([point, hook]) => {
      if (hook) {
        const hooks = this.hooks.get(point as HookPoint) || []
        hooks.push(hook)
        this.hooks.set(point as HookPoint, hooks)
      }
    })

    console.log(`[Plugin] Registered: ${plugin.name} v${plugin.version}`)
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    Object.entries(plugin.hooks).forEach(([point, hook]) => {
      if (hook) {
        const hooks = this.hooks.get(point as HookPoint) || []
        const idx = hooks.indexOf(hook as PluginHookGeneric)
        if (idx >= 0) hooks.splice(idx, 1)
      }
    })

    this.plugins.delete(pluginId)
    console.log(`[Plugin] Unregistered: ${pluginId}`)
  }

  async runHook<T>(point: HookPoint, context: T): Promise<T> {
    const hooks = this.hooks.get(point) || []
    let result = context
    for (const hook of hooks) {
      try {
        result = (await hook(result)) as T
      } catch (err) {
        console.error(`[Plugin] Hook ${point} failed:`, err)
      }
    }
    return result
  }

  listPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values())
  }
}

export const pluginRegistry = new PluginRegistry()

// ─── Built-in Example Plugins ────────────────────────────

// 1. HS Code 校验插件
export const hsCodeValidatorPlugin: PluginManifest = {
  id: 'builtin.hscode-validator',
  name: 'HS Code 格式校验',
  version: '1.0.0',
  description: '自动检查 HS Code 格式是否正确',
  author: '鲸途科技',
  hooks: {
    'pi:parse:after': (ctx: unknown) => {
      const result = ctx as Record<string, unknown>
      const items = (result.items || []) as Array<Record<string, unknown>>
      const warnings = [...((result.warnings || []) as string[])]

      items.forEach((item) => {
        const hsCode = String(item.hsCode || '')
        if (hsCode && !/^\d{6,10}$/.test(hsCode.replace(/\./g, ''))) {
          warnings.push(`HS Code ${hsCode} 格式可能不正确`)
        }
      })

      return { ...result, warnings }
    },
  },
}

// 2. 自动汇率换算插件（占位）
export const exchangeRatePlugin: PluginManifest = {
  id: 'builtin.exchange-rate',
  name: '汇率自动换算',
  version: '1.0.0',
  description: '支持非 USD 币种的自动汇率换算',
  author: '鲸途科技',
  hooks: {
    'pi:parse:after': (ctx: unknown) => {
      // Placeholder: would fetch real-time exchange rates
      return ctx
    },
  },
}

// 3. 重量合理性检查插件
export const weightCheckPlugin: PluginManifest = {
  id: 'builtin.weight-check',
  name: '重量合理性检查',
  version: '1.0.0',
  description: '检查毛重是否大于等于净重',
  author: '鲸途科技',
  hooks: {
    'pi:parse:after': (ctx: unknown) => {
      const result = ctx as Record<string, unknown>
      const gross = Number(result.grossWeight || 0)
      const net = Number(result.netWeight || 0)
      const warnings = [...((result.warnings || []) as string[])]

      if (net > gross) {
        warnings.push('净重大于毛重，请检查数据')
      }

      return { ...result, warnings }
    },
  },
}

// Register built-in plugins
pluginRegistry.register(hsCodeValidatorPlugin)
pluginRegistry.register(weightCheckPlugin)
