// cloudfunctions/sendSubscribeMsg/index.js
// 订阅消息推送云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/**
 * event: { touser, templateId, data, page }
 * data 格式: { thing1: {value:'xxx'}, thing2: {value:'xxx'}, time3: {value:'xxx'} }
 */
exports.main = async (event) => {
  const { touser, templateId, data, page } = event;
  if (!touser || !templateId || !data) return { success: false, error: '缺少参数' };

  try {
    const res = await cloud.openapi.subscribeMessage.send({
      touser,
      templateId,
      data,
      page: page || ''
    });
    return { success: true, result: res };
  } catch (err) {
    // 43101: 用户拒绝接收  |  47003: 模板参数不匹配
    console.error('[sendSubscribeMsg] 发送失败:', err.errCode, err.message);
    return { success: false, error: err.message, errCode: err.errCode };
  }
};
