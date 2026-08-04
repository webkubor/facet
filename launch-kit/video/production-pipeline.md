# 视频制作流水线（基于本机已验证工具链）

目标：65 秒竖版 1080×1920，按 shot-list.md v2 七个镜头制作。
本机盘点日期：2026-07-31。✅ = 已实测可用，⬜ = 需安装/待办。

## 工具链现状

| 环节 | 工具 | 状态 |
|---|---|---|
| 配音 TTS | VoxCraft 声坊（~/Desktop/personal/github/voice-editor，Qwen3-TTS 本地） | ✅ 实测：`voice clone "疏音-清冷月色" "<台词>"` 27 秒生成 5.5s wav |
| 音频时长测量/剪辑合成 | ffmpeg / ffprobe（/opt/homebrew/bin） | ✅ |
| 静态素材 | 2 张实测长图 + 12 张模板封面 + page-plan.json | ✅ 已在本仓库 output/ 与 docs/designs/ |
| PDF 翻页画面 | 不必录屏：Playwright（本仓库依赖）对 output/*.html 的每个 `.lesson-page` 截图即得高清页图 | ✅ 依赖已装 |
| 终端打字镜头 | vhs（脚本化终端录制，出 mp4/gif） | ⬜ `brew install vhs` |
| README GIF | gifski 或 ffmpeg 直接出 mp4 | ⬜ gifski 可选：`brew install gifski` |
| 视频组装 | 方案 A：ffmpeg concat + xfade（零新依赖）；方案 B：Remotion（~/Desktop/personal/github/story-to-video 已有工程经验，动效更细） | ✅ 二选一 |
| 字幕 SRT | 由每句 TTS wav 的 ffprobe 时长直接推算时间轴（无需 whisper） | ✅ |
| BGM | story-to-video 里有 bgm-matcher 可复用 | ⬜ 可选 |

## 制作步骤

### 1. 配音（VoxCraft）

音色建议：现有 persona 偏角色扮演（武侠/闺秀/耳语），科技解说建议先设计专用音色：

```bash
cd ~/Desktop/personal/github/voice-editor && source .venv/bin/activate
voice design 科技解说-清朗 "一条命令，同时生成PDF和长图，直接能发。" \
  --tone "二十多岁清朗声线，语速中等偏快，吐字干净利落，像科技区UP主口播，自信不做作"
```

然后按 voiceover.md「TTS 分句稿」逐句生成 7 个 wav：

```bash
voice clone 科技解说-清朗 "<第N句台词>"
```

每句约 30 秒出片，7 句共约 3–4 分钟。

### 2. 时间轴 = 音频时长

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 <每个wav>
```

镜头 N 的时长 = 对应 wav 时长 + 0.4s 呼吸空隙。据此生成 captions.srt（7 条字幕，起止时间累加即可）。

### 3. 画面素材（多数可免录屏）

| 镜头 | 做法 |
|---|---|
| 1 丑 vs 美对比 | 用浏览器默认样式打印 content/example.md 得"丑 PDF"截图；与 warm-handbook 长图 ffmpeg hstack |
| 2 终端构建 | vhs 脚本敲 `pnpm build:example`（可精确控制打字速度、字号、配色） |
| 3 page-plan ↔ 翻页 | Playwright 截 output/example-warm-handbook.html 各页 + page-plan.json 高亮截图 |
| 4 模板轮播 | ffmpeg：docs/designs/*.png 每张 0.8s 快切 |
| 5 主题对比 | 两张 share.png，ffmpeg hstack + 纵向慢滚（crop 滑窗） |
| 6 Agent 工作流 | 唯一建议真人录屏：Claude Code 里让它跑一次 build（QuickTime/系统录屏） |
| 7 README 滚动 | Playwright 打开 GitHub 仓库页脚本化滚动录制，或浏览器录屏 |

### 4. 组装

竖版画布 1080×1920，素材居中 + 上下留白放屏幕文字：

```bash
ffmpeg -f concat -safe 0 -i scenes.txt -i voiceover.m4a \
  -vf "subtitles=captions.srt:force_style='FontSize=18,MarginV=60'" \
  -c:v libx264 -pix_fmt yuv420p -r 30 final-65s.mp4
```

要更细的动效（长图视差滚动、模板卡片飞入）就走 Remotion，套用 story-to-video 的工程骨架。

## 需要用户做的事（其余均可由 Agent 自动执行）

1. `brew install vhs`（终端镜头；不装也行，改用系统录屏）。
2. 挑旁白音色：用现有「疏音-清冷月色」（样例 out/[克隆]疏音-清冷月色_20260731_233954.wav，5.5s，可先听）还是 design 新解说音色。
3. 镜头 6 的 Claude Code 录屏（约 1 分钟操作）。
4. 可选：BGM 选曲。
