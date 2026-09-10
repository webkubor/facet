---
title: "症状消了不等于前提对了——两起静默故障的复盘"
talkTitle: "静默的成功比响亮的失败更危险"
subtitle: "DSH 心跳被吞、gigi 两天零心跳 — 三行 continue 让告警静默几十天"
date: "2026-09-09"
author: "webkubor"
pageHeader: "Silent Failure · 哨兵修复"
pageFooter: "9-9 号的事后复盘"
shareHeader: "症状消了不等于前提对了"
shareFooter: "DSH 心跳被 curl --fail 卡在 401、gigi 三层失败全被 >/dev/null 2>&1 吞掉——都是静默的成功。"
slug: "silent-failures-sentinel-fix"
series: "技术交流 · 第 5 期"
site: "share.webkubor.online"
closingTitle: "前提错了，补丁再准也是错的"
closingNote: "显示得再准，也要人去看。让哨兵自己喊，比等人翻表靠谱。"
---

# 症状消了不等于前提对了

今天两起故障的共同点是「静默的成功」，不是「响亮的失败」。

DSH 心跳被 `curl --fail` 卡在 401、gigi 三层失败全被 `>/dev/null 2>&1` 吞掉——都跑了几十天，日志空白，退出码 0。

真正治它的是哨兵那三行改动：让"从来没通过"这件事自己喊出来，而不是等人翻表。

## 已做与证据

哨兵本来就有 `agent_stale` 告警，也一直在跑（今天 03:50 还报过 `dispatch_hub_stale`）。

但 gigi 两天零心跳，它一条都没响。原因在 `cmd/watch.go`：

```go
hb := toString(a["heartbeat_at"])
if hb == "" {
    continue // 从未上报过心跳的 agent（如本机 CLI）不算失联
}
```

"从未上报过"被当成不算失联。而注释给的理由（"如本机 CLI"）早就被上面那条 `runtime=="cli"` 拦掉了——所以这条兜底只剩一种命中：

> 注册了、有职责、是服务器 agent，但一次都没接通。

那恰恰是最该报的一种。

翻转成报警，文案区分开：

> agent `<id>` 注册后从未上报过心跳 —— 凭证或 beat 脚本没接通

加了测试 `TestNeverBeatenAgentAlerts` 钉住这条：服务器 agent 空心跳必报，`cli:*` 不报。`go test ./...` 全绿。

## 这一路的方法，三条

### ① 症状归属先定，再顺着查

「DSH 失联 4h」我上午当成事实报给你、还提议 ssh 上去查——它就在本机，launchctl 一条命令就能证伪。

判定是二手的，得先问「这个结论谁算出来的」。

### ② 加字段前先查现有字段为什么是空的

`kind` 装不下 GUI，我第一反应是加 `probe` 列；`runtime` 列就在同一张表、同一次输出里印着 `Runtime: hermes`，我看了三次没停下来问「这值对吗」。

> 默认值糊出来的空，和真的没这个概念，长得一模一样。

### ③ 补丁消症状，前提留在代码里

DSH 被报失联，我加了个「心跳过期但端口应答就算活」的例外分支——那还是承认心跳是主判据。

你一句「本地的不需要这玩意」才把判据本身换掉。

> 症状消了不等于前提对了。

## 你必须清楚了解

DSH 心跳被 `curl --fail` 卡在 401、gigi 三层失败全被 `>/dev/null 2>&1` 吞掉——都跑了几十天，日志空白，退出码 0。

真正治它的是刚才那个哨兵改动：让"从来没通过"这件事自己喊出来，而不是等人翻表。

## 现在该做的三件事

哨兵现在报着 3 个新问题，都不是 agent 相关：

1. **git_hygiene** — 本机 10 条已合并未删的分支，最脏是 `hym-manager`（7 条）
2. **service_down** — `guqiuyue` 上的 `hermes-gateway` 没在跑
3. **task_backlog** — P1「调度看板」queued 6 天无人认领

`vex / nanzhu` 的 `agent-beat.sh` 还是同样的吞错写法（目前能跑所以没暴露）。这三件加上脚本加固，我都能直接做。

## 复盘这一轮的摩擦

真正该被记住的不是我修了两个心跳，而是这两个故障都是你逼问出来的，不是系统自己报出来的。

我前面几轮一直在改「表怎么显示」——显示得再准，也要人去看。

> 哨兵那三行 `continue` 才是它们能静默几十天的原因，我却是在你第四次追问之后才去读 `watch.go`。