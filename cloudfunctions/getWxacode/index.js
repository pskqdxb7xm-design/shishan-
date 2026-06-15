// cloudfunctions/getWxacode/index.js
// 获取带参数的小程序码
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { postId } = event;
  if (!postId) return { success: false, error: '缺少 postId' };

  try {
    // scene 最大32字符，格式: id=xxx
    const scene = 'id=' + postId;
    const page = 'pages/detail/detail';

    const res = await cloud.openapi.wxacode.getUnlimited({
      scene: scene,
      page: page,
      width: 430,
      checkPath: false,
      envVersion: 'release'
    });

    // 上传到云存储
    const cloudPath = 'qrcodes/' + postId + '_' + Date.now() + '.png';
    const uploadRes = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: res.buffer
    });

    // 获取临时链接
    const fileRes = await cloud.getTempFileURL({ fileList: [uploadRes.fileID] });
    const fileID = uploadRes.fileID;

    return {
      success: true,
      fileID: fileID,
      tempUrl: (fileRes.fileList[0] && fileRes.fileList[0].tempFileURL) || ''
    };
  } catch (err) {
    console.error('[getWxacode] 生成失败:', err);
    return { success: false, error: err.message };
  }
};
