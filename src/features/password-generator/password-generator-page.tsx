import { PageHeader } from '@/components/layout/page-header'
import { PasswordGeneratorPanel } from '@/features/password-generator/password-generator-panel'

export function PasswordGeneratorPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="密码生成器"
        description="生成高强度随机密码，支持自定义长度、字符类型、特殊字符集与排除重复字符。"
      />
      <PasswordGeneratorPanel />
    </div>
  )
}
