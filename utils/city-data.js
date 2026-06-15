// 全国城市数据（拼音首字母索引）
var HOT = ['全国','北京','上海','广州','深圳','杭州','成都','重庆','武汉','西安','南京','天津'];

var ALL = [
  {n:'全国',p:'quanguo'},{n:'北京',p:'beijing'},{n:'上海',p:'shanghai'},{n:'广州',p:'guangzhou'},
  {n:'深圳',p:'shenzhen'},{n:'杭州',p:'hangzhou'},{n:'成都',p:'chengdu'},{n:'重庆',p:'chongqing'},
  {n:'武汉',p:'wuhan'},{n:'西安',p:'xian'},{n:'南京',p:'nanjing'},{n:'天津',p:'tianjin'},
  {n:'苏州',p:'suzhou'},{n:'长沙',p:'changsha'},{n:'郑州',p:'zhengzhou'},{n:'东莞',p:'dongguan'},
  {n:'青岛',p:'qingdao'},{n:'沈阳',p:'shenyang'},{n:'宁波',p:'ningbo'},{n:'昆明',p:'kunming'},
  {n:'大连',p:'dalian'},{n:'厦门',p:'xiamen'},{n:'合肥',p:'hefei'},{n:'福州',p:'fuzhou'},
  {n:'无锡',p:'wuxi'},{n:'佛山',p:'foshan'},{n:'济南',p:'jinan'},{n:'哈尔滨',p:'haerbin'},
  {n:'长春',p:'changchun'},{n:'温州',p:'wenzhou'},{n:'石家庄',p:'shijiazhuang'},{n:'泉州',p:'quanzhou'},
  {n:'南宁',p:'nanning'},{n:'贵阳',p:'guiyang'},{n:'南昌',p:'nanchang'},{n:'太原',p:'taiyuan'},
  {n:'烟台',p:'yantai'},{n:'嘉兴',p:'jiaxing'},{n:'绍兴',p:'shaoxing'},{n:'海口',p:'haikou'},
  {n:'珠海',p:'zhuhai'},{n:'惠州',p:'huizhou'},{n:'中山',p:'zhongshan'},{n:'兰州',p:'lanzhou'},
  {n:'乌鲁木齐',p:'wulumuqi'},{n:'呼和浩特',p:'huhehaote'},{n:'银川',p:'yinchuan'},{n:'西宁',p:'xining'},
  {n:'拉萨',p:'lasa'},{n:'三亚',p:'sanya'},{n:'澳门',p:'aomen'},{n:'香港',p:'xianggang'},
  {n:'台北',p:'taibei'},{n:'唐山',p:'tangshan'},{n:'保定',p:'baoding'},{n:'邯郸',p:'handan'},
  {n:'廊坊',p:'langfang'},{n:'沧州',p:'cangzhou'},{n:'秦皇岛',p:'qinhuangdao'},{n:'张家口',p:'zhangjiakou'},
  {n:'承德',p:'chengde'},{n:'邢台',p:'xingtai'},{n:'衡水',p:'hengshui'},{n:'大同',p:'datong'},
  {n:'长治',p:'changzhi'},{n:'临汾',p:'linfen'},{n:'运城',p:'yuncheng'},{n:'赤峰',p:'chifeng'},
  {n:'通辽',p:'tongliao'},{n:'鄂尔多斯',p:'eerduosi'},{n:'包头',p:'baotou'},{n:'鞍山',p:'anshan'},
  {n:'抚顺',p:'fushun'},{n:'锦州',p:'jinzhou'},{n:'营口',p:'yingkou'},{n:'盘锦',p:'panjin'},
  {n:'丹东',p:'dandong'},{n:'吉林市',p:'jilinshi'},{n:'大庆',p:'daqing'},{n:'齐齐哈尔',p:'qiqihaer'},
  {n:'牡丹江',p:'mudanjiang'},{n:'佳木斯',p:'jiamusi'},{n:'常州',p:'changzhou'},{n:'南通',p:'nantong'},
  {n:'徐州',p:'xuzhou'},{n:'扬州',p:'yangzhou'},{n:'镇江',p:'zhenjiang'},{n:'泰州',p:'taizhou'},
  {n:'盐城',p:'yancheng'},{n:'连云港',p:'lianyungang'},{n:'淮安',p:'huaian'},{n:'宿迁',p:'suqian'},
  {n:'湖州',p:'huzhou'},{n:'金华',p:'jinhua'},{n:'衢州',p:'quzhou'},{n:'舟山',p:'zhoushan'},
  {n:'台州',p:'taizhou'},{n:'丽水',p:'lishui'},{n:'义乌',p:'yiwu'},{n:'芜湖',p:'wuhu'},
  {n:'蚌埠',p:'bengbu'},{n:'马鞍山',p:'maanshan'},{n:'安庆',p:'anqing'},{n:'阜阳',p:'fuyang'},
  {n:'莆田',p:'putian'},{n:'漳州',p:'zhangzhou'},{n:'龙岩',p:'longyan'},{n:'三明',p:'sanming'},
  {n:'南平',p:'nanping'},{n:'宁德',p:'ningde'},{n:'九江',p:'jiujiang'},{n:'赣州',p:'ganzhou'},
  {n:'上饶',p:'shangrao'},{n:'宜春',p:'yichun'},{n:'吉安',p:'jian'},{n:'景德镇',p:'jingdezhen'},
  {n:'淄博',p:'zibo'},{n:'潍坊',p:'weifang'},{n:'临沂',p:'linyi'},{n:'济宁',p:'jining'},
  {n:'泰安',p:'taian'},{n:'威海',p:'weihai'},{n:'日照',p:'rizhao'},{n:'滨州',p:'binzhou'},
  {n:'德州',p:'dezhou'},{n:'聊城',p:'liaocheng'},{n:'菏泽',p:'heze'},{n:'枣庄',p:'zaozhuang'},
  {n:'洛阳',p:'luoyang'},{n:'开封',p:'kaifeng'},{n:'南阳',p:'nanyang'},{n:'新乡',p:'xinxiang'},
  {n:'安阳',p:'anyang'},{n:'商丘',p:'shangqiu'},{n:'信阳',p:'xinyang'},{n:'许昌',p:'xuchang'},
  {n:'焦作',p:'jiaozuo'},{n:'濮阳',p:'puyang'},{n:'漯河',p:'luohe'},{n:'宜昌',p:'yichang'},
  {n:'襄阳',p:'xiangyang'},{n:'荆州',p:'jingzhou'},{n:'黄冈',p:'huanggang'},{n:'十堰',p:'shiyan'},
  {n:'孝感',p:'xiaogan'},{n:'荆门',p:'jingmen'},{n:'咸宁',p:'xianning'},{n:'株洲',p:'zhuzhou'},
  {n:'湘潭',p:'xiangtan'},{n:'衡阳',p:'hengyang'},{n:'岳阳',p:'yueyang'},{n:'常德',p:'changde'},
  {n:'邵阳',p:'shaoyang'},{n:'郴州',p:'chenzhou'},{n:'永州',p:'yongzhou'},{n:'怀化',p:'huaihua'},
  {n:'韶关',p:'shaoguan'},{n:'汕头',p:'shantou'},{n:'江门',p:'jiangmen'},{n:'湛江',p:'zhanjiang'},
  {n:'茂名',p:'maoming'},{n:'肇庆',p:'zhaoqing'},{n:'梅州',p:'meizhou'},{n:'阳江',p:'yangjiang'},
  {n:'清远',p:'qingyuan'},{n:'潮州',p:'chaozhou'},{n:'揭阳',p:'jieyang'},{n:'汕尾',p:'shanwei'},
  {n:'柳州',p:'liuzhou'},{n:'桂林',p:'guilin'},{n:'北海',p:'beihai'},{n:'梧州',p:'wuzhou'},
  {n:'玉林',p:'yulin'},{n:'三亚',p:'sanya'},{n:'儋州',p:'danzhou'},{n:'绵阳',p:'mianyang'},
  {n:'德阳',p:'deyang'},{n:'宜宾',p:'yibin'},{n:'泸州',p:'luzhou'},{n:'南充',p:'nanchong'},
  {n:'乐山',p:'leshan'},{n:'达州',p:'dazhou'},{n:'自贡',p:'zigong'},{n:'攀枝花',p:'panzhihua'},
  {n:'广元',p:'guangyuan'},{n:'遂宁',p:'suining'},{n:'内江',p:'neijiang'},{n:'眉山',p:'meishan'},
  {n:'广安',p:'guangan'},{n:'巴中',p:'bazhong'},{n:'遵义',p:'zunyi'},{n:'六盘水',p:'liupanshui'},
  {n:'安顺',p:'anshun'},{n:'毕节',p:'bijie'},{n:'铜仁',p:'tongren'},{n:'曲靖',p:'qujing'},
  {n:'玉溪',p:'yuxi'},{n:'保山',p:'baoshan'},{n:'昭通',p:'zhaotong'},{n:'丽江',p:'lijiang'},
  {n:'大理',p:'dali'},{n:'普洱',p:'puer'},{n:'临沧',p:'lincang'},{n:'咸阳',p:'xianyang'},
  {n:'宝鸡',p:'baoji'},{n:'渭南',p:'weinan'},{n:'汉中',p:'hanzhong'},{n:'榆林',p:'yulin'},
  {n:'延安',p:'yanan'},{n:'安康',p:'ankang'},{n:'天水',p:'tianshui'},{n:'白银',p:'baiyin'},
  {n:'酒泉',p:'jiuquan'},{n:'嘉峪关',p:'jiayuguan'},{n:'西昌',p:'xichang'},{n:'日喀则',p:'rikaze'},
  {n:'昌都',p:'changdu'},{n:'林芝',p:'linzhi'},{n:'石嘴山',p:'zuishan'},{n:'吴忠',p:'wuzhong'},
  {n:'固原',p:'guyuan'},{n:'克拉玛依',p:'kelamayi'},{n:'吐鲁番',p:'tulufan'},{n:'哈密',p:'hami'},
  {n:'库尔勒',p:'kuerle'},{n:'伊宁',p:'yining'}
];

// 按首字母分组
var groups = {};
ALL.forEach(function(c){
  var k = c.p.charAt(0).toUpperCase();
  if (!groups[k]) groups[k] = [];
  groups[k].push(c);
});
var indexList = Object.keys(groups).sort();

module.exports = { HOT: HOT, ALL: ALL, GROUPS: groups, INDEXLIST: indexList };
