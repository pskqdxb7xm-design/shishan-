// cloudfunctions/sendNotification/index.js
// 通用消息通知云函数
// 由前端各业务点调用：评论、回复、申请加入、审核结果

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * event: {
 *   receiver_openid: string,  // 接收者
 *   type: 'comment' | 'reply' | 'apply' | 'audit',
 *   post_id: string,
 *   post_title: string,
 *   content: string,          // 摘要
 *   senderAvatar: string,     // 触发者头像
 *   senderName: string        // 触发者昵称
 * }
 */
exports.main = async (event) => {
  const { receiver_openid, type, post_id, post_title, content, senderAvatar, senderName } = event;
  if (!receiver_openid || !type || !post_id) {
    return { success: false, error: '缺少必要参数' };
  }

  // 类型校验
  const VALID_TYPES = ['comment', 'reply', 'apply', 'audit'];
  if (VALID_TYPES.indexOf(type) === -1) return { success: false, error: '无效类型' };
  // 内容截断
  var safeTitle = (post_title || '').substring(0, 100);
  var safeContent = (content || '').substring(0, 200);

  // 防骚扰：同一发送者 1 分钟内最多 5 条
  const { OPENID } = cloud.getWXContext();
  var recent = await db.collection('notifications')
    .where({ sender_openid: OPENID, create_time: db.command.gte(new Date(Date.now() - 60000)) }).count();
  if (recent.total >= 5) return { success: false, error: '操作太频繁' };

  // 防打扰：不发给自己
  if (OPENID === receiver_openid) {
    return { success: true, skipped: true, reason: 'self' };
  }

  try {
    await db.collection('notifications').add({
      data: {
        receiver_openid,
        sender_openid: OPENID,
        sender_info: { avatar: senderAvatar || '', nickname: senderName || '匿名' },
        post_id,
        post_title: safeTitle,
        type,
        content: safeContent,
        is_read: false,
        create_time: db.serverDate()
      }
    });
    return { success: true };
  } catch (err) {
    console.error('[sendNotification] 失败:', err);
    return { success: false, error: err.message };
  }
};
