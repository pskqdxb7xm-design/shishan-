// cloudfunctions/logError/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 每个用户每天最多上报 5 次
const MAX_PER_DAY = 5;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { message, stack, context: ctx } = event || {};

  try {
    // 检查今日已上报次数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { total } = await db.collection('error_logs')
      .where({ openid: OPENID, create_time: db.command.gte(today) }).count();
    if (total >= MAX_PER_DAY) return { success: true, skipped: true };

    await db.collection('error_logs').add({
      data: {
        openid: OPENID,
        message: (message || '').substring(0, 500),
        stack: (stack || '').substring(0, 1000),
        context: ctx || '',
        time: new Date().toISOString(),
        create_time: db.serverDate()
      }
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
