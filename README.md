<p align="center">
  <img src="assets/brand/icon-rounded.png" width="128" height="128" alt="Rhino logo" />
</p>
<h1 align="center">Rhino</h1>
<p align="center">一个人的训练日志：安排力量与有氧，记录每一组，回看自己的进展。</p>
<p align="center">
  <a href="https://rhino.hexly.ai">站点</a> ·
  <a href="docs/README.en.md">English</a>
</p>

## 这是什么

Rhino 是单用户健身计划与记录网站。根据每周可训练次数、时长和器械安排训练，开始前微调动作与组数，结束后记录实际完成情况。中文界面适配电脑和手机，Cloudflare Access 限定访问身份，Worker 与 D1 保存个人档案和训练历史。

当前是个人预览版本，不是专业教练或医疗服务。三维动作尚未经专业审核，肌群高亮只是表面区域示意，不代表精确组织分割或肌肉激活测量。真人视频是外部参考，也不构成个性化训练处方；动作不确定或出现疼痛时应停止并咨询专业人员。真实手机性能仍需单独验证。

## 功能

- **训练计划**：按频次、时长、器械与重点部位生成每周力量／有氧安排，支持骑行等纯有氧训练；每月重新采纳计划时保留不可变的历史版本。
- **训练记录**：开始前替换动作、调整组数、次数及有氧时长；训练后记录实际次数、负重、剩余次数（RIR）、跳过的组和有氧强度，不把计划量当成完成量。
- **动作实验室**：11 个力量动作，提供三维示意、肌群高亮、中文要点和静态阶段图；每个动作配有注明来源的 YouTube 真人参考，点击加载后才连接第三方。
- **个人进展**：按日期录入身高、体重，以曲线查看变化；保留原始精度，使用历史身高计算 BMI，根据生日提供有不确定性的心率估算，并支持医生给出的心率范围。
- **可靠保存**：个人记录保存在 D1，更新检查版本冲突，训练开始后保留原计划快照。BMI 不是诊断，年龄公式不是安全上限，也不决定力量负重。
- **本地隔离**：开发页右上角切换 Local／E2E／Prod；日常本地记录、临时测试数据和线上数据分开，过期页面的请求不能自动转向新环境。

弯举、臂屈伸、侧平举、俯身划船和提踵可在训练前选择，自动计划仍使用基础 A/B 模板。称重提醒、交互式加重建议等尚未完成的能力见[当前限制](docs/08-local-and-release.md#open-acceptance-work)。

## 使用

1. 打开[站点](https://rhino.hexly.ai)，通过 Cloudflare Access 使用获准的所有者身份登录。
2. 在「个人档案」设置生日、器械与训练偏好，并记录身高和体重。
3. 在「训练计划」预览并采纳周计划；当天选择一次训练，开始前按实际情况调整。
4. 训练后填写完成的组和有氧内容，在「我的进展」回看记录与趋势。

个人页面与业务 API 均需要所有者身份。当前源码的匿名 `GET /api/live` 仅提供应用名称、版本、revision 和最小数据库健康状态，不返回个人记录；数据库不可用时返回 503。源码变更是否上线，以[Release](https://github.com/nocoo/rhino/releases)和[部署结果](https://github.com/nocoo/rhino/actions/workflows/deploy.yml)为准。

## 开发

使用 Node **26.10.0**、Bun **1.4.2**，TypeScript 固定为 **7.0.2**。本机若限制 npm 官方源，遵循机器的镜像配置，不修改锁文件中的来源地址。

```sh
bun install --frozen-lockfile
bun run db:migrate
bun run dev
```

已配置的开发机器访问 [rhino.dev.hexly.ai](https://rhino.dev.hexly.ai)，Caddy 转发到 `127.0.0.1:7057`。Local 使用合成身份和本地 D1，无需生产凭据，不应公开暴露。其他机器需要配置相应本地域名与保存来源，见[本地环境说明](docs/08-local-and-release.md)。

| 环境 | 数据与行为 |
| --- | --- |
| Local | 每次启动的默认环境；`.wrangler/state` 持久保存日常开发数据 |
| E2E | 创建新的临时 Wrangler 数据库；退出后仅清理自身标记匹配的实例 |
| Prod | 使用真实 Access 身份代理到线上 Worker；读写都会影响生产数据 |

切换前确认放弃未保存修改，再重新加载页面。旧标签页会被拒绝，而不是继续访问新环境。自动化测试锁定 E2E；生产站不显示切换器，也不提供本地网关。

确需在本地访问生产数据时，先安装 `cloudflared` 并登录，再主动选择 Prod：

```sh
bun run login:prod
```

凭据只留在本地服务端，不传入浏览器 JavaScript。

```sh
bun run typecheck
bun run lint
bun run build
```

部署使用固定版本的公共 `nocoo/base-ci`：本仓库 `main` 的 push CI 全部通过后自动部署同一 SHA，无须手动触发或人工批准；PR、失败或过时的 CI 不会部署。上线后自动验证版本、revision、D1 健康和业务 API 的 Access 保护。自建部署必须先替换仓库中的维护者账号、D1、域名及 Access 配置；不要直接部署到现有资源。配置、迁移与恢复步骤见[发布手册](docs/08-local-and-release.md)。

## 测试

安装依赖后在仓库根目录执行：

```sh
bun run test:coverage
bun run test:l2
bun x --no-install playwright install chromium
bun run test:l3
```

单元测试使用 Vitest，Worker 测试调用真实隔离的本地 D1；L2 通过 HTTP 验证接口，L3 覆盖桌面与手机尺寸的浏览器流程。测试生成独立 RS256 密钥和带标记的临时数据库，移除继承的 Cloudflare 凭据，不写入日常 Local 或线上数据。L2／L3 必须通过上述 runner 启动。

## 技术栈

| 技术 | 用途 |
| --- | --- |
| React · Vite · Basalt · Lucide | 中文响应式界面、控件与图标 |
| Three.js | 动作示意、视角控制与肌群区域显示 |
| Recharts | 个人测量与训练趋势 |
| Cloudflare Workers · D1 · Access | API、持久化与所有者认证 |
| TypeScript · Zod · jose | 类型、输入校验与 JWT 验证 |
| Bun · Biome · Vitest · Playwright | 脚本、静态检查、单元与浏览器测试 |

## 文档

- [文档索引](docs/README.md)
- [训练依据与适用边界](docs/02-training-evidence.md)
- [计划与指标算法](docs/03-planning-and-metrics.md)
- [架构与数据契约](docs/04-architecture-and-data.md)
- [界面与三维动作验收](docs/05-experience-and-3d.md)
- [本地环境、发布与恢复](docs/08-local-and-release.md)
- [真人视频来源](docs/09-video-references.md)
- [品牌资源使用](assets/brand/README.md)
- [维护规范](AGENTS.md) · [变更记录](CHANGELOG.md)

## 许可证

应用代码与文档采用 [MIT](LICENSE) 许可证。随附的 MakeHuman 几何与骨骼资源保留独立的 **CC0** 许可，来源、哈希、修改和限制见[模型来源](assets-source/README.md)，未包含购买的素材。
