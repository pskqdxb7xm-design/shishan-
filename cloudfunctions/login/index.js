// cloudfunctions/login/index.js
// 微信静默登录云函数
// 获取 openid，查询 users 集合，新用户自动注册

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { success: false, error: '未能获取 openid' };
  }

  try {
    // 查询用户是否已存在
    const { data: users } = await db
      .collection('users')
      .where({ _openid: OPENID })
      .get();

    if (users.length > 0) {
      // 老用户：更新最后登录时间
      const user = users[0];
      await db.collection('users').doc(user._id).update({
        data: { updatedAt: new Date() }
      });
      return {
        success: true,
        isNewUser: false,
        user: { ...user, updatedAt: new Date() }
      };
    }

    // 新用户：自动注册
    const newUser = {
      _openid: OPENID,
      userId: OPENID,
      nickname: '微信用户',
      avatar: '',
      bio: '这个人很懒，什么都没写',
      gender: 0,
      region: '',
      totalExp: 0,
      level: 1,
      coins: 20,
      cuisineTitles: [],
      badges: [],
      stats: {
        recipeCount: 0,
        postCount: 0,
        likeReceived: 0,
        coinReceived: 0,
        followingCount: 0,
        followerCount: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const { _id } = await db.collection('users').add({ data: newUser });
    newUser._id = _id;

    return {
      success: true,
      isNewUser: true,
      user: newUser
    };
  } catch (err) {
    console.error('[login] 登录失败:', err);
    return { success: false, error: err.message };
  }
};
