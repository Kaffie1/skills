---
name: coding-workflow
description: 当用户提出功能需求、重构、模块设计或新需求，并希望通过“先用 superpowers 风格澄清与规划，再用 OpenSpec 执行 propose/apply/archive”的完整流程落地时使用；涵盖制品生成、实现、验证与归档的端到端执行。
---

# OpenSpec + superpowers 执行工作流

当用户希望把一个需求真正执行落地，而不只是做解释时，使用这个 skill。

这个工作流结合了两部分能力：

- superpowers 风格的需求澄清、方案比较、任务质量控制和验证纪律
- OpenSpec 的变更制品生成与变更生命周期管理

## 模式选择

这个 skill 支持两种执行模式：

- 轻量模式：适用于局部功能补齐、局部 bug 修复、小范围接口新增、参数补充、明显局部且可短链路验证的改动
- 完整模式：适用于新能力、跨层改动、设计不明确、风险较高、需要长期沉淀，或用户明确要求走完整流程的任务

轻量模式通常满足以下大部分特征：

- 改动范围较小，通常集中在少量文件内
- 架构不变，主要是在现有模式内补接口、补字段、补回调或修局部问题
- 依赖关系简单，不需要复杂的跨模块方案比较
- 验证路径较短，可通过构建、单测、mock、service/topic 调用等快速验证
- 不需要为团队长期维护额外沉淀完整变更制品

完整模式通常适用于以下情况之一：

- 跨模块或跨层改动明显
- 需要先比较多条实现路径再做决策
- 验收标准复杂，不能只靠短链路验证证明完成
- 风险较高，可能影响公共接口、已有行为或多个调用方
- 这次变更需要作为后续协作或规范沉淀的重要参考

强制规则：

- 如果用户明确要求“走全部流程”“完整流程”“全流程”“按 OpenSpec 全套执行”或表达同等含义，必须进入完整模式，不能擅自降级为轻量模式
- 如果用户没有明确指定模式，则由 agent 根据任务复杂度判断使用轻量模式还是完整模式
- 如果任务复杂度介于轻量与完整之间，或 agent 无法稳定判断应使用哪种模式，则必须先询问用户希望走轻量模式还是完整模式
- 无论选择哪种模式，都不能跳过最小必要澄清：必须先确认运行/验证环境和需求边界

## 核心目标

把一个原始需求推进为：

1. 一个已经澄清好的执行目标
2. 一个具备完整规划制品的 OpenSpec change
3. 一个按任务推进、过程受控的实现结果
4. 一个基于需求与验收标准完成验证的交付结果
5. 一个可归档、可追溯的结构化输出

## 何时使用

当用户表达以下意图时使用：

- “实现这个需求”
- “把这个功能做出来”
- “按流程执行”
- “帮我从需求一直做到交付”
- “用 OpenSpec 和 superpowers 跑完整流程”

以下情况不要使用：

- 纯解释
- 仅做代码审查
- 仅做 bug 分析分诊
- 用户明确要求跳过 OpenSpec

## 执行约定

不要停在分析阶段。

如果用户已经提供了足够信息，应尽可能在同一轮内持续推进：

- 只在必要时澄清
- 创建或更新 OpenSpec 制品
- 当用户要的是“执行”而不是“规划”时，继续实现
- 在声称完成之前必须进行验证

补充说明：

- 轻量模式下，允许跳过完整的 OpenSpec change 制品创建，直接进入“最小澄清 -> 阅读代码 -> 实现 -> 边写边验证 -> 汇报结果”的路径
- 完整模式下，必须按本文件定义的 OpenSpec propose/apply/verify/archive 语义推进
- 无论轻量还是完整，只要关键验证没有闭环，就不能宣称完整完成

## 工作流

### 第 1 阶段：用 superpowers 风格收敛需求

在创建制品之前，先把用户请求归一化为一个简洁的执行简报。

至少要收集以下信息：

- 目标
- 范围
- 约束
- 成功标准
- 环境假设
- 执行环境与验证环境

如果缺少关键信息，尽量只问最少的问题。
优先控制在 1 到 3 个具体问题之内。

如果可以合理假设，就不要问过于宽泛的开放式问题。
如果做了假设，必须把假设写入生成的制品中。

环境规则：

- 只要执行环境会影响构建行为、运行行为、验证结果、依赖解析、路径布局、硬件访问、仿真器访问或网络连通性，就必须把它当成必需澄清项。
- 如果用户没有明确说明执行环境或验证环境，在开始实现或验证前必须先问清楚。
- 至少要确认验证是在宿主机上执行，还是在 Docker 内执行。
- 如果仓库里同时存在宿主机运行和容器运行两套模式，不要猜，必须询问用户使用哪一种。
- 如果项目还存在 venv、conda、远程机器人、仿真容器、CI runner 等其他环境边界，要用最小问题把真正的执行目标问清楚。

### 第 2 阶段：探索本地项目上下文

在锁定实现计划之前，先检查仓库现状。

只读取完成任务所需的最小上下文：

- 相关 README 或文档
- 若存在，读取现有 `openspec/` 状态
- 相关源码目录
- 若会约束本次变更，读取现有测试
- 容器或环境定义，例如 `Dockerfile`、`docker-compose*.yml`、devcontainer 文件、环境启动脚本

实现时要遵循现有架构和命名习惯。

### 第 3 阶段：在生成制品前先选方案

如果需求不是特别简单，先简要比较 2 到 3 种实现路径。

然后明确给出推荐方案。

这一阶段的目的是保持 superpowers 的工作方式：不要不经比较就直接进入实现。

### 第 4 阶段：进入 OpenSpec 工作流

当需求已经足够清晰后，把它转换成一个 OpenSpec change。

#### 4.1 创建归一化需求输入

在项目根目录写入或覆盖 `requirement-template.yaml`。

归一化后的需求至少应包含：

- title
- goal
- scope
- constraints
- acceptance criteria
- assumptions

#### 4.2 确保 OpenSpec 已初始化

如果 `openspec/` 不存在，就先在项目中初始化 OpenSpec。

如果初始化失败，停止执行并明确报告阻塞点。

#### 4.3 运行 propose 流程

优先使用 OpenSpec 的直接工作流入口：

```text
/opsx:propose "requirement-template.yaml"
```

如果无法直接运行 slash command，就在项目本地完整执行等价的 propose 流程。

#### 4.4 验证规划制品

至少确认以下制品存在且内容自洽：

- `proposal.md`
- `design.md`
- `tasks.md`
- 必需的 spec 文件

如果规划制品明显不完整或前后矛盾，不要开始实现。

### 第 5 阶段：用 superpowers 的标准提升任务质量

在开始实现之前，检查 `tasks.md` 是否真的具备可执行性。

任务应满足：

- 足够小，能在一次专注会话中完成
- 按依赖顺序组织
- 可验证
- 尽量能对应到具体文件或具体子系统

如果任务太笼统，要先细化再编码。

### 第 6 阶段：通过 OpenSpec apply 执行实现

如果用户要的是执行而不是只做规划，就继续进入实现阶段。

优先使用：

```text
/opsx:apply <change-name>
```

如果无法直接运行 slash command，就完整执行等价的 apply 流程，而不是停留在检查阶段。

实现规则：

- 遵循现有仓库模式
- 如果项目已有代码，先阅读与需求相关的架构、目录组织、命名方式、配置方式和测试方式，再按既有风格实现新增需求
- 在应当有测试的地方，不要跳过测试
- 只实现满足任务所需的最小改动
- 如果实际情况偏离原设计，要同步更新制品
- 所有命令只能在用户已确认的执行环境中运行
- 实现过程中如果出现局部 bug，默认由 agent 自主完成定位、修复和复验；只有在涉及架构取舍、风险升级或需求冲突时，才暂停并向用户确认

### 第 7 阶段：按 superpowers 风格做验证

不要因为“代码写完了”就宣称成功。

验证必须对照以下内容进行：

- `spec.md` 中的场景
- `tasks.md` 的完成状态
- 相关测试
- 用户明确给出的验收标准
- 用户确认过的执行/验证环境

对于风险较高的任务，优先按以下顺序验证：

1. 静态检查或构建
2. 单元测试或集成测试
3. 场景级验证
4. 制品一致性复查

如果有任何部分未被验证，必须明确说明。

补充验证规则：

- 新增需求完成后，若需要补充脚本化测试或验收用例，默认优先放在项目约定的测试目录（如 `test/`），不要放到 `scripts/`，除非项目本身已有明确不同约定
- 面向验收的验证输出，默认优先打印清晰的通过/失败结果，例如 `<topic> verification succeeded`；除非用户明确要求，否则不要默认打印大量中间数据或冗余摘要

降级策略：

- 第一优先级始终是边实现边验证；每完成一个关键子任务，就尽量立即执行对应的构建、测试、接口检查或场景验证
- 如果因为外部依赖缺失、运行环境不完整、链接产物缺失或类似阻塞，导致当前阶段无法完成完整验证，先判断阻塞是否只影响最终构建/运行，还是已经影响接口稳定性与实现正确性
- 如果阻塞只影响最终构建、链接或联调，但不影响当前已知接口下的安全实现，则降级为“优先把能确定的代码写完”，同时继续补齐可做的局部验证，例如静态检查、局部单测、脚手架验证、参数校验或 mock/stub 验证
- 如果阻塞已经影响接口边界、调用语义或实现正确性，就不要盲目把后续代码全部铺完；应停止在高风险边界处，明确说明缺失依赖、当前风险和待确认项
- 无论采用哪种降级方式，只要关键验证未闭环，就不能把任务表述为“完整完成”，也不能执行 archive；必须明确标注“代码已尽量落地，但验证被外部依赖阻塞”

### 第 8 阶段：完成后归档

只有当变更真的完成并完成验证后，才执行：

```text
/opsx:archive <change-name>
```

如果验证不完整，不要归档，要明确说明还缺什么。

## 硬性规则

- 当需求存在实质性歧义时，不要跳过澄清
- 当用户没有说明执行环境或验证环境时，不要自行假设
- 对于实现级别的工作，除非用户明确要求跳过，否则不要跳过 OpenSpec 制品创建
- 在制品至少达到最小自洽之前，不要开始实现
- 不要接受过于模糊的 `tasks.md`，必须先细化
- 没有验证证据时，不要声称完成
- 不要归档未完成或验证薄弱的 change

## 输出要求

在汇报进度或最终结果时，应包含：

- 归一化后的需求摘要
- change 名称
- 制品状态
- 实现状态
- 验证状态
- 是否已完成 archive
- 明确列出假设或剩余阻塞项

## 简短执行提示

如果运行中需要一句话概括当前策略，可使用：

`先用 superpowers 风格把需求收敛清楚，再用 OpenSpec 把结果落成 change 并执行 apply/verify/archive。`

## 内置 OpenSpec 引擎

如果这个 skill 在没有外部 `openspec` CLI 的环境下运行，必须仍然保留 OpenSpec 的执行语义，并通过以下 4 个内部模块实现：

1. `workflow-engine`
2. `spec-validator`
3. `archive-engine`
4. `task-tracker`

接口定义以 `OPENSPEC_INTERNAL_INTERFACES.md` 为准。

解释规则：

- 不要把 OpenSpec 简化成一套 Markdown 模板
- 保留 schema 中定义的制品依赖语义
- 在 archive 前保留结构校验
- archive 的含义必须是“把 delta spec 合并进主 spec，再归档 change”，而不是“只是移动文件”
- 任务完成检查必须是独立能力，不能被埋进 archive 的副作用中

如果环境里有真实的 `openspec` CLI，可以继续使用。
如果没有，就要用 skill 自带的本地引擎模拟同等语义。

### 内置运行资源

这个 skill 自带一套本地 OpenSpec 风格执行引擎，位于：

- `assets/spec-driven/`
- `scripts/lib/`
- `scripts/portable-openspec.mjs`

当没有外部 `openspec`，或希望使用 skill 自带的确定性行为时，使用它：

```bash
node .codex/skills/coding-workflow/scripts/portable-openspec.mjs init
node .codex/skills/coding-workflow/scripts/portable-openspec.mjs new-change <change-name>
node .codex/skills/coding-workflow/scripts/portable-openspec.mjs status <change-name>
node .codex/skills/coding-workflow/scripts/portable-openspec.mjs instructions <change-name> <artifact-id>
node .codex/skills/coding-workflow/scripts/portable-openspec.mjs validate-main <spec-path>
node .codex/skills/coding-workflow/scripts/portable-openspec.mjs validate-delta <change-dir>
node .codex/skills/coding-workflow/scripts/portable-openspec.mjs archive <change-name>
```

优先使用这套内置引擎的场景：

- 需要 skill 的本地可移植性
- 需要 skill 自己控制 schema 和模板行为
- 环境中没有预装 `openspec`

## 内置 Superpowers 层

这个 skill 还自带一层本地 superpowers 风格编排能力，位于：

- `references/SUPERPOWERS_EXECUTION_RULES.md`
- `scripts/lib/capability-inspector.mjs`
- `scripts/lib/change-name.mjs`
- `scripts/lib/request-classifier.mjs`
- `scripts/lib/requirement-normalizer.mjs`
- `scripts/portable-superpowers.mjs`
- `scripts/portable-execution.mjs`

在调用内置 OpenSpec 引擎前，先使用它：

```bash
node .codex/skills/coding-workflow/scripts/portable-superpowers.mjs inspect --request "<user request>"
node .codex/skills/coding-workflow/scripts/portable-superpowers.mjs classify --request "<user request>"
node .codex/skills/coding-workflow/scripts/portable-superpowers.mjs brief --request "<user request>"
```

superpowers 层负责：

- 从 `openspec/specs/` 和 `openspec/changes/archive/` 中检查现有能力
- 把请求分类为 `new`、`modify` 或 `extend`
- 在 change 创建前生成执行简报和 `requirement-template` 形态的结构化输入
- 在实现阶段采用边实现边验证的推进方式，而不是等全部完成后再一次性验证
- 如果实现过程中出现局部 bug，默认先自行定位、修复并复验，只有在涉及架构取舍、风险升级或需求冲突时才暂停确认
- 每完成一个关键子任务，都尽量补充对应的可执行验证，确保实现、调试和验收可以连续闭环

推荐的本地执行顺序：

1. `portable-superpowers.mjs inspect`
2. `portable-superpowers.mjs classify`
3. `portable-superpowers.mjs brief`
4. `portable-openspec.mjs init`
5. `portable-openspec.mjs new-change`
6. `portable-openspec.mjs status/instructions`
7. 增量实现并持续验证
8. `portable-openspec.mjs archive`

如果希望通过单一入口完成本地规划，可使用：

```bash
node .codex/skills/coding-workflow/scripts/portable-execution.mjs plan --request "<user request>"
node .codex/skills/coding-workflow/scripts/portable-execution.mjs bootstrap-change --request "<user request>"
```

`bootstrap-change` 会完成以下事情：

- 检查当前已有能力
- 对请求进行分类
- 生成执行简报
- 生成 `requirement-template` 结构化内容
- 如果需要，初始化 `openspec/`
- 创建 change
- 写入 `requirement-template.yaml`
- 返回初始状态和首批可执行制品说明
