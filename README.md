# 中育工具箱 · 便携版壳

把上游 [ZhongYuToolBox_Web](https://github.com/Loshop-Studio/ZhongYuToolBox_Web) 的**前端产物**套上这个**壳**，
打包成**免安装版**。每次构建同时产出**两个产物**，按场景挑一个发：

| 产物 | 形式 | 什么时候用 |
|---|---|---|
| `中育工具箱-免安装版-vX.Y.Z.zip` | 压缩包 | ✅ **默认推荐**。解压后双击 `中育Toolbox.exe`，任何机器都打得开 |
| `中育工具箱-免安装版-单文件.exe` | 单文件 | 只有一个文件、双击即用最方便；⚠️ 但**受管/学校机器可能打不开** |

> **zip 为什么是默认推荐的？** 单文件 exe 是 7-Zip 自解压包，双击时它会先把整包解压到
> **系统临时目录**再启动。老版自解压模块（`7zSD.sfx`，2010 年）往临时目录写文件失败时，
> 就直接弹 `Extraction Failed / Can not open output file` —— 杀软管控、权限受限的机器上很常见。
> zip 走系统自带解压器，不碰临时目录，**任何环境都打得开**。
> 两个产物都在，不冲突：发不出去的时候改发 zip 就行。

## 为什么单独建这个仓库

| | 上游仓库 | 本仓库（壳） |
|---|---|---|
| 内容 | Vue 前端 + 壳 | 只有壳 + 打包工具 |
| 更新频率 | 几乎每天 | 很少动 |

壳独立出来后，GitHub Actions 每次只要：**拉上游最新前端 → 编译壳 → 打包 → 上传产物**。

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
  pack-zip.ps1       打免安装 zip（零外部依赖，推荐）
  pack-zip.cmd       上面的双击包装版
  pack-sfx.mjs       打单文件 exe（需要 Node + 7-Zip，备选）
  sync-shell.mjs     从上游同步壳源码
vendor/
  7zSD.sfx           7-Zip 自解压模块（新版 7-Zip 已不再附带，必须随仓库保存）
assets/
  icon.ico           exe 图标
.github/workflows/
  build-portable.yml 自动构建（一次产出 zip + exe 两个 Artifact）
```

## 依赖情况

**使用环节：零安装。** 收件人什么都不用装 —— zip 用系统自带「全部解压缩」，
exe 直接双击，两种都是解压完就能用。

**打包环节：**

| 打什么 | 需要什么 | 说明 |
|---|---|---|
| zip | **只要 Windows** | 脚本只用自带 PowerShell + .NET；不需要 7-Zip / Node / Python |
| exe | Node + 7-Zip | 7-Zip 本机默认装在 `C:\Program Files\7-Zip`；CI runner 自带 |
| 两者都要 | Node + 7-Zip | 编译壳那一步（`build-portable.mjs`）本身就需要 Node |

**编译环节（仅本仓库自己构建时）：需要 Node**，因为要跑上游的 `vite build`。

**运行环节需要两个 Windows 组件**（不是第三方软件，Win10 1903+ / Win11 自带）：

| 组件 | 说明 | 缺失时 |
|---|---|---|
| .NET Framework 4.8 | 壳是 C# WPF | 启动失败 |
| Microsoft Edge WebView2 Runtime | 界面渲染引擎 | 弹窗提示需安装 |

Win11 必带 WebView2；Win10 装了 Edge 就有。如果目标机器是精简系统 / 删过 Edge / Win7，
需要额外处理，见「让运行也零依赖」一节。

## 自动打包（推荐）

**手动触发**：仓库 → Actions → `Build portable artifacts` → Run workflow（可指定上游分支或标签）

**自动触发**：
- 本仓库 `main` 分支有改动时自动验证
- 每天 10:00（北京）自动检查一次上游

构建完成后，在 Actions 页面的那次运行里下载 **Artifacts**：

- `portable-webview2-zip` → 免安装版 zip（**发这个**）
- `portable-webview2-exe` → 单文件 exe

zip 产物形如 `中育工具箱-免安装版-v0.0.8.zip`，里面是：

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

# 3. 打包（两个产物一起出）
tools\pack-zip.cmd 0.0.8                                            # zip，不用装任何东西
node tools\pack-sfx.mjs --input out --out "dist-exe\中育工具箱-免安装版-单文件.exe"
```

第 3 步的 zip 也可以直接调 PowerShell（`pack-zip.cmd` 就是它的包装，自动加 `-ExecutionPolicy Bypass`）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\pack-zip.ps1 -Version 0.0.8
```

参数：`-InputDir`（默认 `out`）、`-OutFile`、`-Name`（zip 内顶层目录名）、`-Version`、`-Level`（0=不压缩）。
打 exe 用 `-mx=9` LZMA1 压缩，比较慢（36MB 目录可能要几分钟），耐心等。

> ⚠️ 编译那一步必须在**普通终端**里执行。在受管/沙箱环境中运行会被拦截（禁止调用 C# 编译器）。
> 打包（PowerShell / 7-Zip）不受此限制。

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
- **单文件 exe 用的是 LZMA1**：老版 `7zSD.sfx` 不认 LZMA2，`pack-sfx.mjs` 已固定该参数。
- **单文件 exe 不是 100% 可靠**：受管机器上可能 `Extraction Failed`。发不出去就发 zip。
- 程序与安装包**未做代码签名**，首次运行可能被安全软件拦一下。
- `.ps1` 带 UTF-8 BOM（PowerShell 5.1 读无 BOM 脚本会按 GBK 解析，中文会乱码）；
  `.cmd` 包装里只用 ASCII，避免控制台代码页问题。**改这两个文件时别把 BOM 弄丢了。**
