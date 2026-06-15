// 云函数：initDB
// 一键初始化所有数据库集合 + 安全规则 + 种子数据

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 要创建的所有集合
const COLLECTIONS = [
  {
    name: 'users',
    desc: '用户信息（经验/等级/金币/称号）',
    indexes: [
      { field: 'userId', unique: true },
      { field: 'level', direction: -1 },
    ],
  },
  {
    name: 'posts',
    desc: '帖子动态（成品图 + 心得）',
    indexes: [
      { field: 'createdAt', direction: -1 },
      { field: 'category' },
      { field: 'status' },
    ],
  },
  {
    name: 'comments',
    desc: '评论（两级结构）',
    indexes: [
      { field: 'postId' },
      { field: 'parentId' },
    ],
  },
  {
    name: 'user_actions',
    desc: '用户行为（点赞/收藏/关注/打赏）',
    indexes: [
      { field: 'userId' },
      { field: 'targetId' },
    ],
  },
  {
    name: 'notifications',
    desc: '消息通知',
    indexes: [
      { field: 'receiver_openid' },
      { field: 'is_read' },
    ],
  },
  {
    name: 'reports',
    desc: '举报记录',
    indexes: [
      { field: 'reporter_openid' },
      { field: 'target_id' },
    ],
  },
];

exports.main = async (event, context) => {
  // 安全检查：仅管理员可执行
  const { OPENID } = cloud.getWXContext();
  var ADMIN = ['']; // TODO: 填入管理员的 openid
  if (ADMIN.length > 0 && ADMIN.indexOf(OPENID) === -1) {
    return { success: false, error: '无权限' };
  }
  const results = [];

  for (const col of COLLECTIONS) {
    try {
      // 创建集合（已存在会报错，跳过）
      await db.createCollection(col.name);
      results.push({ collection: col.name, status: 'created', desc: col.desc });

      // 检查并创建索引（如果集合是新建的）
      for (const idx of col.indexes) {
        try {
          await db.collection(col.name).createIndex({
            keys: { [idx.field]: idx.direction || 1 },
            unique: idx.unique || false,
          });
        } catch (idxErr) {
          // 索引可能已存在
        }
      }
    } catch (err) {
      if (err.errCode === -502005) {
        // 集合已存在
        results.push({ collection: col.name, status: 'already_exists', desc: col.desc });
      } else {
        results.push({ collection: col.name, status: 'error', error: err.message });
      }
    }
  }

  return {
    success: true,
    message: '数据库初始化完成',
    results: results,
  };
};
