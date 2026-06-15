// cloudfunctions/getTeamInfo/index.js
// 组队信息查询 — 非对称隐私控制
// 队长看全部，队员看队长+自己，游客看不到微信号

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { postId } = event;
  const { OPENID } = cloud.getWXContext();

  if (!postId) return { success: false, error: '缺少 postId' };

  try {
    // 1. 查询帖子
    const { data: posts } = await db.collection('posts').doc(postId).get();
    if (posts.length === 0) return { success: false, error: '帖子不存在' };
    const post = posts[0];

    // 安全检查：非作者的普通用户只能看到已审核通过的帖子
    if (OPENID !== post._openid && post.audit_status && post.audit_status !== 'pass') {
      return { success: false, error: '帖子不存在或审核中' };
    }

    // 2. 查询所有已通过的申请
    const { data: members } = await db.collection('user_actions')
      .where({ targetId: postId, actionType: 'apply', applyStatus: 'accepted' })
      .field({ _openid: true, applyMessage: true, auth_granted: true })
      .get();

    // 3. 收集需要的 user openid（队长 + 队员）
    const needOpenids = [post._openid];
    members.forEach(m => { if (needOpenids.indexOf(m._openid) === -1) needOpenids.push(m._openid); });

    // 4. 批量查用户（仅获取需要的字段）
    const userMap = {};
    if (needOpenids.length > 0) {
      const { data: users } = await db.collection('users')
        .where({ _openid: db.command.in(needOpenids.slice(0, 20)) })
        .field({ _openid: true, nickname: true, avatar: true, wechat_id: true, mbti: true })
        .get();
      users.forEach(u => { userMap[u._openid] = u; });
    }

    const isOwner = (OPENID === post._openid);
    const myMember = members.find(m => m._openid === OPENID);
    const isMember = !!myMember;
    const { owner_show_wechat } = post;

    // 5. 构建返回数据 — 按角色脱敏
    const result = {
      post: {
        _id: post._id,
        title: post.title,
        category: post.category,
        activityTime: post.activityTime,
        location: post.location,
        coverImages: post.coverImages || [],
        targetCount: post.targetCount || 0,
        currentCount: post.currentCount || 1,
        status: post.status || 'recruiting',
        owner_show_wechat: !!owner_show_wechat,
        contact_info: post.contact_info || '',
        stats: post.stats || {},
        createdAt: post.createdAt,
        owner: {
          _openid: post._openid,
          nickname: (userMap[post._openid] || {}).nickname || '匿名',
          avatar: (userMap[post._openid] || {}).avatar || '',
          mbti: (userMap[post._openid] || {}).mbti || ''
        }
      },
      role: isOwner ? 'owner' : (isMember ? 'member' : 'guest'),
      members: []
    };

    // 构建队员列表（按角色脱敏 wechat_id）
    members.forEach(m => {
      const u = userMap[m._openid] || {};
      let wechat = null;
      if (isOwner) {
        // 队长看所有人微信号
        wechat = u.wechat_id || null;
      } else if (isMember && m._openid === OPENID) {
        // 队员看自己
        wechat = u.wechat_id || null;
      }
      result.members.push({
        nickname: u.nickname || '匿名',
        avatar: u.avatar || '',
        wechat_id: wechat,
        message: m.applyMessage || ''
      });
    });

    // 队长微信号（队员可见，受开关控制）
    if (isMember && !isOwner && owner_show_wechat) {
      result.owner_wechat = (userMap[post._openid] || {}).wechat_id || null;
    } else if (isOwner) {
      result.owner_wechat = (userMap[post._openid] || {}).wechat_id || null;
    } else {
      result.owner_wechat = null;
    }

    return { success: true, data: result };

  } catch (err) {
    console.error('[getTeamInfo] 失败:', err);
    return { success: false, error: err.message };
  }
};
