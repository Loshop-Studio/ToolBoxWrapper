# 中育工具箱 · 便携版壳

把上游 [ZhongYuToolBox_Web](https://github.com/Loshop-Studio/ZhongYuToolBox_Web) 的**前端产物**套上这个**壳**，
打成**免安装 zip**：解压后双击 `中育Toolbox.exe` 即用。

> **产物是 zip，不是单文件 exe。** 旧方案用 7-Zip 自解压包（single-file exe），
> 在受管/学校机器上会直接弹 `Extraction Failed / Can not open output file`（老存根要往 `%TEMP%`
> 写文件，写不进去就报错）。zip 走系统自带解压器，不吃这个毛病。**打包与解压环节现已零外部依赖。**

## 为什么单独建这个仓库

| | 上游仓库 | 本仓库（壳） |
|---|---|---|
| 内容 | Vue 前端 + 壳 | 只有壳 + 打包工具 |
| 更新频率 | 几乎每天 | 很少动 |

壳独立出来后，GitHub Actions 每次只要：**拉上游最新前端 → 编译壳 → 打成 zip → 上传产物**。

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
  build-portable.mjs 编译壳 + 组装便携版目录（需要 Node）
  pack-zip.ps1       打成免安装 zip（PowerShell + .NET，零外部依赖）
  pack-zip.cmd       上面的双击包装版
  pack-sfx.mjs       旧方案：打单文件 SFX exe（已弃用，见下方「已知约束」）
  sync-shell.mjs     从上游同步壳源码
vendor/
  7zSD.sfx           7-Zip 自解压模块（已弃用，仅留作存档）
assets/
  icon.ico           exe 图标
.github/workflows/
  build-portable.yml 自动构建
```

## 依赖情况

**打包环节（把便携版目录压成 zip）：零外部依赖。** 只用 Windows 自带的 PowerShell + .NET，
不需要 7-Zip、不需要 Node、不需要 Python。任何 Windows 10/11 机器上都能直接跑。

**使用环节（把 zip 解开并运行）：零安装。** 解压用系统自带「全部解压缩」即可，不用装任何软件。

**编译环节（仅本仓库自己构建时需要）：需要 Node。** 因为要跑上游的 `vite build`。

**运行环节需要两个 Windows 组件**（不是第三方软件，Win10 1903+ / Win11 自带）：

| 组件 | 说明 | 缺失时 |
|---|---|---|
| .NET Framework 4.8 | 壳是 C# WPF | 启动失败 |
| Microsoft Edge WebView2 Runtime | 界面渲染引擎 | 弹窗提示需安装 |

Win11 必带 WebView2；Win10 装了 Edge 就有。如果目标机器是精简系统 / 删过 Edge / Win7，
需要额外处理，见「让运行也零依赖」一节。

## 自动打包（推荐）

**手动触发**：仓库 → Actions → `Build portable zip` → Run workflow（可指定上游分支或标签）

**自动触发**：
- 本仓库 `main` 分支有改动时自动验证
- 每天 10:00（北京）自动检查一次上游

构建完成后，在 Actions 页面的那次运行里下载 **Artifacts → portable-webview2-zip**。

产物形如 `中育工具箱-免安装版-v0.0.8.zip`，里面是：

```
中育工具箱-免安装版-v0.0.8\
  中育Toolbox.exe      ← 双击这个
  版本.txt
  dist\                前端页面
  WebView2Loader.dll 等三个 dll
  bridge.js  self-test.json  LICENSES\
```

### 想让它自动发 Release？

打开 `.github/workflows/build-portable.yml`，把文件末尾「可选：自动发布到 Release」整段的注释去掉，
然后到仓库 **Settings → Actions → General → Workflow permissions** 选 **Read and write permissions** 即可。

## 本地构建

前提：Windows 10/11。上游前端那一步需要 Node 18+（仓库旁边要有上游仓库）：

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

# 3. 打成免安装 zip（不用装任何东西）
tools\pack-zip.cmd 0.0.8
```

第 3 步也可以直接调 PowerShell（`pack-zip.cmd` 就是它的包装，自动加 `-ExecutionPolicy Bypass`）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\pack-zip.ps1 -Version 0.0.8
```

参数：`-InputDir`（默认 `out`）、`-OutFile`、`-Name`（zip 内顶层目录名）、`-Version`、`-Level`（0=不压缩）。

> ⚠️ 编译那一步必须在**普通终端**里执行。在受管/沙箱环境中运行会被拦截（禁止调用 C# 编译器）。
> 打包（PowerShell）不受此限制。

## 让运行也零依赖（可选）

如果目标机器缺 WebView2 Runtime（精简系统、删过 Edge 的 Win10、Win7），有两个办法：

1. **包内自带运行时**（推荐，包会变大）
   下载微软 WebView2 **Fixed Version** 运行时（`msedgewebview2.exe` 及配套目录）放进包里，
   并把 `Program.cs` 里的 `CoreWebView2Environment.CreateAsync(null, ...)` 第一个参数
   改成包内 `msedgewebview2.exe` 的路径（找不到时回退 `null`）。代价：包从 22MB 涨到约 90MB。
2. **改成 Inno Setup 安装版**
   `native-windows/installer.iss` 已有现成脚本，装的时候能自动检测并联网补装 WebView2。
   代价：不再是「解压即用」，要跑安装程序。

## 同步上游的壳

上游改动了 `native-windows/` 时，跑一次即可同步：

```bash
node tools/sync-shell.mjs --from ../ZhongYuToolBox_Web --dry-run   # 先看有什么变化
node tools/sync-shell.mjs --from ../ZhongYuToolBox_Web             # 真正同步
```

同步后到 GitHub Desktop 看一眼 diff，确认无误再提交。

## 已知约束

- **zip 里的中文目录名**：用 UTF-8 编码写入并置 bit 11 标志，Windows 10+ / 7-Zip / WinRAR / Bandizop 都能正确识别。
- **不能只拷 `中育Toolbox.exe`**：解压后的目录必须完整（`dist\`、`*.dll`、`bridge.js` 都得在）。
- **单文件 SFX 方案已弃用**：`pack-sfx.mjs` 与 `vendor/7zSD.sfx` 仅为存档保留。
  原因：老版 7zSD.sfx（2010）自解压时依赖 `%TEMP%` 可写，在受管机器上会直接失败。
- 程序与安装包**未做代码签名**，首次运行可能被安全软件拦一下。
- `.ps1` 带 UTF-8 BOM（PowerShell 5.1 读无 BOM 脚本会按 GBK 解析，中文会乱码）；
  `.cmd` 包装里只用 ASCII，避免控制台代码页问题。**改这两个文件时别把 BOM 弄丢了。**
