/**
 * 工作流数据重置工具
 * 当用户完成报关流程并返回工作台时，清空所有步骤中的临时数据
 * 防止信息泄露给下一个使用者
 */

import { usePIStore } from '@/stores/piStore'
import { useDatasetStore } from '@/stores/datasetStore'
import { usePriceStore } from '@/stores/priceStore'
import { useProjectStore } from '@/stores/projectStore'
import { useDocumentStore } from '@/stores/documentStore'

/**
 * 重置整个工作流的临时状态
 * 注意：不清除历史记录、产品模板、系统设置等持久化数据
 */
export function resetWorkflow() {
  // 1. 清空 PI 数据
  usePIStore.getState().reset()

  // 2. 恢复默认组件（清空当前项目的组件自定义）
  useDatasetStore.getState().resetToDefaults()

  // 3. 清空价格数据
  usePriceStore.getState().reset()

  // 4. 清空当前项目引用（保留项目列表在历史中）
  useProjectStore.getState().clearCurrentProject()

  // 5. 重置文档生成状态
  useDocumentStore.getState().reset()
}
