// cloudfunctions/initMockData/index.js
// 上线前一次性灌入测试数据
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MOCK_POSTS = [
  { title:'周末羽毛球局，来一起挥洒汗水！', category:'🏸羽毛球', activityTime:'本周六 14:00-16:00', location:'朝阳区·朝阳公园羽毛球馆', coverImages:['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80','https://images.unsplash.com/photo-1613918431703-aa50889e3be9?w=800&q=80'], content:'欢迎初中级球友，新手也可！自带球拍，场地费AA。', tags:['羽毛球','朝阳公园'], targetCount:6, currentCount:2 },
  { title:'微恐推理本《阿卡姆疯人院》缺一女，速拼', category:'🎭剧本杀', activityTime:'明天 19:30 开始', location:'望京·谜岛剧本杀', coverImages:['https://images.unsplash.com/photo-1585504198199-20277593b94f?w=800&q=80'], content:'还差1个妹子发车啦！新手友好，DM很专业。', tags:['剧本杀','望京'], targetCount:5, currentCount:3 },
  { title:'京郊百望山轻松徒步，适合小白', category:'🏕️徒步', activityTime:'周日 09:00 集合', location:'海淀区·百望山森林公园', coverImages:['https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=80'], content:'全程约8公里，爬升不大，沿途风景超好，认识新朋友。', tags:['徒步','百望山'], targetCount:10, currentCount:4 },
  { title:'周五晚KTV局，来唱歌释放压力！', category:'🎤KTV', activityTime:'周五 19:00-22:00', location:'朝阳区·纯K(三里屯店)', coverImages:['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80'], content:'周末前的狂欢，人均60元，酒水AA。', tags:['KTV','三里屯'], targetCount:8, currentCount:5 },
  { title:'篮球3v3周末对抗赛，找个场子', category:'🏀篮球', activityTime:'周日 16:00-18:00', location:'东城区·地坛体育中心', coverImages:['https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80'], content:'3缺3，水平不重要，主要是运动出汗。', tags:['篮球','地坛'], targetCount:6, currentCount:3 },
  { title:'王者荣耀开黑车队，钻石以上进', category:'🎮桌游', activityTime:'每晚 20:00 在线', location:'线上', coverImages:['https://images.unsplash.com/photo-1542751110-97427bbecf20?w=800&q=80'], content:'固定车队缺1人，主打配合，不喷人。', tags:['王者荣耀','线上'], targetCount:5, currentCount:3 },
  { title:'周末瑜伽体验课，初学者友好', category:'🧘瑜伽', activityTime:'周六 10:00-11:30', location:'朝阳区·静心瑜伽馆', coverImages:['https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80'], content:'专业瑜伽老师指导，提供瑜伽垫，放松身心。', tags:['瑜伽','体验课'], targetCount:10, currentCount:6 },
  { title:'寻找美食探店搭子，本周六出发', category:'🍜美食', activityTime:'周六 11:30', location:'东城区·簋街', coverImages:['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'], content:'一起探索簋街美食，人均预算100以内，AA制。', tags:['美食','簋街'], targetCount:4, currentCount:2 },
  { title:'狼人杀新手教学局，只教不喷', category:'🎭剧本杀', activityTime:'周三 19:00-22:00', location:'海淀区·中关村创业咖啡', coverImages:['https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&q=80'], content:'纯新手教学局，有资深玩家手把手教，体验推理乐趣。', tags:['狼人杀','新手'], targetCount:12, currentCount:1 },
  { title:'冬季滑雪一日游，北京出发', category:'🏕️徒步', activityTime:'下周六 06:00 出发', location:'延庆·八达岭滑雪场', coverImages:['https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=800&q=80'], content:'包车出发，含门票租赁，420元/人。', tags:['滑雪','延庆'], targetCount:20, currentCount:1 },
];

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  var ADMIN = ['']; // TODO: 填入管理员的 openid
  if (ADMIN.length > 0 && ADMIN.indexOf(OPENID) === -1) {
    return { success: false, error: '无权限' };
  }
  const now = new Date();

  // 先获取/创建测试用户
  var testUser = OPENID;
  if (!testUser) {
    const { data } = await db.collection('users').limit(1).get();
    if (data.length > 0) testUser = data[0]._openid;
    else return { success: false, error: '无可用用户，请先登录一次' };
  }

  const results = [];
  for (var i = 0; i < MOCK_POSTS.length; i++) {
    const p = MOCK_POSTS[i];
    try {
      const d = new Date(now.getTime() - (MOCK_POSTS.length - i) * 3600000); // 每条间隔1小时
      await db.collection('posts').add({
        data: {
          title: p.title, category: p.category,
          activityTime: p.activityTime, location: p.location,
          coverImages: p.coverImages, content: p.content,
          tags: p.tags || [], targetCount: p.targetCount, currentCount: p.currentCount,
          owner_show_wechat: true, contact_info: '',
          stats: { likeCount: 0, commentCount: 0, viewCount: 0, coinCount: 0 },
          status: 'recruiting', audit_status: 'pass',
          createdAt: d, updatedAt: d,
          _openid: testUser
        }
      });
      results.push({ title: p.title, status: 'ok' });
    } catch (e) {
      results.push({ title: p.title, status: e.message });
    }
  }

  return { success: true, count: results.length, results: results };
};
