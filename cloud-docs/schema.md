# 云数据库 NoSQL 设计文档

> 微信云开发（CloudBase）NoSQL 数据库集合设计
> 关联字段统一使用 `_openid`（微信自动注入）或自定义 `userId`

---

## 集合总览

| 集合名 | 说明 | 安全级别 |
|--------|------|----------|
| `users` | 用户信息（经验/等级/金币/称号） | 仅创建者可读写 |
| `posts` | 帖子动态（成品图 + 心得） | 所有用户可读，仅创建者可写 |
| `comments` | 评论（两级结构） | 所有用户可读，仅创建者可写/删 |
| `user_actions` | 用户行为（点赞/收藏/关注/报名/打赏） | 仅创建者可读写 |

---

## 一、users 集合

### 文档结构

```json
{
  "_id": "自动生成",
  "_openid": "微信openid（自动注入，唯一）",
  "userId": "同 _openid，方便关联查询",
  "nickname": "用户昵称",
  "avatar": "云存储 fileID，如 cloud://xxx.png",
  "bio": "个人简介",
  "gender": 0,
  "region": "省/市",
  "totalExp": 0,
  "level": 1,
  "coins": 0,
  "cuisineTitles": [
    { "cuisine": "川菜", "title": "川菜学徒", "count": 3 }
  ],
  "badges": ["badge_first_dish", "badge_ten_dishes"],
  "stats": {
    "recipeCount": 0,
    "postCount": 0,
    "likeReceived": 0,
    "coinReceived": 0,
    "followingCount": 0,
    "followerCount": 0
  },
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 文档 ID |
| `_openid` | string | 自动 | 微信 openid，唯一标识 |
| `userId` | string | 是 | 等于 `_openid`，方便查询 |
| `nickname` | string | 是 | 用户昵称 |
| `avatar` | string | 否 | 云存储 fileID |
| `bio` | string | 否 | 个人简介 |
| `gender` | number | 否 | 0-未知 1-男 2-女 |
| `region` | string | 否 | 所在省/市 |
| `totalExp` | number | 是 | 总经验值 |
| `level` | number | 是 | 总等级 (1-50) |
| `coins` | number | 是 | 金币余额 |
| `cuisineTitles` | array | 否 | 菜系称号列表 |
| `cuisineTitles[].cuisine` | string | - | 菜系名 |
| `cuisineTitles[].title` | string | - | 称号，如"川菜帮厨" |
| `cuisineTitles[].count` | number | - | 该菜系完成数量 |
| `badges` | string[] | 否 | 已解锁徽章 ID 列表 |
| `stats.recipeCount` | number | 是 | 累计完成菜品数 |
| `stats.postCount` | number | 是 | 累计发帖数 |
| `stats.likeReceived` | number | 是 | 累计获赞数 |
| `stats.coinReceived` | number | 是 | 累计获赏金币 |
| `stats.followingCount` | number | 是 | 关注数 |
| `stats.followerCount` | number | 是 | 粉丝数 |
| `createdAt` | Date | 是 | 注册时间 |
| `updatedAt` | Date | 是 | 最后更新时间 |

### 索引建议

```
1. _openid 唯一索引（系统自动）
2. userId 唯一索引
3. level 降序索引（排行榜）
4. stats.recipeCount 降序索引（排名）
```

### 安全规则

```json
{
  "read": "auth.openid == doc._openid",
  "write": "auth.openid == doc._openid"
}
```

> 用户只能读写自己的数据。排行榜等公开查询通过云函数返回（不直接暴露用户集合）。

---

## 二、posts 集合

### 文档结构

```json
{
  "_id": "自动生成",
  "_openid": "发帖人 openid（自动注入）",
  "userId": "发帖人 userId",
  "title": "帖子标题",
  "content": "文字心得/描述",
  "coverImages": [
    "cloud://env-id.xxx/uploads/image1.jpg",
    "cloud://env-id.xxx/uploads/image2.jpg"
  ],
  "recipeId": "关联菜谱ID（可选）",
  "category": "川菜",
  "difficulty": 3,
  "cookTime": "30分钟",
  "tags": ["家常", "快手菜"],
  "stats": {
    "likeCount": 0,
    "commentCount": 0,
    "viewCount": 0,
    "coinCount": 0
  },
  "status": "published",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 文档 ID |
| `_openid` | string | 自动 | 发帖人 openid |
| `userId` | string | 是 | 发帖人 userId |
| `title` | string | 是 | 帖子标题 |
| `content` | string | 否 | 心得/描述文本 |
| `coverImages` | string[] | 是 | **云存储 fileID 数组**（成品图） |
| `recipeId` | string | 否 | 关联菜谱 _id |
| `category` | string | 否 | 菜系分类 |
| `difficulty` | number | 否 | 难度 1-5 |
| `cookTime` | string | 否 | 耗时描述 |
| `tags` | string[] | 否 | 标签 |
| `stats.likeCount` | number | 是 | 点赞数 |
| `stats.commentCount` | number | 是 | 评论数 |
| `stats.viewCount` | number | 是 | 浏览数 |
| `stats.coinCount` | number | 是 | 被打赏金币数 |
| `status` | string | 是 | published / draft / deleted |
| `createdAt` | Date | 是 | 发布时间 |
| `updatedAt` | Date | 是 | 最后编辑时间 |

### 索引建议

```
1. _openid 索引（查某用户的所有帖子）
2. createdAt 降序索引（首页"最新"排序）
3. stats.likeCount + stats.commentCount 复合降序（"热门"排序）
4. status 索引
5. category 索引（按菜系筛选）
```

### 安全规则

```json
{
  "read": "doc.status == 'published'",
  "write": "auth.openid == doc._openid"
}
```

> "所有用户可读，仅创建者可写"。写操作包含：创建、编辑、删除。已登录用户即可创建帖子（`auth != null`），但仅能修改自己的。

---

## 三、comments 集合

### 文档结构

```json
{
  "_id": "自动生成",
  "_openid": "评论人 openid（自动注入）",
  "userId": "评论人 userId",
  "postId": "所属帖子 _id",
  "parentId": null,
  "replyToUserId": null,
  "content": "做的太棒了！",
  "likeCount": 5,
  "status": "active",
  "createdAt": "2025-01-01T12:00:00.000Z"
}
```

### 两级评论结构说明

**一级评论**：`parentId: null`，直接回复帖子
```json
{ "_id": "c001", "postId": "p001", "parentId": null, "content": "做得太好了！" }
```

**二级评论（回复）**：`parentId` 指向一级评论 `_id`，`replyToUserId` 指向被回复者
```json
{ "_id": "c002", "postId": "p001", "parentId": "c001", "replyToUserId": "user_abc", "content": "谢谢鼓励！" }
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 文档 ID |
| `_openid` | string | 自动 | 评论人 openid |
| `userId` | string | 是 | 评论人 userId |
| `postId` | string | 是 | 所属帖子 _id |
| `parentId` | string | 否 | 父评论 _id（null = 一级评论） |
| `replyToUserId` | string | 否 | 被回复者 userId |
| `content` | string | 是 | 评论内容 |
| `likeCount` | number | 是 | 评论获赞数 |
| `status` | string | 是 | active / deleted |
| `createdAt` | Date | 是 | 评论时间 |

### 索引建议

```
1. postId + createdAt 复合索引（查帖子评论列表，按时间排序）
2. parentId 索引（查某条评论的所有回复）
3. _openid 索引（查某用户的所有评论）
```

### 安全规则

```json
{
  "read": "doc.status == 'active'",
  "write": "auth.openid == doc._openid"
}
```

> "所有用户可读，仅创建者可写/删"。已登录用户可创建评论，只能删除/编辑自己的评论。

---

## 四、user_actions 集合

### 文档结构

```json
{
  "_id": "自动生成",
  "_openid": "操作用户 openid（自动注入）",
  "userId": "操作用户 userId",
  "targetType": "post",
  "targetId": "帖子/菜谱/评论/用户的 _id",
  "targetUserId": "目标内容作者的 userId",
  "actionType": "like",
  "data": {},
  "createdAt": "2025-01-01T12:00:00.000Z"
}
```

### actionType 枚举值

| 值 | 说明 | 适用范围 |
|------|------|----------|
| `like` | 点赞 | targetType: post / comment |
| `favorite` | 收藏 | targetType: post / recipe |
| `register` | 报名 | targetType: post（活动帖） |
| `follow` | 关注 | targetType: user |
| `tip` | 打赏 | targetType: post |

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 文档 ID |
| `_openid` | string | 自动 | 操作用户 openid |
| `userId` | string | 是 | 操作用户 userId |
| `targetType` | string | 是 | 目标类型：post / recipe / comment / user |
| `targetId` | string | 是 | 目标文档 _id |
| `targetUserId` | string | 否 | 目标作者的 userId |
| `actionType` | string | 是 | 行为类型（见上表） |
| `data` | object | 否 | 附加数据（打赏金额 `{amount: 5}` 等） |
| `createdAt` | Date | 是 | 操作时间 |

### 索引建议

```
1. userId + actionType 复合索引（查某用户的某类行为）
2. targetId + actionType 复合索引（查某个目标的某类行为计数）
3. userId + targetType + targetId 唯一复合索引（防止重复点赞/收藏）
4. targetUserId + createdAt 复合索引（查某用户收到的互动）
```

### 安全规则

```json
{
  "read": "auth.openid == doc._openid",
  "write": "auth.openid == doc._openid"
}
```

> "仅创建者可读写"。用户只能增删自己的行为记录。统计数字（点赞数等）存储在目标文档的 `stats` 字段中，而非直接查询此集合。

---

## 五、关联关系速查

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│  users   │      │  posts   │      │ comments │
│  _openid │◄─────┤ _openid  │◄─────┤ _openid  │
│  userId  │      │  userId  │      │  userId  │
│          │      │          │      │  postId  │──────► posts._id
│  badges[]│──┐   │ recipeId │      │ parentId │──────► comments._id
│  stats   │  │   │  stats   │      │replyUser │──────► users._id
│  coins   │  │   │coverImgs[]│     │          │
└──────────┘  │   └──────────┘      └──────────┘
              │
              │   ┌──────────────┐
              └──►│user_actions  │
                  │ _openid/userId──► 操作者
                  │ targetId ───────► 任意集合 _id
                  │ targetUserId ───► 目标作者
                  │ actionType     │
                  └──────────────┘
```

---

## 六、NoSQL 设计原则总结

1. **冗余是常态**：`posts` 中存 `userId` 和 `_openid`，减少多表关联查询
2. **统计前置**：点赞数、评论数直接存在目标文档的 `stats` 字段，避免 `count()` 查询
3. **`_openid` 是锚**：所有用户相关数据用 `_openid` 关联，系统级安全可靠
4. **云存储用 fileID**：图片字段统一存 `cloud://` 格式的 fileID，不用临时 URL
5. **软删除**：`status` 字段标记删除，不做物理删除，便于数据恢复
