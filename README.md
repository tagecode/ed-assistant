# ED Assistant

**中文名**：文件加解密助手  
**英文名**：Encryption and Decryption Assistant

一款面向个人与小团队的跨平台桌面文件加解密工具。以 [age](https://github.com/FiloSottile/age) 为加密引擎，通过图形界面完成文件加密保护与解密还原，无需使用命令行。

---

## 简介

ED Assistant 基于 **Electron + Vite + React + TypeScript + Tailwind CSS + shadcn/ui** 构建，将 age 预编译二进制（含 `age-plugin-batchpass` 密码模式插件）随应用打包，在主进程中通过子进程调用，不向渲染进程暴露敏感能力。

当前处于 **MVP 阶段**，已实现密码生成、口令/公钥加密与解密、X25519 密钥对生成、主题与设置等核心功能。更多规划见 [PRD.md](./PRD.md)。

---

## 主要功能（MVP）

### 密码生成器

- 长度 8～128、字符集可配置（大小写、数字、特殊字符、排除易混淆、排除重复、自定义特殊字符集）
- 实时强度评级（弱 / 中 / 强 / 极强）与熵值估算
- 一键复制；**⌘R / Ctrl+R** 快捷键重新生成
- 当前会话最近 5 条记录，可复制或删除，可与加密页联动填入口令

### 文件加密

- 多文件选择与输出目录指定
- **口令模式**：输入或生成加密口令，支持强度指示、自动生成口令、从密码生成器填入、复制口令；输出 `原文件名.pwd.age`
- **公钥模式**：支持多行 `age1...` 公钥，输出 `原文件名.key.age`
- 执行结果展示成功/失败列表与总耗时
- **输出冲突处理**：若输出目录中已存在同名文件，弹窗选择「覆盖」或「自动重命名」（`文件名_1.后缀`、`文件名_2.后缀` …）

### 文件解密

- 识别 `.pwd.age` / `.key.age` / `.age` 等 age 加密文件
- 口令解密 / 私钥解密两种模式，自动推导解密后文件名
- **输出冲突处理**：若目标路径已存在，弹窗选择覆盖或自动重命名

### 密钥管理

- 生成 X25519 密钥对（`age1...` / `AGE-SECRET-KEY-1...`）
- 公钥、私钥展示与一键复制，私钥可保存到本地文件

### 设置

- 亮色 / 暗色 / 跟随系统主题（`electron-store` 持久化）
- 应用版本、Electron 运行时及 age 二进制状态查看

更多规划（多收件人、SSH 密钥、Armor、后量子密钥等）见 [PRD.md](./PRD.md) 里程碑。

---

## 技术栈

| 层次     | 技术 |
|----------|------|
| 桌面运行时 | Electron 41+ |
| 构建与开发 | Vite 7 + vite-plugin-electron |
| 前端      | React 19 + TypeScript 5 |
| 样式与组件 | Tailwind CSS v4 + shadcn/ui（new-york）+ lucide-react |
| 加密引擎  | age / age-keygen / age-plugin-batchpass（随应用打包） |
| 持久化    | electron-store |
| 打包      | electron-builder（macOS / Windows / Linux） |

---

## 快速开始

**前置**：Node.js 18+，npm/pnpm，可访问 filippo.io 以下载 age 二进制。

1. **安装依赖**

```bash
npm install
```

2. **下载 age 二进制（首次必需）**

```bash
npm run download:age
```

脚本将按当前系统平台与架构下载 `age`、`age-keygen`、`age-plugin-batchpass` 到 `resources/bin/<os>/<arch>/`。跨平台打包可执行 `node scripts/download-age-bins.mjs --all`。

3. **开发模式**

```bash
npm run dev
```

启动 Vite 开发服务器与 Electron 窗口，加载完成后进入主界面。

4. **构建与打包**

```bash
npm run build          # 仅构建
npm run dist           # 构建并打包当前平台
npm run dist:mac       # macOS
npm run dist:win       # Windows
npm run dist:linux     # Linux
```

安装包输出到 `release/`，配置见 `package.json` 的 `build` 字段。

---

## 项目结构

```
ed-assistant/
├── electron/              # 主进程
│   ├── main.ts            # 窗口、IPC、对话框、覆盖确认等
│   ├── preload.ts         # contextBridge 暴露 API
│   └── age/
│       ├── runner.ts      # age 二进制调用与路径逻辑
│       └── types.ts
├── src/                   # 渲染进程（React）
│   ├── app/               # 路由、主题 Provider
│   ├── features/          # 加密、解密、密钥、密码生成器、设置
│   ├── components/        # 布局与 shadcn/ui
│   ├── shared/            # IPC 与共享类型（electron.ts）
│   └── lib/               # 工具（剪贴板、格式化等）
├── resources/bin/         # 各平台 age 二进制（脚本下载）
├── scripts/
│   └── download-age-bins.mjs
├── PRD.md
└── package.json
```

---

## 贡献与许可

项目处于早期迭代，欢迎通过 Issue 反馈或 Pull Request 参与。许可证与贡献规范将在项目稳定后补充。
