# 中育工具箱 · 便携版壳

把上游 [ZhongYuToolBox_Web](https://github.com/Loshop-Studio/ZhongYuToolBox_Web) 的**前端产物**，套上这个**壳**，
打成**单文件免安装 exe**（7-Zip 自解压包）：双击即用，程序退出后自动清理临时目录。

## 为什么单独建这个仓库

| | 上游仓库 | 本仓库（壳） |
|---|---|---|
| 内容 | Vue 前端 + 壳 | 只有壳 + 打包工具 |
| 更新频率 | 几乎每天 | 很少动 |

壳独立出来后，GitHub Actions 每次只要：**拉上游最新前端 → 编译壳 → 拼成单文件 → 上传产物**。
上游发多少个版本都不用手动跟。

> 还有一个关键原因：编译 C# 需要 Windows 自带的 `csc.exe`，**本机的受管环境会拦截对 C# 编译器的调用**，
> 所以本地无法全自动。而 GitHub Actions 的 Windows 机器自带 `csc.exe`，整条链路才能真正跑通。

## 目录结构

```
native-windows/      壳源码（上游 native-windows/ 的副本）
  Program.cs         C# WPF + WebView2 主程序
  app.manifest       应用清单
  App.exe.config     运行配置
  bridge.js          前端与壳之间的桥接脚本
  installer.iss      Inno Setup 安装包脚本（本仓库暂未使用）
  InstallerSmoke.cs  安装烟雾测试（本仓库暂未使用）
tools/
  build-portable.mjs 编译壳 + 组装便携版目录
  pack-sfx.mjs       打成单文件 SFX exe
  sync-shell.mjs     从上游同步壳源码
vendor/
  7zSD.sfx           7-Zip 自解压模块（新版 7-Zip 已不再附带，必须随仓库保存）
assets/
  icon.ico           exe 图标
.github/workflows/
  build-portable.yml 自动构建
```

## 自动打包（推荐）

**手动触发**：仓库 → Actions → `Build portable single-file exe` → Run workflow（可指定上游分支或标签）

**自动触发**：
- 本仓库 `main` 分支有改动时自动验证
- 每天 10:00（北京）自动检查一次上游

构建完成后，在 Actions 页面的那次运行里下载 **Artifacts → portable-webview2-exe**。

### 想让它自动发 Release？

打开 `.github/workflows/build-portable.yml`，把文件末尾「可选：自动发布到 Release」整段的注释去掉，
然后到仓库 **Settings → Actions → General → Workflow permissions** 选 **Read and write permissions** 即可。

## 本地构建

前提：Windows + .NET Framework 4.8+ + Node 18+ + 7-Zip（默认装在 `C:\Program Files\7-Zip`）。
本仓库旁边需要有上游仓库：

```
D:\Documents\GitHub\
  ├─ ZhongYuToolBox_Web        ← 上游
  └─ ZhongYuToolBox-Portable   ← 本仓库
```

```bash
# 1. 先构建上游前端
cd ../ZhongYuToolBox_Web
npm ci
npx vite build --config vite.config.ts --mode webview2

# 2. 回本仓库，编译壳 + 组装
cd ../ZhongYuToolBox-Portable
node tools/build-portable.mjs --dist ../ZhongYuToolBox_Web/dist \
     --licenses-from ../ZhongYuToolBox_Web/node_modules --out out

# 3. 打成单文件
node tools/pack-sfx.mjs --input out --out "dist-exe/中育工具箱（新版免安装）.exe"
```

> ⚠️ 必须在**普通终端**里执行。在受管/沙箱环境中运行会被拦截（禁止调用 C# 编译器）。

## 同步上游的壳

上游改动了 `native-windows/` 时，跑一次即可同步：

```bash
node tools/sync-shell.mjs --from ../ZhongYuToolBox_Web --dry-run   # 先看有什么变化
node tools/sync-shell.mjs --from ../ZhongYuToolBox_Web             # 真正同步
```

同步后到 GitHub Desktop 看一眼 diff，确认无误再提交。

## 已知约束

- **需要系统组件**：`.NET Framework 4.8` + `Microsoft Edge WebView2 Runtime`（Win11 自带；Win10 装有 Edge 即有）
- **不能只复制 exe**：解压后的目录必须完整（但本仓库产出的单文件 exe 已经把这些都包进去了）
- **必须用 LZMA1**：老版 `7zSD.sfx` 不认 LZMA2，`pack-sfx.mjs` 已固定该参数
- 程序与安装包**未做代码签名**，首次运行可能被安全软件拦一下
