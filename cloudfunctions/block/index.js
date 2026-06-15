// cloudfunctions/block/index.js
// 拉黑/取消拉黑  +  获取黑名单
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  try {
  const { OPENID } = cloud.getWXContext();
  const { action, target_openid } = event;

  if (action === 'get') {
    // 获取当前用户黑名单
    const { data } = await db.collection('users').where({ _openid: OPENID }).field({ block_list: true }).get();
    return { success: true, block_list: (data[0] && data[0].block_list) || [] };
  }

  if (action === 'toggle') {
    if (!target_openid) return { success: false, error: '缺少 target_openid' };
    if (target_openid === OPENID) return { success: false, error: '不能操作自己' };
    // 获取当前黑名单
    const { data } = await db.collection('users').where({ _openid: OPENID }).field({ block_list: true }).get();
    var list = (data[0] && data[0].block_list) || [];
    var idx = list.indexOf(target_openid);
    if (idx > -1) {
      list.splice(idx, 1);  // 取消拉黑
    } else {
      list.push(target_openid);  // 拉黑
    }
    await db.collection('users').where({ _openid: OPENID }).update({ data: { block_list: list } });
    return { success: true, blocked: idx === -1, block_list: list };
  }

  return { success: false, error: 'unknown action' };
  } catch (e) { return { success: false, error: e.message }; }
};
