// cloudfunctions/report/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { target_type, target_id, reason, description } = event;
  if (!target_type || !target_id || !reason) return { success: false, error: '缺少参数' };

  try {
    await db.collection('reports').add({
      data: {
        reporter_openid: OPENID,
        target_type,
        target_id,
        reason,
        description: description || '',
        status: 'pending',
        create_time: db.serverDate()
      }
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
