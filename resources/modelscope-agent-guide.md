# 【单Agent】ModelScope\-Agent学习指南

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OWVkNzU1ZmNjODhlZDU5MDAwMWNmMzI3ZDFlNWY4MGVfNmZlZWU3NmU1ZDE0YmVjY2ExOWYyY2FmOTNmZGU0MDFfSUQ6NzMyMjY3MzQzMzc3MzczNTk0MF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YzU4OTU3ZjhkYzhjZWYwNmQ3ZTIzYjFiOTlkY2M5ZmZfZTBiZTc4YTBkMjI0NjZmNmZhYmNjMDRiYTY1YTEyOWJfSUQ6NzMyMjY3MzQ3NjIwMTE4NTI4M18xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

# AI Agent **Engineer**认证

1. 认证地址：https://certs\.datawhale\.cn/agent/quiz/intro

2. **评分标准**

    - 满分 100 分，成功获得 80 分及以上，可获得 Datawhale x 魔搭社区 联合颁发的 Agent Engineer 证书

    - 可反复考试认证，通过学习以下内容来提升分数

3. 证书查询：https://certs\.datawhale\.cn/agent/quiz/intro，点击查看证书

# 必知必会

> 阅读时，请注意文字左方的小三角，意味着可以 展开 查看详情
> 
> ![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MTYyYmUzYjM3YWZkMjJhNzcxMWIzMDA4ZTU3YjVlZDhfZTJkMzAwNzdmMjc2MjAxNzBjMzEzMWZlMWRmODZkNzRfSUQ6NzMxMTY5NDU1MDE5ODkyNzM2MV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)
> 
> 

## 🧠 Agent概念入门



![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjE5NDFjMGRiNmU1NmJkZDQyNTZmN2IzYTQ2NmY1ZTRfODdkMWY0ZjhhZDE4YzhhMmZkYzYwNDkzNzhjZjRlNDhfSUQ6NzMxMzE3NTkxMjA5MzE1NTMyOV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZTc5YTBhYTkyOGU1NWExMDFiZTRmMzhmZDdhYWFhNTVfOGFmNmVhNGRkZDk3YWVjNWI5ZjE3NmU2ZGIxNDUwNDVfSUQ6NzMxMzE3NTk0NjU5OTc3NjI1OF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

[https://www.bilibili.com/video/BV1cu4y1k7Pg/]()

## [零代码动手创建ModelScope Agent](https://datawhaler.feishu.cn/wiki/URhIwhft4iUPcRkx7BOcBc6anhe)

目前Agent创建项目已有一定更新，界面可能存在差异，但整体步骤没有大变动

另外魔搭创空间已支持直接进行Agent应用创建，本教程可能存在一定的滞后，期待你能一起共创更新

有意维护可联系@Amy（wx：aomferni）

### [创建通义千问API](https://dashscope.console.aliyun.com/overview) \(新注册用户有一定的限时免费额度\)

1. 登录阿里云账号，打开 [DashScope管理控制台](https://dashscope.console.aliyun.com/overview)，开通 **DashScope灵积模型服务**

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NmI3ZDIzZTlkYmQ2OGIxOGQ3NjY4NDkxY2QyOGQ1OWRfMWVhOWY3MWI2ZDc1YzRlYjE5OTcyZWFjZWMxNjAwMzVfSUQ6NzM0NTAyMTI0OTAyNDExNDcxNl8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ODU2MGI4MDk3YTM3NTljNWRkZjNjZTFhMjJjM2Y2NDNfZmZiNGU0NzgxMzU1ZTQxZDQ1Y2NhZWMzZTIwNDVlODVfSUQ6NzM0NTAyMTI1MTI4OTc0MzM2M18xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjFiNTMwMWEyZWU0ZTA0YzA0ZmUzMWU5MmM3ODEyMGVfYWI5ODExN2E3NmJiZDRhZjI1ZThkNTNhMDlkMDg0NmFfSUQ6NzM0NTAyMTI0OTI5NDIzNzcwMF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

2. 回到控制台，创建 **API\-KEY，****并记得复制保存！！！！**

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NWY5ZTQyODA5YjEyM2RmZjA5NmI4ZjZkODY3MmQyY2VfMWRhMjIwYWQ0YTRkMTIyNzMwYmFkYWI0NjkwMGQ3MzNfSUQ6NzM0NTAyMTI1Mjc3OTAxNjE5Nl8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YTY0YzljYTc2N2QxMzEwODVmMzU4ZmM4YWJhZmNkNmRfNmRmNzQyYzZkOWYxMDUwZWEyMTYyOWZhZmQ3ZTU0ZGRfSUQ6NzM0NTAyMTI1MjQ4OTE4MzIzNV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZDYyNjEzYmU5MDVkZTFmN2RmM2FmMDc0OTc0NjkwNGRfY2NiYjYzYjFmOWQxZGMxNDkyYzY5NmU3NzBhMzc2YzlfSUQ6NzM0NTAyMTI1MDE3ODQzMzAyNV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

3. 后续就可以快乐地使用 **API\-KEY **啦\~\~\~\~

4. 最新限时免费的[模型列表](https://dashscope.console.aliyun.com/billing)如下

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MWVjOWNlMTdhNjY2Y2Y0NjRjZTdlYmUyZmRkNmY0NTBfYWZkOWNiMTk5MDJhZjVmMjMxNzE0ZGI3NDI3MGQ0NzdfSUQ6NzM0NzYyMzIzODMzMzkwNjk3Ml8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

### 使用 [魔搭Agent创建器](https://modelscope.cn/studios/modelscope/AgentFabric/summary) 快速创建Agent

打开魔搭社区的 [AgentFabric](https://modelscope.cn/studios/modelscope/AgentFabric/summary)，或者 [创空间\-交互式创建应用](https://modelscope.cn/studios/agent)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OTFmZTJkMjc5MWJhZWI5YTgyNmM4YTIxZmU5YzE0ZjFfMjE2MTc2ZTg2M2I3NGE0NjU3ZDc5Y2RmNDQ4NDRlZTdfSUQ6NzM1NjQzMTM3NTc2Mjc2Nzg3Nl8xNzg1NTkxODg0OjE3ODU2NzgyODRfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZDExYWZkZjRiOWIyMTlkNjc4MzMxOWM2MjE0Y2JiN2NfOWVkNDZmNDBhMzA3YzRiMzdhMTU0OTI0MDdlNzFhOGRfSUQ6NzM1OTQ5MzkzMzk2NDYyMzg3NF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

左边点开【create】是一个聊天界面，只需打字就能零代码创建一个Agent，右边是即时体验界面

#### 创建天气小助手

1. **在左侧聊天框中发送你想要的功能**

    这里我给出一个 设计天气查询Agent 的example

    ```Plaintext
    我想做一个能查询天气的agent，名字就叫“Datawhale&Modelscopeの天気予報”，要求能查询我指定城市今天的天气情况和温度信息，并画一幅图向我形象的展示出来。
    ```

    可以看到，它在回复的同时，多了2行字，分别是

    “✅Config Updated\!

    ✅Logo Updated\!    ” 

    这是在调整Agent的配置，以及logo，可以在右边查看到具体的修改。

    此外它还会反问一些问题，比如城市和展示风格等。

    可以通过回复来进行进一步的配置自动调整，但也可以不予理会，右边可以实时体验调整后的效果。

2. **检查配置\&提供Tool**

    点进左上角的【Configure】可以查看 Agent 的配置，其中的字段均可任意修改做Prompt Enginerring

    下方的【Capabilities】是这个Agent可调用的Tool，目前可用的内置Tools有限，可按需勾选

    此处勾选了用于画画的“Wanx Image Generation”，和用于查天气的“高德天气”

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NzEzZThkYWE3YmE3NGVkYzVjNmViMjBkODQ0ZDJhNjlfMThjOWExNTFmZTkwNzI4MDA5NDI5Y2M0YjkyMmE3YzBfSUQ6NzM1NjQzMTM3NTc2MjczNTEwOF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

3. **体验Agent，做Prompt Engineering**

    1. 右边的聊天框里随时可以体验 Agent，可自由根据实施效果进行Prompt修改，但修改后记得点击【Update Configuration】更新配置，否则效果不会有变化

    2. 还可以 点开▶，查看调用详情

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZTlkMTYxZjc1YjUwMmVmMGE4ODc1OThhNmQzOGRkMDlfN2EwZWNlYzI0MTc2MDljNGQxMWQ3NWE2ZGI2NTk1NmRfSUQ6NzM1NjQzMTM3MzEzNTgwNjQ2N18xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

4. **Agent能力体现**：将指令自动拆分成了“天气查询”和“画图”，并成功的调用了对应的工具完成任务

#### 创建宠物模拟器

> Prompt：我想做一个 宠物模拟器，让用户可以在线给自己选一只宠物，进行起名和进行喂养、玩游戏、出门遛弯等行动，并每次都能输出多张合适的图片，并在完成5次操作后，生成markdown文档记录这些行动
> 
> 

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YTNlNzYzY2Y3Njg5OThlOTcyNmMzYmEwZGFmZTMwMThfYTA2YTk3MDI4ZTRhZmFjOWU2OWJlMzYwYTA5ODU1YTdfSUQ6NzM1NjQzMTM3Mjc2MjI4NDAzNl8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=M2NlYWY5NGIxYTE4NWJhM2ViOGEwNmI4MzQ0ODg1MWVfMGFhMzVjMGI1MGU3MDg0NzJkMGEyOTlmMjZlNjc0ZDlfSUQ6NzM1NjQzMTM3MjYyMDcwOTg5Ml8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ODc4ZWQ4MDUxNjEyOTk5YTQ1MWQxNzI1OGQzZTBmMDhfMzAyZGExODdhODkzNGViNGNkNjlhYjM1YjkyMzJmNzRfSUQ6NzM1NjQzMTM3MjczMjg0MTk4OF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MzA1OTA3NDQ3YzgxNjVjMzg4MDI2ODFjYTczNmEwOGNfZDY4NThlNTdlZTI3OGJkNzJjYTBiODI1ZTA1ZjAxOGJfSUQ6NzM1NjQzMTM3NjIyNDY0OTIxOV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZmY4NDcwN2VjMmI2YjM2Yzg4MTg3NThjOWM2M2E1MDJfNjQwMDQzMzQ4ZDc3ODQzNDRkYjM2ZmFhZjEyYjQzMTZfSUQ6NzM1NjQzMTM3MzUzMDQzMTQ5MV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=M2RkNmRmNGU5Yjc3MzJlYjEzZTdkYzkyODM5ZWM0OThfNWM4ZmU3MDdjZDViNDdhOWQzZDY5ZDQ3MDhhZjIwNDdfSUQ6NzM1NjQzMTM3MjYyMDc0MjY2MF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MDIxNzg3NDJiY2YxODZlZjFiMDQ2ZTU0MTA5ZDkzZjVfZDhmM2FhZTBjNDkzNDQ3ZGIyNmQ1ODNmYjBhOWM3MDJfSUQ6NzM1NjQzMTM3MTgxMTgxNTQyOF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NjJhZDAxNjgyZWE4MGE5NTI5ZWQ2NjRmNWYyOGM0ZDdfNjc5YWJjM2RiYmUyNGM0MTczM2RlZjI2NTNhMzRiOWZfSUQ6NzM1NjQzMTM3MTkyNzkxMjQ1MV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

### 发布 属于自己的Agent

1. 创建Agent并实验效果满意后，点开【发布】，点击【构建】，构建完成后点击【发布】

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YjlmZmFmZTJmY2NjMzdjOGE4YzViZGEwZDJiY2EzZGJfNWU4YTFlNGI4MjYyZTBjNTg0OWU4MjYxNmNjZmVhZmVfSUQ6NzM1NjQzMTIzOTgwMjg5NjM4OF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NTQ5NmQzZWZiYjNjNWYxMjQ1OTkzODFhYTBhMGU0YjJfMDVmM2M0NmJmNGVhODVhOGI0Njk3MDQzZDg5OWE0OTlfSUQ6NzM1NjQzMTI0MTQwNTM0OTg5Ml8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

2. 跳转到创建创空间，修改创空间信息，填入前面创建的 **API\-KEY**，然后【复制创空间】

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZWE3NTQxNjkxOTQzMDhhOTRhYzIxZTUwOGUzZjU0NWRfY2Q5ZTQ1YTNlMDAxYjNkODM0ZTQzYjY5ODY1MGE1YmZfSUQ6NzM1NjQzMTI0Mjg2MTQ2MTUwOF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=M2JjODNiOWE2OTA4MWE0YWIyMzIwYmYwYmRlMDQzMTRfZDMwZjgzMTMyYTYzYzIyNTYyYTBkZjFiMDcyOGI5MjBfSUQ6NzM1NjQzMTI0MDE3MzMzODYyOF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

3. 打开相应的创空间，进入【设置】、【上线空间展示】

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZTRmOTllNTM4OTM5ZWNkZDRhOTA1NzQ2YzY3MTg0NzZfNDEzODNiMTg2NzBmMTY1NDVhY2U4MjgzZTcxZTRjYmJfSUQ6NzM1NjQzMTIzOTU3NDEyNjU5Nl8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Yjk2MmYxMDFjZmQxMGVlNWM0MjcyZTZiYTM0OTgwNDZfYWZkYmE3NWY3ZTE5M2ZkMjliNjc3OWJhYmYzZjRkYTlfSUQ6NzM1NjQzMTI0Mjk1MzQ5MDQzNV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YjY0NmJmM2RlZWJmZDYwY2MzNTdjYTlkZjc1NmRiNjBfMDNkYzY2MWY4ODY2OWIxZDBiNjQ5YTAzYTIxYzVhMGVfSUQ6NzM1NjQzMTIzODkxNzg4MTg1OV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Mjc1OTI1OTRmYjA4MTcxODEzYzE5ZTJhZTc2MDEzYmZfMjVkZGNkMzU2ZjdiMzI0YjI5MWU0NDY2N2E4NjM3ZDlfSUQ6NzM1NjQzMTI0MDczNTkxNjAzNV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjE3MTdlZmM2NjIyZDc2NzM0ZThmY2UyZDgwOGUzZDJfZDNkMzE4YTU2MjcwZDI2ZDQ1Y2Y4N2FjZGU1YTAxZGVfSUQ6NzM1NjQzMTI0MTgzNjgwNjE0N18xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NzQyYTFiYzcyMDAxMmMxNTZlYzFjNmM4MjU1ZmZhMmFfYzI4OTM5ZWIwNDEyMWE3NGFhOTkzNzJjNTQ1MDMwMzFfSUQ6NzM1NjQzMTI0MTk1NDY4OTAyOF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YzIxYTk2NzJmMWFhZDcxNmJlYmYzNjQ3YmQ2NzcwY2NfMTExZjM5ZTA3NDIxNzBjZmQ4NGZhOGZjZTk1ZDQ2N2RfSUQ6NzM1NjQzMTI0MTk1NDY3MjY0NF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MDM3NDNmZjY2ZjI1ZmY0MTAxNWNjNjk2MzZkZTc4ZGNfNGZhMTI4NjFlNTdkMmRiMmQwZTY3ZGNlOTNiY2MyNTJfSUQ6NzM1NjQzMTI0MTk1NDczODE4MF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZjVlNzEyNzA5YTI5YjBmYjQ4YmUxNjY0M2M4NjA5YzNfNGU0NDQ5NmFmMTVjMmNiOTcxOTg2YzgxNzNmMDQwZTFfSUQ6NzM1NjQzMTI0MjgzNjA2NjMwOF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

4. 等待发布成功即可，祝大家都能享受Agent创建之旅\~ **Agent is ALL YOU NEED**！\~

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MzFmMjNkZDQzN2I2ZGIwZTY0MDQ4ZWUyMzg1YzgxMWFfODdjYTIwMTg0YWU0MDZkMTRhMTY3ZDU1OGZjN2EwMTNfSUQ6NzM1NjQzMTI0MjU1NDg2NzcxNl8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MWNlNDgwOTlmMGU2M2Q5MzAwODgwNWY0YzI0ZDcwOTBfOTUwOGQ0NGYzMTFiYTM1OThhZjdlMjAyM2U5YTQyZWJfSUQ6NzM1NjQzMTIzOTI3NTkyMTQxMV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Mjg4ZjJjYjk1Y2YzMDZjZDcyMDVjYjdmZGUzMzhmNDFfODg3MzEyYzEyNjdjNGM0ZTQ5ZDIzYzQ0Zjk3YmNjNTVfSUQ6NzM1NjQzMTI0MjQ5OTYzNzI1MV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MzRiM2EyM2JlZTAzNTM5YWU1ZWNlYjVmN2E2NTRkMDZfNTNmMzg0YmZmNjZkMjRkYThjYmY2YThiY2MyNzNlYTZfSUQ6NzM1NjQzMTI0MzA1Nzc0MTgyN18xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

### 可选：深入代码魔改 \(仅简单介绍\)

1. 在github上查看 [魔搭开源Agent框架](https://github.com/modelscope/modelscope-agent)，获取更多文档

2. 将github上的 [魔搭开源Agent框架](https://github.com/modelscope/modelscope-agent) 下载下来，进行深度魔改后发布

3. 将自己发布的Agent的代码下载下来，进行深度魔改后发布

    点开相应的创空间，在设置处，可在环境变量中可查看自己通过 [AgentFabric](https://modelscope.cn/studios/modelscope/AgentFabric/summary) 创建并发布的Agent的代码，AGENR\_URL，可直接复制链接，粘贴到浏览器地址栏下载

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MGM4M2NmZWJlYjJkOGUwZTcyZDY2NjZkMDI1YzE0MWRfZjhkYzVmODZjNTJjMDBlZTNjNmMyOWQ4NWFjYmQ3NTNfSUQ6NzM1NjQzMTA2ODE4OTE0NzE0MF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZWUwZWYzNjdjZDc3ZThjOTMwMmI3MGI2YzFhMzE4NDRfYzkwZWNhYmY1OTZmM2NjNzEyZjg5ZDY0NDQ5MjNiMjlfSUQ6NzM1NjQzMTA2ODAxNjU5MDg1Ml8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

    

4. 可以fork自己感兴趣的有源码的创空间，然后git clone到本地，进行深度魔改后发布

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YjEyN2U4MDg1MzFjOTIxNWRlYjBhNTFiOWY4NGI3NTRfZGMyOTk1ZDJhN2IxNmNkY2ZhNTQ1NDZiMWYyNTQ3MzVfSUQ6NzM1NjQzMTA2Njc2ODI5Mzg5MV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OTliNDZkZTk1ODIzMTZlZWFhNmVjODQzZjUzODEwYTBfYjBlOTZiMWI4M2VkMWUyNGM3NGYxM2IwZDYyOTkxYjlfSUQ6NzM1NjQzMTA2NzgxOTIxMjgwNF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZWQzODExMTYyY2MzZDMzN2ZmNzE5NDRmMmU0ZGEyYTlfZTdiNjQyMTUxN2I0ODBlMDFlNzVhNGRjMzg4MTA4MWFfSUQ6NzM1NjQzMTA2NjUyODIzNTUyM18xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

5. 发布前，需要有一个创空间，并git clone到本地，将修改好的文件复制到对应文件夹，并push即可

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ODZkODExOGMyNzVjMmU2NzI3MzYyOThkYjAyMTdkZWFfNmM4ZDdjYjZkN2QzZGEzNTIxNDAzNjA3MmE0YmMxYTNfSUQ6NzM1NjQzMTA2NzYyMzQ1Njc3Ml8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MDlhYzRhNWEyZjNhNDdjZDIxMjc5NjVhYjYwOWM2OWZfOGU3MjcxOGFjMmJkMjFjNWQ2YTdhNDAxOGQ0Zjc1MTFfSUQ6NzM1NjQzMTA2Njc0MTYwNDM1NV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

6. 更详细的本地开发步骤可参考[agent\-tutorial/Agent原理深入\+快速搭建demo](https://github.com/datawhalechina/agent-tutorial/blob/main/notebook/%E7%AC%AC%E4%B8%80%E7%AB%A0%EF%BC%9AAgent%E7%AE%80%E4%BB%8B/1.2%20Agent%E5%8E%9F%E7%90%86%E6%B7%B1%E5%85%A5+%E7%8E%AF%E5%A2%83%E9%85%8D%E7%BD%AE.md) 或 [modelscope Agent 新人开发教程 @Tintin](https://tianchi.aliyun.com/forum/post/641455)

7. 更多教程还可见[魔搭Agent大本营](https://modelscope.cn/brand/view/agent)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Yzc3MWM4MGVlYWQ4NzI2N2M2MmI2Nzc1NWM3OWI5YjVfMDgwYTU2MDMyZmEzY2Y5NzcyODE1MmZiYThhNmJlOTJfSUQ6NzM1OTQ5MzUxMzE4NDAwMjA3Nl8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

# 更多学习内容

## 学习教程

- [**最简单的教程跳转**](https://datawhaler.feishu.cn/docx/DqaydpsFdovWonxDrYxcrBYxnkf#S1e6dHOGvodk5YxgmsscgTTQnTg)

- **手把手****Agent开发教程（觉得不错，star一下）：****https://github\.com/datawhalechina/agent\-tutorial**

- **魔搭Agent框架源代码****（觉得不错，star一下）**：[**https://github\.com/modelscope/modelscope\-agent**](https://github.com/modelscope/modelscope-agent/blob/master/README_CN.md)

- [**魔搭官方Agent实操系列**](https://modelscope.cn/brand/view/agent)教程：

    - [**0代码创建、发布并分享一个专属Agent**](https://modelscope.cn/headlines/article/266)

    - [**低代码调用API创建更加酷炫的Agent**](https://modelscope.cn/headlines/article/267)

    - [**将API注册为tool，成为smart API**](https://modelscope.cn/headlines/article/268)

    - [**Agent自带的Code Interpreter如何使用**](https://modelscope.cn/headlines/article/272)

    - [**如何在本地/云端创建并发布更定制化的Agent**](https://www.modelscope.cn/headlines/article/278)

## 直播分享

- **直播系列分享（记得三连）：****https://space\.bilibili\.com/431850986/channel/collectiondetail?sid=1958604**

- **嘉宾PPT：****https://datawhaler\.feishu\.cn/drive/folder/ITikffDkilmehKdLUjdc3PaKntd?from=from\_copylink**

|**直播名称**|**分享嘉宾**|**视频录播（记得****三连****）**|**PPT**|
|---|---|---|---|
|动手学Agent应用开发 \- 开营仪式<br>|成晨：魔搭社区技术运营负责人<br>朱琳：魔搭社区生态运营<br>宜俊：魔搭社区开发者|https://www\.bilibili\.com/video/BV1Vg4y1Z73Q||
|Agent设计 \- Prompt和Function Call<br>|陈嘉诺：Datawhale成员<br>张晋：Datawhale成员|https://www\.bilibili\.com/video/BV1pc411y7f9|[Agent设计案例及思路\.pdf](https://datawhaler.feishu.cn/file/MdQTbUft2o4GNdxdn4nc7Sdvnyf) <br>[从prompt的角度理解Agent原理\.pdf](https://datawhaler.feishu.cn/file/BafwbY6HLowTjwxfr27cGFH8nrN) |
|魔搭Agent框架原理与实践|周文猛：魔搭社区模型建设技术负责人<br>成晨：魔搭社区技术运营负责人|https://www\.bilibili\.com/video/BV1Ma4y1R7GZ||
|通义千问大模型原理与实践|林俊旸:通义千问开源大模型负责人|https://www\.bilibili\.com/video/BV1Ba4y197pv||
|通义千问基础语言模型进展|周畅：通义千问技术负责人|https://www\.bilibili\.com/video/BV1Ce411i7NN|[通义千问基础语言模型进展\-周畅\.pdf](https://datawhaler.feishu.cn/file/ANyRb1fvzo318PxQKXncWJU2nug) |
|NVIDIA NeMo 助力 RAG在 AI Agent 中的研发与应用|金国强：NVIDIA 解决方案架构师|https://www\.bilibili\.com/video/BV1Je411e7kQ|[NVIDIA NeMo助力RAG在AI Agent中的研发与应用\-金国强\.pdf](https://datawhaler.feishu.cn/file/H82PbOEC5oUdphx3wJqc3DiDnUh) |

# 常见QA \& 注意事项

> 持续更新回答中，未被回答的问题可以作为思考题思考，
> 
> 也可以通过评论进行讨论或回答，开源贡献帮助到更多人\~
> 
> 

## 如果没有Agent思路怎么办？

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MDI1OTU0ZTlmZGI4YTY4NzFhNzMzYzBiYTlkZGQyNDhfM2NlNTgyYjQ5YjkzYTczODhmOWRhN2Q2ZjgxZGM0ZWRfSUQ6NzM0NTA0Mjk5MzEyNjUzOTI2NV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

可以参考上图的流程，详情可以阅读[agent\-tutorial/3\.1 Agent应用通用创作思路](https://github.com/datawhalechina/agent-tutorial/blob/main/docs/%E7%AC%AC%E4%B8%89%E7%AB%A0%EF%BC%9AAgent%E5%BA%94%E7%94%A8%E5%B1%95%E6%9C%9B/3.1%20Agent%E9%80%9A%E7%94%A8%E5%88%9B%E4%BD%9C%E6%80%9D%E8%B7%AF.md)

## 如何保护个人创意？防止Prompt泄露？

目前可能没有过多的保障措施，如果是零代码构建的Agent，可以通过在Prompt中强调不要泄露

如果是开源项目构建的Agent，较为麻烦，在Prompt中强调不要泄露的同时，可能需要再将主Prompt隐藏到环境变量中\(这个方案目前没有尝试过\)



但总得来说，创意本身很重要，但思考、分享并实现的过程更重要，且目前仅是简单的Demo形态，如果后续有更多的优化想法，可以脱离魔搭平台，去构建更强、更有意思的应用

目前建议学习者主要将之作为开源贡献的一部分，进行学习和交流使用，如果拿到还不错的名字，影响力提升带来的价值可能更大

## API额度有多少？

学习活动中 notebook，服务器，一些通义千问模型都是限时免费的；

通义大模型\(qwen\-max\)在3月18日即将开启收费，大家需注意；

但如果要用GPU或者更高需求的产品，可能要付费；

另外文生图的API每人只有500次额度，请谨慎使用；

更多额度计费详情，见[灵积模型服务\-计费管理](https://dashscope.console.aliyun.com/billing)

## 需要自己准备算力吗？

创空间目前有免费的 CPU环境可供使用，具体可在https://modelscope\.cn/my/mynotebook/preset 进行查看，可以在本地运行代码，还可以通过个人云账号授权阿里云的付费实例，

其他的自己构建的API服务等可以自行思考算力解决方案

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NDQ4ZjBiNzVmMDhkMTRjNGY5MzU4ZTUwYmZkYzlhYzlfZjY5ZDE1NGIzYjI3N2EyOTAyNTk2MDNmZDAxOTc0YTlfSUQ6NzM0NTA0MzIyOTczOTU0ODY3M18xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

## 如何做Prompt工程？

1. 如果是零代码构建的Agent，建议直接在 [Agent创建器](https://www.modelscope.cn/studios/modelscope/AgentFabric/summary) 的界面进行体验和Prompt工程，效果合适后点击【构建】\-【发布】，但仅获取 AGENT\_URL，并在已创建的Agent创空间中，替换这个环境变量，再【重启空间展示】即可

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MTAyNTllYjYwMzliMTg5ZDgzODgwMjA0NjhjOTUzZDRfODJiNzIzNmYwZTY4Yjk3Y2E0YjJmY2ExM2E3MzRkZDFfSUQ6NzMxMjc0Mjg4MTExNzM1NjA2MF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZTVlYTk0MjkyYjA2ZjMwYWI1NTZjYTBkYmJiMjUwYWFfMTBhOTVjZTFjMjA2OGJiNTE1YTI5M2FiZGEyOWQxMjBfSUQ6NzMxMjc0MzIxNjEyNTA4MzY3Nl8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

2. 如果是代码级的修改，则需要在本地，config/builder\_config\.json 文件中，对相应的字段进行修改并调试，效果合适后 commit 并 push 至魔搭云平台，然后【重启空间展示】

## 创建Agent并发布后，尝试进行对话显示Error

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YzExOGRmZmVhOTgxMmVlZDczYWZlN2EzYzJkZTU0NDJfMTdhZWIzM2NhMTFiOTU5YzU4ZTc5NmZkZmE5MGY3NDZfSUQ6NzMxMTY5OTkyMzg2OTkwODk5NV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

这是由于勾选了【高德天气】的tools，但没有在发布的环境变量中添加 高德天气的API\-KEY，

需要先申请高德开放平台，注册后申请ak，参考[教程](https://github.com/Jin-Zhang-Yaoguang/agent-tutorial/blob/main/notebook/%E7%AC%AC%E4%BA%8C%E7%AB%A0%EF%BC%9AAgent%E5%AE%9E%E8%B7%B5/%E9%AB%98%E5%BE%B7%E5%BC%80%E6%94%BEAPI%E5%AE%9E%E8%B7%B5.md)进行高德 API\-KEY 的申请，并将对应的key设置为环境变量`AMAP_TOKEN`

## 如何针对已有的Agent代码进行魔改？

1. 下载发布的Agent的代码：直接复制链接环境变量中的 AGENT\_URL ，粘贴到浏览器地址栏下载

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZTU3YjgxNzE4MTIyNDk0NGYyYjJkYzkwMDU3NzcwY2RfZWZkYmIwZTkyN2U3M2VkM2E1ZTUzODU3NzQ5YWMzYjZfSUQ6NzM0NTA0MzQzMjgyMTE3ODM3MF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

2. 解压并修改对应代码

3. 将创空间的代码git clone到本地：复制对应的git命令，在本地找一个文件夹，打开终端界面，粘贴命令并使用

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NWQ3ODhhNDIwMjBjMGMwZGY1MWFjN2UyYzBjNmQwMDdfMjk5NTUyZmM1YWY4OTJlMDAyNDFmYjIzZjVjZjQ2OGJfSUQ6NzM0NTA0MzQzNjgyMTIxNzI4Ml8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NDI1OTE4MmI2ZWU0NmVhNzYyMWI1MDk2ODViMjg4YWRfZGQ3NWFhNjlhM2ViY2IwOWQwZDAzMWUwYWQyMmUwZGRfSUQ6NzM0NTA0MzQzMzI5MzY3NjU3Ml8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MTkyNmU1NTJiNmIwZDVkNGQyMzQ4NjUyNDczNTI0MzZfMDFlODRiODVhY2U4MDk3MmNkYjljZTE1NjNkY2JjYjRfSUQ6NzM0NTA0MzQzNjk4MTMyMTczMl8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

4. 将第二步修改后的代码复制到新的目录下，并修改ReadMe\.md中的启动文件

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ODA1NDUyM2UzODBlNzZkNDZjNzcyZTY4N2NjZjdlNzdfZWRkMDJjNDBhZjljYmQzZGQ3YmRkOGQ5NTQ5YzRlNjJfSUQ6NzM0NTA0MzQzMjY4NTkyODQ1MV8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

5. 最后将代码push到创空间中

    `git add .`

    `git commit -m "随便写点啥"`

    `git push`

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YWFmMjBkMTFiZmFjYjk0NjQ5NTAyNmMxNDI5YTgzYjNfZWM3YjhhZTIyMzNjOWZkMGY5NzRjYjhkZGIwYzkwZDFfSUQ6NzM0NTA0MzQzNjgyMTU0NDk4OF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGY2OGY1ZjY4MDkyNGM1YjY0YTg5NWI4OGU3MjEzOTFfNWRkMGM0YWNiOTQ5Mjg1ODE0ZmVjM2IwN2FmNDNmMjhfSUQ6NzM0NTA0MzQzNzU2NzQyNjU2Ml8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YmUxMTMzMzFmNWVlNWE4NzcxNzQwOTQ2YjBhMDkzODBfYTZjOTdlODMxZmVkZWZmYTcxNmQ2N2ZmNTUwNGEwZGNfSUQ6NzM0NTA0MzQzNTMzMjM1NDA1MF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

6. 最后再刷新创空间，并重新上线空间即可

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjUwNjg3NGRkMTAzMmI2MjhmNDA4ZGNlNzBmYWFmNzBfZGMwNGFmMWJkYmQ2YWM3OGYwMDI1Y2U5ODVkNTFiMTNfSUQ6NzM0NTA0MzQzNTA3MDQ4ODU3OF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

# 学习简介\(学习活动已结束\)

|**学习阶段**|**学习内容**|**建议动作**|
|---|---|---|
|**Part1**<br>**Agent入门**<br>|**Agent入门，自由组队**<br>- **开营仪式 \-**[** **](https://www.bilibili.com/video/BV1Vg4y1Z73Q/)[**Agent \- AI应用新范式**](https://www.bilibili.com/video/BV1Vg4y1Z73Q/)<br>- 跑通[**必知必会**](https://datawhaler.feishu.cn/docx/DqaydpsFdovWonxDrYxcrBYxnkf#S1e6dHOGvodk5YxgmsscgTTQnTg)，成功 [**创建你的第一个Agent**](https://www.modelscope.cn/studios/modelscope/AgentFabric/summary)** **并提交<br>- 收看直播，提升Agent开发能力<br>    - [**ModelScopeAgent框架原理与实践**](https://www.bilibili.com/video/BV1Ma4y1R7GZ/)<br>    - [**通义大模型原理与实践**](https://www.bilibili.com/video/BV1Ba4y197pv/)|- 多看、多听、多学、多想、多讨论<br>- 在群里多交流冒泡组队<br>- 在队里多沟通、交流idea、熟悉同伴能力<br>- 在队内、大群内多交流idea、碰撞|
|**Part2**<br>**Agent进阶**|**Agent进阶，磨炼能力**<br>- 学习[《](https://github.com/datawhalechina/agent-tutorial)[**手把手**](https://github.com/datawhalechina/agent-tutorial)[**Agent开发教程**](https://github.com/datawhalechina/agent-tutorial)[》](https://github.com/datawhalechina/agent-tutorial)，进行Agent开发进阶<br>    - Agent的function call与tools设计<br>    - Agent的Prompt设计<br>- 探索idea，尝试不同的Prompt、API与tools|- 学习相关技术，提升个人实力<br>- 填写打卡表单|
|**Part3**<br>**Agent开发**<br>|**开发Agent，提交作品**<br>1. 开发创意Agent应用作品，部署发布到[**ModelScopeAgent大本营**](https://www.modelscope.cn/brand/view/agent?spm=a2c22.12281976.0.0.23713774Y4o1kI&branch=0&tree=2)上|- 完成比完美重要<br>- 追求卓越，精益求精|

## 面向对象

- 有一定**创新思维**与**Python基础**

- 希望在实际中运用**Agent框架与AIGC技术**，构建**创新应用**

- 有**足够的精力投入**，有创新想法，热爱分享

## 学习亮点

- 学习内容：

    - 魔搭开源的**Agent框架**，**通义大模型**鼎力支持

    - **零门槛**上手Agent应用体验 与 **手把手**的Agent开发教程

- 学习支持：

    - 助教团队全程**答疑解惑**，带你玩转Agent

    - **刻意练习**，磨炼**Agent开发**技能，提供**免费****API****与部署平台**

    - **组队学习**，遇见志同道合的伙伴，**让学习不再孤独**

# Agent作品汇总

## 获奖作品

赛事所有获奖作品公示：https://tianchi\.aliyun\.com/competition/entrance/532168/customize429

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NDg5YzJkMmUzNjEyMzgxNTZjNTc3ZDYyYTM3YTY4OThfMjU3YmIyNDNjODY0NzUyNmM2OGFjNGU4YmJjYWNhOTlfSUQ6NzM0MzU3ODg2NjE1MjgwMDI1N18xNzg1NTkxODg0OjE3ODU2NzgyODRfVjM)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NTQ5ZGU5Y2E3NjliZjJlMjViODEzYmQ3Y2YxZDE1YzdfN2JjODcyMzFlZTllMGI4YWYwM2NmNWQ5Mjc4OTljOTRfSUQ6NzMxNjQ1OTM5MDQ3NDQ4NTc2NF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)



## 所有作品展示



本手册由@司玉鑫@Amy编写，觉得不错在下方点个赞吧，更多建议与反馈，欢迎评论或联系玉鑫（加V：a1434088958）



# 祝大家都能享受 Agent 带来的乐趣！！！

扫描下方二维码关注公众号：@Datawhale

更多组队学习和赛事等你参与\~

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MTU0ZDI4MWZhNWVjYzM1NmM0NWJjZjg1NGFjNjYyYmVfMzIyYWJkYzI2MDA0ZDVhZDk3Y2M3ODlhYWFjOGU3YjlfSUQ6NzM1NjQyOTYyMDM4Njc5MTQyOF8xNzg1NTkxODgzOjE3ODU2NzgyODNfVjM)

Datawhale 是一个专注于数据科学与 AI 领域的开源组织，汇集了众多领域院校和知名企业的优秀学习者，聚合了一群有开源精神和探索精神的团队成员。

Datawhale 以“ for the learner，和学习者一起成长”为愿景，鼓励真实地展现自我、开放包容、互信互助、敢于试错和勇于担当。

同时 Datawhale 用开源的理念去探索开源内容、开源学习和开源方案，赋能人才培养，助力人才成长，建立起人与人，人与知识，人与企业和人与未来的联结。

