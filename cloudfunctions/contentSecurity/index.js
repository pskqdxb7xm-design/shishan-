// cloudfunctions/contentSecurity/index.js
// 内容安全审核云函数
// 文本同步审核 (msgSecCheck v2) + 图片异步审核 (mediaCheckAsync)

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/**
 * 文本审核 (同步) — 先审后发
 * @param {string} content  待审核文本
 * @param {string} openid   用户 openid
 * @param {number} scene    场景值: 1=评论 2=论坛/发帖 3=昵称/个人资料
 * @returns {{ pass: boolean, error?: string }}
 */
async function checkText(content, openid, scene) {
  if (!content || content.trim().length === 0) return { pass: true };

  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      openid: openid,
      scene: scene || 2,
      content: content.substring(0, 5000)
    });

    if (res && res.result && res.result.suggest === 'pass') {
      return { pass: true };
    }
    return { pass: false, error: '内容含有敏感信息，请修改后重新发布' };

  } catch (err) {
    // 87014: 明确违规
    if (err.errCode === 87014) {
      return { pass: false, error: '内容含有违规信息，请修改后重新发布' };
    }
    // 降级兜底：API 超时/报错默认放行
    console.error('[contentSecurity] 文本审核 API 异常，默认放行:', err);
    return { pass: true, fallback: true };
  }
}

/**
 * 图片审核 (异步) — 先发后审
 * @returns {{ trace_id: string } | null}
 */
async function checkImages(fileIDs) {
  if (!fileIDs || fileIDs.length === 0) return null;

  var tasks = fileIDs.map(function (fid) {
    return cloud.openapi.security.mediaCheckAsync({
      mediaUrl: fid,
      mediaType: 2,
      version: 2
    }).catch(function (err) {
      console.error('[contentSecurity] 图片审核提交失败:', fid, err);
      return null;
    });
  });

  var results = await Promise.all(tasks);
  return { trace_ids: results.filter(Boolean).map(function (r) { return r.traceId || r.trace_id; }) };
}

// ============================================================
exports.main = async (event) => {
  var action = event.action;
  var { OPENID } = cloud.getWXContext();

  if (action === 'checkText') {
    return checkText(event.content, OPENID, event.scene || 2);
  }

  if (action === 'checkImages') {
    return checkImages(event.fileIDs);
  }

  if (action === 'checkAll') {
    // 先文本审核，再图片异步
    var textResult = await checkText(event.content, OPENID, 2);
    if (!textResult.pass) {
      return { success: false, audit: 'reject', reason: textResult.error, stage: 'text' };
    }
    var imgResult = await checkImages(event.fileIDs);
    return { success: true, audit: 'pending', text: 'pass', images: imgResult };
  }

  return { success: false, error: 'unknown action' };
};
