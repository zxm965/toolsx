export type RunStatus = '执行中' | '成功' | '失败'
export type RetryStep = '等待' | '执行中' | '完成'

export type RunRecord = {
  id: number
  title: string
  status: RunStatus
  detail: string
  time: string
}

export type RunRecordInput = Omit<RunRecord, 'id' | 'time'>

export type ToolItem = {
  type: string
  name: string
}

export type DemoUser = {
  id: number
  name: string
}

export type ParsedConfig = {
  ok: boolean
  label: string
}
