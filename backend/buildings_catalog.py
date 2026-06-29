"""网站中出现的全部古建景点及诗词检索关键词。"""

from __future__ import annotations

# 来源：index.html BUILDINGS_DB、explore.html ALL_BUILDING_NAMES、
# gugong-explore.html 北京六处、index.html 省份代表建筑
# 注意：已移除「桥」「关」「城」等单字泛词，避免词牌名（如《鹊桥仙》）误匹配

BUILDINGS_CATALOG: list[dict] = [
    # ── 北京（地图详页 + 故宫探秘长卷六处）──
    {"name": "北京故宫", "province": "北京", "category": "皇宫", "aliases": ["故宫", "紫禁城"], "keywords": ["故宫", "紫禁城", "丹陛", "太和", "金銮", "午门", "神武", "乾清", "坤宁", "内廷", "华盖", "御花园", "神京", "帝宅", "皇居", "绮殿"]},
    {"name": "故宫", "province": "北京", "category": "皇宫", "aliases": ["北京故宫"], "keywords": ["故宫", "紫禁城", "丹陛", "太和", "金銮", "神京"]},
    {"name": "北京四合院", "province": "北京", "category": "民居", "aliases": ["四合院"], "keywords": ["四合", "深院", "宅院", "庭院", "胡同", "深宅", "朱门", "侯门"]},
    {"name": "四合院", "province": "北京", "category": "民居", "aliases": ["北京四合院"], "keywords": ["四合", "深院", "宅院", "庭院", "胡同", "深宅"]},
    {"name": "卢沟桥", "province": "北京", "category": "桥梁", "aliases": ["卢沟", "卢沟晓月"], "keywords": ["卢沟", "晓月", "永定", "桑乾"]},
    {"name": "颐和园", "province": "北京", "category": "园林", "aliases": ["清漪园"], "keywords": ["颐和", "昆明", "万寿", "清漪", "玉泉", "池馆", "园林"]},
    {"name": "恭王府", "province": "北京", "category": "王府", "aliases": ["和绅府"], "keywords": ["恭王", "王府", "邸第", "台榭", "园林"]},
    {"name": "万宁桥", "province": "北京", "category": "桥梁", "aliases": ["后门桥"], "keywords": ["万宁", "玉河", "后门"]},
    {"name": "宛平城", "province": "北京", "category": "城池", "aliases": ["宛平"], "keywords": ["宛平", "卢沟", "长城", "烽火", "城关", "城楼"]},
    # ── 山西 ──
    {"name": "乔家大院", "province": "山西", "category": "民居", "aliases": ["乔家"], "keywords": ["乔家", "晋商", "深院", "大院", "朱门"]},
    {"name": "霍州署", "province": "山西", "category": "官府", "aliases": ["霍州衙署"], "keywords": ["霍州", "官衙", "府衙", "台阁"]},
    {"name": "鱼沼飞梁", "province": "山西", "category": "桥梁", "aliases": ["晋祠飞梁"], "keywords": ["晋祠", "飞梁", "鱼沼"]},
    {"name": "平遥古城墙", "province": "山西", "category": "城墙", "aliases": ["平遥"], "keywords": ["平遥", "古城", "城墙", "城垣"]},
    # ── 江苏 ──
    {"name": "苏州拙政园", "province": "江苏", "category": "园林", "aliases": ["拙政园"], "keywords": ["拙政", "姑苏", "苏州", "园林", "亭台", "水榭"]},
    {"name": "淮安府衙", "province": "江苏", "category": "官府", "aliases": ["淮安府"], "keywords": ["淮安", "府衙", "衙署", "官衙", "漕运", "运河"]},
    {"name": "宝带桥", "province": "江苏", "category": "桥梁", "aliases": [], "keywords": ["宝带"]},
    {"name": "周庄民居", "province": "江苏", "category": "民居", "aliases": ["周庄"], "keywords": ["周庄", "江南", "水乡", "民居", "粉墙", "临水", "深宅"]},
    # ── 四川 ──
    {"name": "阆中古城民居", "province": "四川", "category": "民居", "aliases": ["阆中"], "keywords": ["阆中", "古城", "民居"]},
    {"name": "泸州龙脑桥", "province": "四川", "category": "桥梁", "aliases": ["龙脑桥"], "keywords": ["泸州", "龙脑"]},
    {"name": "泸定桥", "province": "四川", "category": "桥梁", "aliases": ["大渡河铁索桥"], "keywords": ["泸定", "大渡"]},
    # ── 广东 ──
    {"name": "陈家祠", "province": "广东", "category": "祠堂", "aliases": ["陈氏书院", "陈家书院"], "keywords": ["陈家", "陈氏", "祠堂", "宗祠", "书院", "岭南"]},
    {"name": "潮州广济桥", "province": "广东", "category": "桥梁", "aliases": ["湘子桥", "广济桥"], "keywords": ["潮州", "广济", "湘子", "韩江", "恶溪"]},
    {"name": "开平碉楼", "province": "广东", "category": "民居", "aliases": ["碉楼"], "keywords": ["开平", "碉楼", "侨乡"]},
    # ── 探索长卷其它代表建筑 ──
    {"name": "佛光寺东大殿", "province": "山西", "category": "佛寺", "aliases": ["佛光寺"], "keywords": ["佛光", "五台山", "东大殿", "斗拱", "木构"]},
    {"name": "独乐寺观音阁", "province": "天津", "category": "佛寺", "aliases": ["独乐寺"], "keywords": ["独乐", "观音阁", "观音", "蓟州"]},
    {"name": "应县木塔", "province": "山西", "category": "佛塔", "aliases": ["释迦塔"], "keywords": ["应县", "木塔", "释迦", "佛宫", "梵宫"]},
    # ── 省份地图代表建筑（index.html PROVINCE_INFO）──
    {"name": "玉皇阁", "province": "河北", "category": "道观", "aliases": [], "keywords": ["玉皇", "道观", "玄帝"]},
    {"name": "嘉峪关", "province": "甘肃", "category": "关隘", "aliases": ["嘉峪"], "keywords": ["嘉峪", "长城", "烽", "塞", "阳关", "玉门"]},
    {"name": "河海津门", "province": "天津", "category": "城市", "aliases": ["天津"], "keywords": ["津门", "海河", "漕运"]},
    {"name": "伪满皇宫", "province": "吉林", "category": "皇宫", "aliases": [], "keywords": ["皇宫", "禁城"]},
    {"name": "喀喇沁亲王府", "province": "内蒙古", "category": "王府", "aliases": ["亲王府"], "keywords": ["亲王府", "王府", "蒙古"]},
    {"name": "青州古城", "province": "山东", "category": "古城", "aliases": ["青州"], "keywords": ["青州", "古城"]},
    {"name": "应天门", "province": "河南", "category": "宫门", "aliases": [], "keywords": ["应天", "天门", "阙"]},
    {"name": "秦王宫", "province": "陕西", "category": "宫殿", "aliases": ["阿房"], "keywords": ["阿房", "秦宫", "章台", "咸阳"]},
    {"name": "丹噶尔古城", "province": "青海", "category": "古城", "aliases": [], "keywords": ["丹噶尔", "古城", "茶马"]},
    {"name": "约特干故城", "province": "新疆", "category": "故城", "aliases": [], "keywords": ["约特干", "故城", "西域", "楼兰", "高昌"]},
    {"name": "花戏楼", "province": "安徽", "category": "戏楼", "aliases": [], "keywords": ["花戏", "戏楼"]},
    {"name": "东阳卢宅", "province": "浙江", "category": "民居", "aliases": ["卢宅"], "keywords": ["东阳", "卢宅", "民居", "祠堂"]},
    {"name": "海派里弄", "province": "上海", "category": "民居", "aliases": ["里弄"], "keywords": ["里弄", "石库门", "沪"]},
    {"name": "滕王阁", "province": "江西", "category": "楼阁", "aliases": [], "keywords": ["滕王阁", "滕王", "洪州", "赣江", "高阁"]},
    {"name": "黄鹤楼", "province": "湖北", "category": "楼阁", "aliases": [], "keywords": ["黄鹤楼", "黄鹤", "汉阳", "长江", "鹦鹉洲"]},
    {"name": "凤凰古城", "province": "湖南", "category": "古城", "aliases": ["凤凰"], "keywords": ["凤凰", "古城", "沱江", "吊脚"]},
    {"name": "福建土楼", "province": "福建", "category": "民居", "aliases": ["土楼"], "keywords": ["土楼", "土寨", "围屋", "客家"]},
    {"name": "石宝寨", "province": "重庆", "category": "寨", "aliases": [], "keywords": ["石宝", "寨", "长江"]},
    {"name": "双龙桥", "province": "云南", "category": "桥梁", "aliases": [], "keywords": ["双龙"]},
    {"name": "沱江吊脚楼", "province": "贵州", "category": "民居", "aliases": ["吊脚楼"], "keywords": ["吊脚", "沱江", "苗", "侗", "风雨"]},
    {"name": "风雨桥", "province": "广西", "category": "桥梁", "aliases": [], "keywords": ["风雨桥", "风雨", "侗", "鼓楼"]},
    {"name": "罗驿古村", "province": "海南", "category": "古村", "aliases": [], "keywords": ["罗驿", "古村", "驿", "琼", "椰"]},
    {"name": "竹堑城", "province": "台湾", "category": "城池", "aliases": [], "keywords": ["竹堑", "城垣"]},
]
