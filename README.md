# 律知库 LexVault

本地优先的 Windows 个人法律知识库。导入从国家法律法规数据库下载的 PDF、DOCX、旧版 DOC 等文件后，律知库会在本机解析并按法条建立索引。默认纯本地运行，不需要模型 API，也不会发送文档、问题或命中内容。

[![Tests](https://github.com/lkyyds77/lexvault/actions/workflows/test.yml/badge.svg)](https://github.com/lkyyds77/lexvault/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/lkyyds77/lexvault)](https://github.com/lkyyds77/lexvault/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 功能

- 导入 PDF、Word（`.docx` / `.doc`）、TXT 和 Markdown 文档
- 递归导入整个文件夹，并自动跳过已导入的重复路径
- 中文关键词检索与按“第×条”切分的法律文本索引
- 内存倒排索引与 BM25 类相关性评分，避免每次查询全库扫描
- 默认纯本地检索与回答，不调用模型 API
- 只显示直接结论，上下文、效力信息和原文默认折叠
- 远程模型模式发送所有通过相关性筛选的精简命中片段，不设置固定条数上限，也不发送完整文件
- 展示法规名称、时效性、公布日期、施行日期及失效日期
- 展开查看命中的法条原文并打开本地源文件
- 支持 DeepSeek 及其他兼容 OpenAI Chat Completions 的服务
- API Key 使用 Electron `safeStorage` 在本机加密保存
- Windows 开机启动和全局快捷键唤出，默认 `Ctrl+Shift+K`
- 模型服务不可用时仍展示本地检索结果和法条原文

## 安装

从 [GitHub Releases](https://github.com/lkyyds77/lexvault/releases/latest) 下载最新版 Windows 安装程序并运行。

安装包目前未使用商业代码签名证书，Windows SmartScreen 可能显示提醒。请核对 Release 页面提供的 SHA-256 后再安装。

## 第一次使用

1. 启动律知库即可使用默认的“纯本地模式”，无需 API Key。
2. 如需使用远程模型精炼结论，可在“隐私与设置”中关闭纯本地模式。使用 DeepSeek 时填写：
   - API 地址：`https://api.deepseek.com`
   - 模型：`deepseek-flash`
   - API Key：从 DeepSeek 控制台取得的密钥
3. 点击“测试模型连接”，成功后保存设置。
4. 打开[国家法律法规数据库](https://flk.npc.gov.cn/)，下载需要的 Word 或 PDF 文件。
5. 在“法规文档库”中导入文件，然后开始提问。

详细说明见[使用指南](docs/USAGE.md)。

## 本地开发

需要 Node.js 20 或更高版本。

```powershell
git clone https://github.com/lkyyds77/lexvault.git
cd lexvault
npm install
npm test
npm start
```

构建 Windows NSIS 安装程序：

```powershell
npm run dist
```

输出文件位于 `dist/`。

运行可重复的 2 万法条片段性能基准：

```powershell
npm run benchmark
```

基准方法与当前结果见[性能说明](docs/PERFORMANCE.md)。

## 数据与隐私

- 导入的完整文档、索引和设置保存在 Electron 用户数据目录中。
- 文档解析和检索始终在本机完成。
- 默认“纯本地模式”不执行模型网络请求，文档、问题和检索结果均不离开设备。
- 用户主动关闭纯本地模式后，问题和所有通过相关性筛选的精简命中片段会发送到所配置的模型服务；完整文件仍不上传。命中较多时可能增加 Token 消耗并触及模型上下文限制。
- API Key 不会写入源码仓库，也不会随文档上传。
- 删除应用前如需保留知识库，请先备份 `%APPDATA%\lexvault`。

## 已知限制

- 扫描版 PDF 必须先经过 OCR，否则可能无法提取文字。
- 少数损坏、加密或非标准 `.doc` 文件可能无法解析，可尝试用 Word/WPS 另存为 `.docx`。
- 官方下载文件若不包含网页上的时效字段，相应字段会显示“未标明”，程序不会自行猜测。
- 当前检索为本地关键词相关性排序，并非向量数据库。
- 本项目提供资料检索辅助，不构成法律意见。

## 参与贡献

欢迎提交 Issue 和 Pull Request。请先阅读[贡献指南](CONTRIBUTING.md)和[安全政策](SECURITY.md)。

## 许可证

[MIT License](LICENSE)
