---
title: "一个「更新成功」的提示，牵出我机器上 12G 的僵尸"
talkTitle: "更新成功，但版本没变"
subtitle: "四套 node 全局包 · 五个 LaunchAgent 硬编码 · 一次从症状到根因的排查实录"
date: "2026-09-01"
author: "webkubor"
pageHeader: "Node 多副本清理"
pageFooter: "从一条更新提示到 12G 回收"
shareHeader: "一个「更新成功」的提示，牵出我机器上 12G 的僵尸"
shareFooter: "四套 node 全局包 · 五个 LaunchAgent 硬编码 · 排查实录"
slug: "node-multi-copy-cleanup"
series: "技术交流 · 第 2 期"
site: "share.webkubor.online"
closingTitle: "聊到这里"
closingNote: "样本还是只有我这一台机器。你们的开发机上有几个 node？欢迎来对一下账。"
---

# 一个「更新成功」的提示，牵出我机器上 12G 的僵尸

事情的开头很小：OpenCode 弹了一句

```
Update Complete
Successfully updated to OpenCode v1.18.25. Please restart the application.
```

我重启了。它又提示有新版本可以升级。

再更新，再重启，还是提示。**更新程序说它成功了，版本号纹丝不动。**

顺着这条线查下去，最后从机器上清出 12G，还发现五个后台服务的配置里写死了一条即将被我删掉的路径 —— 差一点就把它们全搞挂。

这篇记的是这个过程：我看到了什么、每一步的判断依据是什么、以及哪几次我判断错了。

## 第一层：更新装到了 A，运行的是 B

先看系统里有几个 `opencode`：

```bash
which -a opencode
# /Users/webkubor/.local/bin/opencode
# /Users/webkubor/.nvm/versions/node/v24.15.0/bin/opencode
```

两个。第一个是软链，顺着往下摸：

```
~/.local/bin/opencode
  → /opt/homebrew/opt/node/bin/opencode
  → /opt/homebrew/Cellar/node/23.9.0/lib/node_modules/opencode-ai/bin/opencode.exe   # 1.17.8
```

而 npm 全局包那份是 1.18.25。

时间线还原出来是这样的：某天我用 homebrew 装了 node，顺手 `npm -g` 装了 opencode，还在 `~/.local/bin` 建了个软链。后来我切到 nvm 管 node，**npm 的全局前缀跟着变了**，此后所有更新都装进 nvm 那套，而 `~/.local/bin` 在 PATH 里排第 7 位、nvm 排第 21 位 —— 我运行的一直是六月那个副本。

> 这里有个反直觉的点：`npm ls -g` 显示的是 **npm 当前前缀下**的包，它会诚实告诉你 1.18.25 装好了。但你敲的那个命令根本不是它。**「装了什么」和「跑的是什么」是两个问题**，绝大多数工具只回答前一个。

## 第二层：postinstall 被 npm 拦了

把软链删掉，让 PATH 落到 nvm 那份，结果：

```
Error: opencode-ai's postinstall script was not run.
```

重装一次，npm 自己把原因说了：

```
npm warn install-scripts 1 package had install scripts blocked
  because they are not covered by allowScripts:
npm warn install-scripts   opencode-ai@1.18.25 (postinstall: node ./postinstall.mjs)
```

opencode 的 npm 包只是个壳，129MB 的真实二进制靠 `postinstall` 下载。**npm 12 起默认拦截不在白名单里的 install script** —— 这是个正经的供应链安全改进，但它带来一个副作用：

- npm 认为自己成功了（包确实装了）
- opencode 的更新程序认为自己成功了（npm 退出码是 0）
- 只有二进制没换

**没有任何一方在说谎，但结果是错的。** 这是这次最值得记的一点：链条上每一环都返回成功，不代表事情做成了。真正的判据只有一个 —— 装完之后，那个二进制的版本号变了没有。

修法两条，缺一不可：

```bash
npm i -g opencode-ai --allow-scripts=opencode-ai      # 这次让它跑
npm config set allow-scripts=opencode-ai --location=user   # 以后都让它跑（只放行这一个包）
```

只做第一条，下次自更新还会复发。

## 第三层：不止两套，是四套

问题解决了，但我起了疑心：还有多少工具是这样的？

写个脚本扫 PATH 上所有目录里的同名可执行文件，用 `realpath` 判断是不是真的不同实体：

```
在多个位置各有一份的可执行文件：12 个

  claude         2 处  ⚠️ 不同实体
  wrangler       2 处  ⚠️ 不同实体
  dsh            2 处  ⚠️ 不同实体
  lark-cli       2 处  ⚠️ 不同实体
  ...
```

一路挖下去，node 全局包一共**四套**：

| 位置 | 大小 | 由来 |
| --- | --- | --- |
| `~/.nvm/versions/node/v24.15.0/lib/node_modules` | 1.6G | 当前在用 |
| `/opt/homebrew/lib/node_modules` | 1.0G | homebrew node |
| `/opt/homebrew/Cellar/node/23.9.0/lib/node_modules` | 358M | homebrew 升级 node 时留下的 |
| `~/Library/pnpm/global` | 44M | pnpm 全局 |

其中 `lark-cli` 最有意思 —— **版本是倒挂的**：

```
npm 上最新:  1.0.92
在跑的(nvm): 1.0.39     ← PATH 命中这个
闲置(cellar): 1.0.69
实际命中:   ~/Library/pnpm/bin/lark-cli   ← 结果两个都不是，是第四份
```

它管着我的飞书通知。一直没出事，纯属运气。

## 顺手清掉的 8.5G

盘点时发现 `~/Library/pnpm` 占了 **9.1G**。拆开看：

```
8.7G  store/      ← 内容寻址存储
 44M  global/
 20K  bin/
```

再拆 store：

```
4.9G  store/v11/   ← pnpm 11 在用
3.7G  store/v10/   ← 旧版本残留
151M  store/v3/    ← 更旧的
```

`v10` 和 `v3` 是历史版本的 store，pnpm 11 根本不看它们。删掉，再对 v11 跑一次 `pnpm store prune`：

```
Removed 194015 files (4.16 GB)
Removed 3473 packages
```

**8.7G → 243M**。

> pnpm store 是硬链接的源，清理它不会弄坏现有项目 —— 下次 install 重新下载即可。但 `prune` 只清「当前没被任何项目引用的」，旧版本目录它不管，得手动删。

## 换成 mise：为什么不选 Volta

到这一步，结论已经很清楚：**病根是「多个 node 来源共存」，不治它就会一直复发。**

候选是 Volta 和 mise，我查了一下：

| | Volta | mise |
| --- | --- | --- |
| star | 13k | 33k |
| 最新 release | 2024-12-05 | 2026-08-31 |
| 最后提交 | 2025-11 | 当天 |
| open issues | 341 | 53 |
| 管理范围 | 仅 JS | node/python/go/rust… |

Volta 的设计我很喜欢 —— 它的 shim 会让全局 CLI **记住自己该用哪个 node 跑**，换 node 版本不丢工具，正好治我这个病。但 release 停在一年半前、341 个 open issue，把工具链押上去不合适。

加上我机器上 Python 有 pipx、Go 有自己的项目，mise 能一份配置全管，就它了。

## 真正危险的地方：删之前先扫引用

装好 mise、把 20 个全局 CLI 迁过去之后，我准备删 nvm。

**删之前扫了一遍系统里谁在引用它** —— 这一步救了我：

```
=== 引用 nvm 的 LaunchAgent ===
  ai.hermes.gateway                  🟡 只在 PATH 环境变量里
  com.github.facebook.watchman       🟡 只在 PATH 里（还指向早就删掉的 v22.19.0）
  com.modelgo.followup               🔴 Program 直接写死
  com.webkubor.claude-codex-patrol   🟡 只在 PATH 里
  com.webkubor.cpu-watchdog          🟡 只在 PATH 里
```

五个后台服务。其中一个是 Program 字段直接写死 `~/.nvm/.../bin/node`，删了 nvm 它当场就起不来。

还有三处藏在脚本里：

- `~/.dsh/serve.sh` —— launchd 不加载 `.zshrc`，脚本自己解析 nvm 目录
- `~/.claude/bin/cs-doctor` —— PATH 里写死
- `~/.claude/CLAUDE.md` —— 修复命令里的路径（文档也算引用，照着敲会出错）

**这是这次最大的教训**：卸载一个运行时之前，光看「有没有进程在跑它」是不够的。launchd plist、cron、各种 `serve.sh`、甚至你自己写的文档，都可能把路径焊死在里面。而这些引用**平时完全无害**，只在你删掉目标的那一刻集体爆炸，还是延迟爆炸 —— 下次服务重启时才炸。

改完之后，DSH 那个我特意用 `mise where node` 动态解析，并保留一条 nvm 回退：

```bash
MISE_NODE="$(/opt/homebrew/bin/mise where node 2>/dev/null)"
if [ -n "$MISE_NODE" ] && [ -x "$MISE_NODE/bin/dsh" ]; then
  NODE_BIN="$MISE_NODE/bin"
else
  NODE_BIN="$HOME/.nvm/versions/node/$(ls ~/.nvm/versions/node | sort -V | tail -1)/bin"
fi
```

迁移期两边都能起来，验证通过了再拆回退。

### 还有一类引用不在文件里

上面那些都能靠 `grep` 扫出来。但删完当天我又被咬了一次 —— git commit 起不来了，hook 报找不到 node。

查下去发现：hook 文件本身干干净净，没有任何 nvm 字样。**问题在它继承的 PATH** —— 我那个终端会话是在删 nvm *之前*开的，`$PATH` 里第 21 位还钉着 `~/.nvm/versions/node/v24.15.0/bin`，而那个目录已经没了。git hook 从调用方继承环境，于是 `node not found`。

```bash
# 修法：把 mise 的 node 顶到最前，并剔除已失效的 nvm 路径
export PATH="$(mise where node)/bin:$(echo "$PATH" | tr ':' '\n' | grep -v '\.nvm/versions' | tr '\n' ':')"
```

**不要用 `--no-verify` 绕过去** —— 那是把「环境坏了」伪装成「门禁不重要」，下次真有问题时门禁已经形同虚设。

所以扫引用要扫两层：**磁盘上的**（plist / 脚本 / 文档里的硬编码路径）和**进程里的**（已经启动的 shell、常驻服务继承的 PATH）。后者 grep 不出来，只能靠「删完之后新开一个终端，把关键操作重跑一遍」来暴露。

### 第三类：应用数据目录里的软链

删完第二天，DSH（我常驻的一个本地服务）的插件和模型配置在界面上全空了。

一查，`~/.dsh` 下有 **106 个悬空软链**，全部指向已经删掉的 nvm：

```
~/.dsh/profiles/node_modules/zwitch
  → ~/.nvm/versions/node/v24.15.0/lib/node_modules/@deepseek-ai/dsh/node_modules/zwitch
```

这类引用最难扫，因为：

- 它**不是配置文件**，`grep -r "nvm"` 扫配置目录扫不到
- 它**不是脚本**，没有可读的路径字符串
- 软链的目标只存在于文件系统元数据里，只有 `find -type l` 逐个 `realpath` 才能发现

更麻烦的是同版本包的**依赖树可能不同**。我重装的是同一个版本号 `0.1.1-rc.2`，两份都是 281M，但 nvm 那份的 `node_modules` 里有 `zwitch`/`shiki`/`katex`，mise 这份没有 —— npm 在不同时间点解析出的依赖树不一样。所以「重装同版本」不等于「恢复原状」。

结局倒是轻松：把 106 个悬空链全删了、重启，**新日志 0 个 MODULE_NOT_FOUND、0 个错误**，服务照常起来。说明它们是旧安装的残骸，没有任何功能真依赖。而界面上那次「全空」，是浏览器还持着重启前的旧连接，刷新就好了。

> 这里我差点误判：日志里确实有 `Cannot find module '@webkubor/dsh-bloom-theme'`，看着像实锤。但数了一下行号 —— 报错在 12~157 行，而第 8 次启动的标记在 164 行，**从第 8 次启动之后再没出现过**。那是几个月前包改名时的旧账，日志没轮转所以一直留着。
>
> **看日志要看它是哪一次运行的**。tail 出来一段红字就下结论，很容易把老账算到今天头上。

所以完整的清单是四类：**配置文件里的硬编码路径**、**脚本里的动态解析**、**进程继承的 PATH**、**数据目录里的软链**。前两类 grep 能扫，第三类靠新开终端重跑，第四类只能 `find -type l`。

## 我判断错的三次

写这类实录，只写「我怎么找到答案」是不诚实的。这次我错了三次：

**一、把 mise 的启动挂错了位置。** 我把 `eval "$(mise activate zsh)"` 插在 nvm 之后，看着很合理。但 `.zshrc` 后面有一行 `path=(...)` —— 那是**赋值**不是追加，把 mise 刚加的 shim 路径整个冲掉了。新 shell 里 node 还是 homebrew 的 v23.9.0。

移到文件末尾才生效。

**二、用错了验证方式，还差点据此下结论。** 我用 `zsh -l -c '...'` 验证，看到 node 还是旧的，一度以为迁移失败。实际上 **zsh 在非交互模式下根本不加载 `.zshrc`** —— 我的验证方法本身是错的。换 `zsh -i -c` 一切正常。

**三、`facet` 装成了同名的别人的包。** 迁移时我对着包名 `npm i -g facet`，装完发现没有可执行文件。一查：npm 上的 `facet` 是 "Configuration mixin for constructors"，而我用的 `facet` 是自己写的 Markdown 排版工具，**从来没发布到 npm，是本地 `npm link` 的**。

> 这条对做工具的人是个提醒：**包名不是身份**。迁移全局 CLI 时不能只看名字，得看它的 `resolved` 字段 —— 是 registry 来的，还是本地 link 的。

另外还有一次操作失误：`brew uninstall node` 触发了 autoremove，把 **ripgrep** 一起卸了 —— 它并不是 node 的依赖。装回来了，但下次卸 brew 包我会先看它打算带走什么。

## 结果

```
mise ── node 24.15.0 ── 21 个 CLI      ← 唯一 node 来源
brew ── mise / gh / wget / ripgrep …    ← 不再有 node
pnpm ── ~/Library/pnpm
pipx ── Python CLI
```

| 项 | 回收 |
| --- | --- |
| pnpm store（旧版本 + prune） | 8.5G |
| nvm | 2.0G |
| homebrew node 本体 + 全局包 | 1.27G |
| Expo/RN 那套（早就不用了） | 180M |
| opencode 旧副本 | 123M |
| **合计** | **≈ 12G** |

顺带修好的：`lark-cli` 从 1.0.39 升到 1.0.92（飞书通知那条链路）、`claude-code` 2.1.91 → 2.1.252、一个指向已删除 node 版本的死 alias。

## 几个我还没想明白的

**一、这类问题为什么没有好工具？** 现有的版本管理器都在回答「我装了什么」，但真正咬人的是「我跑的是什么、它被谁遮蔽了、更新到底生效没有」。这个信息其实完全可以自动算出来 —— 扫 PATH、比对 realpath、跨位置对账版本号 —— 但我没找到现成的。

**二、更新程序该不该自己验证？** opencode 的更新逻辑是「npm 退出码 0 = 成功」。这在 npm 加 `allowScripts` 之前是对的。工具是不是都该在更新后回读一次自己的版本号？成本很低，但我没见几个这么做。

**三、多久该盘点一次？** 我这台机器上最老的僵尸是 2023 年 11 月的 cordova。中间换过 node 管理器、换过包管理器，每次换都留下一层。如果不是这次 opencode 报错，我可能永远不会发现。

这些都是我一台机器上的样本，不一定有代表性。你们的开发机上有几个 node？
